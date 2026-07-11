const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("./db");

const makeToken = () => crypto.randomBytes(16).toString("hex");

const wedding = db.prepare("SELECT id FROM events WHERE slug='francisco-ariana'").get()
  || (() => {
    const defaults = require("../config/default-settings.json");
    const info = db.prepare(`
      INSERT INTO events(slug,name,settings_json,event_type,published)
      VALUES(?,?,?,?,?)
    `).run("francisco-ariana","Boda Francisco & Ariana",JSON.stringify(defaults),"wedding",0);
    return { id: info.lastInsertRowid };
  })();

const accounts = [
  { email:"leyva2636@gmail.com", name:"Francisco Alvarado", role:"owner", password:"Cambiar123!" },
  { email:"ariana@evento.local", name:"Ariana", role:"client", password:"Cambiar123!" }
];

for (const account of accounts) {
  const hash = bcrypt.hashSync(account.password, 12);
  db.prepare(`
    INSERT INTO users(email,password_hash,display_name,role,login_identifier,auth_provider)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET
      display_name=excluded.display_name,
      role=excluded.role,
      login_identifier=excluded.login_identifier,
      password_hash=excluded.password_hash,
      active=1
  `).run(account.email,hash,account.name,account.role,account.email.toLowerCase(),"local");
}

const owner = db.prepare("SELECT id FROM users WHERE email='leyva2636@gmail.com'").get();
const ariana = db.prepare("SELECT id FROM users WHERE email='ariana@evento.local'").get();

/* El propietario es superusuario: no necesita estar vinculado como cliente al evento. */
db.prepare("DELETE FROM user_events WHERE user_id=?").run(owner.id);

/* Ariana es la cliente administradora de la boda. */
db.prepare(`
  INSERT INTO user_events(user_id,event_id,permission)
  VALUES(?,?,'manage')
  ON CONFLICT(user_id,event_id) DO UPDATE SET permission='manage'
`).run(ariana.id,wedding.id);

db.prepare("UPDATE events SET owner_user_id=?,event_type='wedding',archived=0 WHERE id=?")
  .run(ariana.id,wedding.id);

/* Cuenta propietaria interna. */
const studioPlan = db.prepare("SELECT id FROM plans WHERE code='studio'").get();
if (!db.prepare("SELECT id FROM subscriptions WHERE user_id=? LIMIT 1").get(owner.id)) {
  db.prepare(`
    INSERT INTO subscriptions(user_id,plan_id,status,ends_at)
    VALUES(?,?, 'active', datetime('now','+3650 days'))
  `).run(owner.id,studioPlan.id);
}

/* La boda se simula como cliente que ya pagó Premium. Tener cuenta no implica pago;
   este seed activa la boda expresamente para hacer la prueba comercial. */
const premiumPlan = db.prepare("SELECT * FROM plans WHERE code='premium'").get();
let subscription = db.prepare("SELECT id FROM subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1").get(ariana.id);
if (!subscription) {
  const info = db.prepare(`
    INSERT INTO subscriptions(user_id,plan_id,status,ends_at)
    VALUES(?,?, 'active', datetime('now', ?))
  `).run(ariana.id,premiumPlan.id,`+${premiumPlan.duration_days} days`);
  subscription = {id:info.lastInsertRowid};
} else {
  db.prepare(`
    UPDATE subscriptions SET plan_id=?,status='active',starts_at=CURRENT_TIMESTAMP,
      ends_at=datetime('now', ?) WHERE id=?
  `).run(premiumPlan.id,`+${premiumPlan.duration_days} days`,subscription.id);
}

if (!db.prepare("SELECT id FROM payments WHERE user_id=? AND provider_reference='SEED-BODA-PAGADA'").get(ariana.id)) {
  db.prepare(`
    INSERT INTO payments(user_id,plan_id,provider,provider_reference,amount_cents,currency,status,paid_at)
    VALUES(?,?, 'demo','SEED-BODA-PAGADA',?,?,'paid',CURRENT_TIMESTAMP)
  `).run(ariana.id,premiumPlan.id,premiumPlan.price_cents,premiumPlan.currency);
}

const insertGuest = db.prepare(`
  INSERT OR IGNORE INTO guests
  (event_id,code,token,family_name,phone,max_adults,max_children,table_name,custom_message,is_test)
  VALUES(?,?,?,?,?,?,?,?,?,?)
`);

[
  ["FAM001","Familia Alvarado","529930000001",2,0,"Mesa 1","Nos dará mucha alegría compartir este día con ustedes.",0],
  ["FAM002","Familia Hernández","529930000002",2,2,"Mesa 2","Gracias por ser parte de nuestra historia.",0],
  ["FAM003","Familia Jiménez","529930000003",1,3,"Mesa 3","Será muy especial contar con ustedes.",0],
  ["PRUEBA01","Invitación de prueba","",2,1,"Mesa demo","Esta invitación no cuenta en producción.",1]
].forEach(([code,family,phone,adults,children,table,message,isTest]) => {
  insertGuest.run(wedding.id,code,makeToken(),family,phone,adults,children,table,message,isTest);
});

console.log("Datos creados con separación propietario/cliente.");
console.log("Superusuario: leyva2636@gmail.com / Cambiar123!");
console.log("Cliente boda: ariana@evento.local / Cambiar123!");
console.log("La cuenta de Ariana se simuló con plan Premium pagado.");
