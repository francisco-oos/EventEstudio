const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const defaultSettings = require("../config/default-settings.json");
const eventTypes=require("../config/event-types.json");
const commercialPlans=require("../config/commercial-plans.json");
const {normalizeFeatureSettings}=require("./features");
const {applyPendingRestoreSync}=require("./restore");
const {SCHEMA_VERSION}=require("./schema-version");

require("dotenv").config({path:path.join(__dirname,"..",".env")});
const projectRoot=path.join(__dirname,"..");
const storageRoot=process.env.STORAGE_ROOT?path.resolve(process.env.STORAGE_ROOT):projectRoot;
const dataDir = process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(storageRoot, "data");
const backupsDir=process.env.BACKUPS_DIR?path.resolve(process.env.BACKUPS_DIR):path.join(storageRoot,"backups");
const dbPath=process.env.DB_PATH?path.resolve(process.env.DB_PATH):path.join(dataDir,"wedding.db");
const schemaVersion=SCHEMA_VERSION;

/* Si un intento de migración falla antes de actualizar user_version, Railway puede
   reiniciar el proceso. Reutilizamos el PRIMER snapshot verificado del mismo salto
   de esquema para preservar el estado original y evitar llenar el volumen con una
   copia nueva en cada reinicio. */
function findVerifiedPreMigrationBackup(fromVersion,toVersion){
  if(!fs.existsSync(backupsDir))return null;
  const prefix=`pre-migration-v${fromVersion}-to-v${toVersion}-`;
  const manifests=fs.readdirSync(backupsDir)
    .filter(name=>name.startsWith(prefix)&&name.endsWith('.db.json'))
    .sort();
  for(const manifestName of manifests){
    try{
      const manifestPath=path.join(backupsDir,manifestName);
      const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
      if(manifest.format!=="eventstudio-pre-migration-v1"||
         Number(manifest.fromSchemaVersion)!==fromVersion||
         Number(manifest.toSchemaVersion)!==toVersion||
         manifest.source!==path.basename(dbPath))continue;
      const snapshotPath=manifestPath.slice(0,-5);
      if(!fs.existsSync(snapshotPath))continue;
      const checksum=crypto.createHash('sha256').update(fs.readFileSync(snapshotPath)).digest('hex');
      if(checksum!==manifest.databaseSha256)continue;
      const snapshot=new Database(snapshotPath,{readonly:true,fileMustExist:true});
      const integrity=snapshot.pragma('integrity_check',{simple:true});
      snapshot.close();
      if(integrity==='ok')return snapshotPath;
    }catch{}
  }
  return null;
}

fs.mkdirSync(dataDir, { recursive: true });
applyPendingRestoreSync();
const databaseExisted=fs.existsSync(dbPath);
const db = new Database(dbPath);
/* Seguridad de integridad: antes de consultar el esquema, verifica que el archivo
   SQLite sea legible. Luego activa defensas recomendadas por SQLite para procesos
   que manejan datos externos/restaurados. No cambia el modelo ni los datos. */
