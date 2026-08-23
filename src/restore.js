const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const AdmZip=require("adm-zip");
const Database=require("better-sqlite3");
const {numberSetting}=require("./config");

const projectRoot=path.join(__dirname,"..");
const storageRoot=process.env.STORAGE_ROOT?path.resolve(process.env.STORAGE_ROOT):projectRoot;
const dataDir=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(storageRoot,"data");
const uploadsDir=process.env.UPLOADS_DIR?path.resolve(process.env.UPLOADS_DIR):path.join(storageRoot,"uploads");
const dbPath=process.env.DB_PATH?path.resolve(process.env.DB_PATH):path.join(dataDir,"wedding.db");
const restoreRoot=path.join(storageRoot,"restore-pending");
const markerPath=path.join(restoreRoot,"restore.json");
const stagedDbPath=path.join(restoreRoot,"wedding.db");
const stagedUploadsDir=path.join(restoreRoot,"uploads");
fs.mkdirSync(dataDir,{recursive:true});

const requiredTables=["users","events","guests","rsvps","photos","backup_records"];

function sha256Buffer(buffer){return crypto.createHash("sha256").update(buffer).digest("hex");}
function removeIfExists(target){try{fs.rmSync(target,{recursive:true,force:true});}catch{}}
function safeUploadRelative(entryName){
  const normalized=String(entryName||"").replace(/\\/g,"/");
  if(!normalized.startsWith("uploads/")||normalized.endsWith("/"))return "";
  const relative=normalized.slice("uploads/".length);
  if(!relative||relative.startsWith("/")||relative.split("/").some(part=>!part||part==="."||part===".."))return "";
  return relative;
}

function safeUploadDirectory(entryName){
  const normalized=String(entryName||"").replace(/\\/g,"/");
  if(!normalized.startsWith("uploads/")||!normalized.endsWith("/"))return false;
  const relative=normalized.slice("uploads/".length,-1);
  return !relative||!relative.startsWith("/")&&!relative.split("/").some(part=>!part||part==="."||part==="..");
}

