"use strict";

/* Regresión del incidente real de Railway 2026-08-28.
   La base de producción reportó user_version=0 y una tabla plans anterior a
   retention_days/max_published_events/publication_policy. El test reconstruye
   explícitamente ese esquema antiguo: no parte de una tabla plans moderna. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const Database=require("better-sqlite3");
const {SCHEMA_VERSION}=require("../src/schema-version");

const root=path.resolve(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-legacy-v0-migration-"));
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
  {cwd:root,env,encoding:"utf8"}
);

try{
  /* Bootstrap sólo para obtener las demás tablas actuales; después plans se
     reemplaza por el contrato realmente antiguo que falló en producción. */
  openApplicationDatabase();
  let database=new Database(databasePath);
  const originalPlans=database.prepare("SELECT id,code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb,active,created_at FROM plans ORDER BY id").all();
  assert.ok(originalPlans.length>0,"El fixture debe contener planes antes de degradarlo.");
  database.pragma("foreign_keys = OFF");
  database.exec(`
    CREATE TABLE plans_v0 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      duration_days INTEGER NOT NULL DEFAULT 120,
      max_events INTEGER NOT NULL DEFAULT 1,
      max_guests INTEGER NOT NULL DEFAULT 300,
      max_storage_mb INTEGER NOT NULL DEFAULT 2048,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO plans_v0(id,code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb,active,created_at)
    SELECT id,code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb,active,created_at FROM plans;
    DROP TABLE plans;
    ALTER TABLE plans_v0 RENAME TO plans;
    PRAGMA user_version = 0;
  `);
  database.close();

  const firstMigrationOutput=openApplicationDatabase();
  assert.match(firstMigrationOutput,/Respaldo verificado previo a migración:/,"La migración v0 debe crear un snapshot antes de alterar el esquema.");

  database=new Database(databasePath,{readonly:true,fileMustExist:true});
  assert.equal(database.pragma("integrity_check",{simple:true}),"ok");
  assert.equal(database.pragma("user_version",{simple:true}),SCHEMA_VERSION);
  const columns=new Set(database.prepare("PRAGMA table_info(plans)").all().map(item=>item.name));
  for(const column of ["retention_days","max_published_events","publication_policy","tagline","public","featured","sort_order"]){
    assert.ok(columns.has(column),`La migración v0 no añadió plans.${column}.`);
  }
  const migratedPlans=database.prepare("SELECT id,code,name FROM plans ORDER BY id").all();
  assert.equal(migratedPlans.length,originalPlans.length,"La migración no puede perder planes existentes.");
  assert.deepEqual(migratedPlans.map(item=>item.code),originalPlans.map(item=>item.code),"La migración debe conservar los códigos de plan.");
  assert.equal(database.prepare("SELECT COUNT(*) total FROM plan_products").get().total>0,true,"La Store debe conservar asociaciones plan/producto.");
  database.close();

  const backupsDir=path.join(storage,"backups");
  const firstBackups=fs.readdirSync(backupsDir).filter(name=>name.endsWith(".db"));
  assert.equal(firstBackups.length,1,"Debe existir un solo snapshot del salto v0→actual.");

  /* Simula un reinicio posterior a un crash que hubiera dejado user_version en 0.
     El snapshot original debe reutilizarse, no duplicarse hasta llenar el volumen. */
  database=new Database(databasePath);
  database.pragma("user_version = 0");
  database.close();
  const retryOutput=openApplicationDatabase();
  assert.match(retryOutput,/Respaldo previo existente reutilizado:/,"Un retry v0 debe reutilizar el snapshot verificado anterior.");
  const retryBackups=fs.readdirSync(backupsDir).filter(name=>name.endsWith(".db"));
  assert.equal(retryBackups.length,1,"Los reinicios no deben crear una tormenta de snapshots pre-migración.");

  database=new Database(databasePath,{readonly:true,fileMustExist:true});
  assert.equal(database.pragma("user_version",{simple:true}),SCHEMA_VERSION);
  assert.equal(database.pragma("foreign_key_check").length,0);
  database.close();

  console.log(`✓ Migración realista v0→${SCHEMA_VERSION}: plans legacy, snapshot único, retry idempotente e integridad PASS`);
}finally{
  fs.rmSync(storage,{recursive:true,force:true});
}
