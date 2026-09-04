"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {performance}=require("node:perf_hooks");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-rc23-e2e-"));
const port=6100+(process.pid%300);
const base=`http://127.0.0.1:${port}`;
let server;

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});
  if(token)headers.set("Authorization",`Bearer ${token}`);
  if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;
  if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const started=performance.now();
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const elapsedMs=performance.now()-started;
  const type=response.headers.get("content-type")||"";
  const data=type.includes("application/json")?await response.json():await response.text();
  return {response,data,elapsedMs};
}

async function waitForServer(){
  for(let attempt=0;attempt<80;attempt++){
    try{if((await request("/api/health")).response.ok)return;}catch{}
    await wait(125);
  }
  throw new Error("El servidor E2E RC23 no inició.");
}

async function createAccount(ownerToken,{email,name,role="client",planCode=null}){
  const created=await request("/api/admin/users",{method:"POST",token:ownerToken,json:{email,displayName:name,role,password:"TemporalSegura123!",eventIds:[]}});
  assert.equal(created.response.status,201,JSON.stringify(created.data));
  const login=await request("/api/auth/login",{method:"POST",json:{email,password:"TemporalSegura123!"}});
  assert.equal(login.response.status,200,JSON.stringify(login.data));
  const changed=await request("/api/auth/password",{method:"PUT",token:login.data.token,json:{currentPassword:"TemporalSegura123!",newPassword:"DefinitivaSegura123!"}});
  assert.equal(changed.response.status,200,JSON.stringify(changed.data));
  if(planCode){
    const granted=await request(`/api/admin/users/${created.data.id}/grant-plan`,{method:"POST",token:ownerToken,json:{planCode,reason:"Matriz E2E RC23"}});
    assert.equal(granted.response.status,200,JSON.stringify(granted.data));
  }
  return {id:Number(created.data.id),token:login.data.token,email};
}

async function createTransferredEvent(ownerToken,client,{name,eventType="wedding"}){
  const created=await request("/api/admin/events",{method:"POST",token:ownerToken,json:{name,eventType}});
  assert.equal(created.response.status,200,JSON.stringify(created.data));
  const transferred=await request(`/api/admin/events/${created.data.id}/transfer`,{method:"POST",token:ownerToken,json:{clientId:client.id}});
  assert.equal(transferred.response.status,200,JSON.stringify(transferred.data));
  return created.data;
}

function percentile(values,p){
  const ordered=[...values].sort((a,b)=>a-b);
  if(!ordered.length)return 0;
  return ordered[Math.min(ordered.length-1,Math.max(0,Math.ceil(ordered.length*p)-1))];
}

