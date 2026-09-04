"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const packageJson=require("../package.json");
const stationery=require("../config/stationery.json");
const seals=require("../config/seals.json");
const themes=require("../config/themes.json");
const experiences=require("../config/experiences.json");
const defaultSettings=require("../config/default-settings.json");
const {normalizeStationery,designTokens}=require("../src/stationery-config");
const {stationeryIsAuthoritative,applyOpeningCoordination}=require("../src/opening-coordination");
const {loadThemeDesigns,ensureAccessiblePalette,contrastRatio}=require("../src/theme-design");

assert.equal(packageJson.version,"6.14.2-rc.30");
assert.equal(stationery.formats.length,4);
assert.equal(stationery.materials.length,15);
assert.equal(stationery.presets.length,16);
assert.equal(stationery.liners.length,9);
assert.equal(stationery.overlays.length,10);
assert.equal(stationery.stamps.length,7);
assert.equal(stationery.frames.length,8);
assert.equal(stationery.dividers.length,9);

for(const collection of ["formats","materials","liners","overlays","stamps","frames","dividers","presets"]){
  for(const item of stationery[collection]){
    assert.ok(item.label,`${collection}/${item.id} requiere etiqueta.`);
    if(collection!=="presets")assert.ok(item.description,`${collection}/${item.id} requiere descripción para el estudio maestro.`);
  }
}

const studioHtml=read("public/stationery-studio.html");
const studioCss=read("public/stationery-studio.css");
const studioJs=read("public/stationery-studio.js");
const engineJs=read("public/stationery-engine.js");
const engineCss=read("public/stationery-engine.css");

