"use strict";

/* Compatibilidad no destructiva: siempre trabaja sobre una copia temporal de
   la base indicada por EVENTSTUDIO_IMPORTED_DB y nunca imprime datos privados. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn}=require("node:child_process");
const {once}=require("node:events");
const bcrypt=require("bcryptjs");
const Database=require("better-sqlite3");
const {SCHEMA_VERSION}=require("../src/schema-version");

const source=path.resolve(String(process.env.EVENTSTUDIO_IMPORTED_DB||""));
if(!process.env.EVENTSTUDIO_IMPORTED_DB){
  console.log("↷ Compatibilidad de base importada omitida: define EVENTSTUDIO_IMPORTED_DB.");
  process.exit(0);
}
assert.ok(fs.existsSync(source),"No existe la base importada indicada.");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-imported-db-"));
const destination=path.join(storage,"data","wedding.db");
const port=5500+(process.pid%100);
const base=`http://127.0.0.1:${port}`;
let server;

function copyDatabase(){
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  for(const suffix of ["","-wal","-shm"]){
    const input=`${source}${suffix}`;
    if(fs.existsSync(input))fs.copyFileSync(input,`${destination}${suffix}`);
  }
}
async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});
  if(token)headers.set("Authorization",`Bearer ${token}`);
  if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;
  if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const type=response.headers.get("content-type")||"";
  return {response,data:type.includes("application/json")?await response.json():await response.text()};
}
async function waitForServer(){
  for(let attempt=0;attempt<80;attempt++){
    try{if((await request("/api/health")).response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,125));
  }
  throw new Error("La aplicación no abrió la copia de la base importada.");
}

async function main(){
  copyDatabase();
  let db=new Database(destination);
  assert.equal(db.pragma("quick_check",{simple:true}),"ok");
  assert.equal(db.pragma("user_version",{simple:true}),SCHEMA_VERSION);
  const before={
    users:Number(db.prepare("SELECT COUNT(*) total FROM users").get().total),
    events:Number(db.prepare("SELECT COUNT(*) total FROM events").get().total),
    guests:Number(db.prepare("SELECT COUNT(*) total FROM guests").get().total),
    photos:Number(db.prepare("SELECT COUNT(*) total FROM photos").get().total)
  };
  const email=`compatibilidad-rc21-${process.pid}@example.test`,password="CompatibilidadSegura123!";
  db.prepare(`INSERT INTO users(email,password_hash,display_name,role,active,must_change_password)
    VALUES(?,?,?,'owner',1,0)`).run(email,bcrypt.hashSync(password,10),"Propietario sintético RC21");
  db.close();

  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,PAYMENT_PROVIDER:"disabled",ALLOW_PUBLIC_REGISTRATION:"false"};
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});
  await waitForServer();
  const login=await request("/api/auth/login",{method:"POST",json:{email,password}});
  assert.equal(login.response.status,200,JSON.stringify(login.data));
  const token=login.data.token;
  const summary=await request("/api/admin/platform-summary",{token});
  assert.equal(summary.response.status,200);
  assert.ok(Number(summary.data.events)>=before.events);
  const created=await request("/api/admin/events",{method:"POST",token,json:{name:"Evento sintético de compatibilidad",eventType:"wedding"}});
  assert.equal(created.response.status,200,JSON.stringify(created.data));
  const preview=await request("/api/admin/preview-links",{method:"POST",token,eventId:created.data.id,json:{minutes:10}});
  assert.equal(preview.response.status,201,JSON.stringify(preview.data));
  const previewToken=new URL(preview.data.url).searchParams.get("previewToken");
  const config=await request(`/api/config/${encodeURIComponent(created.data.slug)}?previewToken=${encodeURIComponent(previewToken)}&previewOpening=night-flower-original&opening=1&forceMotion=1`);
  assert.equal(config.response.status,200,JSON.stringify(config.data));
  assert.equal(config.data.presentation.openingStyle,"night-flower-original");

  server.kill("SIGTERM");await once(server,"exit");server=null;
  db=new Database(destination,{readonly:true,fileMustExist:true});
  assert.equal(db.pragma("integrity_check",{simple:true}),"ok");
  assert.equal(Number(db.prepare("SELECT COUNT(*) total FROM users").get().total),before.users+1);
  assert.equal(Number(db.prepare("SELECT COUNT(*) total FROM events").get().total),before.events+1);
  assert.equal(Number(db.prepare("SELECT COUNT(*) total FROM guests").get().total),before.guests);
  assert.equal(Number(db.prepare("SELECT COUNT(*) total FROM photos").get().total),before.photos);
  db.close();
  console.log(`✓ Base importada compatible: ${before.users} usuarios, ${before.events} eventos; integridad y preview RC21 verificados sobre copia`);
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(server&&!server.killed){server.kill("SIGTERM");await once(server,"exit").catch(()=>{});}
  fs.rmSync(storage,{recursive:true,force:true});
});
