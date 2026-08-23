"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");

const root=path.resolve(__dirname,"..");
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

function request({port,hostHeader,origin,cookie,pathName="/api/auth/login",body}){
  const payload=body===undefined?null:Buffer.from(JSON.stringify(body));
  return new Promise((resolve,reject)=>{
    const headers={Host:hostHeader};
    if(origin!==undefined)headers.Origin=origin;
    if(cookie)headers.Cookie=cookie;
    if(payload){
      headers["Content-Type"]="application/json";
      headers["Content-Length"]=String(payload.length);
    }
    const req=http.request({
      hostname:"127.0.0.1",
      port,
      path:pathName,
      method:payload?"POST":"GET",
      headers
    },res=>{
      const chunks=[];
      res.on("data",chunk=>chunks.push(chunk));
      res.on("end",()=>{
        const text=Buffer.concat(chunks).toString("utf8");
        let data=text;
        try{data=JSON.parse(text);}catch{}
        resolve({status:res.statusCode,headers:res.headers,data});
      });
    });
    req.once("error",reject);
    if(payload)req.end(payload);else req.end();
  });
}

async function waitForServer(port,child){
  for(let attempt=0;attempt<60;attempt++){
    if(child.exitCode!==null)throw new Error(`El servidor terminó con código ${child.exitCode}.`);
    try{
      const health=await request({port,hostHeader:`127.0.0.1:${port}`,pathName:"/api/health"});
      if(health.status===200)return;
    }catch{}
    await wait(200);
  }
  throw new Error("El servidor para probar orígenes no inició a tiempo.");
}

async function stopServer(child){
  if(child.exitCode!==null)return;
  child.kill("SIGTERM");
  await once(child,"exit");
}

async function localPolicy(){
  const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-origin-local-"));
  const port=4000+(process.pid%250);
  const lanOrigin=`http://192.168.48.101:${port}`;
  const computerOrigin=`http://localhost:${port}`;
  const env={
    ...process.env,
    NODE_ENV:"test",
    HOST:"127.0.0.1",
    PORT:String(port),
    SITE_URL:lanOrigin,
    STORAGE_ROOT:storage,
    DATA_DIR:"",
    DB_PATH:"",
    UPLOADS_DIR:"",
    BACKUPS_DIR:"",
    INITIAL_OWNER_EMAIL:"",
    INITIAL_OWNER_PASSWORD:"",
    ALLOW_PUBLIC_REGISTRATION:"false"
  };
  execFileSync(process.execPath,[path.join(root,"src","seed.js")],{cwd:root,env,stdio:"pipe"});
  const child=spawn(process.execPath,[path.join(root,"src","server.js")],{
    cwd:root,
    env:{...env,NODE_ENV:"development"},
    stdio:["ignore","pipe","pipe"]
  });
  try{
    await waitForServer(port,child);
    const first=await request({
      port,
      hostHeader:`localhost:${port}`,
      origin:computerOrigin,
      body:{email:"owner@eventstudio.local",password:"Cambiar123!"}
    });
    assert.equal(first.status,200);
    const cookie=String(first.headers["set-cookie"]?.[0]||"").split(";")[0];
    assert.match(cookie,/^eventstudio_session=/);

    const computer=await request({
      port,
      hostHeader:`localhost:${port}`,
      origin:computerOrigin,
      cookie,
      body:{email:"owner@eventstudio.local",password:"Cambiar123!"}
    });
    assert.equal(computer.status,200,"localhost debe funcionar aunque SITE_URL sea la IP LAN.");

    const phone=await request({
      port,
      hostHeader:`192.168.48.101:${port}`,
      origin:lanOrigin,
      cookie,
      body:{email:"owner@eventstudio.local",password:"Cambiar123!"}
    });
    assert.equal(phone.status,200);

    const attacker=await request({
      port,
      hostHeader:`localhost:${port}`,
      origin:"https://attacker.example",
      cookie,
      body:{email:"owner@eventstudio.local",password:"Cambiar123!"}
    });
    assert.equal(attacker.status,403);
    assert.equal(attacker.data.code,"CSRF_ORIGIN");

    const missing=await request({
      port,
      hostHeader:`localhost:${port}`,
      cookie,
      body:{email:"owner@eventstudio.local",password:"Cambiar123!"}
    });
    assert.equal(missing.status,403);
  }finally{
    await stopServer(child);
    fs.rmSync(storage,{recursive:true,force:true});
  }
}

async function productionPolicy(){
  const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-origin-production-"));
  const port=4260+(process.pid%200);
  const siteOrigin="https://eventstudio.example";
  const password="ProduccionSegura123!";
  const env={
    ...process.env,
    NODE_ENV:"production",
    HOST:"127.0.0.1",
    PORT:String(port),
    SITE_URL:siteOrigin,
    TRUST_PROXY:"true",
    SESSION_SECRET:"eventstudio-origin-production-secret-32-characters",
    STORAGE_ROOT:storage,
    DATA_DIR:"",
    DB_PATH:"",
    UPLOADS_DIR:"",
    BACKUPS_DIR:"",
    INITIAL_OWNER_NAME:"Propietario de prueba",
    INITIAL_OWNER_EMAIL:"owner-origin@example.test",
    INITIAL_OWNER_PASSWORD:password,
    ALLOW_PUBLIC_REGISTRATION:"false",
    GOOGLE_CLIENT_ID:"configured-but-unavailable"
  };
  const child=spawn(process.execPath,[path.join(root,"src","server.js")],{
    cwd:root,
    env,
    stdio:["ignore","pipe","pipe"]
  });
  try{
    await waitForServer(port,child);
    const first=await request({
      port,
      hostHeader:"eventstudio.example",
      origin:siteOrigin,
      body:{email:"owner-origin@example.test",password}
    });
    assert.equal(first.status,200);
    const cookie=String(first.headers["set-cookie"]?.[0]||"").split(";")[0];
    assert.match(cookie,/^eventstudio_session=/);

    const accepted=await request({
      port,
      hostHeader:"eventstudio.example",
      origin:siteOrigin,
      cookie,
      body:{email:"owner-origin@example.test",password}
    });
    assert.equal(accepted.status,200);

    for(const rejectedOrigin of [`http://localhost:${port}`,"https://attacker.example",undefined]){
      const rejected=await request({
        port,
        hostHeader:"eventstudio.example",
        origin:rejectedOrigin,
        cookie,
        body:{email:"owner-origin@example.test",password}
      });
      assert.equal(rejected.status,403);
      assert.equal(rejected.data.code,"CSRF_ORIGIN");
    }

    const options=await request({
      port,
      hostHeader:"eventstudio.example",
      pathName:"/api/public/auth-options"
    });
    assert.equal(options.status,200);
    assert.equal(options.data.googleEnabled,false);
    assert.equal(options.data.googleConfigured,true);
  }finally{
    await stopServer(child);
    fs.rmSync(storage,{recursive:true,force:true});
  }
}

Promise.resolve()
  .then(localPolicy)
  .then(productionPolicy)
  .then(()=>console.log("✓ Orígenes local/LAN y producción validados sin debilitar CSRF"))
  .catch(error=>{
    console.error(error);
    process.exitCode=1;
  });
