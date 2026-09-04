"use strict";

const raw=require("../config/gift-persuasion-presets.json");

function clean(value,maxLength){return String(value??"").trim().slice(0,maxLength);}

const presets=(Array.isArray(raw.presets)?raw.presets:[]).map((item,index)=>{
  const id=clean(item?.id,80);
  const label=clean(item?.label,120);
  const strategy=clean(item?.strategy,160);
  const text=clean(item?.text,700);
  if(!id||!label||!text)throw new Error(`Preset persuasivo inválido en índice ${index}.`);
  return {id,label,strategy,text};
});

const ids=new Set();
for(const item of presets){
  if(ids.has(item.id))throw new Error(`Preset persuasivo duplicado: ${item.id}`);
  ids.add(item.id);
}

function publicCatalog(){
  return presets.map(({id,label,strategy,text})=>({id,label,strategy,text}));
}

function normalizeBank(bank={}){
  const presetId=clean(bank.persuasionPresetId,80);
  const validPresetId=presetId==="custom"||ids.has(presetId)?presetId:"";
  return {
    ...bank,
    persuasionPresetId:validPresetId,
    persuasionCustomText:clean(bank.persuasionCustomText,700)
  };
}

function resolve(bank={}){
  const presetId=clean(bank.persuasionPresetId,80);
  if(presetId==="custom")return clean(bank.persuasionCustomText,700);
  if(!presetId)return "";
  return presets.find(item=>item.id===presetId)?.text||"";
}

module.exports={version:Number(raw.version)||1,presets,publicCatalog,normalizeBank,resolve};