async function main(){
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,PAYMENT_PROVIDER:"disabled",ENABLE_DEMO_PAYMENTS:"false",ALLOW_PUBLIC_REGISTRATION:"false"};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});
  await waitForServer();

  const ownerLogin=await request("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}});
  assert.equal(ownerLogin.response.status,200,JSON.stringify(ownerLogin.data));
  const ownerToken=ownerLogin.data.token;

  const developer=await createAccount(ownerToken,{email:`rc23-dev-${process.pid}@example.test`,name:"Developer RC23",role:"developer"});
  const premium=await createAccount(ownerToken,{email:`rc23-premium-${process.pid}@example.test`,name:"Cliente Premium RC23",planCode:"premium"});
  const express=await createAccount(ownerToken,{email:`rc23-express-${process.pid}@example.test`,name:"Cliente Express RC23",planCode:"express"});
  const starter=await createAccount(ownerToken,{email:`rc23-starter-${process.pid}@example.test`,name:"Cliente Starter RC23",planCode:"starter"});

  const premiumEvent=await createTransferredEvent(ownerToken,premium,{name:"Evento Premium RC23"});
  const expressEvent=await createTransferredEvent(ownerToken,express,{name:"Evento Express RC23"});
  const starterEvent=await createTransferredEvent(ownerToken,starter,{name:"Evento Starter RC23"});

  /* Constructor de perfiles: Owner/Developer operan; Client queda fuera. */
  const profileName=`Perfil QA RC23 ${process.pid}`;
  const profileCreated=await request("/api/admin/commercial-profiles",{method:"POST",token:ownerToken,json:{name:profileName,description:"Perfil creado por E2E RC23",catalogMode:"all",recommendedCategories:[]}});
  assert.equal(profileCreated.response.status,201,JSON.stringify(profileCreated.data));
  const ownerCatalog=await request("/api/admin/commerce/catalog",{token:ownerToken});
  assert.equal(ownerCatalog.response.status,200);
  const profile=ownerCatalog.data.profiles.find(item=>item.name===profileName);
  assert.ok(profile,"El perfil recién creado debe aparecer en Mi Negocio.");
  const profileUpdated=await request(`/api/admin/commercial-profiles/${profile.id}`,{method:"PUT",token:developer.token,json:{name:profileName,description:"Actualizado por Developer RC23",catalogMode:"all",recommendedCategories:[],curatedProductIds:[],active:true,sortOrder:profile.sort_order||0}});
  assert.equal(profileUpdated.response.status,200,JSON.stringify(profileUpdated.data));
  assert.equal((await request("/api/admin/commerce/catalog",{token:premium.token})).response.status,403,"Un cliente no debe entrar al Constructor de Perfiles/Mi Negocio.");

  /* Mi Negocio mantiene paridad Owner/Developer y perfil de cliente consultable sólo desde plataforma. */
  const developerCatalog=await request("/api/admin/commerce/catalog",{token:developer.token});
  assert.equal(developerCatalog.response.status,200);
  assert.equal(developerCatalog.data.products.length,ownerCatalog.data.products.length,"Owner y Developer deben operar sobre el mismo catálogo técnico.");
  assert.equal((await request(`/api/admin/clients/${premium.id}/commercial-profile`,{token:developer.token})).response.status,200);
  assert.equal((await request(`/api/admin/clients/${premium.id}/commercial-profile`,{token:starter.token})).response.status,403);

  /* Planos/layouts: Premium puede operar su evento; Express no obtiene seating por accidente. */
  const seating=await request("/api/admin/seating?mode=planned",{token:premium.token,eventId:premiumEvent.id});
  assert.equal(seating.response.status,200,JSON.stringify(seating.data));
  assert.ok(Array.isArray(seating.data.tables)&&seating.data.tables.length>=1,"Premium debe recibir un plano inicial utilizable.");
  const savedLayout=await request("/api/admin/seating/layout",{method:"PUT",token:premium.token,eventId:premiumEvent.id,json:{mode:"planned",tables:seating.data.tables,zones:seating.data.zones}});
  assert.equal(savedLayout.response.status,200,JSON.stringify(savedLayout.data));
  const expressSeating=await request("/api/admin/seating?mode=planned",{token:express.token,eventId:expressEvent.id});
  assert.equal(expressSeating.response.status,403,"Express no debe recibir Plano y mesas sin derecho.");
  assert.equal(expressSeating.data.code,"FEATURE_UNAVAILABLE");
  assert.equal((await request("/api/admin/seating?mode=planned",{token:premium.token,eventId:expressEvent.id})).response.status,403,"Un cliente Premium no puede cruzar al evento Express.");

  /* URL pública: se calcula antes de invitados; al publicar, página y config funcionan sin token i=. */
  const publicUrlBefore=await request(`/api/admin/events/${expressEvent.id}/public-url`,{token:express.token,eventId:expressEvent.id});
  assert.equal(publicUrlBefore.response.status,200,JSON.stringify(publicUrlBefore.data));
  assert.equal(publicUrlBefore.data.published,false);
  assert.match(publicUrlBefore.data.url,new RegExp(`/e/${expressEvent.slug}$`));
  const publish=await request(`/api/admin/events/${expressEvent.id}/publication`,{method:"PATCH",token:ownerToken,eventId:expressEvent.id,json:{published:true}});
  assert.equal(publish.response.status,200,JSON.stringify(publish.data));
  const publicPage=await request(`/e/${encodeURIComponent(expressEvent.slug)}`);
  assert.equal(publicPage.response.status,200,"La invitación pública debe cargar sin crear invitados.");
  assert.match(String(publicPage.data),/id="invitation"/);
  const publicConfig=await request(`/api/config/${encodeURIComponent(expressEvent.slug)}`);
  assert.equal(publicConfig.response.status,200,"La configuración pública no debe depender de RSVP ni tokens de invitado.");
  assert.equal(publicConfig.data.event.slug,expressEvent.slug);

  /* Carga concurrente: plataforma, clientes y público comparten proceso sin mezclar tenants. */
  const scenarios=[
    {name:"owner-business",run:()=>request("/api/admin/commerce/catalog",{token:ownerToken}),status:200},
    {name:"developer-business",run:()=>request("/api/admin/commerce/catalog",{token:developer.token}),status:200},
    {name:"premium-settings",run:()=>request("/api/admin/settings",{token:premium.token,eventId:premiumEvent.id}),status:200},
    {name:"starter-settings",run:()=>request("/api/admin/settings",{token:starter.token,eventId:starterEvent.id}),status:200},
    {name:"premium-seating",run:()=>request("/api/admin/seating?mode=planned",{token:premium.token,eventId:premiumEvent.id}),status:200},
    {name:"public-page",run:()=>request(`/e/${encodeURIComponent(expressEvent.slug)}`),status:200},
    {name:"public-config",run:()=>request(`/api/config/${encodeURIComponent(expressEvent.slug)}`),status:200},
    {name:"premium-cross",run:()=>request("/api/admin/settings",{token:premium.token,eventId:starterEvent.id}),status:403},
    {name:"starter-cross",run:()=>request("/api/admin/settings",{token:starter.token,eventId:premiumEvent.id}),status:403}
  ];
  const rounds=Math.max(4,Math.min(40,Number(process.env.EVENTSTUDIO_CONCURRENT_ROUNDS)||12));
  const jobs=[];
  for(let round=0;round<rounds;round++)for(const scenario of scenarios)jobs.push((async()=>({scenario,...await scenario.run()}))());
  const results=await Promise.all(jobs);
  for(const result of results)assert.equal(result.response.status,result.scenario.status,`${result.scenario.name} devolvió ${result.response.status}.`);
  const successfulDurations=results.filter(result=>result.response.status<400).map(result=>result.elapsedMs);
  const p95=percentile(successfulDurations,.95);
  const maxAllowed=Math.max(500,Number(process.env.EVENTSTUDIO_CONCURRENT_P95_LIMIT_MS)||1500);
  assert.ok(p95<maxAllowed,`p95 concurrente ${p95.toFixed(1)} ms excede ${maxAllowed} ms.`);

  /* Relectura posterior: ninguna ráfaga debe modificar pertenencia ni layout. */
  assert.equal((await request("/api/admin/settings",{token:premium.token,eventId:expressEvent.id})).response.status,403);
  const seatingAfter=await request("/api/admin/seating?mode=planned",{token:premium.token,eventId:premiumEvent.id});
  assert.equal(seatingAfter.response.status,200);
  assert.equal(seatingAfter.data.tables.length,savedLayout.data.tables.length,"La concurrencia no debe corromper el plano.");

  console.log(`✓ RC23 E2E: ${results.length} solicitudes concurrentes, p95 ${p95.toFixed(1)} ms; perfiles, Mi Negocio, planos, roles y URL pública aislados`);
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(server&&!server.killed){server.kill("SIGTERM");await once(server,"exit").catch(()=>{});}
  fs.rmSync(storage,{recursive:true,force:true});
});