function inspectDatabase(databasePath,{production=process.env.NODE_ENV==="production"}={}){
  const snapshot=new Database(databasePath);
  try{
    const integrity=snapshot.pragma("integrity_check",{simple:true});
    if(integrity!=="ok")throw Object.assign(new Error(`La base no pasó la verificación SQLite: ${integrity}`),{code:"RESTORE_DB_INTEGRITY"});
    const tables=new Set(snapshot.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
    const missing=requiredTables.filter(table=>!tables.has(table));
    if(missing.length)throw Object.assign(new Error(`El respaldo no contiene las tablas requeridas: ${missing.join(", ")}.`),{code:"RESTORE_SCHEMA_INVALID"});

    let disabledDemoAccounts=0;
    if(production&&tables.has("users")){
      const columns=new Set(snapshot.prepare("PRAGMA table_info(users)").all().map(row=>row.name));
      const conditions=["lower(email) LIKE '%@eventstudio.local'","lower(email) LIKE '%@demo.eventstudio.local'"];
      if(columns.has("auth_provider"))conditions.push("lower(COALESCE(auth_provider,''))='demo'");
      if(columns.has("login_identifier"))conditions.push("lower(COALESCE(login_identifier,'')) LIKE 'demo%'");
      const configured=String(process.env.DEMO_ACCOUNT_EMAILS||"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean);
      if(configured.length){
        const placeholders=configured.map(()=>"?").join(",");
        conditions.push(`lower(email) IN (${placeholders})`);
      }
      const sql=`UPDATE users SET active=0 WHERE ${conditions.join(" OR ")}`;
      disabledDemoAccounts=snapshot.prepare(sql).run(...configured).changes;
      if(disabledDemoAccounts&&tables.has("sessions"))snapshot.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE active=0)").run();
    }
    snapshot.pragma("wal_checkpoint(TRUNCATE)");
    return {integrity,tables:[...tables],disabledDemoAccounts};
  }finally{snapshot.close();}
}

function inspectBackup(zipPath,{stage=false}={}){
  let zip;
  try{zip=new AdmZip(zipPath);}catch{
    throw Object.assign(new Error("El archivo no es un ZIP de respaldo válido."),{code:"RESTORE_ZIP_INVALID"});
  }
  const entries=zip.getEntries();
  const maxEntries=numberSetting("MAX_RESTORE_FILES",10000,{min:10,max:100000,integer:true});
  if(entries.length>maxEntries){
    throw Object.assign(new Error("El respaldo contiene demasiadas entradas."),{code:"RESTORE_FILE_COUNT_LIMIT"});
  }
  const normalizedNames=entries.map(entry=>String(entry.entryName||"").replace(/\\/g,"/"));
  if(new Set(normalizedNames).size!==normalizedNames.length){
    throw Object.assign(new Error("El respaldo contiene rutas duplicadas."),{code:"RESTORE_DUPLICATE_ENTRY"});
  }
  const unexpected=normalizedNames.find(name=>
    !["manifest.json","data/wedding.db"].includes(name)
    &&!safeUploadRelative(name)
    &&!safeUploadDirectory(name)
  );
  if(unexpected){
    throw Object.assign(new Error("El respaldo contiene una ruta no permitida."),{code:"RESTORE_ENTRY_NOT_ALLOWED"});
  }
  const maxUnpackedBytes=numberSetting("MAX_RESTORE_UNPACKED_MB",8192,{min:256,max:32768})*1024*1024;
  const unpackedBytes=entries.reduce((total,entry)=>{
    const size=Number(entry.header?.size||0);
    if(!Number.isSafeInteger(size)||size<0){
      throw Object.assign(new Error("El respaldo declara un tamaño de entrada inválido."),{code:"RESTORE_ENTRY_SIZE_INVALID"});
    }
    return total+size;
  },0);
  if(unpackedBytes>maxUnpackedBytes){
    throw Object.assign(new Error("El contenido descomprimido excede el límite seguro configurado."),{code:"RESTORE_UNPACKED_LIMIT"});
  }
  const entryNames=new Set(entries.map(entry=>String(entry.entryName||"").replace(/\\/g,"/")));
  if(!entryNames.has("manifest.json")||!entryNames.has("data/wedding.db")){
    throw Object.assign(new Error("El ZIP debe contener manifest.json y data/wedding.db."),{code:"RESTORE_CONTENT_MISSING"});
  }
  let manifest;
  try{manifest=JSON.parse(zip.readAsText("manifest.json"));}catch{
    throw Object.assign(new Error("El manifiesto del respaldo no es válido."),{code:"RESTORE_MANIFEST_INVALID"});
  }
  if(!["eventstudio-backup-v1","eventstudio-backup-v2"].includes(manifest.format)||manifest.database!=="data/wedding.db"){
    throw Object.assign(new Error("El formato del respaldo no es compatible con EventStudio."),{code:"RESTORE_FORMAT_UNSUPPORTED"});
  }
  const databaseBuffer=zip.readFile("data/wedding.db");
  if(!databaseBuffer?.length)throw Object.assign(new Error("La base del respaldo está vacía."),{code:"RESTORE_DB_EMPTY"});
  const digest=sha256Buffer(databaseBuffer);
  if(manifest.databaseSha256&&manifest.databaseSha256!==digest){
    throw Object.assign(new Error("La huella de la base no coincide con el manifiesto."),{code:"RESTORE_CHECKSUM_MISMATCH"});
  }

  const validationDir=fs.mkdtempSync(path.join(dataDir,"restore-check-"));
  const validationDb=path.join(validationDir,"wedding.db");
  try{
    fs.writeFileSync(validationDb,databaseBuffer,{flag:"wx"});
    const database=inspectDatabase(validationDb);
    const uploadEntries=entries.filter(entry=>safeUploadRelative(entry.entryName));
    const summary={
      format:manifest.format,
      createdAt:manifest.createdAt||null,
      appVersion:manifest.appVersion||null,
      databaseSha256:digest,
      databaseBytes:databaseBuffer.length,
      unpackedBytes,
      uploadFiles:uploadEntries.length,
      disabledDemoAccounts:database.disabledDemoAccounts
    };
    if(stage){
      let createdRestoreRoot=false;
      try{
        fs.mkdirSync(restoreRoot);createdRestoreRoot=true;
        fs.mkdirSync(stagedUploadsDir,{recursive:true});
        fs.copyFileSync(validationDb,stagedDbPath);
        for(const entry of uploadEntries){
          const relative=safeUploadRelative(entry.entryName);
          const destination=path.join(stagedUploadsDir,...relative.split("/"));
          const resolved=path.resolve(destination);
          if(!resolved.startsWith(`${path.resolve(stagedUploadsDir)}${path.sep}`))continue;
          fs.mkdirSync(path.dirname(destination),{recursive:true});
          fs.writeFileSync(destination,entry.getData());
        }
        fs.writeFileSync(markerPath,JSON.stringify({...summary,stagedAt:new Date().toISOString()},null,2));
      }catch(error){
        if(createdRestoreRoot)removeIfExists(restoreRoot);
        if(error.code==="EEXIST")throw Object.assign(new Error("Ya existe una restauración pendiente de reinicio."),{code:"RESTORE_ALREADY_PENDING"});
        throw error;
      }
    }
    return summary;
  }finally{removeIfExists(validationDir);}
}

function stageRestore(zipPath,metadata={}){
  const summary=inspectBackup(zipPath,{stage:true});
  fs.writeFileSync(markerPath,JSON.stringify({...JSON.parse(fs.readFileSync(markerPath,"utf8")),...metadata},null,2));
  return summary;
}

function applyPendingRestoreSync(){
  if(!fs.existsSync(markerPath))return null;
  if(!fs.existsSync(stagedDbPath))throw new Error("Existe una restauración pendiente sin base validada.");
  fs.mkdirSync(dataDir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  const previousDb=`${dbPath}.before-restore-${stamp}`;
  const incomingDb=`${dbPath}.restore-new`;
  removeIfExists(incomingDb);
  fs.copyFileSync(stagedDbPath,incomingDb);
  inspectDatabase(incomingDb);
  for(const suffix of ["-wal","-shm"]){removeIfExists(`${dbPath}${suffix}`);}
  if(fs.existsSync(dbPath))fs.renameSync(dbPath,previousDb);
  fs.renameSync(incomingDb,dbPath);

  if(fs.existsSync(stagedUploadsDir)){
    const previousUploads=`${uploadsDir}.before-restore-${stamp}`;
    if(fs.existsSync(uploadsDir))fs.renameSync(uploadsDir,previousUploads);
    fs.renameSync(stagedUploadsDir,uploadsDir);
  }
  const marker=JSON.parse(fs.readFileSync(markerPath,"utf8"));
  if(marker.rollback?.filename){
    const rollbackFile=path.join(storageRoot,"backups",path.basename(marker.rollback.filename));
    if(fs.existsSync(rollbackFile)){
      const restored=new Database(dbPath);
      try{
        restored.prepare(`
          INSERT OR IGNORE INTO backup_records(filename,relative_path,size_bytes,checksum_sha256,status,created_by)
          VALUES(?,?,?,?, 'ready',NULL)
        `).run(marker.rollback.filename,marker.rollback.filename,Number(marker.rollback.sizeBytes||fs.statSync(rollbackFile).size),marker.rollback.checksumSha256||null);
        if(restored.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'").get()){
          restored.prepare("INSERT INTO audit_logs(actor_user_id,event_id,action,target_type,target_id,metadata_json) VALUES(NULL,NULL,'backup.restore_completed','backup',?,?)")
            .run(marker.rollback.filename,JSON.stringify({sourceVersion:marker.appVersion||null,rollbackFilename:marker.rollback.filename}));
        }
      }finally{restored.close();}
    }
  }
  removeIfExists(restoreRoot);
  return {...marker,previousDb};
}

module.exports={inspectBackup,stageRestore,applyPendingRestoreSync,restoreRoot,markerPath};
