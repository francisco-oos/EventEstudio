"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");
const themes=require("../config/themes.json");
const experiences=require("../config/experiences.json");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-rc21-invitations-"));
const port=5300+(process.pid%100);
const base=`http://127.0.0.1:${port}`;
let server;

async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});if(token)headers.set("Authorization",`Bearer ${token}`);if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const type=response.headers.get("content-type")||"";const data=type.includes("application/json")?await response.json():await response.text();return {response,data};
}
async function waitForServer(){for(let attempt=0;attempt<80;attempt++){try{if((await request("/api/health")).response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,125));}throw new Error("No inició la matriz RC21.");}
async function previewLink(token,eventId){
  const result=await request("/api/admin/preview-links",{method:"POST",token,eventId,json:{}});assert.equal(result.response.status,201,JSON.stringify(result.data));return new URL(result.data.url).searchParams.get("previewToken");
}
async function createAccount(ownerToken,{email,name,role}){
  const password="TemporalSegura123!";
  const created=await request("/api/admin/users",{method:"POST",token:ownerToken,json:{email,displayName:name,role,password,eventIds:[]}});assert.equal(created.response.status,201,JSON.stringify(created.data));
  const login=await request("/api/auth/login",{method:"POST",json:{email,password}});assert.equal(login.response.status,200);
  const changed=await request("/api/auth/password",{method:"PUT",token:login.data.token,json:{currentPassword:password,newPassword:"DefinitivaSegura123!"}});assert.equal(changed.response.status,200);
  return {id:created.data.id,token:login.data.token};
}

