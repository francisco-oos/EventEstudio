"use strict";

const experiences=require("../config/experiences.json");
const stationery=require("../config/stationery.json");

const HEX=/^#[0-9a-f]{6}$/i;
const openingById=new Map((experiences.openings||[]).map(item=>[item.id,item]));
const presetById=new Map((stationery.presets||[]).map(item=>[item.id,item]));

function color(value){
  const normalized=String(value||"").trim().toLowerCase();
  return HEX.test(normalized)?normalized:null;
}

function selectedOpening(openingStyle){
  return openingById.get(String(openingStyle||""))||null;
}

function presetTokens(policy){
  const preset=presetById.get(String(policy?.presetId||""));
  if(!preset)return {};
  const pick=key=>color(preset?.[key]);
  return {
    accent:pick(policy.accentKey),
    gold:pick(policy.goldKey),
    line:pick(policy.lineKey)
  };
}

function presentationTokens(policy,presentation={}){
  const pick=field=>field?color(presentation?.[field]):null;
  return {
    accent:pick(policy?.accentField),
    gold:pick(policy?.goldField),
    line:pick(policy?.lineField)
  };
}

function coordinationFor(settings={}){
  const opening=selectedOpening(settings?.presentation?.openingStyle);
  const policy=opening?.coordination&&typeof opening.coordination==="object"
    ? opening.coordination
    : {mode:"template"};
  if(policy.mode!=="accent-harmony")return {mode:policy.mode||"template",tokens:{},openingId:opening?.id||""};
  const tokens=policy.source==="stationery-preset"
    ?presetTokens(policy)
    :policy.source==="presentation"
      ?presentationTokens(policy,settings?.presentation||{})
      :{};
  return {
    mode:"accent-harmony",
    openingId:opening?.id||"",
    tokens:Object.fromEntries(Object.entries(tokens).filter(([,value])=>Boolean(value)))
  };
}

function stationeryIsAuthoritative(settings={},normalizedStationery=settings?.stationery||{}){
  /*
     El sobre unificado es una decisión explícita de diseño: cuando fue
     personalizado, su paleta debe gobernar todos los entregables del evento.
     `syncDesignTokens` se conserva por compatibilidad de datos, pero ya no puede
     dejar a medias una aplicación del Estudio Avanzado. Las demás aperturas nunca
     heredan una papelería guardada anteriormente.
  */
  return String(settings?.presentation?.openingStyle||"")===String(stationery.openingId||"")
    &&normalizedStationery?.customized===true;
}

function applyOpeningCoordination(basePalette={},settings={}){
  /*
     Compatibilidad histórica: las entradas independientes ya no alteran la
     paleta de los entregables. Sus colores pertenecen exclusivamente a su propia
     animación. El sobre unificado se resuelve mediante stationeryIsAuthoritative.
  */
  void settings;
  return {...basePalette};
}

module.exports={
  coordinationFor,
  stationeryIsAuthoritative,
  applyOpeningCoordination
};
