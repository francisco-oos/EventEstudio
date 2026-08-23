"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const Database=require("better-sqlite3");
const {SCHEMA_VERSION}=require("../src/schema-version");
const {inspectDatabaseState}=require("../scripts/iniciar-local");

const root=path.resolve(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-data-safety-"));
const databasePath=path.join(storage,"data","wedding.db");
const env={
  ...process.env,
  NODE_ENV:"test",
  STORAGE_ROOT:storage,
  DATA_DIR:"",
  DB_PATH:"",
  UPLOADS_DIR:"",
  BACKUPS_DIR:"",
  INITIAL_OWNER_EMAIL:"",
  INITIAL_OWNER_PASSWORD:""
};
const openApplicationDatabase=()=>execFileSync(
  process.execPath,
  ["-e","const db=require('./src/db');db.close();"],
  {cwd:root,env,stdio:"pipe"}
);

try{
  openApplicationDatabase();
  let database=new Database(databasePath);
  assert.equal(database.pragma("user_version",{simple:true}),SCHEMA_VERSION);
  database.exec("CREATE TABLE safety_marker(value TEXT NOT NULL); INSERT INTO safety_marker(value) VALUES('conservar');");
  database.pragma("user_version = 0");
  database.close();

  openApplicationDatabase();
  const backupDir=path.join(storage,"backups");
  const snapshots=fs.readdirSync(backupDir).filter(name=>name.endsWith(".db"));
  assert.equal(snapshots.length,1,"Debe existir un solo respaldo previo a la migración.");
  const snapshotPath=path.join(backupDir,snapshots[0]);
  const manifest=JSON.parse(fs.readFileSync(`${snapshotPath}.json`,"utf8"));
  const digest=crypto.createHash("sha256").update(fs.readFileSync(snapshotPath)).digest("hex");
  assert.equal(manifest.format,"eventstudio-pre-migration-v1");
  assert.equal(manifest.fromSchemaVersion,0);
  assert.equal(manifest.toSchemaVersion,SCHEMA_VERSION);
  assert.equal(manifest.databaseSha256,digest);

  const snapshot=new Database(snapshotPath,{readonly:true,fileMustExist:true});
  assert.equal(snapshot.pragma("integrity_check",{simple:true}),"ok");
  assert.equal(snapshot.prepare("SELECT value FROM safety_marker").get().value,"conservar");
  snapshot.close();

  openApplicationDatabase();
  assert.equal(
    fs.readdirSync(backupDir).filter(name=>name.endsWith(".db")).length,
    1,
    "Un segundo arranque con el mismo esquema no debe duplicar respaldos."
  );

  database=new Database(databasePath);
  database.prepare(`
    INSERT INTO events(slug,name,settings_json,event_type,published)
    VALUES('evento-real-seguridad','Evento existente','{}','custom',0)
  `).run();
  database.close();

  assert.throws(()=>execFileSync(
    process.execPath,
    [path.join(root,"src","seed.js")],
    {cwd:root,env,stdio:"pipe"}
  ),/Command failed/);

  database=new Database(databasePath,{readonly:true,fileMustExist:true});
  assert.equal(database.prepare("SELECT COUNT(*) total FROM events").get().total,1);
  assert.equal(database.prepare("SELECT COUNT(*) total FROM users").get().total,0);
  assert.equal(database.prepare("SELECT COUNT(*) total FROM events WHERE slug='boda-demostracion'").get().total,0);
  database.close();

  const state=inspectDatabaseState(databasePath);
  assert.equal(state.needsDemo,false);
  assert.equal(state.events,1);
  assert.equal(state.users,0);
  assert.equal(state.partial,true);

  console.log("✓ Base existente, seed y respaldo previo a migración protegidos");
}finally{
  fs.rmSync(storage,{recursive:true,force:true});
}
