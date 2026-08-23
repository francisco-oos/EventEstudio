const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const AdmZip=require("adm-zip");

const root=path.join(__dirname,"..");
const source=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-restore-source-"));
const target=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-restore-target-"));

try{
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{
    cwd:root,env:{...process.env,STORAGE_ROOT:source},stdio:"ignore"
  });
  const sampleUpload=path.join(source,"uploads","site-media","restore-sample.txt");
  fs.mkdirSync(path.dirname(sampleUpload),{recursive:true});
  fs.writeFileSync(sampleUpload,"archivo de prueba de restauración");

  const backupPath=execFileSync(process.execPath,["-e",`
    const backups=require('./src/backup');
    backups.createBackup(null,{reason:'restore-smoke'}).then(row=>process.stdout.write(require('path').join(backups.backupsDir,row.filename)));
  `],{cwd:root,env:{...process.env,STORAGE_ROOT:source},encoding:"utf8"}).trim();
  assert.ok(fs.existsSync(backupPath));

  const unexpectedZip=path.join(target,"unexpected-entry.zip");
  const unexpectedArchive=new AdmZip(backupPath);
  unexpectedArchive.addFile("unexpected.txt",Buffer.from("no permitido"));
  unexpectedArchive.writeZip(unexpectedZip);
  assert.throws(()=>execFileSync(process.execPath,["-e",`
    require('./src/restore').inspectBackup(process.argv[1]);
  `,unexpectedZip],{
    cwd:root,
    env:{...process.env,NODE_ENV:"production",STORAGE_ROOT:target},
    stdio:"pipe"
  }),/Command failed/);

  const result=JSON.parse(execFileSync(process.execPath,["-e",`
    const path=require('path');
    const fs=require('fs');
    const Database=require('better-sqlite3');
    const restore=require('./src/restore');
    const staged=restore.stageRestore(process.argv[1]);
    const applied=restore.applyPendingRestoreSync();
    const db=new Database(path.join(process.env.STORAGE_ROOT,'data','wedding.db'),{readonly:true});
    const events=db.prepare('SELECT COUNT(*) total FROM events').get().total;
    const inactiveDemoClients=db.prepare("SELECT COUNT(*) total FROM users WHERE role='client' AND active=0").get().total;
    const inactiveDemoAccounts=db.prepare("SELECT COUNT(*) total FROM users WHERE lower(email) LIKE '%@eventstudio.local' AND active=0").get().total;
    db.close();
    process.stdout.write(JSON.stringify({staged,applied,events,inactiveDemoClients,inactiveDemoAccounts,uploadRestored:fs.existsSync(path.join(process.env.STORAGE_ROOT,'uploads','site-media','restore-sample.txt')),markerRemoved:!fs.existsSync(restore.markerPath)}));
  `,backupPath],{cwd:root,env:{...process.env,NODE_ENV:"production",STORAGE_ROOT:target},encoding:"utf8"}));

  assert.equal(result.staged.format,"eventstudio-backup-v2");
  assert.ok(result.events>=1);
  assert.ok(result.inactiveDemoClients>=1,"Las cuentas cliente de demostración deben quedar inactivas al restaurar en producción.");
  assert.ok(result.inactiveDemoAccounts>=2,"Ninguna cuenta de demostración, incluida la propietaria, debe quedar activa en producción.");
  assert.equal(result.uploadRestored,true);
  assert.equal(result.markerRemoved,true);
  console.log("✓ Restauración validada, aplicada y protegida contra cuentas demo");
}finally{
  fs.rmSync(source,{recursive:true,force:true});
  fs.rmSync(target,{recursive:true,force:true});
}
