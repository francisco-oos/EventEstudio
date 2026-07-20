const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const archiver=require("archiver");
const db=require("./db");

const root=path.join(__dirname,"..");
const storageRoot=process.env.STORAGE_ROOT?path.resolve(process.env.STORAGE_ROOT):root;
const dataDir=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(storageRoot,"data");
const uploadsDir=process.env.UPLOADS_DIR?path.resolve(process.env.UPLOADS_DIR):path.join(storageRoot,"uploads");
const backupsDir=process.env.BACKUPS_DIR?path.resolve(process.env.BACKUPS_DIR):path.join(storageRoot,"backups");
const retention=Math.max(1,Number(process.env.BACKUP_RETENTION||14));
fs.mkdirSync(backupsDir,{recursive:true});

function checksum(file){
  return new Promise((resolve,reject)=>{
    const hash=crypto.createHash("sha256");
    fs.createReadStream(file).on("data",chunk=>hash.update(chunk)).on("error",reject).on("end",()=>resolve(hash.digest("hex")));
  });
}

function zipArchive(destination,snapshot,manifest){
  return new Promise((resolve,reject)=>{
    const output=fs.createWriteStream(destination,{flags:"wx"});
    const archive=archiver("zip",{zlib:{level:9}});
    output.on("close",resolve);
    output.on("error",reject);
    archive.on("error",reject);
    archive.pipe(output);
    archive.file(snapshot,{name:"data/wedding.db"});
    if(fs.existsSync(uploadsDir))archive.directory(uploadsDir,"uploads");
    archive.append(JSON.stringify(manifest,null,2),{name:"manifest.json"});
    archive.finalize();
  });
}

function enforceRetention(){
  const rows=db.prepare("SELECT * FROM backup_records WHERE status='ready' ORDER BY created_at DESC,id DESC").all();
  for(const row of rows.slice(retention)){
    const file=path.join(backupsDir,path.basename(row.relative_path));
    try{fs.unlinkSync(file);}catch{}
    db.prepare("DELETE FROM backup_records WHERE id=?").run(row.id);
  }
}

async function createBackup(userId,metadata={}){
  const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  const filename=`eventstudio-backup-${stamp}-${crypto.randomBytes(3).toString("hex")}.zip`;
  const relativePath=filename;
  const destination=path.join(backupsDir,filename);
  const snapshot=path.join(dataDir,`.backup-${process.pid}-${Date.now()}.db`);
  const record=db.prepare("INSERT INTO backup_records(filename,relative_path,status,created_by) VALUES(?,?,'creating',?)")
    .run(filename,relativePath,userId||null);
  try{
    await db.backup(snapshot);
    const checkDb=new (require("better-sqlite3"))(snapshot,{readonly:true});
    const integrity=checkDb.pragma("integrity_check",{simple:true});
    checkDb.close();
    if(integrity!=="ok")throw new Error(`La copia SQLite no pasó la verificación: ${integrity}`);
    const manifest={
      format:"eventstudio-backup-v1",createdAt:new Date().toISOString(),appVersion:require("../package.json").version,
      database:"data/wedding.db",uploads:"uploads/",integrityCheck:integrity,metadata
    };
    await zipArchive(destination,snapshot,manifest);
    const digest=await checksum(destination);
    const size=fs.statSync(destination).size;
    db.prepare("UPDATE backup_records SET status='ready',size_bytes=?,checksum_sha256=? WHERE id=?")
      .run(size,digest,record.lastInsertRowid);
    enforceRetention();
    return db.prepare("SELECT * FROM backup_records WHERE id=?").get(record.lastInsertRowid);
  }catch(error){
    try{fs.unlinkSync(destination);}catch{}
    db.prepare("UPDATE backup_records SET status='failed' WHERE id=?").run(record.lastInsertRowid);
    throw error;
  }finally{
    try{fs.unlinkSync(snapshot);}catch{}
  }
}

function listBackups(){
  return db.prepare("SELECT id,filename,size_bytes,checksum_sha256,status,created_at FROM backup_records ORDER BY created_at DESC,id DESC").all();
}

function backupFile(id){
  const row=db.prepare("SELECT * FROM backup_records WHERE id=? AND status='ready'").get(Number(id));
  if(!row)return null;
  const file=path.join(backupsDir,path.basename(row.relative_path));
  if(!fs.existsSync(file))return null;
  return {row,file};
}

module.exports={createBackup,listBackups,backupFile,backupsDir};
