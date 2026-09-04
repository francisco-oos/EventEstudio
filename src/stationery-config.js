"use strict";

const catalog=require("../config/stationery.json");

const HEX=/^#[0-9a-f]{6}$/i;
const ids=key=>new Set((catalog[key]||[]).map(item=>item.id));
const FORMAT_IDS=ids("formats");
const MATERIAL_IDS=ids("materials");
const LINER_IDS=ids("liners");
const OVERLAY_IDS=ids("overlays");
const STAMP_IDS=ids("stamps");
const FRAME_IDS=ids("frames");
const DIVIDER_IDS=ids("dividers");
const PRESET_IDS=ids("presets");
const LEGACY_PRESETS=Object.freeze(Object.fromEntries((catalog.legacyAliases||[]).map(item=>[item.openingId,item.presetId])));

function bool(value,fallback=false){
  if(value===undefined||value===null)return fallback;
  return value===true||value===1||value==="1"||value==="true"||value==="yes";
}

function clamp(value,min,max,fallback){
  const numeric=Number(value);
  return Number.isFinite(numeric)?Math.min(max,Math.max(min,numeric)):fallback;
}

function color(value,fallback){
  const normalized=String(value||"").trim().toLowerCase();
  return HEX.test(normalized)?normalized:fallback;
}

function selectedId(set,value,fallback){
  const normalized=String(value||"");
  return set.has(normalized)?normalized:fallback;
}

function presetById(id){
  return (catalog.presets||[]).find(item=>item.id===id)||null;
}

function legacyPresetForOpening(openingId){
  return LEGACY_PRESETS[String(openingId||"")]||null;
}

function isLegacyEnvelopeOpening(openingId){
  return Boolean(legacyPresetForOpening(openingId));
}

function configuredBase(current={},openingStyle=""){
  const source=current&&typeof current==="object"?current:{};
  const legacyPreset=legacyPresetForOpening(openingStyle);
  const preset=presetById(legacyPreset)||presetById(source.presetId)||presetById(catalog.defaults.presetId)||{};
  if(legacyPreset&&source.customized!==true){
    return {
      ...catalog.defaults,
      ...preset,
      enabled:source.enabled!==false,
      customized:false,
      syncDesignTokens:false,
      presetId:legacyPreset
    };
  }
  return source.customized===true
    ? {...catalog.defaults,...source}
    : {...catalog.defaults,...preset,...source,presetId:legacyPreset||source.presetId||catalog.defaults.presetId};
}

function normalizeStationery(current={},incoming={},options={}){
  const requested=incoming&&typeof incoming==="object"?incoming:{};
  const base=configuredBase(current,options.openingStyle);
  const requestedPreset=PRESET_IDS.has(String(requested.presetId||""))?presetById(requested.presetId):null;
  const next=requestedPreset?{...base,...requestedPreset,...requested}:{...base,...requested};
  const defaults=catalog.defaults;
  const customized=bool(next.customized,false);
  const unifiedCustomized=String(options.openingStyle||"")===String(catalog.openingId||"")&&customized;
  return {
    enabled:bool(next.enabled,true),
    customized,
    syncDesignTokens:unifiedCustomized?true:bool(next.syncDesignTokens,false),
    presetId:selectedId(PRESET_IDS,next.presetId,defaults.presetId),
    formatId:selectedId(FORMAT_IDS,next.formatId,defaults.formatId),
    materialId:selectedId(MATERIAL_IDS,next.materialId,defaults.materialId),
    textureStrength:clamp(next.textureStrength,catalog.controls?.textureStrength?.min??0,catalog.controls?.textureStrength?.max??100,defaults.textureStrength),
    outerColor:color(next.outerColor,defaults.outerColor),
    innerColor:color(next.innerColor,defaults.innerColor),
    cardColor:color(next.cardColor,defaults.cardColor),
    textColor:color(next.textColor,defaults.textColor),
    ornamentColor:color(next.ornamentColor,defaults.ornamentColor),
    sealColor:color(next.sealColor,defaults.sealColor),
    linerId:selectedId(LINER_IDS,next.linerId,defaults.linerId),
    overlayId:selectedId(OVERLAY_IDS,next.overlayId,defaults.overlayId),
    stampId:selectedId(STAMP_IDS,next.stampId,defaults.stampId),
    frameId:selectedId(FRAME_IDS,next.frameId,defaults.frameId),
    dividerId:selectedId(DIVIDER_IDS,next.dividerId,defaults.dividerId),
    fontMode:next.fontMode==="custom"?"custom":"event"
  };
}

function designTokens(stationery){
  const value=normalizeStationery(stationery,{});
  return {
    bg:value.outerColor,
    paper:value.cardColor,
    ink:value.textColor,
    muted:value.innerColor,
    accent:value.sealColor,
    gold:value.ornamentColor,
    line:value.innerColor
  };
}

function surfaceTexture(stationery){
  const value=normalizeStationery(stationery,{});
  return (catalog.materials||[]).find(item=>item.id===value.materialId)?.surfaceTexture||"none";
}

module.exports={
  catalog,
  normalizeStationery,
  presetById,
  legacyPresetForOpening,
  isLegacyEnvelopeOpening,
  designTokens,
  surfaceTexture
};
