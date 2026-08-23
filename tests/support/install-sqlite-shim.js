"use strict";

const Module=require("node:module");
const adapter=require("./better-sqlite3-shim");
const originalLoad=Module._load;

Module._load=function eventStudioTestModuleLoader(request,parent,isMain){
  if(request==="better-sqlite3")return adapter;
  return originalLoad.call(this,request,parent,isMain);
};
