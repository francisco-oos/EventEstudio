#!/usr/bin/env node
"use strict";

const crypto=require("crypto");
const fs=require("fs");
const http=require("http");
const net=require("net");
const os=require("os");
const path=require("path");
const {spawn,spawnSync}=require("child_process");

const root=path.resolve(__dirname,"..");
const packageJson=require(path.join(root,"package.json"));
const lockPath=path.join(root,"package-lock.json");
const envPath=path.join(root,".env");
const envExamplePath=path.join(root,".env.example");
const installMarker=path.join(root,"node_modules",".eventstudio-lock-sha256");

function nodeSupported(version=process.versions.node){
  return Number(String(version).split(".")[0])>=20;
}

function isPrivateIPv4(address){
  const parts=String(address||"").split(".").map(Number);
  if(parts.length!==4||parts.some(part=>!Number.isInteger(part)||part<0||part>255))return false;
  return parts[0]===10
    ||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)
    ||(parts[0]===192&&parts[1]===168)
    ||(parts[0]===169&&parts[1]===254);
}

function networkCandidates(interfaces){
  let availableInterfaces=interfaces;
  if(!availableInterfaces){
    try{availableInterfaces=os.networkInterfaces();}catch{return [];}
  }
  const virtualPattern=/(docker|veth|virtual|vmware|virtualbox|wsl|hyper-v|vethernet|tailscale|zerotier|loopback)/i;
  const preferredPattern=/(wi-?fi|wireless|wlan|ethernet|^en\d|^eth\d|lan)/i;
  const candidates=[];
  for(const [name,entries] of Object.entries(availableInterfaces||{})){
    for(const entry of entries||[]){
      const family=typeof entry.family==="string"?entry.family:String(entry.family);
      if(family!=="IPv4"||entry.internal||!entry.address)continue;
      let score=isPrivateIPv4(entry.address)?100:20;
      if(preferredPattern.test(name))score+=40;
      if(virtualPattern.test(name))score-=200;
      candidates.push({name,address:entry.address,score});
    }
  }
  return candidates
    .sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)||a.address.localeCompare(b.address))
    .filter((item,index,array)=>array.findIndex(other=>other.address===item.address)===index);
}

function chooseLanIp(candidates,preferred=""){
  const requested=String(preferred||"").trim();
  if(requested&&candidates.some(item=>item.address===requested))return requested;
  return candidates.find(item=>item.score>=0&&isPrivateIPv4(item.address))?.address||"";
}

