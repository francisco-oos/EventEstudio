"use strict";

const fs=require("fs");
const path=require("path");
const AdmZip=require("adm-zip");

function spreadsheetError(message,code){
  return Object.assign(new Error(message),{code});
}

/*
  XLSX es un contenedor ZIP. ExcelJS 4.4.0 no limita por sí mismo cuánto puede
  expandirse un archivo comprimido al leerlo. Este preflight inspecciona sólo el
  directorio central del ZIP, antes de que ExcelJS descomprima las entradas.
  Los límites son deliberadamente holgados para hojas reales de invitados, pero
  bloquean bombas de compresión, rutas anómalas y archivos con miles de entradas.
*/
function validateXlsxArchive(filePath,options={}){
  const maxEntries=Number(options.maxEntries||2500);
  const maxUncompressedBytes=Number(options.maxUncompressedBytes||128*1024*1024);
  const maxEntryBytes=Number(options.maxEntryBytes||64*1024*1024);
  const maxCompressionRatio=Number(options.maxCompressionRatio||250);
  const maxCompressedBytes=Number(options.maxCompressedBytes||8*1024*1024);

  const stat=fs.statSync(filePath);
  if(!stat.isFile()||stat.size<=0)throw spreadsheetError("El archivo XLSX está vacío.","XLSX_EMPTY");
  if(stat.size>maxCompressedBytes)throw spreadsheetError("El archivo XLSX excede el tamaño comprimido permitido.","XLSX_COMPRESSED_LIMIT");

  let zip;
  try{zip=new AdmZip(filePath);}catch{
    throw spreadsheetError("El archivo .xlsx no contiene un ZIP válido.","XLSX_ZIP_INVALID");
  }
  const entries=zip.getEntries();
  if(!entries.length||entries.length>maxEntries){
    throw spreadsheetError("El XLSX contiene una cantidad de entradas no permitida.","XLSX_ENTRY_LIMIT");
  }

  let totalUncompressed=0;
  let hasContentTypes=false,hasWorkbook=false;
  for(const entry of entries){
    const name=String(entry.entryName||"").replace(/\\/g,"/");
    if(!name||name.includes("\0")||name.startsWith("/")||/^[A-Za-z]:\//.test(name)||name.split("/").some(part=>part==="..")){
      throw spreadsheetError("El XLSX contiene una ruta interna no permitida.","XLSX_ENTRY_PATH");
    }
    if(entry.isDirectory)continue;
    const uncompressed=Number(entry.header?.size);
    const compressed=Number(entry.header?.compressedSize);
    if(!Number.isSafeInteger(uncompressed)||uncompressed<0||!Number.isSafeInteger(compressed)||compressed<0){
      throw spreadsheetError("El XLSX declara tamaños internos inválidos.","XLSX_ENTRY_SIZE_INVALID");
    }
    if(uncompressed>maxEntryBytes){
      throw spreadsheetError("Una entrada interna del XLSX excede el límite seguro.","XLSX_ENTRY_TOO_LARGE");
    }
    totalUncompressed+=uncompressed;
    if(!Number.isSafeInteger(totalUncompressed)||totalUncompressed>maxUncompressedBytes){
      throw spreadsheetError("El XLSX se expandiría por encima del límite seguro.","XLSX_UNCOMPRESSED_LIMIT");
    }
    if(uncompressed>0){
      if(compressed===0||uncompressed/Math.max(1,compressed)>maxCompressionRatio){
        throw spreadsheetError("El XLSX tiene una relación de compresión anómala.","XLSX_COMPRESSION_RATIO");
      }
    }
    if(name==="[Content_Types].xml")hasContentTypes=true;
    if(name==="xl/workbook.xml")hasWorkbook=true;
  }
  if(!hasContentTypes||!hasWorkbook){
    throw spreadsheetError("El archivo no tiene la estructura mínima de un libro XLSX.","XLSX_STRUCTURE_INVALID");
  }
  return {entries:entries.length,compressedBytes:stat.size,uncompressedBytes:totalUncompressed};
}

module.exports={validateXlsxArchive};
