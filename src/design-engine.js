"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const root=path.join(__dirname,"..");
const designDir=path.join(root,"config","design");
const readJson=name=>JSON.parse(fs.readFileSync(path.join(designDir,name),"utf8"));

const assetManifest=readJson("assets-manifest.json");
const componentCatalog=readJson("components.json");
const recipeCatalog=readJson("recipes.json");
const photoPresentations=readJson("photo_presentations.json");
const motionTimelines=readJson("motion_timelines.json");
const printLayouts=readJson("print_layouts.json");
const qrFrames=readJson("qr_frames.json");
const paletteFamilies=readJson("palette_families.json");
const typographyPresets=readJson("typography_presets.json");

const assetsById=new Map(assetManifest.assets.map(item=>[item.id,item]));
const componentsByType=new Map(componentCatalog.components.map(item=>[item.type,item]));
const recipesById=new Map(recipeCatalog.recipes.map(item=>[item.id,item]));
const photoIds=new Set(photoPresentations.map(item=>item.id));
const motionIds=new Set(motionTimelines.map(item=>item.id));
const ALLOWED_TONES=new Set(["primary","accent","gold","ink","muted","paper"]);
const ALLOWED_MOTIONS=new Set(["none","float-soft","sway-soft","soft-rise","rotate-slow"]);
const SAFE_HEX=/^#[0-9a-f]{6}$/i;
const COLOR_HARMONIES=new Set(["monochromatic","analogous","complementary","split-complementary","triadic","tetradic","luxury","dark-luxury","pastel","high-contrast"]);
const HEADING_FONT_IDS=new Set((typographyPresets.heading||[]).map(item=>item.id));
const BODY_FONT_IDS=new Set((typographyPresets.body||[]).map(item=>item.id));
const TYPOGRAPHY_SCALES=new Set(typographyPresets.scales||["compact","comfortable","large"]);
const NAME_CASES=new Set(typographyPresets.nameCases||["preserve","title","uppercase","small-caps"]);
const EXPERIENCE_MODES=new Set(["auto","classic","story","poster","gallery"]);