function resolvePort(value){
  const port=Number(value||3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error("El puerto local debe ser un número entre 1 y 65535.");
  return port;
}

function localUrls(ip,port){
  return {
    computer:`http://localhost:${port}/admin.html`,
    phone:ip?`http://${ip}:${port}/admin.html`:""
  };
}

function lockDigest(){
  return crypto.createHash("sha256").update(fs.readFileSync(lockPath)).digest("hex");
}

function dependenciesReady(){
  try{
    const expected=lockDigest();
    const installed=fs.readFileSync(installMarker,"utf8").trim();
    require.resolve("express",{paths:[root]});
    require.resolve("better-sqlite3",{paths:[root]});
    return expected===installed;
  }catch{
    return false;
  }
}

function npmInvocation({
  platform=process.platform,
  execPath=process.execPath,
  env=process.env,
  exists=fs.existsSync
}={}){
  const pathApi=platform==="win32"?path.win32:path;
  const executableDir=pathApi.dirname(execPath);
  const cliCandidates=[
    env.npm_execpath,
    pathApi.join(executableDir,"node_modules","npm","bin","npm-cli.js"),
    pathApi.resolve(executableDir,"..","lib","node_modules","npm","bin","npm-cli.js")
  ];
  const npmCli=cliCandidates.find(candidate=>
    candidate
    &&/\.(?:c|m)?js$/i.test(candidate)
    &&exists(candidate)
  );
  if(npmCli){
    return {
      command:execPath,
      args:[npmCli],
      method:"npm-cli"
    };
  }
  if(platform==="win32"){
    return {
      command:env.ComSpec||env.COMSPEC||"cmd.exe",
      args:["/d","/c","npm.cmd"],
      method:"cmd"
    };
  }
  return {
    command:"npm",
    args:[],
    method:"path"
  };
}

function ensureDependencies(){
  if(dependenciesReady())return;
  console.log("\nPreparando dependencias exactas de EventStudio...");
  const cachePath=path.join(os.tmpdir(),"eventstudio-npm-cache");
  fs.mkdirSync(cachePath,{recursive:true});
  const npm=npmInvocation();
  const result=spawnSync(npm.command,[...npm.args,"ci","--cache",cachePath],{
    cwd:root,
    env:process.env,
    stdio:"inherit",
    windowsHide:false
  });
  if(result.error)throw new Error(`No se pudo ejecutar npm: ${result.error.message}`);
  if(result.status!==0)throw new Error("npm ci no terminó correctamente.");
  fs.writeFileSync(installMarker,`${lockDigest()}\n`);
}

function ensureLocalEnv(){
  if(!fs.existsSync(envPath)&&fs.existsSync(envExamplePath)){
    fs.copyFileSync(envExamplePath,envPath,fs.constants.COPYFILE_EXCL);
    console.log("Se creó .env local a partir de .env.example.");
  }
  require("dotenv").config({path:envPath});
}

function storageDatabasePath(){
  if(process.env.DB_PATH)return path.resolve(process.env.DB_PATH);
  const storageRoot=process.env.STORAGE_ROOT?path.resolve(process.env.STORAGE_ROOT):root;
  const dataDir=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(storageRoot,"data");
  return path.join(dataDir,"wedding.db");
}

function inspectDatabaseState(databasePath=storageDatabasePath()){
  if(!fs.existsSync(databasePath)){
    return {state:"missing",databasePath,needsDemo:true,users:0,events:0};
  }
  const Database=require("better-sqlite3");
  let database;
  try{
    database=new Database(databasePath,{readonly:true,fileMustExist:true});
    const tables=new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
    if(!tables.has("users")||!tables.has("events")){
      throw new Error("La base existente no contiene las tablas users y events; no se modificará automáticamente.");
    }
    const integrity=database.pragma("quick_check",{simple:true});
    if(integrity!=="ok")throw new Error(`quick_check devolvió: ${integrity}`);
    const users=database.prepare("SELECT COUNT(*) total FROM users").get().total;
    const events=database.prepare("SELECT COUNT(*) total FROM events").get().total;
    const needsDemo=users===0&&events===0;
    return {
      state:needsDemo?"empty":"existing",
      databasePath,
      needsDemo,
      users,
      events,
      partial:(users===0)!==(events===0)
    };
  }catch(error){
    throw new Error(`No se usará ni resembrará la base ${databasePath}: ${error.message}`);
  }finally{
    try{database?.close();}catch{}
  }
}

function databaseNeedsDemo(databasePath=storageDatabasePath()){
  return inspectDatabaseState(databasePath).needsDemo;
}

function prepareDemoIfEmpty(serverEnv){
  const database=inspectDatabaseState();
  if(!database.needsDemo){
    console.log(
      `\nBase existente conservada: ${database.databasePath} `
      +`(${database.users} usuario(s), ${database.events} evento(s)).`
    );
    if(database.partial){
      console.log("La base tiene información parcial; el modo demo permanecerá desactivado para no mezclar datos.");
    }
    return false;
  }
  console.log("\nLa base local está vacía. Creando el entorno de demostración...");
  const result=spawnSync(process.execPath,[path.join(root,"src","seed.js")],{
    cwd:root,
    env:serverEnv,
    stdio:"inherit"
  });
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error("No se pudo crear el entorno de demostración.");
  return true;
}

function portAvailable(port,host="0.0.0.0"){
  return new Promise(resolve=>{
    const tester=net.createServer();
    tester.once("error",()=>resolve(false));
    tester.once("listening",()=>tester.close(()=>resolve(true)));
    tester.listen(port,host);
  });
}

function waitForHealth(port,child,timeoutMs=30000){
  const started=Date.now();
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(callback,value)=>{
      if(settled)return;
      settled=true;
      clearInterval(timer);
      child.off("exit",onExit);
      callback(value);
    };
    const onExit=code=>finish(reject,new Error(`EventStudio se cerró antes de iniciar (código ${code??"desconocido"}).`));
    child.once("exit",onExit);
    const check=()=>{
      const request=http.get({hostname:"127.0.0.1",port,path:"/api/health",timeout:1500},response=>{
        let body="";
        response.setEncoding("utf8");
        response.on("data",chunk=>{body+=chunk;});
        response.on("end",()=>{
          try{
            const data=JSON.parse(body);
            if(response.statusCode===200&&data.ok)finish(resolve,data);
          }catch{}
        });
      });
      request.on("error",()=>{});
      request.on("timeout",()=>request.destroy());
      if(Date.now()-started>timeoutMs)finish(reject,new Error("El servidor no respondió dentro de 30 segundos."));
    };
    const timer=setInterval(check,500);
    check();
  });
}

