"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const {
  inspectDatabaseState,
  databaseSidecarPaths
}=require("../scripts/iniciar-local");

class FakeDatabase{
  constructor(file){this.file=file;this.closed=false;}
  prepare(sql){
    if(/sqlite_master/.test(sql))return {all:()=>[{name:"users"},{name:"events"}]};
    if(/COUNT\(\*\).*users/i.test(sql))return {get:()=>({total:4})};
    if(/COUNT\(\*\).*events/i.test(sql))return {get:()=>({total:2})};
    throw new Error(`Consulta no simulada: ${sql}`);
  }
  pragma(name){
    if(name!=="quick_check")return "ok";
    return databaseSidecarPaths(this.file).length?"*** in database main *** stale sidecar":"ok";
  }
  close(){this.closed=true;}
}

class AlwaysBrokenDatabase extends FakeDatabase{
  pragma(name){return name==="quick_check"?"database disk image is malformed":"ok";}
}

function withTempProject(fn){
  const project=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-rc36-"));
  const data=path.join(project,"data");
  fs.mkdirSync(data,{recursive:true});
  const db=path.join(data,"wedding.db");
  fs.writeFileSync(db,"base-verificada");
  try{return fn({project,data,db});}
  finally{fs.rmSync(project,{recursive:true,force:true});}
}

withTempProject(({project,db})=>{
  fs.writeFileSync(`${db}-wal`,"wal-antiguo");
  fs.writeFileSync(`${db}-shm`,"shm-antiguo");
  const result=inspectDatabaseState(db,{DatabaseCtor:FakeDatabase});
  assert.equal(result.state,"existing");
  assert.equal(result.users,4);
  assert.equal(result.events,2);
  assert.deepEqual(databaseSidecarPaths(db),[]);
  const quarantineRoot=path.join(project,"backups","local-sidecar-quarantine");
  const runs=fs.readdirSync(quarantineRoot);
  assert.equal(runs.length,1);
  const saved=fs.readdirSync(path.join(quarantineRoot,runs[0])).sort();
  assert.deepEqual(saved,["wedding.db-shm","wedding.db-wal"]);
});

withTempProject(({db})=>{
  fs.writeFileSync(`${db}-wal`,"wal-posiblemente-valido");
  assert.throws(
    ()=>inspectDatabaseState(db,{DatabaseCtor:AlwaysBrokenDatabase}),
    /No se usará ni resembrará la base/
  );
  assert.ok(fs.existsSync(`${db}-wal`),"No se debe mover un sidecar si la base aislada también falla quick_check.");
});

withTempProject(({db})=>{
  const result=inspectDatabaseState(db,{DatabaseCtor:FakeDatabase});
  assert.equal(result.state,"existing");
  assert.equal(databaseSidecarPaths(db).length,0);
});

console.log("RC36 local SQLite sidecar recovery: PASS");