function hexToRgb(hex){
  const value=String(hex||"").replace("#","");
  if(!/^[0-9a-f]{6}$/i.test(value))return {r:123,g:75,b:86};
  return {r:parseInt(value.slice(0,2),16),g:parseInt(value.slice(2,4),16),b:parseInt(value.slice(4,6),16)};
}
function rgbToHex(r,g,b){return `#${[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("")}`;}
function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b);let h=0,s=0,l=(max+min)/2;
  if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);if(max===r)h=(g-b)/d+(g<b?6:0);else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}
  return {h,s,l};
}
function hslToRgb(h,s,l){
  h=((h%360)+360)%360/360;if(s===0){const v=l*255;return {r:v,g:v,b:v};}
  const hue=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;return {r:hue(p,q,h+1/3)*255,g:hue(p,q,h)*255,b:hue(p,q,h-1/3)*255};
}
function hslHex(h,s,l){const rgb=hslToRgb(h,s,l);return rgbToHex(rgb.r,rgb.g,rgb.b);}
function relativeLuminance(hex){const {r,g,b}=hexToRgb(hex);const values=[r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return values[0]*.2126+values[1]*.7152+values[2]*.0722;}
function contrastRatio(a,b){const x=relativeLuminance(a),y=relativeLuminance(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+.05)/(lo+.05);}
function generateHarmoniousPalette(seed="#7b4b56",harmony="complementary"){
  const safeSeed=SAFE_HEX.test(String(seed))?String(seed).toLowerCase():"#7b4b56";const base=rgbToHsl(...Object.values(hexToRgb(safeSeed)));
  let h=base.h,s=Math.max(.18,Math.min(.78,base.s)),l=Math.max(.30,Math.min(.58,base.l));let h2=h,h3=h,bgL=.965,paperL=.99,inkL=.14,satBg=.10,goldS=.48,goldL=.54;
  switch(COLOR_HARMONIES.has(harmony)?harmony:"complementary"){case "analogous":h2=(h+30)%360;h3=(h+330)%360;break;case "complementary":h2=(h+180)%360;h3=(h+30)%360;break;case "split-complementary":h2=(h+150)%360;h3=(h+210)%360;break;case "triadic":h2=(h+120)%360;h3=(h+240)%360;break;case "tetradic":h2=(h+90)%360;h3=(h+180)%360;break;case "luxury":h2=42;h3=(h+180)%360;goldS=.60;goldL=.50;break;case "dark-luxury":h2=42;h3=(h+180)%360;bgL=.08;paperL=.12;inkL=.94;satBg=.20;goldS=.64;goldL=.58;l=Math.min(l,.44);break;case "pastel":h2=(h+35)%360;h3=(h+325)%360;s=Math.min(.42,s);l=.70;inkL=.20;break;case "high-contrast":h2=(h+180)%360;h3=(h+60)%360;s=Math.max(.60,s);l=.42;bgL=.98;paperL=1;inkL=.08;break;}
  const dark=harmony==="dark-luxury";const paper=hslHex(h,satBg*.7,paperL),bg=hslHex(h,satBg,bgL),ink=hslHex(h,.18,inkL);
  const accentCandidates=(dark?[.68,.72,.76,.80,.84,.88]:[l,.42,.38,.34,.30,.26,.22]).map(lightness=>hslHex(h,s,lightness));
  const accent=accentCandidates.reduce((best,value)=>{const score=Math.min(contrastRatio(value,paper),contrastRatio(value,bg));const bestScore=Math.min(contrastRatio(best,paper),contrastRatio(best,bg));return score>bestScore?value:best;},accentCandidates[0]);
  const accentDark=hslHex(h3,Math.min(.78,s),dark?.72:.28);
  return {bg,paper,ink,muted:hslHex(h,.10,dark?.66:.44),accent,"accent-dark":accentDark,gold:hslHex(42,goldS,goldL),line:hslHex(h,.12,dark?.26:.84),secondary:hslHex(h2,Math.min(.70,s*.9),dark?.62:.50)};
}
function scanSafeQrColors(palette={},background="#ffffff"){
  const p=sanitizePalette(palette);
  const bg=SAFE_HEX.test(String(background||""))?String(background).toLowerCase():"#ffffff";
  const candidates=[p.ink,p["accent-dark"],p.accent,p.gold,"#111111"].filter(value=>SAFE_HEX.test(String(value||"")));
  const foreground=candidates.find(value=>contrastRatio(value,bg)>=7)||candidates.find(value=>contrastRatio(value,bg)>=4.5)||"#111111";
  return {foreground,background:bg,ratio:Number(contrastRatio(foreground,bg).toFixed(2))};
}
function paletteAudit(palette={}){
  const p=sanitizePalette(palette);const pairs=[["ink","paper"],["ink","bg"],["accent","paper"],["accent","bg"]];
  const checks=pairs.filter(([a,b])=>p[a]&&p[b]).map(([foreground,background])=>{const ratio=contrastRatio(p[foreground],p[background]);return {foreground,background,ratio:Number(ratio.toFixed(2)),aaNormal:ratio>=4.5,aaLarge:ratio>=3};});
  return {pass:checks.every(item=>item.aaNormal||((item.foreground==="accent")&&item.aaLarge)),checks};
}

function clone(value){return JSON.parse(JSON.stringify(value));}
function clamp(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
function safeText(value,max=160){return String(value??"").replace(/[\u0000-\u001F\u007F]/g,"").trim().slice(0,max);}
function safeId(value,max=100){const text=safeText(value,max);return /^[a-z0-9][a-z0-9._:-]*$/i.test(text)?text:"";}

function sanitizePalette(input={},fallback={}){
  const out={};
  for(const key of ["bg","paper","ink","muted","accent","accent-dark","gold","line","headingColor","bodyColor"]){
    const value=input?.[key];
    out[key]=SAFE_HEX.test(String(value||""))?String(value).toLowerCase():(SAFE_HEX.test(String(fallback?.[key]||""))?String(fallback[key]).toLowerCase():undefined);
  }
  return Object.fromEntries(Object.entries(out).filter(([,value])=>value));
}

function sanitizeSection(input,index=0){
  const type=safeId(input?.type,50);
  const component=componentsByType.get(type);
  if(!component)return null;
  const styleIds=new Set((component.styles||[]).map(item=>item.id));
  const styleId=styleIds.has(input?.styleId)?input.styleId:(component.styles?.[0]?.id||"");
  const raw=input?.props&&typeof input.props==="object"?input.props:{};
  const tones=new Set(["heading","body","ink","muted","accent","gold","paper"]);
  const props={
    textAlign:["left","center","right"].includes(raw.textAlign)?raw.textAlign:"center",
    spacing:clamp(raw.spacing,12,120,36),
    width:clamp(raw.width,40,100,92),
    headingSize:clamp(raw.headingSize,.75,3,1),
    bodySize:clamp(raw.bodySize,.75,2,1),
    headingWeight:[400,500,600,700,800].includes(Number(raw.headingWeight))?Number(raw.headingWeight):700,
    bodyWeight:[400,500,600,700].includes(Number(raw.bodyWeight))?Number(raw.bodyWeight):400,
    lineHeight:clamp(raw.lineHeight,1,2.2,1.55),
    letterSpacing:clamp(raw.letterSpacing,-.05,.2,0),
    headingTone:tones.has(raw.headingTone)?raw.headingTone:"heading",
    bodyTone:tones.has(raw.bodyTone)?raw.bodyTone:"body",
    // RC38: el usuario puede elegir un color directo por bloque sin perder los
    // tokens semánticos. Un valor vacío significa «heredar el tono».
    headingColor:SAFE_HEX.test(String(raw.headingColor||""))?String(raw.headingColor).toLowerCase():"",
    bodyColor:SAFE_HEX.test(String(raw.bodyColor||""))?String(raw.bodyColor).toLowerCase():"",
    headingCase:["inherit","uppercase","lowercase","capitalize"].includes(raw.headingCase)?raw.headingCase:"inherit",
    surface:["paper","transparent","accent-soft"].includes(raw.surface)?raw.surface:"paper"
  };
  return {
    uid:safeId(input?.uid,100)||`${type}-${index+1}`,
    type,
    styleId,
    order:Math.round(clamp(input?.order,0,99,index)),
    visible:input?.visible!==false,
    props
  };
}

function sanitizeAssetInstance(input,index=0){
  const assetId=safeId(input?.assetId,120);
  const asset=assetsById.get(assetId);
  if(!asset||asset.status!=="approved")return null;
  const anchor=safeId(input?.anchor,50)||"hero";
  if(anchor!=="hero"&&anchor!=="footer"&&!componentsByType.has(anchor))return null;
  const motion=ALLOWED_MOTIONS.has(input?.motion)?input.motion:"none";
  return {
    uid:safeId(input?.uid,100)||`asset-${index+1}`,
    assetId,
    anchor,
    x:clamp(input?.x,0,100,50),
    y:clamp(input?.y,0,100,50),
    scale:clamp(input?.scale,0.1,4,1),
    rotation:clamp(input?.rotation,-360,360,0),
    zIndex:Math.round(clamp(input?.zIndex,-5,40,1)),
    opacity:clamp(input?.opacity,0.05,1,1),
    tone:ALLOWED_TONES.has(input?.tone)?input.tone:"accent",
    motion:asset.motions?.includes(motion)?motion:"none",
    locked:Boolean(input?.locked)
  };
}

function normalizeRecipe(input={},fallbackRecipe=null){
  const fallback=fallbackRecipe||recipeCatalog.recipes[0];
  const requestedId=safeId(input?.id,100);
  const sections=(Array.isArray(input?.sections)?input.sections:fallback.sections||[]).map(sanitizeSection).filter(Boolean);
  const seen=new Set();
  const uniqueSections=sections.filter(section=>{if(seen.has(section.uid))return false;seen.add(section.uid);return true;}).slice(0,40);
  const assets=(Array.isArray(input?.assets)?input.assets:fallback.assets||[]).map(sanitizeAssetInstance).filter(Boolean);
  const uniqueAssets=[];const assetUids=new Set();
  for(const asset of assets){if(assetUids.has(asset.uid))continue;assetUids.add(asset.uid);uniqueAssets.push(asset);if(uniqueAssets.length>=80)break;}
  const design=input?.design&&typeof input.design==="object"?input.design:{};
  const fallbackDesign=fallback.design||{};
  return {
    schema:"eventstudio.design-recipe.v2",
    id:requestedId||safeId(fallback.id,100)||"custom",
    name:safeText(input?.name||fallback.name||"Diseño personalizado",120),
    description:safeText(input?.description||fallback.description||"",400),
    version:Math.max(1,Math.round(clamp(input?.version,1,9999,1))),
    status:["draft","published","experimental"].includes(input?.status)?input.status:"draft",
    source:["catalog","custom","legacy-migration"].includes(input?.source)?input.source:"custom",
    eventTypes:Array.isArray(input?.eventTypes)?input.eventTypes.map(value=>safeId(value,50)).filter(Boolean).slice(0,30):clone(fallback.eventTypes||[]),
    tags:Array.isArray(input?.tags)?input.tags.map(value=>safeText(value,50)).filter(Boolean).slice(0,40):clone(fallback.tags||[]),
    moods:Array.isArray(input?.moods)?input.moods.map(value=>safeId(value,50)).filter(Boolean).slice(0,20):clone(fallback.moods||[]),
    design:{
      layoutFamily:safeId(design.layoutFamily,60)||safeId(fallbackDesign.layoutFamily,60)||"classic",
      photoPresentationId:photoIds.has(design.photoPresentationId)?design.photoPresentationId:(photoIds.has(fallbackDesign.photoPresentationId)?fallbackDesign.photoPresentationId:photoPresentations[0]?.id||""),
      motionPreset:["still","subtle","balanced","dynamic"].includes(design.motionPreset)?design.motionPreset:(fallbackDesign.motionPreset||"subtle"),
      motionTimelineId:motionIds.has(design.motionTimelineId)?design.motionTimelineId:(motionIds.has(fallbackDesign.motionTimelineId)?fallbackDesign.motionTimelineId:motionTimelines[0]?.id||""),
      palette:sanitizePalette(design.palette,fallbackDesign.palette),
      colorTheory:{
        seed:SAFE_HEX.test(String(design.colorTheory?.seed||""))?String(design.colorTheory.seed).toLowerCase():(SAFE_HEX.test(String(fallbackDesign.colorTheory?.seed||""))?String(fallbackDesign.colorTheory.seed).toLowerCase():(sanitizePalette(design.palette,fallbackDesign.palette).accent||"#7b4b56")),
        harmony:COLOR_HARMONIES.has(design.colorTheory?.harmony)?design.colorTheory.harmony:(COLOR_HARMONIES.has(fallbackDesign.colorTheory?.harmony)?fallbackDesign.colorTheory.harmony:"complementary"),
        familyId:safeId(design.colorTheory?.familyId||fallbackDesign.colorTheory?.familyId,80)||"custom"
      },
      texture:["none","paper","linen","soft-grain","wash"].includes(design.texture)?design.texture:(fallbackDesign.texture||"none"),
      openingId:safeId(design.openingId,80)||safeId(fallbackDesign.openingId,80)||"none",
      openingProps:{
        rosePetalColor:SAFE_HEX.test(String(design.openingProps?.rosePetalColor||""))?String(design.openingProps.rosePetalColor).toLowerCase():(SAFE_HEX.test(String(fallbackDesign.openingProps?.rosePetalColor||""))?String(fallbackDesign.openingProps.rosePetalColor).toLowerCase():""),
        floralPetalColor:SAFE_HEX.test(String(design.openingProps?.floralPetalColor||""))?String(design.openingProps.floralPetalColor).toLowerCase():(SAFE_HEX.test(String(fallbackDesign.openingProps?.floralPetalColor||""))?String(fallbackDesign.openingProps.floralPetalColor).toLowerCase():""),
        floralCenterColor:SAFE_HEX.test(String(design.openingProps?.floralCenterColor||""))?String(design.openingProps.floralCenterColor).toLowerCase():(SAFE_HEX.test(String(fallbackDesign.openingProps?.floralCenterColor||""))?String(fallbackDesign.openingProps.floralCenterColor).toLowerCase():"")
      },
      experienceMode:EXPERIENCE_MODES.has(design.experienceMode)?design.experienceMode:(EXPERIENCE_MODES.has(fallbackDesign.experienceMode)?fallbackDesign.experienceMode:"auto"),
      galleryStyleId:safeId(design.galleryStyleId,80)||safeId(fallbackDesign.galleryStyleId,80)||"classic",
      heroMedia:{
        // enabled=false evita descargar una foto de portada que el diseño oculta.
        // Se conserva true por defecto para no romper Recipes históricas.
        enabled:design.heroMedia?.enabled===false?false:(fallbackDesign.heroMedia?.enabled===false?false:true),
        layout:["background","split-left","split-right"].includes(design.heroMedia?.layout)?design.heroMedia.layout:(["background","split-left","split-right"].includes(fallbackDesign.heroMedia?.layout)?fallbackDesign.heroMedia.layout:"background"),
        fit:["cover","contain"].includes(design.heroMedia?.fit)?design.heroMedia.fit:(["cover","contain"].includes(fallbackDesign.heroMedia?.fit)?fallbackDesign.heroMedia.fit:"cover"),
        positionX:clamp(design.heroMedia?.positionX,0,100,clamp(fallbackDesign.heroMedia?.positionX,0,100,50)),
        positionY:clamp(design.heroMedia?.positionY,0,100,clamp(fallbackDesign.heroMedia?.positionY,0,100,50)),
        // RC41: el mismo archivo de portada puede tener encuadres distintos en móvil y escritorio.
        // Si no existen overrides se hereda la posición histórica, manteniendo compatibilidad total.
        mobilePositionX:clamp(design.heroMedia?.mobilePositionX,0,100,clamp(fallbackDesign.heroMedia?.mobilePositionX,0,100,clamp(design.heroMedia?.positionX,0,100,50))),
        mobilePositionY:clamp(design.heroMedia?.mobilePositionY,0,100,clamp(fallbackDesign.heroMedia?.mobilePositionY,0,100,clamp(design.heroMedia?.positionY,0,100,50))),
        desktopPositionX:clamp(design.heroMedia?.desktopPositionX,0,100,clamp(fallbackDesign.heroMedia?.desktopPositionX,0,100,clamp(design.heroMedia?.positionX,0,100,50))),
        desktopPositionY:clamp(design.heroMedia?.desktopPositionY,0,100,clamp(fallbackDesign.heroMedia?.desktopPositionY,0,100,clamp(design.heroMedia?.positionY,0,100,50))),
        mobileFit:["cover","contain"].includes(design.heroMedia?.mobileFit)?design.heroMedia.mobileFit:(["cover","contain"].includes(fallbackDesign.heroMedia?.mobileFit)?fallbackDesign.heroMedia.mobileFit:(design.heroMedia?.fit||"cover")),
        desktopFit:["cover","contain"].includes(design.heroMedia?.desktopFit)?design.heroMedia.desktopFit:(["cover","contain"].includes(fallbackDesign.heroMedia?.desktopFit)?fallbackDesign.heroMedia.desktopFit:(design.heroMedia?.fit||"cover")),
        overlay:clamp(design.heroMedia?.overlay,0,.8,clamp(fallbackDesign.heroMedia?.overlay,0,.8,.33))
      },
      typography:{
        heading:HEADING_FONT_IDS.has(design.typography?.heading)?design.typography.heading:(HEADING_FONT_IDS.has(fallbackDesign.typography?.heading)?fallbackDesign.typography.heading:"georgia"),
        body:BODY_FONT_IDS.has(design.typography?.body)?design.typography.body:(BODY_FONT_IDS.has(fallbackDesign.typography?.body)?fallbackDesign.typography.body:"system"),
        scale:TYPOGRAPHY_SCALES.has(design.typography?.scale)?design.typography.scale:(TYPOGRAPHY_SCALES.has(fallbackDesign.typography?.scale)?fallbackDesign.typography.scale:"comfortable"),
        nameCase:NAME_CASES.has(design.typography?.nameCase)?design.typography.nameCase:(NAME_CASES.has(fallbackDesign.typography?.nameCase)?fallbackDesign.typography.nameCase:"title")
      }
    },
    sections:uniqueSections,
    assets:uniqueAssets,
    compatibility:{legacyThemeId:safeId(input?.compatibility?.legacyThemeId||fallback.compatibility?.legacyThemeId,100)||null},
    thumbnail:{motif:safeId(input?.thumbnail?.motif||fallback.thumbnail?.motif,60)||"spark",preview:safeText(input?.thumbnail?.preview||fallback.thumbnail?.preview,8)}
  };
}

function catalogRecipe(id){const recipe=recipesById.get(id);return recipe?normalizeRecipe(recipe,recipe):null;}
function legacyRecipeForSettings(settings={}){
  const base=catalogRecipe(settings.themeId)||normalizeRecipe(recipeCatalog.recipes[0],recipeCatalog.recipes[0]);
  const next=clone(base);
  next.source="legacy-migration";
  next.design.palette=sanitizePalette(settings.designKit?.enabled?settings.designKit?.palette:next.design.palette,next.design.palette);
  next.design.texture=settings.designKit?.enabled?settings.designKit?.texture||next.design.texture:next.design.texture;
  if(settings.presentation?.motionLevel)next.design.motionPreset=settings.presentation.motionLevel;
  if(settings.presentation?.openingStyle)next.design.openingId=settings.presentation.openingStyle;
  next.design.openingProps={
    ...(next.design.openingProps||{}),
    ...Object.fromEntries(["rosePetalColor","floralPetalColor","floralCenterColor"]
      .map(key=>[key,String(settings.presentation?.[key]||"").toLowerCase()])
      .filter(([,value])=>SAFE_HEX.test(value)))
  };
  if(settings.presentation?.experienceMode)next.design.experienceMode=settings.presentation.experienceMode;
  if(settings.presentation?.galleryStyle)next.design.galleryStyleId=settings.presentation.galleryStyle;
  if(settings.typography&&typeof settings.typography==="object")next.design.typography={...next.design.typography,...settings.typography};
  const gallery=next.sections.find(section=>section.type==="gallery");
  if(gallery&&settings.presentation?.galleryStyle){gallery.props={...(gallery.props||{}),legacyGalleryStyle:safeId(settings.presentation.galleryStyle,60)};}
  return normalizeRecipe(next,base);
}
function resolveEventRecipe(settings={}){
  const fallback=legacyRecipeForSettings(settings);
  if(!settings.designRecipe||typeof settings.designRecipe!=="object")return fallback;
  return normalizeRecipe(settings.designRecipe,fallback);
}
function publicRecipe(settings={},features={}){
  const recipe=resolveEventRecipe(settings);
  const allowedTypes=new Set();
  for(const component of componentCatalog.components){
    const feature=component.requiredFeature;
    if(!feature||features?.[feature]!==false)allowedTypes.add(component.type);
  }
  recipe.sections=recipe.sections.filter(section=>section.visible!==false&&allowedTypes.has(section.type));
  const anchors=new Set(["hero","footer",...recipe.sections.map(section=>section.type)]);
  recipe.assets=recipe.assets.filter(asset=>anchors.has(asset.anchor));
  return recipe;
}
function catalog({eventType="",query="",offset=0,limit=24}={}){
  const q=safeText(query,80).toLowerCase();
  const start=Math.max(0,Number(offset)||0);const size=Math.min(100,Math.max(1,Number(limit)||24));
  const all=recipeCatalog.recipes.filter(recipe=>(!eventType||!recipe.eventTypes?.length||recipe.eventTypes.includes(eventType))&&(!q||`${recipe.name} ${recipe.description} ${(recipe.tags||[]).join(" ")}`.toLowerCase().includes(q)));
  return {total:all.length,offset:start,limit:size,items:all.slice(start,start+size).map(recipe=>({id:recipe.id,name:recipe.name,description:recipe.description,eventTypes:recipe.eventTypes,tags:recipe.tags,thumbnail:recipe.thumbnail,design:{layoutFamily:recipe.design?.layoutFamily,palette:recipe.design?.palette,typography:recipe.design?.typography,colorTheory:recipe.design?.colorTheory,texture:recipe.design?.texture}}))};
}
function assetCatalog({category="",query="",offset=0,limit=24}={}){
  const q=safeText(query,80).toLowerCase();const start=Math.max(0,Number(offset)||0);const size=Math.min(100,Math.max(1,Number(limit)||24));
  const all=assetManifest.assets.filter(asset=>(!category||asset.category===category)&&(!q||`${asset.name} ${asset.category} ${(asset.tags||[]).join(" ")}`.toLowerCase().includes(q)));
  return {total:all.length,offset:start,limit:size,categories:[...new Set(assetManifest.assets.map(item=>item.category))].sort(),items:all.slice(start,start+size)};
}

function assetsForRecipe(recipeInput){
  const recipe=normalizeRecipe(recipeInput,recipeCatalog.recipes[0]);
  const ids=new Set((recipe.assets||[]).map(item=>item.assetId));
  return {schema:assetManifest.schema,version:assetManifest.version,assets:assetManifest.assets.filter(item=>ids.has(item.id)).map(item=>({id:item.id,name:item.name,category:item.category,url:item.url,thumbnailUrl:item.thumbnailUrl,colorizable:Boolean(item.colorizable),aspectRatio:Number(item.aspectRatio)||1,motions:item.motions||[]}))};
}
function recipeHash(recipe){return crypto.createHash("sha256").update(JSON.stringify(recipe)).digest("hex").slice(0,16);}
function esc(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function thumbnailSvg(recipeInput,{width=360,height=210}={}){
  const recipe=normalizeRecipe(recipeInput,recipeCatalog.recipes[0]);
  const palette=recipe.design.palette||{};const bg=palette.bg||"#f4f0e8",paper=palette.paper||"#fffdf8",ink=palette.ink||"#2d2925",accent=palette.accent||"#7b4b56",gold=palette.gold||"#b89458",muted=palette.muted||"#746e66";
  const w=Math.max(220,Math.min(1200,Number(width)||360)),h=Math.max(140,Math.min(900,Number(height)||210));
  const visibleSections=[...(recipe.sections||[])].filter(item=>item.visible!==false).sort((a,b)=>(a.order||0)-(b.order||0));
  const sectionCount=Math.max(1,Math.min(8,visibleSections.length));
  const bars=Array.from({length:sectionCount},(_,i)=>`<rect x="${Math.round(w*.12)}" y="${Math.round(h*(.48+i*.045))}" width="${Math.round(w*(.76-(i%3)*.08))}" height="${Math.max(3,Math.round(h*.018))}" rx="3" fill="${i%2?accent:gold}" opacity="${(0.20+i*.04).toFixed(2)}"/>`).join("");
  const toneColor={primary:accent,accent,gold,ink,muted,paper};
  const assets=(recipe.assets||[]).slice(0,12).map(instance=>{
    const asset=assetsById.get(instance.assetId);if(!asset)return "";
    const x=Math.round(w*(Number(instance.x||50)/100)),y=Math.round(h*(Number(instance.y||50)/100));
    const size=Math.max(14,Math.min(h*.30,h*.12*Number(instance.scale||1)));
    const opacity=Math.max(.08,Math.min(1,Number(instance.opacity??1)));
    const color=toneColor[instance.tone]||accent;
    const href=esc(asset.thumbnailUrl||asset.url||"");
    return `<g transform="translate(${x} ${y}) rotate(${Number(instance.rotation||0)})" opacity="${opacity.toFixed(2)}"><circle r="${Math.max(5,Math.round(size*.26))}" fill="${color}" opacity=".22"/><image href="${href}" x="${(-size/2).toFixed(1)}" y="${(-size/2).toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(recipe.name)}"><rect width="${w}" height="${h}" rx="18" fill="${bg}"/><rect x="${Math.round(w*.055)}" y="${Math.round(h*.08)}" width="${Math.round(w*.89)}" height="${Math.round(h*.84)}" rx="14" fill="${paper}" stroke="${gold}" stroke-opacity=".45"/>${assets}<text x="${w/2}" y="${Math.round(h*.38)}" text-anchor="middle" fill="${ink}" font-family="Georgia,serif" font-size="${Math.round(h*.09)}" font-weight="700">${esc(recipe.name.slice(0,28))}</text>${bars}<text x="${Math.round(w*.08)}" y="${Math.round(h*.88)}" fill="${accent}" font-family="Arial,sans-serif" font-size="${Math.round(h*.045)}">${esc(recipe.design.layoutFamily)}</text></svg>`;
}
function validateCatalog(){
  const issues=[];
  const checkUnique=(items,label)=>{const seen=new Set();for(const item of items){if(!item?.id)issues.push(`${label}: elemento sin id`);else if(seen.has(item.id))issues.push(`${label}: id duplicado ${item.id}`);else seen.add(item.id);}};
  checkUnique(assetManifest.assets,"assets");checkUnique(recipeCatalog.recipes,"recipes");
  const sectionTypes=new Set(componentCatalog.components.map(item=>item.type));
  for(const raw of recipeCatalog.recipes){const recipe=normalizeRecipe(raw,raw);for(const section of recipe.sections)if(!sectionTypes.has(section.type))issues.push(`recipe ${recipe.id}: sección desconocida ${section.type}`);for(const asset of recipe.assets)if(!assetsById.has(asset.assetId))issues.push(`recipe ${recipe.id}: asset desconocido ${asset.assetId}`);}
  if(photoPresentations.length<34)issues.push(`photo presentations: ${photoPresentations.length}/34`);
  const styleCount=componentCatalog.components.reduce((sum,item)=>sum+(item.styles?.length||0),0);
  if(styleCount<103)issues.push(`active section styles: ${styleCount}/103`);
  const layoutFamilies=[...new Set(recipeCatalog.recipes.map(item=>item.design?.layoutFamily).filter(Boolean))].sort();
  for(const recipe of recipeCatalog.recipes){
    const normalized=normalizeRecipe(recipe,recipe);
    if(!HEADING_FONT_IDS.has(normalized.design.typography.heading)||!BODY_FONT_IDS.has(normalized.design.typography.body))issues.push(`Recipe ${recipe.id}: tipografía inválida`);
    if(!paletteAudit(normalized.design.palette).pass)issues.push(`Recipe ${recipe.id}: contraste de paleta insuficiente`);
  }
  return {pass:issues.length===0,issues,counts:{assets:assetManifest.assets.length,recipes:recipeCatalog.recipes.length,components:componentCatalog.components.length,sectionStyles:styleCount,photoPresentations:photoPresentations.length,motionTimelines:motionTimelines.length,qrFrames:qrFrames.length,printLayouts:Object.keys(printLayouts).length,layoutFamilies:layoutFamilies.length,headingFonts:(typographyPresets.heading||[]).length,bodyFonts:(typographyPresets.body||[]).length}};
}

module.exports={assetManifest,componentCatalog,recipeCatalog,photoPresentations,motionTimelines,printLayouts,qrFrames,paletteFamilies,typographyPresets,layoutFamilies:[...new Set(recipeCatalog.recipes.map(item=>item.design?.layoutFamily).filter(Boolean))].sort(),colorHarmonies:[...COLOR_HARMONIES],generateHarmoniousPalette,paletteAudit,contrastRatio,scanSafeQrColors,normalizeRecipe,catalogRecipe,legacyRecipeForSettings,resolveEventRecipe,publicRecipe,assetsForRecipe,catalog,assetCatalog,thumbnailSvg,recipeHash,validateCatalog};
