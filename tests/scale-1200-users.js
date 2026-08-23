"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync}=require("node:child_process");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-scale-1200-"));
process.env.NODE_ENV="test";
process.env.STORAGE_ROOT=storage;
process.env.PAYMENT_PROVIDER="disabled";
execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env:process.env,stdio:"ignore"});
const db=require("../src/db");
const commerce=require("../src/commerce");
const defaults=require("../config/default-settings.json");

try{
  const userInsert=db.prepare("INSERT INTO users(email,password_hash,display_name,role,login_identifier,auth_provider,preferred_locale) VALUES(?,?,?,'client',?,'local',?)");
  const eventInsert=db.prepare("INSERT INTO events(slug,name,settings_json,event_type,owner_user_id,published,protected) VALUES(?,?,?,'wedding',?,0,0)");
  const linkInsert=db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,'manage')");
  const subscriptionInsert=db.prepare("INSERT INTO subscriptions(user_id,plan_id,status,ends_at) VALUES(?,?,'active',datetime('now','+365 days'))");
  const controlInsert=db.prepare("INSERT INTO account_commercial_controls(user_id,customer_profile_id,note) VALUES(?,?,?)");
  const courtesyInsert=db.prepare("INSERT INTO event_grants(event_id,product_id,source,source_reference,granted_by,note) VALUES(?,?,'courtesy',?,?,?)");
  const express=db.prepare("SELECT id FROM plans WHERE code='express'").get();
  const garden=db.prepare("SELECT id FROM product_catalog WHERE code='experience:luminous-garden'").get();
  const owner=db.prepare("SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1").get();
  const profiles=db.prepare("SELECT id,code FROM customer_profiles WHERE active=1 ORDER BY sort_order,id").all();
  assert.equal(profiles.length,4);
  const settings=JSON.stringify({...defaults,event:{...(defaults.event||{}),dateLabel:"Fecha de prueba"}});
  const started=Date.now();
  const created=[];
  db.transaction(()=>{
    for(let index=0;index<1200;index++){
      const suffix=String(index+1).padStart(4,"0");
      const user=userInsert.run(`capacity-${suffix}@example.test`,"hash-prueba-no-utilizable",`Usuario capacidad ${suffix}`,`capacity-${suffix}@example.test`,["es","en","pt"][index%3]);
      const event=eventInsert.run(`capacidad-${suffix}`,`Evento capacidad ${suffix}`,settings,user.lastInsertRowid);
      linkInsert.run(user.lastInsertRowid,event.lastInsertRowid);
      subscriptionInsert.run(user.lastInsertRowid,express.id);
      controlInsert.run(user.lastInsertRowid,profiles[index%profiles.length].id,`Perfil ${profiles[index%profiles.length].code}`);
      if(index%8===0)courtesyInsert.run(event.lastInsertRowid,garden.id,`scale-courtesy-${suffix}`,owner.id,"Cortesía de carga; importe 0");
      created.push({userId:Number(user.lastInsertRowid),eventId:Number(event.lastInsertRowid),courtesy:index%8===0});
    }
  })();
  const insertMs=Date.now()-started;
  assert.equal(db.prepare("SELECT COUNT(*) total FROM users WHERE email LIKE 'capacity-%@example.test'").get().total,1200);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM events WHERE slug LIKE 'capacidad-%'").get().total,1200);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM event_grants WHERE source_reference LIKE 'scale-courtesy-%'").get().total,150);
  assert.equal(db.prepare("SELECT COUNT(DISTINCT customer_profile_id) total FROM account_commercial_controls WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'capacity-%@example.test')").get().total,4);

  const entitlementQuery=db.prepare(`SELECT s.*,p.code plan_code,p.name plan_name,p.max_events,p.max_guests,p.max_storage_mb FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.id DESC LIMIT 1`);
  const eventQuery=db.prepare("SELECT * FROM events WHERE id=?");
  const membershipQuery=db.prepare("SELECT 1 FROM user_events WHERE user_id=? AND event_id=?");
  const entitlementFor=userId=>entitlementQuery.get(userId);
  const decisionStarted=Date.now();
  for(const row of created){
    const event=eventQuery.get(row.eventId);
    const access=commerce.accessForEvent(event,entitlementFor(row.userId));
    assert.equal(access.keys.has("opening:luminous-garden"),row.courtesy,`Derecho incorrecto para evento ${row.eventId}`);
    const foreign=membershipQuery.get(row.userId,created[(row.eventId+17)%created.length].eventId);
    assert.equal(Boolean(foreign),false,"No debe existir acceso cruzado.");
  }
  const decisionMs=Date.now()-decisionStarted;
  const courtesyRevenue=db.prepare("SELECT COALESCE(SUM(CASE WHEN source='courtesy' THEN 0 ELSE 1 END),0) total FROM event_grants WHERE source_reference LIKE 'scale-courtesy-%'").get().total;
  assert.equal(courtesyRevenue,0);
  assert.equal(db.pragma("quick_check",{simple:true}),"ok");
  assert.ok(insertMs<15000,`La creación de 1,200 cuentas tardó ${insertMs} ms.`);
  assert.ok(decisionMs<20000,`La evaluación de 1,200 derechos tardó ${decisionMs} ms.`);
  console.log(`✓ 1,200 usuarios/eventos: alta ${insertMs} ms, permisos ${decisionMs} ms, 4 perfiles y 150 cortesías aisladas`);
}finally{
  db.close();
  fs.rmSync(storage,{recursive:true,force:true});
}
