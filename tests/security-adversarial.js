"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");
const AdmZip=require("adm-zip");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-security-http-"));
const port=5900+(process.pid%200);
const base=`http://127.0.0.1:${port}`;
let server;

async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});
  if(token)headers.set("Authorization",`Bearer ${token}`);
  if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;
  if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const contentType=response.headers.get("content-type")||"";
  const data=contentType.includes("application/json")?await response.json():await response.text();
  return {response,data};
}
async function waitForServer(){for(let i=0;i<80;i++){try{if((await request("/api/health")).response.ok)return;}catch{}await new Promise(r=>setTimeout(r,125));}throw new Error("No inició servidor de auditoría adversarial.");}

async function main(){
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,PAYMENT_PROVIDER:"disabled",ENABLE_DEMO_PAYMENTS:"false",ALLOW_PUBLIC_REGISTRATION:"false"};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});
  await waitForServer();

  const noAuth=await request("/api/admin/backups");
  assert.equal(noAuth.response.status,401,"Backups no puede ser público.");

  const injection=await request("/api/auth/login",{method:"POST",json:{email:"' OR 1=1 --",password:"x"}});
  assert.equal(injection.response.status,401,"Una cadena SQL no debe saltar autenticación.");

  for(let i=0;i<4;i++)await request("/api/auth/login",{method:"POST",json:{email:"intruso-security@example.test",password:"incorrecta"}});
  const fifth=await request("/api/auth/login",{method:"POST",json:{email:"intruso-security@example.test",password:"incorrecta"}});
  assert.equal(fifth.response.status,401);
  const limited=await request("/api/auth/login",{method:"POST",json:{email:"intruso-security@example.test",password:"incorrecta"}});
  assert.equal(limited.response.status,429,"El sexto intento debe quedar limitado.");

  const owner=await request("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}});
  assert.equal(owner.response.status,200,JSON.stringify(owner.data));
  const token=owner.data.token;
  const events=await request("/api/admin/events",{token});
  const event=events.data.find(item=>item.slug==="boda-demostracion")||events.data[0];
  assert.ok(event?.id);

  const zip=new AdmZip();
  zip.addFile("[Content_Types].xml",Buffer.from("<Types/>"));
  zip.addFile("xl/workbook.xml",Buffer.alloc(2*1024*1024,0x41));
  const bomb=zip.toBuffer();
  const form=new FormData();
  form.append("file",new Blob([bomb],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"invitados.xlsx");
  const blocked=await request("/api/admin/import",{method:"POST",token,eventId:event.id,body:form});
  assert.equal(blocked.response.status,400,JSON.stringify(blocked.data));
  assert.match(String(blocked.data.error||""),/(compresión|expandiría|límite|XLSX)/i,"La importación debe rechazar el XLSX anómalo.");
  assert.equal((await request("/api/health")).response.status,200,"El servidor debe seguir vivo después del XLSX hostil.");

  const dataLeak=await request("/data/wedding.db");
  assert.equal(dataLeak.response.status,404,"La base SQLite no debe servirse como archivo público.");

  const traversal=await request("/api/admin/photos/..%2F..%2Fdata%2Fwedding.db/content",{token,eventId:event.id});
  assert.notEqual(traversal.response.status,200,"Una ruta codificada no debe exponer archivos fuera del almacén de fotos.");

  console.log("✓ Auditoría adversarial HTTP: auth, rate-limit, XLSX DoS, exposición DB y traversal bloqueados");
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server&&!server.killed){server.kill("SIGTERM");await once(server,"exit").catch(()=>{});}fs.rmSync(storage,{recursive:true,force:true});});
