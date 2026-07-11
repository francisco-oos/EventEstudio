const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const defaultSettings = require("../config/default-settings.json");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "wedding.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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

CREATE INDEX IF NOT EXISTS idx_guests_event_status ON guests(event_id, status);
CREATE INDEX IF NOT EXISTS idx_guests_event_table ON guests(event_id, table_name);
CREATE INDEX IF NOT EXISTS idx_photos_event_table ON photos(event_id, table_name);
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
ensureColumn("rsvps", "validation_warnings", "TEXT");

ensureColumn("users", "phone", "TEXT");
ensureColumn("users", "login_identifier", "TEXT");
ensureColumn("users", "auth_provider", "TEXT NOT NULL DEFAULT 'local'");
ensureColumn("users", "last_login_at", "TEXT");
ensureColumn("users", "company_name", "TEXT");
ensureColumn("events", "event_type", "TEXT NOT NULL DEFAULT 'wedding'");
ensureColumn("events", "owner_user_id", "INTEGER");
ensureColumn("events", "archived", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("events", "subscription_required", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("events", "published", "INTEGER NOT NULL DEFAULT 0");


const first = db.prepare("SELECT id FROM events ORDER BY id LIMIT 1").get();
if (!first) {
  db.prepare("INSERT INTO events (slug, name, settings_json) VALUES (?, ?, ?)")
    .run("francisco-ariana", "Boda Francisco & Ariana", JSON.stringify(defaultSettings));
}

const planCount = db.prepare("SELECT COUNT(*) total FROM plans").get().total;
if (!planCount) {
  const insertPlan = db.prepare(`INSERT INTO plans(code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb) VALUES(?,?,?,?,?,?,?,?)`);
  insertPlan.run("basic", "Esencial", 149900, "MXN", 120, 1, 200, 1024);
  insertPlan.run("premium", "Premium", 249900, "MXN", 180, 3, 500, 4096);
  insertPlan.run("studio", "Studio", 499900, "MXN", 365, 20, 1500, 20480);
}

module.exports = db;
