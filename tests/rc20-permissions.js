"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-rc20-permissions-"));
const port=4700+(process.pid%200);
const base=`http://127.0.0.1:${port}`;
let server;

async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});
  if(token)headers.set("Authorization",`Bearer ${token}`);
  if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;
  if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const data=(response.headers.get("content-type")||"").includes("application/json")?await response.json():await response.text();
  return {response,data};
}

async function waitForServer(){
  for(let attempt=0;attempt<60;attempt++){
    try{if((await request("/api/health")).response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw new Error("El servidor de permisos RC20 no inició.");
}

async function createAccount(ownerToken,{email,name,role="client"}){
  const created=await request("/api/admin/users",{method:"POST",token:ownerToken,json:{email,displayName:name,role,password:"TemporalSegura123!",eventIds:[]}});
  assert.equal(created.response.status,201,JSON.stringify(created.data));
  const login=await request("/api/auth/login",{method:"POST",json:{email,password:"TemporalSegura123!"}});
  assert.equal(login.response.status,200,JSON.stringify(login.data));
  const changed=await request("/api/auth/password",{method:"PUT",token:login.data.token,json:{currentPassword:"TemporalSegura123!",newPassword:"DefinitivaSegura123!"}});
  assert.equal(changed.response.status,200,JSON.stringify(changed.data));
  return {id:created.data.id,token:login.data.token};
}

async function main(){
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,PAYMENT_PROVIDER:"demo",ENABLE_DEMO_PAYMENTS:"true",ALLOW_PUBLIC_REGISTRATION:"false"};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});
  await waitForServer();

  const ownerLogin=await request("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}});
  const ownerToken=ownerLogin.data.token;
  const developer=await createAccount(ownerToken,{email:`developer-${process.pid}@example.test`,name:"Desarrollo QA",role:"developer"});
  const clientA=await createAccount(ownerToken,{email:`client-a-${process.pid}@example.test`,name:"Cliente A"});
  const clientB=await createAccount(ownerToken,{email:`client-b-${process.pid}@example.test`,name:"Cliente B"});

  for(const client of [clientA,clientB]){
    const plan=await request(`/api/admin/users/${client.id}/grant-plan`,{method:"POST",token:ownerToken,json:{planCode:"express",reason:"Matriz de permisos RC20"}});
    assert.equal(plan.response.status,200,JSON.stringify(plan.data));
    assert.equal(plan.data.complimentary,true);
  }

  const eventA=await request("/api/admin/events",{method:"POST",token:ownerToken,json:{name:"Evento permiso A",eventType:"wedding"}});
  const eventB=await request("/api/admin/events",{method:"POST",token:ownerToken,json:{name:"Evento permiso B",eventType:"wedding"}});
  assert.equal(eventA.response.status,200);assert.equal(eventB.response.status,200);
  for(const [event,client] of [[eventA.data,clientA],[eventB.data,clientB]]){
    const transfer=await request(`/api/admin/events/${event.id}/transfer`,{method:"POST",token:ownerToken,json:{clientId:client.id}});
    assert.equal(transfer.response.status,200,JSON.stringify(transfer.data));
  }

  const ownerFeatures=await request("/api/admin/features",{token:ownerToken,eventId:eventA.data.id});
  const developerFeatures=await request("/api/admin/features",{token:developer.token,eventId:eventA.data.id});
  assert.equal(ownerFeatures.data.view,"platform");
  assert.equal(developerFeatures.data.view,"platform");
  assert.equal(ownerFeatures.data.designAccess.opening["luminous-garden"],true,"Owner debe ver Jardín luminoso.");
  assert.equal(developerFeatures.data.designAccess.opening["luminous-garden"],true,"Developer debe ver Jardín luminoso.");
  const ownerSettings=await request("/api/admin/settings",{token:ownerToken,eventId:eventA.data.id});
  const developerSettings=await request("/api/admin/settings",{token:developer.token,eventId:eventA.data.id});
  assert.equal(ownerSettings.data._designAccess.opening["luminous-garden"],true);
  assert.equal(developerSettings.data._designAccess.opening["luminous-garden"],true);

  const clientAFeatures=await request("/api/admin/features",{token:clientA.token,eventId:eventA.data.id});
  const clientBFeatures=await request("/api/admin/features",{token:clientB.token,eventId:eventB.data.id});
  assert.equal(clientAFeatures.data.designAccess.opening["luminous-garden"],false);
  assert.equal(clientBFeatures.data.designAccess.opening["luminous-garden"],false);
  const simulated=await request("/api/admin/features?view=client",{token:developer.token,eventId:eventA.data.id});
  assert.equal(simulated.data.view,"client");
  assert.equal(simulated.data.designAccess.opening["luminous-garden"],false,"La simulación debe reflejar los derechos del cliente seleccionado.");
  assert.equal((await request("/api/admin/settings",{token:clientA.token,eventId:eventB.data.id})).response.status,403,"Un cliente no debe cruzar a otro evento.");
  const blocked=await request("/api/admin/settings",{method:"PUT",token:clientA.token,eventId:eventA.data.id,json:{presentation:{openingStyle:"luminous-garden"}}});
  assert.equal(blocked.response.status,403);assert.equal(blocked.data.code,"DESIGN_PRODUCT_REQUIRED");

  const revenueBefore=(await request("/api/admin/owner-summary",{token:ownerToken})).data.revenue_cents;
  const catalog=await request("/api/admin/commerce/catalog",{token:ownerToken});
  const garden=catalog.data.products.find(product=>product.code==="experience:luminous-garden");
  assert.ok(garden,"Jardín luminoso debe existir como producto gobernado.");
  const courtesy=await request(`/api/admin/events/${eventA.data.id}/grants`,{method:"POST",token:ownerToken,json:{productId:garden.id,note:"Cortesía de prueba RC20"}});
  assert.equal(courtesy.response.status,201,JSON.stringify(courtesy.data));
  assert.equal(courtesy.data.revenue_cents,0);
  assert.equal((await request("/api/admin/owner-summary",{token:ownerToken})).data.revenue_cents,revenueBefore,"Una cortesía no puede contarse como ingreso.");

  const courtesyFeatures=await request("/api/admin/features",{token:clientA.token,eventId:eventA.data.id});
  assert.equal(courtesyFeatures.data.designAccess.opening["luminous-garden"],true);
  assert.equal((await request("/api/admin/features?view=client",{token:developer.token,eventId:eventA.data.id})).data.designAccess.opening["luminous-garden"],true);
  assert.equal((await request("/api/admin/features",{token:clientB.token,eventId:eventB.data.id})).data.designAccess.opening["luminous-garden"],false,"La cortesía no debe filtrarse a otra cuenta.");
  const enabled=await request("/api/admin/settings",{method:"PUT",token:clientA.token,eventId:eventA.data.id,json:{presentation:{openingStyle:"luminous-garden",motionLevel:"balanced"}}});
  assert.equal(enabled.response.status,200,JSON.stringify(enabled.data));

  const revoked=await request(`/api/admin/events/${eventA.data.id}/grants/${courtesy.data.id}`,{method:"DELETE",token:ownerToken});
  assert.equal(revoked.response.status,200);
  assert.equal((await request("/api/admin/features",{token:clientA.token,eventId:eventA.data.id})).data.designAccess.opening["luminous-garden"],false);
  const degraded=await request(`/api/config/${encodeURIComponent(eventA.data.slug)}?preview=1`,{token:clientA.token});
  assert.equal(degraded.data.presentation.openingStyle,"wax-envelope","Al revocar, la salida pública debe degradar a una apertura autorizada.");

  const adminSource=fs.readFileSync(path.join(root,"public/admin.js"),"utf8");
  const adminHtml=fs.readFileSync(path.join(root,"public/admin.html"),"utf8");
  assert.match(adminSource,/supportClientView=false/);
  assert.doesNotMatch(adminHtml,/id="supportClientView"[^>]*checked/);
  assert.match(adminHtml,/Simular vista cliente/);
  console.log("✓ Owner, developer, clientes, simulación y cortesías aislados correctamente");
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(server&&!server.killed){server.kill("SIGTERM");await once(server,"exit").catch(()=>{});}
  fs.rmSync(storage,{recursive:true,force:true});
});