for(const marker of ["sidebar-nav","sidebar-panel","main-stage","panel-container","stationeryStudioMount","stageHint","applyStudioBtn"]){
  assert.match(studioHtml,new RegExp(marker),`Falta ${marker} en la estructura del estudio.`);
}
for(const tab of ["formats","materials","settings","seals","frames","dividers","liners","laces","stamps"]){
  assert.match(studioHtml,new RegExp(`data-tab="${tab}"`),`Falta la navegación ${tab}.`);
}
assert.match(studioCss,/\.sidebar-nav\{width:90px;flex:0 0 90px/);
assert.match(studioCss,/\.sidebar-panel\{width:360px;flex:0 0 360px/);
assert.match(studioCss,/\.lib-preview\{width:100%;height:120px/);
assert.match(studioCss,/\.format-icon\{width:60px;height:60px/);
assert.match(studioJs,/materialPreviewSvg\(/);
assert.match(studioJs,/resourceSvg\(/);
assert.match(studioJs,/formatIcon\(/);
assert.match(studioJs,/stationeryStudioMount"\)\?\.addEventListener\("click",toggleEnvelope\)/);
assert.doesNotMatch(studioHtml,/openEnvelopeBtn|closeEnvelopeBtn/);
assert.match(studioJs,/if\(key==="sealColor"\)sealState=\{\.\.\.sealState,material:"theme",customized:true\}/);
assert.match(studioJs,/inheritedControl\("Nombres principales",displayName\(\)\)/);
assert.match(studioJs,/inheritedControl\("Fecha",dateLabel\(\)/);
assert.match(studioJs,/inheritedControl\("Tipografía de tarjeta",headingLabel\(\)\)/);
assert.match(studioJs,/body:JSON\.stringify\(\{presentation,stationery:stationeryState,seal:sealState\}\)/);

assert.match(engineJs,/materialPreviewSvg/);
assert.match(engineJs,/resourceSvg/);
assert.match(engineJs,/formatIcon/);
assert.match(engineJs,/class="stationery-envelope envelope-container"/);
assert.match(engineJs,/class="stationery-card envelope-card"/);
assert.match(engineJs,/class="stationery-top-flap env-flap-top"/);
assert.match(engineJs,/class="stationery-front-flaps env-front-flaps"/);
assert.match(engineCss,/transition:transform \.75s cubic-bezier\(\.4,0,\.2,1\)/);
assert.match(engineCss,/transition:transform \.85s cubic-bezier\(\.2,1,\.3,1\)/);
assert.match(engineCss,/\.stationery-preview\.is-preview-open \.stationery-top-flap/);
assert.match(engineCss,/\.stationery-preview\.is-preview-open \.stationery-card/);
assert.doesNotMatch(engineJs,/#[0-9a-f]{6}/i,"El renderer compartido no debe introducir colores literales; deben venir del catálogo.");

const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(engineJs,sandbox,{filename:"stationery-engine.js"});
const renderer=sandbox.window.EventStudioStationery;
assert.ok(renderer);
const base=renderer.normalize(stationery.defaults,stationery,{openingStyle:stationery.openingId});
for(const material of stationery.materials){
  const svg=renderer.materialPreviewSvg(material.id,{...base,materialId:material.id},stationery,`qa-${material.id}`);
  assert.match(svg,/^<svg/);assert.match(svg,/<pattern/);
}
const resourceMap={liners:"linerId",overlays:"overlayId",stamps:"stampId",frames:"frameId",dividers:"dividerId"};
for(const [kind] of Object.entries(resourceMap)){
  for(const item of stationery[kind].filter(entry=>entry.id!=="none")){
    const svg=renderer.resourceSvg(kind,item.id,base,{displayName:"Ariana & Francisco",dateLabel:"14.12.2026",headingFont:"Georgia"},`qa-${kind}-${item.id}`);
    assert.match(svg,/^<svg/,`${kind}/${item.id} debe producir miniatura vectorial real.`);
  }
}
for(const preset of stationery.presets){
  const result=renderer.applyPreset(base,preset.id,stationery);
  assert.equal(result.stationery.presetId,preset.id);
  if(preset.seal?.enabled!==false)assert.ok(result.seal,`${preset.id} debe transferir su receta de lacre.`);
}

const custom=normalizeStationery({}, {...stationery.defaults,customized:true,syncDesignTokens:true,outerColor:"#203040",innerColor:"#304050",cardColor:"#f0efe8",textColor:"#25221f",ornamentColor:"#a58b54",sealColor:"#7f3344"},{openingStyle:stationery.openingId});
assert.equal(stationeryIsAuthoritative({presentation:{openingStyle:stationery.openingId}},custom),true);
assert.deepEqual(designTokens(custom),{bg:custom.outerColor,paper:custom.cardColor,ink:custom.textColor,muted:custom.innerColor,accent:custom.sealColor,gold:custom.ornamentColor,line:custom.innerColor});
assert.equal(stationeryIsAuthoritative({presentation:{openingStyle:"gala-curtain"}},custom),false);

const designs=loadThemeDesigns(themes,path.join(root,"public/styles.css"));
const openings=experiences.openings.filter(item=>!item.hidden);
for(const theme of themes){
  const basePalette=designs.get(theme.id).palette;
  const coordinated=ensureAccessiblePalette({...basePalette,...designTokens(custom)});
  assert.ok(contrastRatio(coordinated.ink,coordinated.paper)>=4.5,`${theme.id}: contraste de papelería inválido.`);
  for(const opening of openings){
    const settings={presentation:{...(defaultSettings.presentation||{}),openingStyle:opening.id}};
    const palette=ensureAccessiblePalette(applyOpeningCoordination(basePalette,settings));
    assert.ok(contrastRatio(palette.ink,palette.paper)>=4.5,`${theme.id}/${opening.id}: contraste inválido.`);
  }
}

for(const file of ["public/stationery-engine.js","public/stationery-studio.js"]){
  assert.doesNotMatch(read(file),/[\u{1F300}-\u{1FAFF}]/u,`${file} no debe incluir emojis en comentarios o lógica técnica.`);
}

console.log(`✓ RC29: paridad visual del generador maestro, miniaturas, clic abrir/cerrar, lacre y sincronización ${themes.length}x${openings.length}`);
