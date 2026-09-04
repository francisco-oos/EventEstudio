"use strict";

const catalog=require("../config/seals.json");

const idSet=key=>new Set((catalog[key]||[]).map(item=>item.id));
const FONTS=idSet("fonts"),BORDERS=idSet("borders"),ORNAMENTS=idSet("ornaments"),MATERIALS=idSet("materials"),QUALITY=idSet("qualityLevels");
const HEX=/^#[0-9a-f]{6}$/i;
const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};
const text=(value,max=48)=>String(value??"").replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,max);
const range=(key,fallback)=>({...(catalog.controls?.[key]||{}),fallback});

function normalizeSeal(current={},incoming={}){
  const base={...catalog.defaults,...(current&&typeof current==="object"?current:{})};
  const next={...base,...(incoming&&typeof incoming==="object"?incoming:{})};
  return {
    enabled:next.enabled!==false,
    customized:next.customized===true,
    autoMonogram:next.autoMonogram!==false,
    initial1:text(next.initial1,2),initial2:text(next.initial2,2),
    connector:text(next.connector,4),
    topText:text(next.topText,32),bottomText:text(next.bottomText,32),
    font:FONTS.has(next.font)?next.font:catalog.defaults.font,
    fontSize:clamp(next.fontSize,range("fontSize",catalog.defaults.fontSize).min,range("fontSize",catalog.defaults.fontSize).max,catalog.defaults.fontSize),
    kerning:clamp(next.kerning,range("kerning",catalog.defaults.kerning).min,range("kerning",catalog.defaults.kerning).max,catalog.defaults.kerning),
    verticalOffset:clamp(next.verticalOffset,range("verticalOffset",catalog.defaults.verticalOffset).min,range("verticalOffset",catalog.defaults.verticalOffset).max,catalog.defaults.verticalOffset),
    borderStyle:BORDERS.has(next.borderStyle)?next.borderStyle:catalog.defaults.borderStyle,
    ornament:ORNAMENTS.has(next.ornament)?next.ornament:catalog.defaults.ornament,
    material:MATERIALS.has(next.material)?next.material:catalog.defaults.material,
    customColor:HEX.test(String(next.customColor||""))?String(next.customColor).toLowerCase():catalog.defaults.customColor,
    reliefDepth:clamp(next.reliefDepth,range("reliefDepth",catalog.defaults.reliefDepth).min,range("reliefDepth",catalog.defaults.reliefDepth).max,catalog.defaults.reliefDepth),
    reliefMode:(catalog.reliefModes||[]).some(item=>item.id===next.reliefMode)?next.reliefMode:catalog.defaults.reliefMode,
    specular:clamp(next.specular,range("specular",catalog.defaults.specular).min,range("specular",catalog.defaults.specular).max,catalog.defaults.specular),
    quality:QUALITY.has(next.quality)?next.quality:catalog.defaults.quality
  };
}

module.exports={catalog,normalizeSeal};
