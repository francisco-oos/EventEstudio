"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const Database=require("better-sqlite3");
const {SCHEMA_VERSION}=require("../src/schema-version");

const root=path.resolve(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-commerce-migration-"));
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
  const database=new Database(databasePath);
  database.pragma("foreign_keys = OFF");
  for(const table of [
    "order_items","orders","cart_items","carts","promotion_products",
    "promotions","event_grants","plan_products","product_catalog"
  ]){
    database.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  const settings=JSON.stringify({
    purchasedFeatures:["physicalInvitations"],
    couple:{displayName:"Evento conservado"},
    features:{physicalInvitations:false},
    featureStates:{physicalInvitations:"disabled"}
  });
  database.prepare(`
    INSERT INTO events(slug,name,settings_json,event_type,published)
    VALUES('migracion-comercial','Evento conservado',?,'wedding',0)
  `).run(settings);
  database.pragma("user_version = 614204");
  database.close();

  openApplicationDatabase();
  const migrated=new Database(databasePath,{readonly:true,fileMustExist:true});
  assert.equal(migrated.pragma("integrity_check",{simple:true}),"ok");
  assert.equal(migrated.pragma("user_version",{simple:true}),SCHEMA_VERSION);
  assert.ok(migrated.prepare("SELECT COUNT(*) total FROM product_catalog").get().total>=80);
  assert.ok(migrated.prepare("SELECT COUNT(*) total FROM plan_products").get().total>0);
  for(const table of ["store_categories","customer_profiles","account_commercial_controls","platform_settings","publication_requests","conversion_events","preview_links","showcase_items"]){
    assert.ok(migrated.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table),`Falta ${table}`);
  }
  assert.ok(migrated.prepare("SELECT recommendations_json FROM customer_profiles LIMIT 1").get(),"Los perfiles comerciales deben conservar recomendaciones configurables.");
  const legacy=migrated.prepare(`
    SELECT eg.source,eg.source_reference,eg.status,pc.code
    FROM event_grants eg
    JOIN product_catalog pc ON pc.id=eg.product_id
    JOIN events e ON e.id=eg.event_id
    WHERE e.slug='migracion-comercial'
  `).get();
  assert.deepEqual(legacy,{
    source:"legacy",
    source_reference:"rc9:physicalInvitations",
    status:"active",
    code:"feature:physicalInvitations"
  });
  assert.equal(migrated.prepare("SELECT COUNT(*) total FROM payments").get().total,0);
  assert.equal(migrated.prepare("SELECT name FROM events WHERE slug='migracion-comercial'").get().name,"Evento conservado");
  migrated.close();

  const backups=fs.readdirSync(path.join(storage,"backups")).filter(name=>name.endsWith(".db"));
  assert.equal(backups.length,1,"La migración a RC13 debe crear un respaldo previo.");
  console.log("✓ Migración comercial a RC13 conserva datos, gobierno y complementos con valor cero");
}finally{
  fs.rmSync(storage,{recursive:true,force:true});
}
