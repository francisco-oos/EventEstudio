"use strict";

const raw=require("../config/gift-message-presets.json");

function clean(value,max){return String(value??"").trim().slice(0,max);}
function normalizedPreset(item,index){
  const id=clean(item?.id,80);
  const label=clean(item?.label,100);
  const text=clean(item?.text,500);
  if(!id||!label||!text)throw new Error(`Preset de felicitación inválido en índice ${index}.`);
  const eventTypes=Array.isArray(item.eventTypes)?item.eventTypes.map(value=>clean(value,60)).filter(Boolean):["*"];
  const principles=Array.isArray(item.principles)?item.principles.map(value=>clean(value,80)).filter(Boolean):[];
  return {id,label,text,eventTypes:eventTypes.length?eventTypes:["*"],principles};
}

const presets=(Array.isArray(raw.presets)?raw.presets:[]).map(normalizedPreset);
const ids=new Set();
for(const item of presets){
  if(ids.has(item.id))throw new Error(`Preset de felicitación duplicado: ${item.id}`);
  ids.add(item.id);
}
const maxVisible=Math.max(1,Math.min(12,Number(raw.maxVisible)||6));

function forEventType(eventType){
  const type=clean(eventType||"custom",60);
  const specific=presets.filter(item=>item.eventTypes.includes(type));
  const general=presets.filter(item=>item.eventTypes.includes("*"));
  const merged=[];
  for(const item of [...specific,...general]){
    if(!merged.some(existing=>existing.id===item.id))merged.push(item);
    if(merged.length>=maxVisible)break;
  }
  return merged.map(({id,label,text})=>({id,label,text}));
}

module.exports={version:Number(raw.version)||1,maxVisible,presets,forEventType};
