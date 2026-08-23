"use strict";

const fs=require("fs");
const zlib=require("zlib");

function validatePngStructure(filePath){
  const bytes=fs.readFileSync(filePath);
  let offset=8;
  let width=0;
  let height=0;
  let sawHeader=false;
  let sawEnd=false;
  const imageChunks=[];
  while(offset+12<=bytes.length){
    const length=bytes.readUInt32BE(offset);
    const type=bytes.toString("ascii",offset+4,offset+8);
    const dataStart=offset+8;
    const dataEnd=dataStart+length;
    if(dataEnd+4>bytes.length)throw new Error("La estructura PNG está incompleta.");
    if(type==="IHDR"){
      if(sawHeader||length!==13)throw new Error("La cabecera PNG no es válida.");
      width=bytes.readUInt32BE(dataStart);
      height=bytes.readUInt32BE(dataStart+4);
      if(!width||!height||width>20000||height>20000||width*height>80000000){
        throw new Error("Las dimensiones de la imagen exceden el límite seguro.");
      }
      if(bytes[dataStart+10]!==0||bytes[dataStart+11]!==0)throw new Error("El método PNG no es compatible.");
      sawHeader=true;
    }else if(type==="IDAT"){
      imageChunks.push(bytes.subarray(dataStart,dataEnd));
    }else if(type==="IEND"){
      sawEnd=true;
      break;
    }
    offset=dataEnd+4;
  }
  if(!sawHeader||!sawEnd||!imageChunks.length)throw new Error("La estructura PNG está incompleta.");
  const maxOutputLength=Math.min(512*1024*1024,width*height*8+height*8+1024);
  zlib.inflateSync(Buffer.concat(imageChunks),{maxOutputLength});
}

function validateJpegStructure(filePath){
  const bytes=fs.readFileSync(filePath);
  if(bytes.length<8||bytes[0]!==0xff||bytes[1]!==0xd8||bytes.lastIndexOf(Buffer.from([0xff,0xd9]))<2){
    throw new Error("La estructura JPEG está incompleta.");
  }
  let offset=2;
  let dimensions=null;
  const startOfFrame=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  while(offset+4<=bytes.length){
    while(offset<bytes.length&&bytes[offset]===0xff)offset++;
    const marker=bytes[offset++];
    if(marker===0xd9||marker===0xda)break;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    if(offset+2>bytes.length)break;
    const length=bytes.readUInt16BE(offset);
    if(length<2||offset+length>bytes.length)throw new Error("La estructura JPEG está incompleta.");
    if(startOfFrame.has(marker)&&length>=7){
      const height=bytes.readUInt16BE(offset+3);
      const width=bytes.readUInt16BE(offset+5);
      if(!width||!height||width*height>80000000)throw new Error("Las dimensiones de la imagen exceden el límite seguro.");
      dimensions={width,height};
      break;
    }
    offset+=length;
  }
  if(!dimensions)throw new Error("No se encontraron dimensiones JPEG válidas.");
}

function validateImageStructure(filePath,mime){
  try{
    if(mime==="image/png")validatePngStructure(filePath);
    if(mime==="image/jpeg")validateJpegStructure(filePath);
  }catch(error){
    const invalid=new Error(`La imagen está dañada o incompleta: ${error.message}`);
    invalid.code="INVALID_IMAGE_CONTENT";
    throw invalid;
  }
}

module.exports={validateImageStructure};
