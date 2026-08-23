const packageJson=require('../package.json');
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawn}=require("node:child_process");
const {once}=require("node:events");

const root=path.resolve(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-security-"));
const port=3700+(process.pid%300);
const base=`http://127.0.0.1:${port}`;
let server;

const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

async function waitForServer(){
  for(let attempt=0;attempt<40;attempt++){
    try{
      const response=await fetch(`${base}/api/health`);
      if(response.ok)return;
    }catch{}
    await wait(250);
  }
  throw new Error("El servidor de comprobación de seguridad no inició a tiempo.");
}

async function main(){
  server=spawn(process.execPath,[path.join(root,"src","server.js")],{
    cwd:root,
    env:{
      ...process.env,
      NODE_ENV:"production",
      HOST:"127.0.0.1",
      PORT:String(port),
      SITE_URL:"https://eventstudio.example",
      TRUST_PROXY:"true",
      SESSION_SECRET:"eventstudio-security-test-secret-32-characters",
      STORAGE_ROOT:storage,
      DATA_DIR:"",
      DB_PATH:"",
      UPLOADS_DIR:"",
      BACKUPS_DIR:"",
      INITIAL_OWNER_EMAIL:"",
      INITIAL_OWNER_PASSWORD:"",
      ALLOW_PUBLIC_REGISTRATION:"false",
      ENABLE_DEMO_PAYMENTS:"false"
    },
    stdio:["ignore","pipe","pipe"]
  });
  await waitForServer();

  const page=await fetch(`${base}/admin.html?v=${packageJson.version}`);
  assert.equal(page.status,200);
  assert.match(page.headers.get("content-security-policy")||"",/upgrade-insecure-requests/i);
  assert.match(page.headers.get("cache-control")||"",/no-cache/i);
  assert.match(await page.text(),new RegExp(`styles\\.css\\?v=${packageJson.version.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`));

  const styles=await fetch(`${base}/styles.css?v=${packageJson.version}`);
  assert.equal(styles.status,200);
  assert.match(styles.headers.get("content-type")||"",/^text\/css\b/i);
  assert.match(styles.headers.get("cache-control")||"",/max-age=3600/i);

  console.log("✓ HTTP local permitido y HTTPS de producción conservado");
}

main()
  .catch(error=>{
    console.error(error);
    process.exitCode=1;
  })
  .finally(async()=>{
    if(server&&!server.killed){
      server.kill("SIGTERM");
      await once(server,"exit").catch(()=>{});
    }
    fs.rmSync(storage,{recursive:true,force:true});
  });