function requestRuntimeAsset(hostname,port,pathname,timeoutMs=5000){
  return new Promise((resolve,reject)=>{
    const request=http.get({
      hostname,
      port,
      path:pathname,
      timeout:timeoutMs,
      headers:{"Accept-Encoding":"identity"}
    },response=>{
      const chunks=[];
      let length=0;
      response.on("data",chunk=>{
        length+=chunk.length;
        if(length>2*1024*1024){
          request.destroy(new Error(`El recurso ${pathname} excedió el tamaño esperado.`));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end",()=>resolve({
        statusCode:response.statusCode,
        headers:response.headers,
        body:Buffer.concat(chunks)
      }));
    });
    request.once("error",reject);
    request.once("timeout",()=>request.destroy(new Error(`Tiempo agotado al comprobar ${pathname}.`)));
  });
}

async function verifyRuntimeAssets(hostname,port){
  const version=encodeURIComponent(packageJson.version);
  const assets=[
    {url:`/admin.html?v=${version}`,file:"admin.html",type:/^text\/html\b/i},
    {url:`/styles.css?v=${version}`,file:"styles.css",type:/^text\/css\b/i},
    {url:`/admin.js?v=${version}`,file:"admin.js",type:/^(?:application|text)\/javascript\b/i},
    {url:`/app.js?v=${version}`,file:"app.js",type:/^(?:application|text)\/javascript\b/i},
    {url:`/album.js?v=${version}`,file:"album.js",type:/^(?:application|text)\/javascript\b/i},
    {url:`/catalogo.html?v=${version}`,file:"catalogo.html",type:/^text\/html\b/i},
    {url:`/catalogo.js?v=${version}`,file:"catalogo.js",type:/^(?:application|text)\/javascript\b/i},
    {url:`/muestra.html?theme=paw-parade&event=kids-party&v=${version}`,file:"muestra.html",type:/^text\/html\b/i},
    {url:`/muestra.js?v=${version}`,file:"muestra.js",type:/^(?:application|text)\/javascript\b/i}
  ];
  let htmlResponse;
  for(const asset of assets){
    const response=await requestRuntimeAsset(hostname,port,asset.url);
    if(response.statusCode!==200)throw new Error(`${asset.file} respondió HTTP ${response.statusCode||"desconocido"}.`);
    const contentType=String(response.headers["content-type"]||"");
    if(!asset.type.test(contentType))throw new Error(`${asset.file} respondió con tipo ${contentType||"desconocido"}.`);
    const expected=fs.readFileSync(path.join(root,"public",asset.file));
    if(!response.body.equals(expected))throw new Error(`${asset.file} no coincide con el archivo instalado. Sustituye el código desde una extracción limpia.`);
    if(asset.file==="admin.html")htmlResponse=response;
  }
  const csp=String(htmlResponse?.headers["content-security-policy"]||"").toLowerCase();
  if(csp.includes("upgrade-insecure-requests")){
    throw new Error("La política local intenta convertir HTTP a HTTPS e impediría cargar estilos y botones desde el teléfono.");
  }
  return true;
}

function openComputerBrowser(url){
  if(process.env.EVENTSTUDIO_NO_BROWSER==="1")return;
  let command;
  let args;
  if(process.platform==="win32"){
    command="cmd";
    args=["/c","start","",url];
  }else if(process.platform==="darwin"){
    command="open";
    args=[url];
  }else{
    command="xdg-open";
    args=[url];
  }
  try{
    const opener=spawn(command,args,{detached:true,stdio:"ignore"});
    opener.unref();
  }catch{}
}

