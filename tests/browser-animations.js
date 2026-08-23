"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");
let chromium=null;
try{({chromium}=require("playwright"));}catch{}
const catalog=require("../config/experiences.json");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-browser-animations-"));
const port=5250+(process.pid%80),base=`http://127.0.0.1:${port}`;
let server,browser;

async function api(url,{token,eventId,json,...options}={}){
  const headers={...(options.headers||{})};if(token)headers.Authorization=`Bearer ${token}`;if(eventId)headers["x-event-id"]=String(eventId);
  let body=options.body;if(json!==undefined){headers["Content-Type"]="application/json";body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});const data=(response.headers.get("content-type")||"").includes("application/json")?await response.json():await response.text();return {response,data};
}
async function waitForServer(){for(let attempt=0;attempt<60;attempt++){try{if((await api("/api/health")).response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,150));}throw new Error("No inició el navegador de animaciones.");}

async function openPreview(page,url,style,{fullRun=true}={}){
  await page.goto(`${url}&forceMotion=1&opening=1&_=${Date.now()}`,{waitUntil:"networkidle"});
  const opening=page.locator("#invitationOpening");
  await opening.waitFor({state:"visible"});
  await assert.doesNotReject(async()=>page.locator("#openingEnvelopeButton").click());
  await page.waitForTimeout(900);
  assert.equal(await opening.evaluate(node=>node.classList.contains("hidden")),false,`${style} desapareció antes de ser perceptible.`);
  const geometry=await opening.evaluate(node=>{const rect=node.getBoundingClientRect();return {width:rect.width,height:rect.height,scrollWidth:node.scrollWidth,scrollHeight:node.scrollHeight};});
  assert.ok(geometry.width>300&&geometry.height>600,`${style} no ocupa el viewport móvil.`);
  assert.ok(geometry.scrollWidth<=geometry.width+2,`${style} genera desbordamiento horizontal.`);
  if(fullRun)await page.waitForFunction(()=>document.querySelector("#invitationOpening")?.classList.contains("hidden"),null,{timeout:8500});
}

async function main(){
  if(!chromium){console.log("⊘ QA gráfica opcional omitida: Playwright no está instalado.");return;}
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,PAYMENT_PROVIDER:"disabled",ENABLE_DEMO_PAYMENTS:"false"};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});await waitForServer();
  const login=await api("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}});const token=login.data.token;
  const event=(await api("/api/admin/events",{token})).data.find(item=>item.slug==="boda-demostracion");
  const preview=(await api("/api/admin/preview-links",{method:"POST",token,eventId:event.id,json:{minutes:60}})).data;
  const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||chromium.executablePath();
  if(!fs.existsSync(executablePath)){console.log("⊘ QA gráfica opcional omitida: no existe un ejecutable Chromium local.");return;}
  browser=await chromium.launch({headless:true,executablePath,args:["--no-sandbox"]});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:"reduce"});
  const page=await context.newPage();
  const pageErrors=[];page.on("pageerror",error=>pageErrors.push(error.message));page.on("console",message=>{if(message.type()==="error")pageErrors.push(message.text());});

  for(const opening of catalog.openings.filter(item=>item.id!=="none")){
    const saved=await api("/api/admin/settings",{method:"PUT",token,eventId:event.id,json:{presentation:{openingStyle:opening.id,motionLevel:"balanced"}}});
    assert.equal(saved.response.status,200,`${opening.id}: ${JSON.stringify(saved.data)}`);
    await openPreview(page,preview.url,opening.id,{fullRun:true});
  }

  await page.setViewportSize({width:1440,height:900});
  for(const opening of catalog.openings.filter(item=>item.id!=="none")){
    await api("/api/admin/settings",{method:"PUT",token,eventId:event.id,json:{presentation:{openingStyle:opening.id,motionLevel:"still"}}});
    await openPreview(page,preview.url,opening.id,{fullRun:false});
  }
  await api("/api/admin/settings",{method:"PUT",token,eventId:event.id,json:{presentation:{openingStyle:"wax-envelope",motionLevel:"still"}}});
  await page.goto(`${preview.url}&opening=1&_=${Date.now()}`,{waitUntil:"networkidle"});
  await page.locator("#openingEnvelopeButton").click();
  await page.waitForFunction(()=>document.querySelector("#invitationOpening")?.classList.contains("hidden"),null,{timeout:1800});
  assert.deepEqual(pageErrors,[],`Errores de navegador: ${pageErrors.join(" | ")}`);
  await context.close();
  console.log(`✓ ${catalog.openings.length-1} aperturas: teléfono, escritorio, reduced-motion y previsualización forzada`);
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close().catch(()=>{});if(server&&!server.killed){server.kill("SIGTERM");await once(server,"exit").catch(()=>{});}fs.rmSync(storage,{recursive:true,force:true});});
