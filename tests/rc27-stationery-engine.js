"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const stationery=require("../config/stationery.json");
const experiences=require("../config/experiences.json");
const experienceCatalog=require("../src/experience-catalog");
const {normalizeStationery,designTokens,surfaceTexture}=require("../src/stationery-config");

assert.equal(stationery.openingId,"unified-envelope");
assert.equal(new Set(stationery.presets.map(item=>item.id)).size,stationery.presets.length);

const retiredExpected=["wax-envelope","floral-envelope","minimal-envelope","cinematic-fold","ivory-seal","olive-nectar-seal","powder-blue-seal","blush-heart-emblem"];
const retired=experiences.openings.filter(item=>item.retired).map(item=>item.id);
assert.deepEqual(retired,retiredExpected,"Sólo las aperturas de sobre redundantes deben darse de baja.");
for(const id of retiredExpected){
  const item=experiences.openings.find(opening=>opening.id===id);
  assert.equal(item.hidden,true);assert.equal(item.replacement,"unified-envelope");
  assert.ok(!experienceCatalog.publicCatalog.openings.some(opening=>opening.id===id));
}
for(const id of ["rose-bloom","daisy-bloom","luminous-garden","night-flower-original","particle-heart","newspaper-fold","vintage-parchment","olive-universe-orbit","blue-aurora-reveal","botanical-cosmos-orbit","gala-curtain","constellation-veil","reserve-uncork"]){
  const item=experiences.openings.find(opening=>opening.id===id);
  assert.ok(item,`Falta la mecánica independiente ${id}.`);assert.notEqual(item.retired,true,`${id} no debe retirarse.`);
}

const migrated=normalizeStationery({}, {}, {openingStyle:"floral-envelope"});
const floral=stationery.presets.find(item=>item.id==="floral-envelope");
assert.equal(migrated.presetId,"floral-envelope");assert.equal(migrated.outerColor,floral.outerColor);
const malicious=normalizeStationery({}, {presetId:"../../etc",outerColor:"javascript:alert(1)",textureStrength:900});
assert.equal(malicious.presetId,stationery.defaults.presetId);assert.equal(malicious.outerColor,stationery.defaults.outerColor);assert.equal(malicious.textureStrength,100);
const custom=normalizeStationery({}, {...floral,customized:true,syncDesignTokens:true});
assert.deepEqual(designTokens(custom),{bg:custom.outerColor,paper:custom.cardColor,ink:custom.textColor,muted:custom.innerColor,accent:custom.sealColor,gold:custom.ornamentColor,line:custom.innerColor});
assert.equal(surfaceTexture(custom),"paper");

const rendererSource=read("public/stationery-engine.js");
const context={window:{}};vm.createContext(context);vm.runInContext(rendererSource,context,{filename:"stationery-engine.js"});
const renderer=context.window.EventStudioStationery;assert.ok(renderer);
const result=renderer.applyPreset({},"ivory-seal",stationery);
assert.equal(result.stationery.presetId,"ivory-seal");assert.equal(result.seal.material,"gold");
assert.equal(renderer.initials("Ariana y Francisco"),"AF");
assert.equal(renderer.initials("Ariana & Francisco"),"AF");

const adminHtml=read("public/admin.html"),app=read("public/app.js"),album=read("public/album.js"),server=read("src/server.js"),styles=read("public/styles.css"),engineStyles=read("public/stationery-engine.css");
/* RC27 sigue cubriendo el contrato del motor compartido aunque RC28 traslade su editor a una vista independiente. */
assert.match(read("public/index.html"),/stationery-engine\.js/);
assert.match(server,/stationeryIsAuthoritative\(settings,stationery\)/);
assert.match(server,/function qrPalette\(settings\)[\s\S]*themeDescriptor\(settings\)\.palette/);
assert.match(album,/const palette=settings\._palette\|\|\{\}/);assert.match(album,/dataset\.surfaceTexture/);
assert.match(app,/settings\?\.event\?\.dateTime/);assert.match(app,/if\(style==='particle-heart'(?:&&|\))/);assert.match(app,/activeStationerySealColor\(\)/);
assert.match(server,/code:"TEMPLATES_REQUIRED"/);assert.match(server,/\["owner","developer"\]\.includes\(req\.user\.role\)/);

for(const file of ["public/seal-studio.html","public/seal-studio.js","public/seal-studio.css"]){assert.equal(fs.existsSync(path.join(root,file)),false,`${file} debe permanecer retirado.`);}
assert.doesNotMatch(`${adminHtml}\n${read("public/admin.js")}`,/seal-studio|eventstudio:seal-applied/);

assert.ok(fs.existsSync(path.join(root,"public/assets/varilla_onfalos_elegante.svg")));
assert.match(styles,/varilla_onfalos_elegante\.svg/);
assert.match(styles,/opening-vintage-parchment \.opening-card[^}]*transition:transform 1\.42s \.22s/);
assert.match(styles,/opening-vintage-parchment \.opening-envelope-back[^}]*transition:transform 1\.42s \.22s/);
assert.match(styles,/translate3d\(0,calc\(-50% \+ var\(--scroll-travel\)\),0\)/);
assert.match(engineStyles,/will-change:transform/);assert.match(engineStyles,/@media\(prefers-reduced-motion:reduce\)/);

assert.doesNotMatch(rendererSource,/#[0-9a-f]{6}/i,"Los colores del motor deben provenir del catálogo.");
for(const file of ["public/stationery-engine.js","src/stationery-config.js"]){assert.doesNotMatch(read(file),/[😀-🙏🌀-🫿]/u,`${file} no debe incluir emojis en comentarios técnicos.`);}

console.log("✓ RC27: motor unificado, migración, tokens, permisos, lacre y Onfalós verificados");
