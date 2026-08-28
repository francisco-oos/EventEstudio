"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const AdmZip=require("adm-zip");
const ExcelJS=require("exceljs");
const {validateXlsxArchive}=require("../src/spreadsheet-security");

const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

function runNode(code,env={}){
  return spawnSync(process.execPath,["-e",code],{
    cwd:root,
    env:{...process.env,...env},
    encoding:"utf8",
    timeout:30000
  });
}

async function main(){
  const work=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-security-db-"));
  try{
    const storage=path.join(work,"storage");
    const bootstrap=runNode(`
      const db=require('./src/db');
      console.log(JSON.stringify({
        quick:db.pragma('quick_check',{simple:true}),
        foreignKeys:db.pragma('foreign_keys',{simple:true}),
        trustedSchema:db.pragma('trusted_schema',{simple:true}),
        cellSizeCheck:db.pragma('cell_size_check',{simple:true}),
        mmapSize:db.pragma('mmap_size',{simple:true})
      }));
      db.close();
    `,{NODE_ENV:"test",STORAGE_ROOT:storage});
    assert.equal(bootstrap.status,0,bootstrap.stderr||bootstrap.stdout);
    const line=bootstrap.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    const pragmas=JSON.parse(line);
    assert.equal(pragmas.quick,"ok");
    assert.equal(Number(pragmas.foreignKeys),1,"SQLite debe exigir claves foráneas.");
    assert.equal(Number(pragmas.trustedSchema),0,"trusted_schema debe permanecer desactivado.");
    assert.equal(Number(pragmas.cellSizeCheck),1,"cell_size_check debe permanecer activo.");
    assert.equal(Number(pragmas.mmapSize),0,"mmap debe permanecer desactivado para la base sensible.");

    const dbPath=path.join(storage,"data","wedding.db");
    assert.ok(fs.existsSync(dbPath));
    if(process.platform!=="win32")assert.equal(fs.statSync(dbPath).mode&0o777,0o600,"La base debe ser privada para el usuario del proceso.");

    /* Una alteración del encabezado simula corrupción/tampering físico del archivo.
       El siguiente arranque debe negarse a usar esa base, no repararla en silencio. */
    const descriptor=fs.openSync(dbPath,"r+");
    try{fs.writeSync(descriptor,Buffer.from("BROKEN!!"),0,8,0);}finally{fs.closeSync(descriptor);}
    const corrupted=runNode("require('./src/db')",{NODE_ENV:"test",STORAGE_ROOT:storage});
    assert.notEqual(corrupted.status,0,"Una base físicamente alterada no debe iniciar EventStudio.");

    const normalXlsx=path.join(work,"normal.xlsx");
    const workbook=new ExcelJS.Workbook();
    const sheet=workbook.addWorksheet("Invitados");
    sheet.addRow(["FAMILIA","ADULTOS","NIÑOS"]);sheet.addRow(["Familia Prueba",2,1]);
    await workbook.xlsx.writeFile(normalXlsx);
    const normalSummary=validateXlsxArchive(normalXlsx);
    assert.ok(normalSummary.entries>1&&normalSummary.uncompressedBytes>0,"Un XLSX normal debe superar el preflight.");

    const bombPath=path.join(work,"compression-bomb.xlsx");
    const zip=new AdmZip();
    zip.addFile("[Content_Types].xml",Buffer.from("<Types/>"));
    zip.addFile("xl/workbook.xml",Buffer.alloc(2*1024*1024,0x41));
    zip.writeZip(bombPath);
    assert.throws(()=>validateXlsxArchive(bombPath),error=>error?.code==="XLSX_COMPRESSION_RATIO"||error?.code==="XLSX_UNCOMPRESSED_LIMIT","Una bomba XLSX debe rechazarse antes de ExcelJS.");

    const pkg=require("../package-lock.json");
    const multerVersion=String(pkg.packages?.["node_modules/multer"]?.version||"");
    const majorMinor=multerVersion.split(".").slice(0,2).map(Number);
    assert.ok(majorMinor[0]>2||(majorMinor[0]===2&&majorMinor[1]>=2),`Multer ${multerVersion} es anterior al parche 2.2.0.`);
    assert.match(read("src/server.js"),/fieldNestingDepth:1/);

    console.log("✓ Seguridad BD/XLSX: integridad, FK, pragmas defensivos, permisos, corrupción y bomba de compresión verificados");
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
