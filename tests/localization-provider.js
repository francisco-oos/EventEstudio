"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-translation-"));
const appPort=5350+(process.pid%60),providerPort=5420+(process.pid%60),base=`http://127.0.0.1:${appPort}`;
let server,provider,calls=[];

function body(req){return new Promise(resolve=>{const chunks=[];req.on("data",chunk=>chunks.push(chunk));req.on("end",()=>resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}")));});}
async function request(url,{token,eventId,json,...options}={}){
  const headers={...(options.headers||{})};if(token)headers.Authorization=`Bearer ${token}`;if(eventId)headers["x-event-id"]=String(eventId);
  let requestBody=options.body;if(json!==undefined){headers["Content-Type"]="application/json";requestBody=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body:requestBody});const data=await response.json();return {response,data};
}
async function waitForServer(){for(let index=0;index<60;index++){try{if((await request("/api/health")).response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,120));}throw new Error("No inició la prueba de traducción.");}

async function main(){
  provider=http.createServer(async(req,res)=>{const payload=await body(req);calls.push({payload,authorization:req.headers.authorization});res.setHeader("Content-Type","application/json");res.end(JSON.stringify({translatedText:`[${payload.target}] ${payload.q}`}));});
  provider.listen(providerPort,"127.0.0.1");await once(provider,"listening");
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(appPort),SITE_URL:base,STORAGE_ROOT:storage,TRANSLATION_ENDPOINT:`http://127.0.0.1:${providerPort}/translate`,TRANSLATION_API_KEY:"translation-test-key",PAYMENT_PROVIDER:"disabled"};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});await waitForServer();
  const login=await request("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}});const token=login.data.token,event=(await request("/api/admin/events",{token})).data.find(row=>row.slug==="boda-demostracion");
  const catalog=await request("/api/public/catalog");assert.equal(catalog.data.capabilities.automaticTranslation,true);
  const translated=await request("/api/admin/localization/translate",{method:"POST",token,eventId:event.id,json:{localization:{defaultLocale:"es",enabledLocales:["es","en","pt"]}}});
  assert.equal(translated.response.status,200,JSON.stringify(translated.data));
  for(const locale of ["en","pt"]){const values=translated.data.localization.contentTranslations[locale];assert.ok(Object.keys(values).length>=3);for(const value of Object.values(values))assert.match(value,new RegExp(`^\\[${locale}\\] `));}
  assert.ok(calls.length>=6);assert.ok(calls.every(call=>call.authorization==="Bearer translation-test-key"));assert.ok(calls.every(call=>["en","pt"].includes(call.payload.target)&&call.payload.source==="es"&&call.payload.format==="text"));
  console.log(`✓ Traducción automática ES→EN/PT: ${calls.length} campos, clave sólo en servidor y persistencia validada`);
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server&&!server.killed){server.kill("SIGTERM");await once(server,"exit").catch(()=>{});}if(provider?.listening){provider.close();await once(provider,"close").catch(()=>{});}fs.rmSync(storage,{recursive:true,force:true});});
