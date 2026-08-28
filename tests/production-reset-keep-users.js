"use strict";
const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");

const root=path.join(__dirname,"..");
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-reset-"));
const data=path.join(temp,"data"),uploads=path.join(temp,"uploads");
fs.mkdirSync(data,{recursive:true});
fs.mkdirSync(path.join(uploads,"guest-photos"),{recursive:true});
fs.mkdirSync(path.join(uploads,"site-media"),{recursive:true});
fs.writeFileSync(path.join(uploads,"guest-photos","old.jpg"),"old-photo");
fs.writeFileSync(path.join(uploads,"site-media","old.mp3"),"old-media");

const env={...process.env,
  NODE_ENV:"production",EVENTSTUDIO_RESET_TEST_MODE:"1",STORAGE_ROOT:temp,DATA_DIR:data,UPLOADS_DIR:uploads,
  NODE_OPTIONS:`--require=${path.join(root,"tests/support/install-sqlite-shim.js")}`,
  NODE_PATH:process.env.NODE_PATH||""
};

function node(code){
  const result=spawnSync(process.execPath,["-e",code],{cwd:root,env,encoding:"utf8"});
  if(result.status!==0)throw new Error(`${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

node(`
const db=require('./src/db');
const bcrypt=require('bcryptjs');
const insert=db.prepare("INSERT INTO users(email,password_hash,display_name,role,active) VALUES(?,?,?,?,1)");
const owner=insert.run('owner@reset.test',bcrypt.hashSync('OwnerPassword!1',4),'Owner','owner').lastInsertRowid;
const developer=insert.run('developer@reset.test',bcrypt.hashSync('Developer!123',4),'Developer','developer').lastInsertRowid;
const client=insert.run('client@reset.test',bcrypt.hashSync('ClientPassword!1',4),'Client','client').lastInsertRowid;
const plan=db.prepare("SELECT id FROM plans ORDER BY id LIMIT 1").get().id;
db.prepare("INSERT INTO subscriptions(user_id,plan_id,status,ends_at) VALUES(?,?, 'active', datetime('now','+365 day'))").run(client,plan);
const profile=db.prepare("SELECT id FROM customer_profiles ORDER BY id LIMIT 1").get().id;
db.prepare("INSERT INTO account_commercial_controls(user_id,customer_profile_id,max_events_override,max_published_events_override,note,updated_by) VALUES(?,?,?,?,?,?)").run(client,profile,3,1,'preserve-me',owner);
const event=db.prepare("INSERT INTO events(slug,name,settings_json,owner_user_id) VALUES('legacy-event','Legacy Event','{}',?)").run(client).lastInsertRowid;
db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,'manage')").run(client,event);
db.prepare("INSERT INTO payments(user_id,plan_id,provider,amount_cents,currency,status,paid_at) VALUES(?,?, 'demo',1079600,'MXN','paid',CURRENT_TIMESTAMP)").run(client,plan);
const cart=db.prepare("INSERT INTO carts(user_id,event_id,status) VALUES(?,?,'submitted')").run(client,event).lastInsertRowid;
db.prepare("INSERT INTO orders(user_id,event_id,cart_id,status,subtotal_cents,currency,paid_at) VALUES(?,?,?,'paid',25000,'MXN',CURRENT_TIMESTAMP)").run(client,event,cart);
console.log(JSON.stringify({owner,developer,client}));
db.close();
`);

const before=JSON.parse(node(`
const db=require('./src/db');
const out={
 users:db.prepare('SELECT id,email,password_hash,display_name,role,active FROM users ORDER BY id').all(),
 subscriptions:db.prepare('SELECT * FROM subscriptions ORDER BY id').all(),
 controls:db.prepare('SELECT * FROM account_commercial_controls ORDER BY user_id').all()
}; console.log(JSON.stringify(out)); db.close();
`));

const reset=spawnSync(process.execPath,["scripts/reset-production-keep-users.js","--confirm","RESET_KEEP_USERS"],{cwd:root,env,encoding:"utf8"});
assert.strictEqual(reset.status,0,`${reset.stdout}\n${reset.stderr}`);
const jsonStart=reset.stdout.indexOf("{\n");
const report=JSON.parse(reset.stdout.slice(jsonStart));
assert.strictEqual(report.before.revenueCents,1104600);
assert.strictEqual(report.after.revenueCents,0);
assert.strictEqual(report.after.events,0);
assert.strictEqual(report.invariants.usersPreserved,true);
assert.strictEqual(report.invariants.subscriptionsPreserved,true);
assert.strictEqual(report.invariants.commercialControlsPreserved,true);

const after=JSON.parse(node(`
const db=require('./src/db');
const out={
 users:db.prepare('SELECT id,email,password_hash,display_name,role,active FROM users ORDER BY id').all(),
 subscriptions:db.prepare('SELECT * FROM subscriptions ORDER BY id').all(),
 controls:db.prepare('SELECT * FROM account_commercial_controls ORDER BY user_id').all(),
 events:db.prepare('SELECT COUNT(*) total FROM events').get().total,
 payments:db.prepare('SELECT COUNT(*) total FROM payments').get().total,
 orders:db.prepare('SELECT COUNT(*) total FROM orders').get().total,
 fk:db.pragma('foreign_key_check'), integrity:db.pragma('integrity_check',{simple:true})
}; console.log(JSON.stringify(out)); db.close();
`));
assert.deepStrictEqual(after.users,before.users);
assert.deepStrictEqual(after.subscriptions,before.subscriptions);
assert.deepStrictEqual(after.controls,before.controls);
assert.strictEqual(after.events,0);assert.strictEqual(after.payments,0);assert.strictEqual(after.orders,0);
assert.deepStrictEqual(after.fk,[]);assert.strictEqual(after.integrity,'ok');
assert.strictEqual(fs.readdirSync(path.join(uploads,'guest-photos')).length,0);
assert.strictEqual(fs.readdirSync(path.join(uploads,'site-media')).length,0);
assert.ok(fs.readdirSync(path.join(temp,'reset-archives')).length>=1);
assert.ok(fs.readdirSync(path.join(temp,'backups')).some(name=>name.startsWith('pre-reset-keep-users-')&&name.endsWith('.db')));
assert.ok(fs.readdirSync(path.join(temp,'backups')).some(name=>name.startsWith('post-reset-keep-users-')&&name.endsWith('.db')));

console.log('✓ Reset productivo conserva usuarios/accesos, pone ingresos/eventos en cero y archiva multimedia de forma reversible');
