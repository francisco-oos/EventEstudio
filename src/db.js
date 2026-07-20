const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const defaultSettings = require("../config/default-settings.json");
const {normalizeFeatureSettings}=require("./features");

require("dotenv").config({path:path.join(__dirname,"..",".env")});
const projectRoot=path.join(__dirname,"..");
const storageRoot=process.env.STORAGE_ROOT?path.resolve(process.env.STORAGE_ROOT):projectRoot;
const dataDir = process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(storageRoot, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(process.env.DB_PATH?path.resolve(process.env.DB_PATH):path.join(dataDir, "wedding.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
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
CREATE INDEX IF NOT EXISTS idx_event_tables_event ON event_tables(event_id,order_index);
CREATE INDEX IF NOT EXISTS idx_floor_zones_event ON event_floor_zones(event_id,order_index);
CREATE INDEX IF NOT EXISTS idx_seating_event_table ON seating_assignments(event_id,table_id,seat_index);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_rsvps_guest ON rsvps(guest_id);
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
db.prepare("SELECT id,settings_json FROM events").all().forEach(event=>{
  try{
    const settings=normalizeFeatureSettings(JSON.parse(event.settings_json));
    settings.rsvp={closeAt:"",allowChanges:true,allowFlexibleComposition:false,...(settings.rsvp||{})};
    settings.menus={serviceMode:"fixed",selectionEnabled:false,...(settings.menus||{})};
    settings.menus.serviceMode=settings.menus.selectionEnabled?"guest-choice":"fixed";
    settings.qrDesign={showFamilies:false,...(settings.qrDesign||{})};
    settings.physicalInvitation={templateId:"auto-theme",...(settings.physicalInvitation||{})};
    settings.presentation={openingStyle:"wax-envelope",openingEyebrow:"Una invitación para ti",...(settings.presentation||{})};
    settings.photoPolicy={messageMaxLength:500,defaultStatus:"pending",publishApprovedMessages:true,...(settings.photoPolicy||{})};
    settings.lifecycle={protected:false,automaticPurge:false,...(settings.lifecycle||{})};
    db.prepare("UPDATE events SET settings_json=? WHERE id=?").run(JSON.stringify(settings),event.id);
  }catch{}
});



const first = db.prepare("SELECT id FROM events ORDER BY id LIMIT 1").get();
if (!first && process.env.NODE_ENV!=="production") {
  const initialSettings=JSON.parse(JSON.stringify(defaultSettings));
  db.prepare("INSERT INTO events (slug, name, settings_json) VALUES (?, ?, ?)")
    .run("francisco-ariana","Boda Francisco & Ariana",JSON.stringify(initialSettings));
}

const planCount = db.prepare("SELECT COUNT(*) total FROM plans").get().total;
if (!planCount) {
  const insertPlan = db.prepare(`INSERT INTO plans(code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb) VALUES(?,?,?,?,?,?,?,?)`);
  insertPlan.run("starter", "Evento Único", 69900, "MXN", 120, 1, 120, 512);
  insertPlan.run("basic", "Esencial", 109900, "MXN", 120, 1, 250, 1024);
  insertPlan.run("premium", "Premium", 179900, "MXN", 180, 3, 500, 4096);
  insertPlan.run("studio", "Studio", 349900, "MXN", 365, 20, 1500, 20480);
}

/*
 * Los planes son datos comerciales de la plataforma, no datos del cliente.
 * El UPSERT mantiene instalaciones existentes alineadas con la versión actual
 * sin borrar suscripciones ni pagos históricos.
 */
const upsertPlan = db.prepare(`
  INSERT INTO plans
    (code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb,active)
  VALUES (?,?,?,?,?,?,?,?,1)
  ON CONFLICT(code) DO UPDATE SET
    name=excluded.name,
    price_cents=excluded.price_cents,
    currency=excluded.currency,
    duration_days=excluded.duration_days,
    max_events=excluded.max_events,
    max_guests=excluded.max_guests,
    max_storage_mb=excluded.max_storage_mb,
    active=1
`);

[
  ["starter", "Evento Único", 69900, "MXN", 120, 1, 120, 512],
  ["basic", "Esencial", 109900, "MXN", 120, 1, 250, 1024],
  ["premium", "Premium", 179900, "MXN", 180, 3, 500, 4096],
  ["studio", "Studio", 349900, "MXN", 365, 20, 1500, 20480]
].forEach(plan => upsertPlan.run(...plan));

module.exports = db;
