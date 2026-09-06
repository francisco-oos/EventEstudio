"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const engine=require("../src/design-engine");
const experiences=require("../config/experiences.json");

const root=path.join(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

const qa=engine.validateCatalog();
assert.equal(qa.pass,true,qa.issues.join(" | "));
assert.ok(qa.counts.recipes>=64,"Las 64 plantillas legacy deben conservarse aunque el catálogo incorpore diseños nuevos.");
assert.equal(qa.counts.components,12,"El Design Engine debe incluir música como componente visual sin reemplazar el reproductor productivo.");
assert.equal(qa.counts.sectionStyles,103,"Los estilos activos deben incluir las 6 variantes visuales de música.");
assert.equal(qa.counts.photoPresentations,34);
assert.equal(qa.counts.motionTimelines,16);
assert.equal(qa.counts.qrFrames,12);
assert.equal(qa.counts.printLayouts,8);

const knownOpenings=new Set(experiences.openings.map(item=>item.id));
for(const raw of engine.recipeCatalog.recipes){
  const recipe=engine.catalogRecipe(raw.id);
  assert.ok(recipe,`${raw.id}: Recipe no resoluble.`);
  assert.equal(recipe.schema,"eventstudio.design-recipe.v2");
  assert.ok(knownOpenings.has(recipe.design.openingId),`${raw.id}: opening desconocida ${recipe.design.openingId}`);
  assert.ok(recipe.sections.length>=5,`${raw.id}: composición insuficiente.`);
  assert.ok(recipe.assets.length>=1,`${raw.id}: debe contener al menos un asset decorativo.`);
  const serialized=JSON.stringify(recipe).toLowerCase();
  for(const forbidden of ["valentina & mateo","ariana y francisco","hacienda san josé","12 · 12 · 2026"]){
    assert.equal(serialized.includes(forbidden),false,`${raw.id}: una Recipe no puede contener datos reales/de muestra del evento (${forbidden}).`);
  }
}


const uniquePalettes=new Set();
for(const raw of engine.recipeCatalog.recipes){
  const audit=engine.paletteAudit(raw.design.palette);
  assert.equal(audit.pass,true,`${raw.id}: paleta predefinida sin contraste suficiente.`);
  uniquePalettes.add(JSON.stringify(raw.design.palette));
  assert.ok(raw.design.colorTheory?.seed,`${raw.id}: falta semilla de teoría del color.`);
  assert.ok(raw.design.colorTheory?.harmony,`${raw.id}: falta armonía de teoría del color.`);
  assert.ok(["none","paper","linen","soft-grain","wash"].includes(raw.design.texture),`${raw.id}: textura inválida.`);
}
assert.equal(uniquePalettes.size,qa.counts.recipes,"Cada Recipe prehecha debe conservar una paleta propia derivada de teoría del color.");
for(const harmony of engine.colorHarmonies){
  const generated=engine.generateHarmoniousPalette("#7b4b56",harmony);
  assert.equal(engine.paletteAudit(generated).pass,true,`Armonía ${harmony}: contraste insuficiente.`);
}

const base=engine.catalogRecipe("storybook-seal");
assert.equal(base.design.openingId,"unified-envelope","La Recipe que reemplaza Sobre y sello debe conservar el motor avanzado de sobre.");
const reserva=engine.catalogRecipe("gran-reserva");
assert.equal(reserva.design.openingId,"reserve-uncork");

const mutated=JSON.parse(JSON.stringify(base));
mutated.assets.push({uid:"evil",assetId:"https://attacker.invalid/x.svg",anchor:"hero",x:999,y:-40,scale:99,rotation:999,zIndex:999,opacity:9,tone:"unknown",motion:"unknown"});
mutated.assets[0]={...mutated.assets[0],x:999,y:-10,scale:99,rotation:999,zIndex:99,opacity:0,tone:"unknown",motion:"unknown"};
const normalized=engine.normalizeRecipe(mutated,base);
assert.equal(normalized.assets.some(item=>item.uid==="evil"),false,"No se permiten URLs/IDs arbitrarios fuera del AssetManifest.");
assert.equal(normalized.assets[0].x,100);
assert.equal(normalized.assets[0].y,0);
assert.equal(normalized.assets[0].scale,4);
assert.equal(normalized.assets[0].rotation,360);
assert.equal(normalized.assets[0].zIndex,40);
assert.equal(normalized.assets[0].opacity,.05);
assert.equal(normalized.assets[0].tone,"accent");
assert.equal(normalized.assets[0].motion,"none");

const allFeatures={invitation:true,locations:true,program:true,gallery:true,dressCode:true,rsvp:true,gifts:true,qrCards:true,music:true};
const limited={...allFeatures,program:false,gallery:false,dressCode:false,rsvp:false,gifts:false,qrCards:false,music:false};
const fullPublic=engine.publicRecipe({themeId:base.id,designRecipe:base},allFeatures);
const limitedPublic=engine.publicRecipe({themeId:base.id,designRecipe:base},limited);
for(const type of ["agenda","gallery","dress-code","rsvp","gifts","qr","music"]){
  assert.equal(fullPublic.sections.some(item=>item.type===type),true,`full: falta ${type}`);
  assert.equal(limitedPublic.sections.some(item=>item.type===type),false,`limited: ${type} no debe renderizarse sin entitlement.`);
}
assert.equal(base.sections.some(item=>item.type==="rsvp"),true,"El filtro público no debe destruir la Recipe de origen.");
const publicAssetIds=new Set(engine.assetsForRecipe(limitedPublic).assets.map(item=>item.id));
for(const instance of limitedPublic.assets)assert.equal(publicAssetIds.has(instance.assetId),true);
assert.ok(publicAssetIds.size<engine.assetManifest.assets.length,"La salida pública sólo debe exponer assets usados, no toda la biblioteca.");

const thumbA=engine.thumbnailSvg(base);
const thumbRecipe=JSON.parse(JSON.stringify(base));thumbRecipe.assets[0].x=92;thumbRecipe.assets[0].scale=1.8;thumbRecipe.assets[0].rotation=43;
const thumbB=engine.thumbnailSvg(thumbRecipe);
assert.notEqual(thumbA,thumbB,"Mover/escalar/rotar un asset debe regenerar una miniatura distinta.");

const publicIndex=read("public/index.html");
const publicApp=read("public/app.js");
const publicEngine=read("public/design-engine.js");
const designCss=read("public/design-engine.css");
assert.ok(publicIndex.includes('/design-engine.css'));
assert.ok(publicIndex.includes('id="designQrSection"'));
assert.ok(publicIndex.includes('id="eventStudioFooter"'));
assert.ok(publicIndex.indexOf('/design-engine.js')<publicIndex.indexOf('/app.js'),"El renderer declarativo debe cargarse antes del bootstrap público.");
assert.ok(publicApp.includes('settings._designRecipe?"theme-recipe"'),"Con Recipe activa el público no debe depender de una clase de plantilla estática.");
assert.ok(publicApp.includes('EventStudioDesignEngine?.apply(settings)'));
assert.ok(publicEngine.includes('es-recipe-hidden'));
assert.ok(publicEngine.includes('dataset.esPhoto'));

for(const component of engine.componentCatalog.components){
  for(const style of component.styles||[])assert.ok(designCss.includes(`data-es-style="${style.id}"`),`Falta skin CSS real para ${style.id}`);
}
for(const photo of engine.photoPresentations)assert.ok(designCss.includes(`data-es-photo="${photo.id}"`),`Falta renderer CSS para photo presentation ${photo.id}`);

const lab=read("public/design-lab.js");
assert.equal((lab.match(/function component\(/g)||[]).length,1,"No debe haber redeclaraciones duplicadas del resolver de componentes.");
assert.ok(lab.includes("api('/api/admin/design/recipe',{method:'PUT'"),"Seleccionar una Recipe debe pasar por el contrato DRAFT del servidor.");
assert.ok(lab.includes("catalogRecipeId:id"),"La selección del catálogo debe conservar el id nativo para coordinar Recipe, Stationery y validaciones comerciales.");
assert.equal(lab.includes("catalogRecipeId:id})}));recipe=applied.recipe"),false,"Seleccionar una tarjeta no debe aplicar ACTIVE de inmediato; sólo debe actualizar DRAFT.");
assert.ok(lab.includes('startDrag'));
assert.ok(lab.includes('assetScale'));
assert.ok(lab.includes('assetRotation'));
assert.ok(lab.includes('assetZ'));
assert.ok(lab.includes('updatePackageRecommendation'));
assert.ok(lab.includes('/api/admin/design/palette'));
assert.ok(lab.includes('renderPresentation'));
assert.ok(publicEngine.includes('styleMusic'));
assert.ok(publicEngine.includes('spotifyMusicBtn'));
assert.ok(designCss.includes('music-playlist-card'));
assert.ok(designCss.includes('timeline-mask-horizontal-editorial'));

const comments=[read("src/design-engine.js"),read("public/design-engine.js"),read("public/design-lab.js")].join("\n");
assert.equal(/[😀-🙏🌀-🫿]/u.test(comments),false,"Los nuevos módulos no deben usar emojis en comentarios/código técnico.");

console.log(`✓ RC31/RC32 Design Engine: ${qa.counts.recipes} Recipes, ${qa.counts.assets} assets, ${qa.counts.sectionStyles} skins, teoría del color, música, entitlements y thumbnails reactivos.`);