async function main(){
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,PAYMENT_PROVIDER:"disabled",ALLOW_PUBLIC_REGISTRATION:"true"};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});await waitForServer();

  const ownerLogin=await request("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}});assert.equal(ownerLogin.response.status,200);const ownerToken=ownerLogin.data.token;
  const developer=await createAccount(ownerToken,{email:`developer-rc21-${process.pid}@example.test`,name:"Desarrollo RC21",role:"developer"});
  const registration=await request("/api/auth/register",{method:"POST",json:{displayName:"Cliente autónomo RC21",email:`registro-rc21-${process.pid}@example.test`,password:"RegistroSeguro123!",planCode:"starter",eventType:"wedding",themeId:"romantic-wine",locale:"es",acceptTerms:true}});
  assert.equal(registration.response.status,201,JSON.stringify(registration.data));assert.equal(registration.data.user.role,"client");
  const clientToken=registration.data.token,eventId=registration.data.eventId;
  const event=(await request("/api/admin/events",{token:clientToken})).data.find(item=>item.id===eventId);assert.ok(event&&!event.published);

  const restrictedClient=await createAccount(ownerToken,{email:`client-rc21-${process.pid}@example.test`,name:"Cliente limitado RC21",role:"client"});
  const express=await request(`/api/admin/users/${restrictedClient.id}/grant-plan`,{method:"POST",token:ownerToken,json:{planCode:"express",reason:"Matriz limitada RC21"}});assert.equal(express.response.status,200);
  const restrictedCreated=await request("/api/admin/events",{method:"POST",token:ownerToken,json:{name:"Evento limitado RC21",eventType:"wedding"}});assert.equal(restrictedCreated.response.status,200);
  const transferred=await request(`/api/admin/events/${restrictedCreated.data.id}/transfer`,{method:"POST",token:ownerToken,json:{clientId:restrictedClient.id}});assert.equal(transferred.response.status,200);
  const restrictedEvent=restrictedCreated.data;

  const ownerFeatures=await request("/api/admin/features",{token:ownerToken,eventId});const developerFeatures=await request("/api/admin/features",{token:developer.token,eventId});const clientFeatures=await request("/api/admin/features",{token:restrictedClient.token,eventId:restrictedEvent.id});
  assert.equal(ownerFeatures.data.designAccess.opening["night-flower-original"],true);assert.equal(developerFeatures.data.designAccess.opening["night-flower-original"],true);assert.equal(clientFeatures.data.designAccess.opening["night-flower-original"],false);

  const ownerPreview=await previewLink(ownerToken,eventId);
  for(const opening of experiences.openings.filter(item=>item.id!=="none")){
    const config=await request(`/api/config/${encodeURIComponent(event.slug)}?previewToken=${encodeURIComponent(ownerPreview)}&previewOpening=${encodeURIComponent(opening.id)}&opening=1&forceMotion=1`);
    assert.equal(config.response.status,200,`${opening.id}: ${JSON.stringify(config.data)}`);assert.equal(config.data.presentation.openingStyle,opening.id,`Owner no pudo probar ${opening.id}.`);
  }

  const clientPreview=await previewLink(restrictedClient.token,restrictedEvent.id);
  const clientBlocked=await request(`/api/config/${encodeURIComponent(restrictedEvent.slug)}?previewToken=${encodeURIComponent(clientPreview)}&previewOpening=night-flower-original&opening=1&forceMotion=1`);
  assert.equal(clientBlocked.data.presentation.openingStyle,"wax-envelope","Un preview cliente no debe conceder una experiencia interna.");
  const clientPublicPreview=await request(`/api/config/${encodeURIComponent(restrictedEvent.slug)}?previewToken=${encodeURIComponent(clientPreview)}&previewOpening=particle-heart&opening=1&forceMotion=1`);
  assert.equal(clientPublicPreview.data.presentation.openingStyle,"particle-heart","La tienda cliente debe poder probar un producto público sin adquirirlo.");
  assert.equal((await request("/api/admin/features",{token:restrictedClient.token,eventId:restrictedEvent.id})).data.designAccess.opening["particle-heart"],false,"Probar no debe conceder el producto.");

  const revenueBefore=(await request("/api/admin/owner-summary",{token:ownerToken})).data.revenue_cents;
  const catalog=await request("/api/admin/commerce/catalog",{token:ownerToken});const original=catalog.data.products.find(product=>product.code==="experience:night-flower-original");assert.ok(original);
  const courtesy=await request(`/api/admin/events/${restrictedEvent.id}/grants`,{method:"POST",token:ownerToken,json:{productId:original.id,note:"Cortesía sintética RC21"}});assert.equal(courtesy.response.status,201,JSON.stringify(courtesy.data));assert.equal(courtesy.data.revenue_cents,0);
  assert.equal((await request("/api/admin/owner-summary",{token:ownerToken})).data.revenue_cents,revenueBefore);
  const enabled=await request("/api/admin/settings",{method:"PUT",token:restrictedClient.token,eventId:restrictedEvent.id,json:{presentation:{openingStyle:"night-flower-original",motionLevel:"balanced",floralPetalColor:"#4fd8c8",floralCenterColor:"#fff2a8"}}});assert.equal(enabled.response.status,200,JSON.stringify(enabled.data));
  const entitledPreview=await request(`/api/config/${encodeURIComponent(restrictedEvent.slug)}?previewToken=${encodeURIComponent(clientPreview)}&previewOpening=night-flower-original&opening=1&forceMotion=1`);assert.equal(entitledPreview.data.presentation.openingStyle,"night-flower-original");assert.equal(entitledPreview.data.presentation.floralPetalColor,"#4fd8c8");

  /* Cada plantilla se aplica a un evento compatible. Así se prueba la ruta real
     de configuración y no sólo la presencia del identificador en JSON. */
  const eventByType=new Map([["wedding",event]]),tokenByEvent=new Map([[eventId,ownerPreview]]);
  for(const theme of themes){
    const eventType=theme.eventTypes[0];
    if(!eventByType.has(eventType)){
      const created=await request("/api/admin/events",{method:"POST",token:ownerToken,json:{name:`Evento plantilla ${eventType}`,eventType}});assert.equal(created.response.status,200,JSON.stringify(created.data));eventByType.set(eventType,created.data);
    }
    const target=eventByType.get(eventType);if(!tokenByEvent.has(target.id))tokenByEvent.set(target.id,await previewLink(ownerToken,target.id));
    const config=await request(`/api/config/${encodeURIComponent(target.slug)}?previewToken=${encodeURIComponent(tokenByEvent.get(target.id))}&previewTheme=${encodeURIComponent(theme.id)}`);
    assert.equal(config.response.status,200,theme.id);assert.equal(config.data.themeId,theme.id,`La plantilla ${theme.id} no se aplicó en preview.`);
  }

  const publication=await request(`/api/admin/events/${eventId}/publication`,{method:"PATCH",token:ownerToken,eventId,json:{published:true}});assert.equal(publication.response.status,200);assert.equal(publication.data.published,true);
  const guestCreated=await request("/api/admin/guests",{method:"POST",token:clientToken,eventId,json:{code:"RC21-RSVP",family_name:"Familia de prueba",phone:"5512345678",max_adults:2,max_children:1,table_name:"Mesa de prueba"}});assert.equal(guestCreated.response.status,200,JSON.stringify(guestCreated.data));
  const guests=await request("/api/admin/guests",{token:clientToken,eventId});const guest=guests.data.find(item=>item.code==="RC21-RSVP");assert.ok(guest?.token);
  const invitation=await request(`/api/invitation/token/${encodeURIComponent(guest.token)}`);assert.equal(invitation.response.status,200);assert.equal(invitation.data.guest.family_name,"Familia de prueba");assert.equal("settings_json" in invitation.data.guest,false);
  const confirmed=await request("/api/rsvp",{method:"POST",json:{token:guest.token,attending:true,adults:2,children:1,attendee_names:"Persona Uno, Persona Dos y Menor",dietary:"Sin nueces",special_needs:"Silla alta",responsible_name:"Persona responsable",contact_phone:"5512345678",message:"Confirmación sintética"}});assert.equal(confirmed.response.status,200,JSON.stringify(confirmed.data));assert.equal(confirmed.data.status,"confirmed");
  const updated=await request("/api/rsvp",{method:"POST",json:{token:guest.token,attending:false,adults:0,children:0,message:"Cambio de respuesta sintético"}});assert.equal(updated.response.status,200,JSON.stringify(updated.data));assert.equal(updated.data.status,"declined");
  const saved=await request(`/api/invitation/token/${encodeURIComponent(guest.token)}`);assert.equal(Boolean(saved.data.rsvp.attending),false);assert.equal(saved.data.rsvp.message,"Cambio de respuesta sintético");
  const overflow=await request("/api/rsvp",{method:"POST",json:{token:guest.token,attending:true,adults:3,children:1}});assert.equal(overflow.response.status,400);
  const negative=await request("/api/rsvp",{method:"POST",json:{token:guest.token,attending:true,adults:-1,children:0}});assert.equal(negative.response.status,400);

  console.log(`✓ RC21: ${themes.length} plantillas, ${experiences.openings.length-1} aperturas, previews autorizados, registro y RSVP HTTP verificados`);
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server&&!server.killed){server.kill("SIGTERM");await once(server,"exit").catch(()=>{});}fs.rmSync(storage,{recursive:true,force:true});});