const startupIntegrity=db.pragma("quick_check",{simple:true});
if(startupIntegrity!=="ok"){
  db.close();
  throw new Error(`La base no superó quick_check al iniciar: ${startupIntegrity}`);
}
try{fs.chmodSync(dbPath,0o600);}catch{}
db.pragma("trusted_schema = OFF");
db.pragma("cell_size_check = ON");
db.pragma("mmap_size = 0");
db.pragma("busy_timeout = 5000");
const previousSchemaVersion=Number(db.pragma("user_version",{simple:true})||0);
if(previousSchemaVersion>schemaVersion){
  db.close();
  throw new Error(`La base usa un esquema más nuevo (${previousSchemaVersion}) que esta versión de EventStudio (${schemaVersion}).`);
}
if(databaseExisted&&previousSchemaVersion<schemaVersion){
  const integrity=db.pragma("quick_check",{simple:true});
  if(integrity!=="ok"){
    db.close();
    throw new Error(`La base no superó quick_check antes de migrar: ${integrity}`);
  }
  fs.mkdirSync(backupsDir,{recursive:true});
  const existingSnapshot=findVerifiedPreMigrationBackup(previousSchemaVersion,schemaVersion);
  if(existingSnapshot){
    console.log(`Respaldo previo existente reutilizado: ${path.basename(existingSnapshot)}`);
  }else{
    const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    const snapshotName=`pre-migration-v${previousSchemaVersion}-to-v${schemaVersion}-${stamp}.db`;
    const snapshotPath=path.join(backupsDir,snapshotName);
    const sqlPath=snapshotPath.replace(/'/g,"''");
    db.exec(`VACUUM INTO '${sqlPath}'`);
    try{fs.chmodSync(snapshotPath,0o600);}catch{}
    const snapshot=new Database(snapshotPath,{readonly:true,fileMustExist:true});
    const snapshotIntegrity=snapshot.pragma("integrity_check",{simple:true});
    snapshot.close();
    if(snapshotIntegrity!=="ok"){
      try{fs.unlinkSync(snapshotPath);}catch{}
      db.close();
      throw new Error(`El respaldo previo a la migración no superó integrity_check: ${snapshotIntegrity}`);
    }
    const checksum=crypto.createHash("sha256").update(fs.readFileSync(snapshotPath)).digest("hex");
    fs.writeFileSync(`${snapshotPath}.json`,JSON.stringify({
      format:"eventstudio-pre-migration-v1",
      createdAt:new Date().toISOString(),
      source:path.basename(dbPath),
      fromSchemaVersion:previousSchemaVersion,
      toSchemaVersion:schemaVersion,
      databaseSha256:checksum
    },null,2),{mode:0o600});
    console.log(`Respaldo verificado previo a migración: ${snapshotName}`);
  }
}
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

db.exec(`

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','developer','client')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_events (
  user_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  permission TEXT NOT NULL DEFAULT 'manage',
  PRIMARY KEY(user_id,event_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',
  duration_days INTEGER NOT NULL DEFAULT 120,
  max_events INTEGER NOT NULL DEFAULT 1,
  max_guests INTEGER NOT NULL DEFAULT 300,
  max_storage_mb INTEGER NOT NULL DEFAULT 2048,
  retention_days INTEGER NOT NULL DEFAULT 30,
  max_published_events INTEGER NOT NULL DEFAULT 1,
  publication_policy TEXT NOT NULL DEFAULT 'manual_owner',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial',
  starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(plan_id) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'demo',
  provider_reference TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(plan_id) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS event_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  verified INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_domains_event ON event_domains(event_id);
CREATE INDEX IF NOT EXISTS idx_event_domains_hostname ON event_domains(hostname);

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  family_name TEXT NOT NULL,
  phone TEXT,
  max_adults INTEGER NOT NULL DEFAULT 1,
  max_children INTEGER NOT NULL DEFAULT 0,
  table_name TEXT,
  custom_message TEXT,
  private_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, code),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gift_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  status TEXT NOT NULL,
  donor_name TEXT,
  donor_email TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider,provider_reference),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id INTEGER NOT NULL UNIQUE,
  attending INTEGER NOT NULL DEFAULT 0,
  adults INTEGER NOT NULL DEFAULT 0,
  children INTEGER NOT NULL DEFAULT 0,
  attendee_names TEXT,
  dietary TEXT,
  special_needs TEXT,
  adult_menu_counts TEXT,
  child_menu_counts TEXT,
  message TEXT,
  contact_phone TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(guest_id) REFERENCES guests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT,
  table_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  shape TEXT NOT NULL DEFAULT 'round' CHECK(shape IN ('round','rect')),
  capacity INTEGER NOT NULL DEFAULT 10 CHECK(capacity BETWEEN 1 AND 30),
  x REAL NOT NULL DEFAULT 10,
  y REAL NOT NULL DEFAULT 10,
  width REAL NOT NULL DEFAULT 14,
  height REAL NOT NULL DEFAULT 18,
  rotation REAL NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id,name),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_floor_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('dance_floor','stage','entrance','bar','aisle','restrooms','other')),
  shape TEXT NOT NULL DEFAULT 'rect',
  label TEXT NOT NULL,
  x REAL NOT NULL DEFAULT 35,
  y REAL NOT NULL DEFAULT 35,
  width REAL NOT NULL DEFAULT 30,
  height REAL NOT NULL DEFAULT 24,
  rotation REAL NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seating_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  guest_id INTEGER NOT NULL,
  person_key TEXT NOT NULL,
  table_id INTEGER NOT NULL,
  seat_index INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id,guest_id,person_key),
  UNIQUE(event_id,table_id,seat_index),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY(guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  FOREIGN KEY(table_id) REFERENCES event_tables(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seating_legacy_imports (
  event_id INTEGER PRIMARY KEY,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_upload_receipts (
  event_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  upload_key TEXT NOT NULL,
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id,kind,upload_key),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS photo_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  guest_id INTEGER,
  upload_key TEXT NOT NULL UNIQUE,
  table_name TEXT,
  uploaded_by TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY(guest_id) REFERENCES guests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS message_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  guest_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'invitation' CHECK(kind IN ('invitation','reminder','confirmation')),
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','queued','sent','delivered','read','failed','cancelled')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  provider_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  read_at TEXT,
  cancelled_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY(guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS message_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_id INTEGER,
  event_id INTEGER NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(queue_id) REFERENCES message_queue(id) ON DELETE CASCADE,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  event_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS backup_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  relative_path TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'creating' CHECK(status IN ('creating','ready','failed')),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_guests_event_status ON guests(event_id, status);
CREATE INDEX IF NOT EXISTS idx_guests_event_table ON guests(event_id, table_name);
CREATE INDEX IF NOT EXISTS idx_photos_event_table ON photos(event_id, table_name);
CREATE INDEX IF NOT EXISTS idx_media_upload_receipts_created ON media_upload_receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_event_tables_event ON event_tables(event_id,order_index);
CREATE INDEX IF NOT EXISTS idx_floor_zones_event ON event_floor_zones(event_id,order_index);
CREATE INDEX IF NOT EXISTS idx_seating_event_table ON seating_assignments(event_id,table_id,seat_index);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_rsvps_guest ON rsvps(guest_id);
CREATE INDEX IF NOT EXISTS idx_gift_contributions_event ON gift_contributions(event_id,created_at);
CREATE INDEX IF NOT EXISTS idx_photo_batches_event_status ON photo_batches(event_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_message_queue_event_status ON message_queue(event_id,status,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_queue_provider_id ON message_queue(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_events_provider ON message_events(provider_message_id,status);
CREATE INDEX IF NOT EXISTS idx_audit_event_created ON audit_logs(event_id,created_at);
`);


function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn("guests", "is_test", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("guests", "delivery_status", "TEXT NOT NULL DEFAULT 'not_sent'");
ensureColumn("guests", "last_delivery_at", "TEXT");
ensureColumn("rsvps", "accessibility_options", "TEXT");
ensureColumn("rsvps", "accessibility_other", "TEXT");
ensureColumn("rsvps", "validation_warnings", "TEXT");
ensureColumn("rsvps", "responsible_name", "TEXT");
ensureColumn("photos", "batch_id", "INTEGER");

ensureColumn("users", "phone", "TEXT");
ensureColumn("users", "login_identifier", "TEXT");
ensureColumn("users", "auth_provider", "TEXT NOT NULL DEFAULT 'local'");
ensureColumn("users", "last_login_at", "TEXT");
ensureColumn("users", "company_name", "TEXT");
ensureColumn("users", "must_change_password", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "password_changed_at", "TEXT");
ensureColumn("events", "event_type", "TEXT NOT NULL DEFAULT 'wedding'");
ensureColumn("events", "owner_user_id", "INTEGER");
ensureColumn("events", "archived", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("events", "subscription_required", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("events", "published", "INTEGER NOT NULL DEFAULT 0");
/* Producción puede venir de esquemas pre-RC17 con user_version=0. Estas columnas
   deben existir ANTES de preparar los INSERT/UPSERT de planes de líneas posteriores.
   commerce-schema también las garantiza, pero se inicializa después del seed; dejar
   retention_days sólo allí provocaba el crash observado en Railway. */
ensureColumn("plans", "retention_days", "INTEGER NOT NULL DEFAULT 30");
ensureColumn("plans", "max_published_events", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("plans", "publication_policy", "TEXT NOT NULL DEFAULT 'manual_owner'");

ensureColumn("events", "expires_at", "TEXT");
ensureColumn("events", "grace_until", "TEXT");
ensureColumn("events", "cleanup_after", "TEXT");
ensureColumn("events", "cleanup_status", "TEXT NOT NULL DEFAULT 'active'");
ensureColumn("events", "protected", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("event_floor_zones", "shape", "TEXT NOT NULL DEFAULT 'rect'");
ensureColumn("subscriptions", "granted_by", "INTEGER");
ensureColumn("subscriptions", "grant_reason", "TEXT");

/* SQLite no permite ampliar un CHECK con ALTER TABLE. Reconstruye sólo esta
   tabla cuando proviene de una versión anterior, conservando todo el plano. */
const floorZoneSql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='event_floor_zones'").get()?.sql||"";
if(!floorZoneSql.includes("'aisle'")){
  db.transaction(()=>{
    db.exec(`
      ALTER TABLE event_floor_zones RENAME TO event_floor_zones_legacy;
      CREATE TABLE event_floor_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('dance_floor','stage','entrance','bar','aisle','restrooms','other')),
        shape TEXT NOT NULL DEFAULT 'rect',
        label TEXT NOT NULL,
        x REAL NOT NULL DEFAULT 35,
        y REAL NOT NULL DEFAULT 35,
        width REAL NOT NULL DEFAULT 30,
        height REAL NOT NULL DEFAULT 24,
        rotation REAL NOT NULL DEFAULT 0,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
      );
      INSERT INTO event_floor_zones(id,event_id,type,shape,label,x,y,width,height,rotation,order_index,created_at,updated_at)
      SELECT id,event_id,type,COALESCE(shape,'rect'),label,x,y,width,height,rotation,order_index,created_at,updated_at
      FROM event_floor_zones_legacy;
      DROP TABLE event_floor_zones_legacy;
      CREATE INDEX IF NOT EXISTS idx_floor_zones_event ON event_floor_zones(event_id,order_index);
    `);
  })();
}

/* Migra configuraciones previas sin borrar preferencias del evento. */
db.prepare("SELECT id,event_type,settings_json FROM events").all().forEach(event=>{
  try{
    const settings=normalizeFeatureSettings(JSON.parse(event.settings_json));
    settings.rsvp={closeAt:"",seatReleaseAt:"",allowChanges:true,allowFlexibleComposition:false,...(settings.rsvp||{})};
    settings.menus={serviceMode:"fixed",selectionEnabled:false,...(settings.menus||{})};
    settings.menus.serviceMode=settings.menus.selectionEnabled?"guest-choice":"fixed";
    settings.qrDesign={showFamilies:false,...(settings.qrDesign||{})};
    settings.physicalInvitation={templateId:"auto-theme",...(settings.physicalInvitation||{})};
    settings.presentation={
      openingStyle:"unified-envelope",
      experienceMode:"auto",
      motionLevel:"balanced",
      openingEyebrow:"Una invitación para ti",
      ...(settings.presentation||{})
    };
    settings.creativeBrief={
      protagonist:"",
      milestone:"",
      theme:"",
      tone:"joyful",
      visualNotes:"",
      assetRightsConfirmed:false,
      ...(settings.creativeBrief||{})
    };
    settings.localization={
      defaultLocale:["es","en","pt"].includes(settings.localization?.defaultLocale)?settings.localization.defaultLocale:"es",
      enabledLocales:Array.isArray(settings.localization?.enabledLocales)&&settings.localization.enabledLocales.length
        ?[...new Set(settings.localization.enabledLocales.filter(locale=>["es","en","pt"].includes(locale)))]
        :["es"],
      contentTranslations:settings.localization?.contentTranslations&&typeof settings.localization.contentTranslations==="object"
        ?settings.localization.contentTranslations
        :{}
    };
    if(!settings.localization.enabledLocales.includes(settings.localization.defaultLocale)){
      settings.localization.enabledLocales.unshift(settings.localization.defaultLocale);
    }
    settings.purchasedFeatures=Array.isArray(settings.purchasedFeatures)?settings.purchasedFeatures:[];
    settings.photoPolicy={messageMaxLength:500,defaultStatus:"pending",publishApprovedMessages:true,...(settings.photoPolicy||{})};
    settings.lifecycle={protected:false,automaticPurge:false,...(settings.lifecycle||{})};
    if(event.event_type&&event.event_type!=="wedding"){
      const profile=eventTypes.find(item=>item.id===event.event_type)||eventTypes.find(item=>item.id==="custom");
      const defaults=profile?.defaults||{};
      if(settings.presentation?.heroEyebrow==="Nuestra boda")settings.presentation.heroEyebrow=defaults.heroEyebrow||"Evento especial";
      if(settings.presentation?.storyEyebrow==="Nuestra historia")settings.presentation.storyEyebrow=defaults.storyEyebrow||"Acerca del evento";
      if(settings.presentation?.galleryEyebrow==="Momentos nuestros")settings.presentation.galleryEyebrow=defaults.galleryEyebrow||"Momentos";
      if(settings.presentation?.galleryTitle==="Nuestro álbum")settings.presentation.galleryTitle=defaults.galleryTitle||"Galería";
      if(settings.story?.title==="Nuestra historia")settings.story.title=defaults.storyTitle||"Información del evento";
    }
    const normalizedJson=JSON.stringify(settings);
    if(normalizedJson!==event.settings_json){
      db.prepare("UPDATE events SET settings_json=? WHERE id=?").run(normalizedJson,event.id);
    }
  }catch{}
});



const planCount = db.prepare("SELECT COUNT(*) total FROM plans").get().total;
if (!planCount) {
  const insertPlan = db.prepare(`INSERT INTO plans(code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb,retention_days,max_published_events,publication_policy) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  commercialPlans.plans.forEach(plan=>insertPlan.run(
    plan.code,plan.name,plan.priceCents,commercialPlans.currency,
    plan.durationDays,plan.maxEvents,plan.maxGuests,plan.maxStorageMB,plan.retentionDays||30,
    plan.maxPublishedEvents??plan.maxEvents??1,plan.publicationPolicy||"manual_owner"
  ));
}

/* Los valores del archivo sólo inicializan planes nuevos; el propietario puede
   editar los existentes sin que el arranque revierta sus decisiones. */
const upsertPlan = db.prepare(`
  INSERT INTO plans
    (code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb,retention_days,max_published_events,publication_policy,active)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,1)
  ON CONFLICT(code) DO NOTHING
`);

commercialPlans.plans.forEach(plan=>upsertPlan.run(
  plan.code,plan.name,plan.priceCents,commercialPlans.currency,
  plan.durationDays,plan.maxEvents,plan.maxGuests,plan.maxStorageMB,plan.retentionDays||30,
  plan.maxPublishedEvents??plan.maxEvents??1,plan.publicationPolicy||"manual_owner"
));

require("./commerce-schema").initialize(db);
db.pragma(`user_version = ${schemaVersion}`);

/* La integridad estructural y la integridad referencial son controles distintos.
   quick_check detecta corrupción del archivo; foreign_key_check detecta relaciones
   lógicas rotas que podrían haber llegado desde una restauración o versión antigua. */
const foreignKeyViolations=db.pragma("foreign_key_check");
if(foreignKeyViolations.length){
  db.close();
  throw new Error(`La base contiene ${foreignKeyViolations.length} violación(es) de clave foránea.`);
}

module.exports = db;
