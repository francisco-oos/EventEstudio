"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-qr-photo-matrix-"));
const port=5100+(process.pid%100);
const base=`http://127.0.0.1:${port}`;
let server;
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAK0lEQVR42u3NQQEAQAQAMK6KBPIpfyX4bQWWUx2XXhwTCAQCgUAgEAgEWz5dUQEP/EqsKwAAAABJRU5ErkJggg==","base64");

async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});if(token)headers.set("Authorization",`Bearer ${token}`);if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const type=response.headers.get("content-type")||"";const data=type.includes("application/json")?await response.json():Buffer.from(await response.arrayBuffer());return {response,data};
}
async function waitForServer(){for(let attempt=0;attempt<60;attempt++){try{if((await request("/api/health")).response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,150));}throw new Error("No inició la matriz QR/fotos.");}

async function upload({slug,table,signature,key}){
  const form=new FormData();form.append("photos",new Blob([png],{type:"image/png"}),`${key}.png`);form.append("eventSlug",slug);form.append("tableName",table);form.append("tableSig",signature);form.append("uploadedBy",`Invitado ${table}`);form.append("message",`Recuerdo desde ${table}`);form.append("uploadKey",key);
  return request("/api/photos",{method:"POST",body:form});
}

async function main(){
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,PAYMENT_PROVIDER:"disabled",ENABLE_DEMO_PAYMENTS:"false"};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});await waitForServer();
  const login=await request("/api/auth/login",{method:"POST",json:{email:"client@eventstudio.local",password:"Cambiar123!"}});
  const token=login.data.token,event=(await request("/api/admin/events",{token})).data[0];
  const tables=["Mesa 1","Mesa 2","Mesa 3"];
  const qrRows=[];
  for(const table of tables){
    const qr=await request(`/api/admin/qr?table=${encodeURIComponent(table)}`,{token,eventId:event.id});
    assert.equal(qr.response.status,200,JSON.stringify(qr.data));assert.equal(qr.data.table,table);assert.match(qr.data.dataUrl,/^data:image\/png;base64,/);
    const url=new URL(qr.data.url);assert.equal(url.pathname,"/album.html");assert.equal(url.searchParams.get("e"),event.slug);assert.equal(url.searchParams.get("mesa"),table);assert.match(url.searchParams.get("mesaSig")||"",/^[A-Za-z0-9_-]{32}$/);
    qrRows.push({table,signature:url.searchParams.get("mesaSig")});
    const uploaded=await upload({slug:event.slug,table,signature:url.searchParams.get("mesaSig"),key:`matrix-${table.replace(/\s/g,"-").toLowerCase()}`});
    assert.equal(uploaded.response.status,200,JSON.stringify(uploaded.data));assert.equal(uploaded.data.tableVerified,true);assert.equal(uploaded.data.tableName,table);
  }
  assert.equal(new Set(qrRows.map(row=>row.signature)).size,tables.length,"Cada mesa requiere una firma vinculada a su nombre.");
  const crossed=await upload({slug:event.slug,table:"Mesa 2",signature:qrRows[0].signature,key:"matrix-crossed-signature"});
  assert.equal(crossed.response.status,400);assert.equal(crossed.data.code,"TABLE_QR_INVALID");
  const unknown=await upload({slug:event.slug,table:"Mesa inexistente",signature:qrRows[0].signature,key:"matrix-unknown-table"});
  assert.equal(unknown.response.status,400);assert.equal(unknown.data.code,"TABLE_INVALID");

  const general=await request("/api/admin/qr",{token,eventId:event.id});assert.equal(general.response.status,200);assert.equal(general.data.table,"");
  const pngResponse=await request(`/api/admin/qr.png?table=${encodeURIComponent(tables[0])}`,{token,eventId:event.id});assert.equal(pngResponse.response.status,200);assert.ok(pngResponse.data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  const card=await request(`/api/admin/qr-card.pdf?table=${encodeURIComponent(tables[0])}&template=classic-holder`,{token,eventId:event.id});assert.equal(card.response.status,200);assert.ok(card.data.subarray(0,4).equals(Buffer.from("%PDF")));
  const set=await request("/api/admin/qr-set.pdf?template=classic-holder",{token,eventId:event.id});assert.equal(set.response.status,200);assert.ok(set.data.subarray(0,4).equals(Buffer.from("%PDF")));assert.ok(set.data.length>card.data.length);

  const photos=await request("/api/admin/photos",{token,eventId:event.id});assert.equal(photos.response.status,200);for(const table of tables)assert.ok(photos.data.items.some(item=>item.table_name===table));
  const first=photos.data.items.find(item=>item.table_name==="Mesa 1");const content=await request(`/api/admin/photos/${first.id}/content`,{token,eventId:event.id});assert.equal(content.response.status,200);assert.ok(content.data.length>60);
  const direct=await request(`/uploads/guest-photos/${encodeURIComponent(first.stored_name||first.original_name)}`);assert.equal(direct.response.status,404);
  console.log("✓ QR general/por mesa, firmas, PNG/PDF/set y fotos de tres mesas verificados");
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server&&!server.killed){server.kill("SIGTERM");await once(server,"exit").catch(()=>{});}fs.rmSync(storage,{recursive:true,force:true});});
