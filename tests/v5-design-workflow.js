"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-v5-design-"));
const port=6800+(process.pid%250),base=`http://127.0.0.1:${port}`;
let server;

async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});if(token)headers.set("Authorization",`Bearer ${token}`);if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const data=(response.headers.get("content-type")||"").includes("application/json")?await response.json():await response.text();return {response,data};
}
async function waitForServer(){for(let i=0;i<80;i++){try{if((await request("/api/health")).response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,125));}throw new Error("El servidor V5 no inició.");}

async function main(){
  const labHtml=fs.readFileSync(path.join(root,"public/design-lab.html"),"utf8"),labJs=fs.readFileSync(path.join(root,"public/design-lab.js"),"utf8");
  assert.match(labHtml,/Aplicar cambios/);assert.match(labHtml,/Descartar borrador/);assert.match(labHtml,/Duplicar elemento/);
  assert.match(labJs,/moveAssetByKeyboard/);assert.match(labJs,/api\/admin\/design\/discard/);assert.match(labJs,/pushWorkspaceMode\('stationery'\)/);
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,PAYMENT_PROVIDER:"disabled",ALLOW_PUBLIC_REGISTRATION:"true"};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});await waitForServer();
  const login=await request("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}});assert.equal(login.response.status,200,JSON.stringify(login.data));const token=login.data.token;
  const events=(await request("/api/admin/events",{token})).data,event=events[0];assert.ok(event);
  const eventId=event.id,settings=(await request("/api/admin/settings",{token,eventId})).data;
  assert.equal(settings._permissions.design.apply,true);assert.equal(settings._permissions.design.publishCatalog,true);
  const publication=await request(`/api/admin/events/${eventId}/publication`,{method:"PATCH",token,eventId,json:{published:true}});assert.equal(publication.response.status,200,JSON.stringify(publication.data));
  const activeBefore=(await request(`/api/config/${encodeURIComponent(event.slug)}`,{})).data;
  const loaded=(await request("/api/admin/design/recipe",{token,eventId})).data;
  const draft=structuredClone(loaded.recipe);draft.id=`event-${eventId}-v5`;draft.design.palette={...draft.design.palette,accent:"#315f57",headingColor:"#243b35",bodyColor:"#40564f"};
  draft.sections[0].props={textAlign:"left",spacing:58,width:84,headingSize:1.25,bodySize:1.05,headingWeight:800,bodyWeight:500,lineHeight:1.7,letterSpacing:.02,headingTone:"heading",bodyTone:"body",headingCase:"uppercase",surface:"accent-soft",unexpected:"discard-me"};
  const saved=await request("/api/admin/design/recipe",{method:"PUT",token,eventId,json:{recipe:draft,expectedRevision:loaded.state.draftRevision}});assert.equal(saved.response.status,200,JSON.stringify(saved.data));assert.equal(saved.data.state.hasUnappliedChanges,true);assert.equal(saved.data.recipe.sections[0].props.unexpected,undefined);assert.equal(saved.data.recipe.sections[0].props.headingWeight,800);assert.equal(saved.data.recipe.sections[0].props.bodyWeight,500);
  const activeUnchanged=(await request(`/api/config/${encodeURIComponent(event.slug)}`,{})).data;assert.equal(activeUnchanged._designEngine.hash,activeBefore._designEngine.hash,"Autosave no debe publicar el borrador.");
  const link=await request("/api/admin/preview-links",{method:"POST",token,eventId,json:{minutes:10}});const previewUrl=new URL(link.data.url);const previewResponse=await request(`/api/config/${encodeURIComponent(event.slug)}${previewUrl.search}&designMode=draft`);assert.equal(previewResponse.response.status,200,JSON.stringify(previewResponse.data));const preview=previewResponse.data;assert.equal(preview._designEngine.hash,saved.data.hash,"Preview debe renderizar DRAFT.");
  assert.deepEqual(new Set(preview._assetManifest.assets.map(item=>item.id)),new Set(preview._designRecipe.assets.map(item=>item.assetId)),"El cliente público sólo debe recibir assets referenciados.");
  const conflict=await request("/api/admin/design/recipe",{method:"PUT",token,eventId,json:{recipe:draft,expectedRevision:loaded.state.draftRevision}});assert.equal(conflict.response.status,409);assert.equal(conflict.data.code,"DESIGN_DRAFT_CONFLICT");
  const stationeryDraft=await request("/api/admin/design/stationery-draft",{method:"PUT",token,eventId,json:{expectedRevision:saved.data.state.draftRevision,stationery:{...(settings.stationery||{}),outerColor:"#315f57",customized:true},seal:{...(settings.seal||{}),customized:true}}});assert.equal(stationeryDraft.response.status,200,JSON.stringify(stationeryDraft.data));
  const applied=await request("/api/admin/design/apply",{method:"POST",token,eventId,json:{expectedRevision:stationeryDraft.data.state.draftRevision}});assert.equal(applied.response.status,200,JSON.stringify(applied.data));assert.equal(applied.data.state.hasUnappliedChanges,false);
  const activeAfter=(await request(`/api/config/${encodeURIComponent(event.slug)}`,{})).data;assert.equal(activeAfter._designEngine.hash,applied.data.hash,"Aplicar debe promover el borrador completo a ACTIVE.");assert.notEqual(activeAfter._designEngine.hash,activeBefore._designEngine.hash);assert.equal(activeAfter._palette.textPrimary,activeAfter._palette.ink);assert.equal(activeAfter._palette.textOnAccent,activeAfter._palette.accentContrast);
  const secondApply=await request("/api/admin/design/apply",{method:"POST",token,eventId,json:{expectedRevision:stationeryDraft.data.state.draftRevision}});assert.equal(secondApply.response.status,200);assert.equal(secondApply.data.alreadyApplied,true,"Aplicar dos veces debe ser idempotente.");
  const disposable=structuredClone(applied.data.recipe);disposable.design.palette.accent="#7a2244";
  const disposableSaved=await request("/api/admin/design/recipe",{method:"PUT",token,eventId,json:{recipe:disposable,expectedRevision:secondApply.data.state.draftRevision}});assert.equal(disposableSaved.response.status,200);assert.equal(disposableSaved.data.state.hasUnappliedChanges,true);
  const discarded=await request("/api/admin/design/discard",{method:"POST",token,eventId,json:{expectedRevision:disposableSaved.data.state.draftRevision}});assert.equal(discarded.response.status,200,JSON.stringify(discarded.data));assert.equal(discarded.data.state.hasUnappliedChanges,false);assert.equal(discarded.data.state.draftHash,discarded.data.state.activeHash);
  const activeAfterDiscard=(await request(`/api/config/${encodeURIComponent(event.slug)}`,{})).data;assert.equal(activeAfterDiscard._designEngine.hash,activeAfter._designEngine.hash,"Descartar no debe modificar ACTIVE.");
  const client=await request("/api/auth/register",{method:"POST",json:{displayName:"Cliente V5",email:`cliente-v5-${process.pid}@example.test`,password:"ClienteV5Seguro123!",planCode:"starter",eventType:"wedding",locale:"es",acceptTerms:true}});assert.equal(client.response.status,201,JSON.stringify(client.data));
  const clientFeatures=(await request("/api/admin/features",{token:client.data.token,eventId:client.data.eventId})).data;assert.equal(clientFeatures.designCapabilities.saveTemplate,false);assert.equal(clientFeatures.designCapabilities.publishCatalog,false);
  const forbiddenCatalog=await request("/api/admin/design/catalog-recipes",{method:"POST",token:client.data.token,eventId:client.data.eventId,json:{recipe:draft,status:"published"}});assert.equal(forbiddenCatalog.response.status,403);
  const catalogSaved=await request("/api/admin/design/catalog-recipes",{method:"POST",token,eventId,json:{recipe:draft,status:"draft",name:"Plantilla V5 QA"}});assert.equal(catalogSaved.response.status,201);assert.equal(catalogSaved.data.entry.status,"draft");
  console.log("✓ V5: DRAFT/ACTIVE, conflicto, preview, descarte, Stationery, aplicación idempotente, assets, teclado y permisos verificados");
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server&&!server.killed){server.kill("SIGTERM");await once(server,"exit").catch(()=>{});}fs.rmSync(storage,{recursive:true,force:true});});