async function printAccess(urls,allCandidates){
  console.log("\n============================================================");
  console.log(` EventStudio ${packageJson.version} está listo`);
  console.log("============================================================");
  console.log(`En esta computadora: ${urls.computer}`);
  if(urls.phone){
    console.log(`En tu teléfono:       ${urls.phone}`);
    console.log("\nConecta el teléfono a la misma red Wi-Fi y abre esa dirección.");
    console.log("Si Windows pregunta, permite acceso únicamente en redes privadas.");
    try{
      const QRCode=require("qrcode");
      console.log(await QRCode.toString(urls.phone,{type:"terminal",small:true,errorCorrectionLevel:"M"}));
    }catch{}
  }else{
    console.log("No se detectó una dirección de red local. La vista móvil requiere Wi-Fi o Ethernet.");
  }
  if(allCandidates.length>1){
    console.log(`Direcciones detectadas: ${allCandidates.map(item=>item.address).join(", ")}`);
    console.log("Si elegimos la incorrecta, define EVENTSTUDIO_LAN_IP antes de iniciar.");
  }
  console.log("Para detener EventStudio, vuelve a esta ventana y pulsa Ctrl+C.");
  console.log("Usa esta prueba sólo dentro de una red privada de confianza.\n");
}

async function main(){
  if(!nodeSupported())throw new Error(`Se requiere Node.js 20 o superior. Versión detectada: ${process.versions.node}.`);
  ensureDependencies();
  ensureLocalEnv();

  const candidates=networkCandidates();
  const lanIp=chooseLanIp(candidates,process.env.EVENTSTUDIO_LAN_IP);
  const port=resolvePort(process.env.EVENTSTUDIO_PORT||process.env.PORT);
  const urls=localUrls(lanIp,port);
  const baseUrl=lanIp?`http://${lanIp}:${port}`:`http://127.0.0.1:${port}`;
  const serverEnv={
    ...process.env,
    NODE_ENV:"development",
    HOST:"0.0.0.0",
    PORT:String(port),
    SITE_URL:baseUrl
  };

  if(!(await portAvailable(port)))throw new Error(`El puerto ${port} ya está ocupado. Cierra el otro servidor o configura EVENTSTUDIO_PORT.`);
  const demoCreated=prepareDemoIfEmpty(serverEnv);
  if(demoCreated)console.log("La demostración se creó únicamente porque la base estaba vacía.");

  const child=spawn(process.execPath,[path.join(root,"src","server.js")],{
    cwd:root,
    env:serverEnv,
    stdio:"inherit",
    windowsHide:false
  });
  child.once("error",error=>console.error(`No se pudo iniciar EventStudio: ${error.message}`));
  let stopping=false;
  const stop=signal=>{
    if(stopping)return;
    stopping=true;
    console.log(`\nDeteniendo EventStudio (${signal})...`);
    if(!child.killed)child.kill(signal);
  };
  process.once("SIGINT",()=>stop("SIGINT"));
  process.once("SIGTERM",()=>stop("SIGTERM"));

  const health=await waitForHealth(port,child);
  if(health.version!==packageJson.version)throw new Error(`El servidor respondió con una versión inesperada: ${health.version}.`);
  await verifyRuntimeAssets(lanIp||"127.0.0.1",port);
  console.log("HTML, estilos y botones verificados desde la dirección local.");
  await printAccess(urls,candidates.filter(item=>item.score>=0));
  openComputerBrowser(urls.computer);

  await new Promise(resolve=>child.once("exit",resolve));
}

if(require.main===module){
  main().catch(error=>{
    console.error(`\nNo se pudo iniciar EventStudio: ${error.message}`);
    process.exitCode=1;
  });
}

module.exports={
  nodeSupported,
  isPrivateIPv4,
  networkCandidates,
  chooseLanIp,
  resolvePort,
  localUrls,
  inspectDatabaseState,
  databaseNeedsDemo,
  npmInvocation,
  requestRuntimeAsset,
  verifyRuntimeAssets
};
