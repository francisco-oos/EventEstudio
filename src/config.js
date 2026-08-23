"use strict";

function numberSetting(name,fallback,{min=-Infinity,max=Infinity,integer=false}={}){
  const raw=process.env[name];
  const value=raw===undefined||String(raw).trim()===""?fallback:Number(raw);
  if(!Number.isFinite(value))throw new Error(`${name} debe ser un número válido.`);
  if(integer&&!Number.isInteger(value))throw new Error(`${name} debe ser un número entero.`);
  if(value<min||value>max)throw new Error(`${name} debe estar entre ${min} y ${max}.`);
  return value;
}

module.exports={numberSetting};
