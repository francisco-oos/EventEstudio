"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const Database=require("better-sqlite3");
const db=require("../src/db");

const CONFIRMATION="RESET_KEEP_USERS";
const projectRoot=path.join(__dirname,"..");
const storageRoot=process.env.STORAGE_ROOT?path.resolve(process.env.STORAGE_ROOT):projectRoot;
const dataDir=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(storageRoot,"data");
const backupsDir=process.env.BACKUPS_DIR?path.resolve(process.env.BACKUPS_DIR):path.join(storageRoot,"backups");
const uploadsDir=process.env.UPLOADS_DIR?path.resolve(process.env.UPLOADS_DIR):path.join(storageRoot,"uploads");
const archiveRoot=path.join(storageRoot,"reset-archives");

function stamp(){return new Date().toISOString().replace(/[:.]/g,"-");}
function sha256File(file){return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");}
function stableJson(value){return JSON.stringify(value,Object.keys(value?.[0]||{}).sort());}
function usersSnapshot(){
  return db.prepare("SELECT * FROM users ORDER BY id").all();
}
function accessSnapshot(){
  return {
    subscriptions:db.prepare("SELECT * FROM subscriptions ORDER BY id").all(),
    commercialControls:db.prepare("SELECT * FROM account_commercial_controls ORDER BY user_id").all()
  };
}
function fingerprint(rows){return crypto.createHash("sha256").update(stableJson(rows)).digest("hex");}
function count(table){return Number(db.prepare(`SELECT COUNT(*) total FROM ${table}`).get().total||0);}
function revenueCents(){
  const plan=Number(db.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM payments WHERE status='paid'").get().total||0);
  const addon=Number(db.prepare("SELECT COALESCE(SUM(subtotal_cents),0) total FROM orders WHERE status='paid'").get().total||0);
  return plan+addon;
}

async function verifiedSnapshot(prefix,metadata={}){
  fs.mkdirSync(backupsDir,{recursive:true});
  const base=`${prefix}-${stamp()}.db`;
  const destination=path.join(backupsDir,base);
  await db.backup(destination);
  try{fs.chmodSync(destination,0o600);}catch{}
  const check=new Database(destination,{readonly:true,fileMustExist:true});
  const integrity=check.pragma("integrity_check",{simple:true});
  check.pragma("foreign_keys = ON");
  const fk=check.pragma("foreign_key_check");
  check.close();
  if(integrity!=="ok"||fk.length){
    try{fs.unlinkSync(destination);}catch{}
    throw new Error(`El snapshot ${base} no pasó integridad/FK.`);
  }
  const manifest={
    format:"eventstudio-production-reset-v1",
    createdAt:new Date().toISOString(),
    database:path.basename(destination),
    databaseSha256:sha256File(destination),
    integrityCheck:"ok",
    foreignKeyViolations:0,
    ...metadata
  };
  fs.writeFileSync(`${destination}.json`,JSON.stringify(manifest,null,2),{mode:0o600});
  return destination;
}

function archiveUploads(runStamp){
  const archiveDir=path.join(archiveRoot,runStamp);
  const moved=[];
  fs.mkdirSync(archiveDir,{recursive:true});
  for(const name of ["guest-photos","site-media"]){
    const source=path.join(uploadsDir,name);
    if(!fs.existsSync(source)){
      fs.mkdirSync(source,{recursive:true});
      continue;
    }
    const entries=fs.readdirSync(source);
    if(entries.length){
      const destination=path.join(archiveDir,name);
      fs.renameSync(source,destination);
      moved.push({name,destination,entries:entries.length});
      fs.mkdirSync(source,{recursive:true});
    }
  }
  if(!moved.length){
    try{fs.rmdirSync(archiveDir);}catch{}
    return {archiveDir:null,moved:[]};
  }
  return {archiveDir,moved};
}

function resetSequences(){
  const cleared=[
    "account_notifications","carts","conversion_events","event_domains","event_floor_zones","event_grants",
    "event_tables","events","guests","media_upload_receipts","message_events","message_queue","orders",
    "payments","photo_batches","photos","preview_links","promotions","publication_requests","rsvps",
    "seating_assignments","seating_legacy_imports"
  ];
  const seqExists=db.prepare("SELECT 1 found FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'").get();
  if(seqExists){
    const remove=db.prepare("DELETE FROM sqlite_sequence WHERE name=?");
    cleared.forEach(table=>remove.run(table));
  }
}

async function resetProductionKeepUsers(){
  const isProduction=String(process.env.NODE_ENV||"").toLowerCase()==="production";
  const testMode=process.env.EVENTSTUDIO_RESET_TEST_MODE==="1";
  if(!isProduction&&!testMode)throw new Error("Este reset sólo puede ejecutarse con NODE_ENV=production.");
  const usersBefore=usersSnapshot();
  if(!usersBefore.length)throw new Error("Se rechazó el reset porque no existen usuarios que preservar.");
  const owners=usersBefore.filter(user=>user.role==="owner"&&Number(user.active)===1);
  if(!owners.length)throw new Error("Se rechazó el reset porque no existe un Owner activo.");
  const accessBefore=accessSnapshot();
  const userFingerprint=fingerprint(usersBefore);
  const subscriptionFingerprint=fingerprint(accessBefore.subscriptions);
  const controlsFingerprint=fingerprint(accessBefore.commercialControls);
  const before={
    users:usersBefore.length,
    subscriptions:accessBefore.subscriptions.length,
    commercialControls:accessBefore.commercialControls.length,
    events:count("events"),
    payments:count("payments"),
    orders:count("orders"),
    revenueCents:revenueCents()
  };

  const preSnapshot=await verifiedSnapshot("pre-reset-keep-users",{
    phase:"before-reset",preservedUsers:before.users,revenueCents:before.revenueCents
  });

  const tx=db.transaction(()=>{
    /* Sesiones se invalidan a propósito: después de un reset destructivo todos vuelven a autenticarse. */
    db.prepare("DELETE FROM sessions").run();
    /* Datos transaccionales que alimentan ingresos y métricas comerciales. */
    db.prepare("DELETE FROM payments").run();
    db.prepare("DELETE FROM account_notifications").run();
    db.prepare("DELETE FROM conversion_events").run();
    db.prepare("DELETE FROM promotions").run();
    db.prepare("DELETE FROM showcase_items WHERE source_type<>'demo'").run();
    /* Borrar eventos activa CASCADE sobre invitados, RSVP, fotos, mesas, carritos, pedidos, grants, previews, etc. */
    db.prepare("DELETE FROM events").run();
    /* Barrido explícito por compatibilidad con bases legacy que pudieran tener FKs diferentes. */
    ["orders","carts","event_grants","publication_requests","preview_links","message_queue","message_events",
     "photo_batches","photos","seating_assignments","event_floor_zones","event_tables","seating_legacy_imports",
     "media_upload_receipts","rsvps","guests","event_domains","user_events"].forEach(table=>{
      db.prepare(`DELETE FROM ${table}`).run();
    });
    resetSequences();
  });
  tx();

  const usersAfter=usersSnapshot();
  const accessAfter=accessSnapshot();
  const fk=db.pragma("foreign_key_check");
  const integrity=db.pragma("integrity_check",{simple:true});
  const after={
    users:usersAfter.length,
    subscriptions:accessAfter.subscriptions.length,
    commercialControls:accessAfter.commercialControls.length,
    events:count("events"),
    payments:count("payments"),
    orders:count("orders"),
    revenueCents:revenueCents()
  };

  const invariants={
    usersPreserved:fingerprint(usersAfter)===userFingerprint,
    subscriptionsPreserved:fingerprint(accessAfter.subscriptions)===subscriptionFingerprint,
    commercialControlsPreserved:fingerprint(accessAfter.commercialControls)===controlsFingerprint,
    revenueZero:after.revenueCents===0,
    eventsZero:after.events===0,
    paymentsZero:after.payments===0,
    ordersZero:after.orders===0,
    foreignKeysClean:fk.length===0,
    integrityOk:integrity==="ok"
  };
  if(Object.values(invariants).some(value=>value!==true)){
    throw new Error(`El reset terminó con una invariante inválida: ${JSON.stringify(invariants)}`);
  }

  const media=archiveUploads(path.basename(preSnapshot,".db").replace(/^pre-reset-keep-users-/,""));
  const postSnapshot=await verifiedSnapshot("post-reset-keep-users",{
    phase:"after-reset",preservedUsers:after.users,revenueCents:after.revenueCents,
    preResetSnapshot:path.basename(preSnapshot)
  });

  return {before,after,invariants,preSnapshot,postSnapshot,media};
}

async function main(){
  const args=process.argv.slice(2);
  const confirmation=args.includes("--confirm")?args[args.indexOf("--confirm")+1]:"";
  if(confirmation!==CONFIRMATION){
    console.error(`ABORTADO. Uso: node scripts/reset-production-keep-users.js --confirm ${CONFIRMATION}`);
    process.exitCode=2;
    return;
  }
  console.log("RESET PRODUCTIVO: se conservarán usuarios + accesos; se limpiará historial operativo/comercial.");
  const result=await resetProductionKeepUsers();
  console.log(JSON.stringify({
    ok:true,
    before:result.before,
    after:result.after,
    invariants:result.invariants,
    preResetSnapshot:path.basename(result.preSnapshot),
    postResetSnapshot:path.basename(result.postSnapshot),
    archivedMedia:result.media.archiveDir?path.relative(storageRoot,result.media.archiveDir):null
  },null,2));
}

if(require.main===module){
  main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;}).finally(()=>{try{db.close();}catch{}});
}

module.exports={resetProductionKeepUsers,CONFIRMATION};
