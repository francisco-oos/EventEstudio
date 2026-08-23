"use strict";

const fs=require("fs");

const REQUIRED_PALETTE_KEYS=["bg","paper","ink","muted","accent","gold","line"];
const SAFE_COLOR=/^#[0-9a-f]{3,8}$/i;
const NEUTRAL_PALETTE={
  bg:"#f4f1ec",
  paper:"#ffffff",
  ink:"#292724",
  muted:"#716d67",
  accent:"#5f625e",
  gold:"#a28d68",
  line:"#d8d2ca"
};


function normalizeHex(value){
  let hex=String(value||"").trim().replace(/^#/,"");
  if(hex.length===3)hex=[...hex].map(char=>char+char).join("");
  if(!/^[0-9a-f]{6}$/i.test(hex))return null;
  return `#${hex.toLowerCase()}`;
}

function relativeLuminance(value){
  const hex=normalizeHex(value);
  if(!hex)return 0;
  const channels=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255)
    .map(channel=>channel<=0.03928?channel/12.92:Math.pow((channel+0.055)/1.055,2.4));
  return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
}

function contrastRatio(first,second){
  const a=relativeLuminance(first),b=relativeLuminance(second);
  const light=Math.max(a,b),dark=Math.min(a,b);
  return (light+0.05)/(dark+0.05);
}

function blendHex(first,second,amount){
  const parse=value=>{const hex=normalizeHex(value);return hex?[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)):null;};
  const a=parse(first),b=parse(second);if(!a||!b)return normalizeHex(first)||"#1f1f1f";
  const mix=a.map((channel,index)=>Math.round(channel+(b[index]-channel)*amount));
  return `#${mix.map(channel=>Math.max(0,Math.min(255,channel)).toString(16).padStart(2,"0")).join("")}`;
}
function accessibleColorVariant(foreground,background,{minimum=4.5}={}){
  const original=normalizeHex(foreground)||"#1f1f1f";
  if(contrastRatio(original,background)>=minimum)return original;
  const candidates=[];
  for(const target of ["#000000","#ffffff"]){
    for(let step=1;step<=20;step++){
      const amount=step/20,candidate=blendHex(original,target,amount);
      if(contrastRatio(candidate,background)>=minimum){candidates.push({candidate,amount});break;}
    }
  }
  candidates.sort((left,right)=>left.amount-right.amount);
  return candidates[0]?.candidate||readableNeutral(background,{minimum});
}

function readableNeutral(background,{minimum=4.5,preferMuted=false}={}){
  const candidates=preferMuted
    ?["#5f5b56","#54514d","#4b4945","#707070","#333333","#ffffff"]
    :["#242321","#1f1f1f","#2b2b2b","#ffffff"];
  return candidates.find(candidate=>contrastRatio(candidate,background)>=minimum)||"#1f1f1f";
}

function ensureAccessiblePalette(input){
  const palette={...input};
  const paper=normalizeHex(palette.paper)||"#ffffff";
  const bg=normalizeHex(palette.bg)||paper;
  const ink=normalizeHex(palette.ink)||readableNeutral(paper);
  const muted=normalizeHex(palette.muted)||ink;
  palette.ink=contrastRatio(ink,paper)>=4.5?ink:readableNeutral(paper);
  palette.muted=contrastRatio(muted,paper)>=4.5?muted:readableNeutral(paper,{preferMuted:true});
  const accent=normalizeHex(palette.accent)||"#5f625e";
  palette.accent=accent;
  palette.accentText=accessibleColorVariant(accent,paper,{minimum:4.5});
  palette.accentContrast=contrastRatio("#ffffff",accent)>=4.5?"#ffffff":readableNeutral(accent);
  palette.bgContrast=contrastRatio(palette.ink,bg)>=4.5?palette.ink:readableNeutral(bg);
  return palette;
}

function escapeRegExp(value){
  return String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

function paletteFromCss(css,theme){
  const selector=escapeRegExp(theme.className);
  const block=String(css).match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`));
  if(!block)throw new Error(`La plantilla ${theme.id} no tiene variables CSS en .${theme.className}.`);
  const palette={};
  for(const match of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)){
    if(REQUIRED_PALETTE_KEYS.includes(match[1]))palette[match[1]]=match[2].trim();
  }
  for(const key of REQUIRED_PALETTE_KEYS){
    if(!SAFE_COLOR.test(palette[key]||"")){
      throw new Error(`La plantilla ${theme.id} no define un color seguro para --${key}.`);
    }
  }
  return Object.freeze(palette);
}

function loadThemeDesigns(themes,cssPath){
  const css=fs.readFileSync(cssPath,"utf8");
  const designs=new Map();
  for(const theme of themes){
    if(!theme?.id||!theme?.className)throw new Error("Cada plantilla requiere id y className.");
    if(designs.has(theme.id))throw new Error(`Plantilla duplicada: ${theme.id}.`);
    designs.set(theme.id,Object.freeze({
      theme:Object.freeze({...theme}),
      palette:Object.freeze(ensureAccessiblePalette(paletteFromCss(css,theme)))
    }));
  }
  return designs;
}

function themeDesignFor(designs,themeId,fallbackId="romantic-wine"){
  return designs.get(themeId)||designs.get(fallbackId)||designs.values().next().value;
}

function printFamilyFor(theme){
  const layout=String(theme?.layoutFamily||"").toLowerCase();
  const motif=String(theme?.motif||"spark").toLowerCase();
  const id=String(theme?.id||"");
  if(["cinematic-vows","midnight-gold","black-tie","cinema-premiere","cinematic-journey"].includes(id)
    ||/(cinema|poster|magazine)/.test(layout))return "cinematic";
  if(["storybook-seal","romantic-wine","enchanted-letter","destination-passport","petal-letter"].includes(id)
    ||/(story|scrapbook|postcard|passport)/.test(layout)
    ||["paper","stamp","plane","petal"].includes(motif))return "storybook";
  if(["lavender-couture","lavender-dream","rose-blue-surprise"].includes(id))return "lavender";
  if(["botanical-ivory","rose-garden","mexican-bougainvillea","forest-candlelight","botanical-scroll","welcome-clouds","stork-watercolor","garden-reveal","celestial-blessing","linen-cross","sage-communion","eternal-rose","family-memories"].includes(id)
    ||/(botanical|garden|celestial|linen|bloom|family-tree)/.test(layout)
    ||["leaf","cloud","rose","branch"].includes(motif))return "botanical";
  if(["paw","block","bubble","confetti","flag","pixel","star","light"].includes(motif))return "playful";
  return "editorial";
}

module.exports={
  REQUIRED_PALETTE_KEYS,
  NEUTRAL_PALETTE,
  paletteFromCss,
  loadThemeDesigns,
  themeDesignFor,
  printFamilyFor,
  contrastRatio,
  accessibleColorVariant,
  ensureAccessiblePalette
};
