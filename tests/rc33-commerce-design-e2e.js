"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const engine=require("../src/design-engine");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-rc33-commerce-"));
const port=4700+(process.pid%250);const base=`http://127.0.0.1:${port}`;let server;

async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});if(token)headers.set("Authorization",`Bearer ${token}`);if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const data=(response.headers.get("content-type")||"").includes("application/json")?await response.json():await response.text();return {response,data};
}
async function waitForServer(){for(let i=0;i<70;i++){try{if((await request("/api/health")).response.ok)return;}catch{}await new Promise(r=>setTimeout(r,150));}throw new Error("Servidor RC33 no inició.");}
function sectionTypes(config){return new Set((config?._designRecipe?.sections||[]).map(item=>item.type));}

async function main(){
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,ALLOW_PUBLIC_REGISTRATION:"true",PAYMENT_PROVIDER:"demo",ENABLE_DEMO_PAYMENTS:"true"};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});await waitForServer();
  const registration=await request("/api/auth/register",{method:"POST",json:{displayName:"RC33 commerce design",email:`rc33-${process.pid}@example.test`,password:"Rc33DesignSeguro123!",planCode:"express",eventType:"wedding",locale:"es",acceptTerms:true}});
  assert.equal(registration.response.status,201,JSON.stringify(registration.data));const token=registration.data.token,eventId=registration.data.eventId;
  // Termina la prueba total y fija Express para comprobar paywall real.
  const express=await request("/api/billing/checkout",{method:"POST",token,json:{planCode:"express"}});assert.equal(express.response.status,200,JSON.stringify(express.data));
  const catalogRecipe=engine.catalogRecipe("romantic-wine");assert.ok(catalogRecipe.sections.some(x=>x.type==="rsvp")&&catalogRecipe.sections.some(x=>x.type==="qr"));
  const customized=JSON.parse(JSON.stringify(catalogRecipe));customized.id=`event-${eventId}-rc33-e2e`;customized.source="custom";customized.status="draft";customized.design.palette.accent="#355f78";customized.design.typography={heading:"cinzel",body:"montserrat",scale:"large",nameCase:"title"};
  const saved=await request("/api/admin/design/recipe",{method:"PUT",token,eventId,json:{recipe:customized}});assert.equal(saved.response.status,200,JSON.stringify(saved.data));const savedHash=saved.data.hash;
  const applied=await request("/api/admin/design/apply",{method:"POST",token,eventId,json:{expectedRevision:saved.data.state.draftRevision}});assert.equal(applied.response.status,200,JSON.stringify(applied.data));assert.equal(applied.data.hash,savedHash);
  const eventSettings=(await request("/api/admin/settings",{token,eventId})).data;const slug=eventSettings._event.slug;
  const privateBefore=await request("/api/admin/design/recipe",{token,eventId});assert.equal(privateBefore.data.hash,savedHash);
  const expressPublic=(await request(`/api/config/${encodeURIComponent(slug)}?preview=1`,{token})).data;const expressTypes=sectionTypes(expressPublic);
  for(const type of ["hero","venues","gallery","music"])assert.equal(expressTypes.has(type),true,`Express debe publicar ${type}`);
  for(const type of ["rsvp","agenda","dress-code","gifts","qr"])assert.equal(expressTypes.has(type),false,`Express no debe publicar ${type}`);
  // El upgrade debe liberar funciones inmediatamente sin volver a guardar la Recipe.
  const basic=await request("/api/billing/checkout",{method:"POST",token,json:{planCode:"basic"}});assert.equal(basic.response.status,200,JSON.stringify(basic.data));
  const basicPublic=(await request(`/api/config/${encodeURIComponent(slug)}?preview=1`,{token})).data;const basicTypes=sectionTypes(basicPublic);
  for(const type of ["rsvp","agenda","dress-code","gifts","gallery","music","venues"])assert.equal(basicTypes.has(type),true,`Basic debe liberar ${type} inmediatamente.`);
  assert.equal(basicTypes.has("qr"),false,"QR de mesas sigue siendo premium.");
  const privateAfterBasic=await request("/api/admin/design/recipe",{token,eventId});assert.equal(privateAfterBasic.data.hash,savedHash,"Comprar no debe alterar la Recipe ni su personalización.");
  assert.equal(privateAfterBasic.data.recipe.design.palette.accent,"#355f78");assert.equal(privateAfterBasic.data.recipe.design.typography.heading,"cinzel");
  const premium=await request("/api/billing/checkout",{method:"POST",token,json:{planCode:"premium"}});assert.equal(premium.response.status,200,JSON.stringify(premium.data));
  const premiumPublic=(await request(`/api/config/${encodeURIComponent(slug)}?preview=1`,{token})).data;assert.equal(sectionTypes(premiumPublic).has("qr"),true,"Premium debe liberar QR sin reconstruir diseño.");
  const privateAfterPremium=await request("/api/admin/design/recipe",{token,eventId});assert.equal(privateAfterPremium.data.hash,savedHash);
  console.log("✓ RC33 commerce E2E: Express filtra, Basic libera RSVP/programa/regalos y Premium libera QR sin mutar la Recipe.");
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{server?.kill("SIGTERM");fs.rmSync(storage,{recursive:true,force:true});});
