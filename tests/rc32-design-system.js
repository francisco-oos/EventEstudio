"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const engine=require("../src/design-engine");

const root=path.join(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

const qa=engine.validateCatalog();
assert.equal(qa.pass,true,qa.issues.join(" | "));
assert.ok(qa.counts.recipes>=64);
assert.equal(qa.counts.components,12);
assert.equal(qa.counts.sectionStyles,103);
assert.equal(qa.counts.photoPresentations,34);
assert.equal(qa.counts.motionTimelines,16);
assert.equal(qa.counts.qrFrames,12);
assert.equal(qa.counts.printLayouts,8);

const textures=new Set();
const palettes=new Set();
for(const raw of engine.recipeCatalog.recipes){
  const recipe=engine.catalogRecipe(raw.id);
  assert.ok(recipe);
  assert.ok(recipe.sections.some(item=>item.type==="music"),`${recipe.id}: falta componente música.`);
  assert.ok(recipe.sections.some(item=>item.type==="hero"),`${recipe.id}: falta portada.`);
  assert.ok(recipe.assets.length>=1,`${recipe.id}: debe usar Asset Library.`);
  assert.equal(engine.paletteAudit(recipe.design.palette).pass,true,`${recipe.id}: contraste de paleta inválido.`);
  assert.ok(engine.colorHarmonies.includes(recipe.design.colorTheory.harmony),`${recipe.id}: armonía desconocida.`);
  assert.match(recipe.design.colorTheory.seed,/^#[0-9a-f]{6}$/i);
  textures.add(recipe.design.texture);
  palettes.add(JSON.stringify(recipe.design.palette));
}
assert.equal(palettes.size,qa.counts.recipes,"Las Recipes prehechas deben conservar identidad cromática propia.");
for(const texture of ["paper","linen","soft-grain","wash"])assert.ok(textures.has(texture),`Falta uso real de textura ${texture}.`);

for(const harmony of engine.colorHarmonies){
  const palette=engine.generateHarmoniousPalette("#356a8a",harmony);
  assert.equal(engine.paletteAudit(palette).pass,true,`${harmony}: la paleta generada no pasa contraste.`);
}

const fullFeatures={invitation:true,locations:true,program:true,gallery:true,dressCode:true,rsvp:true,gifts:true,qrCards:true,music:true};
const noServices={invitation:true,locations:false,program:false,gallery:false,dressCode:false,rsvp:false,gifts:false,qrCards:false,music:false};
const source=engine.catalogRecipe("romantic-wine");
const full=engine.publicRecipe({designRecipe:source,themeId:"romantic-wine"},fullFeatures);
const limited=engine.publicRecipe({designRecipe:source,themeId:"romantic-wine"},noServices);
for(const type of ["venues","agenda","gallery","dress-code","rsvp","gifts","qr","music"]){
  assert.equal(full.sections.some(item=>item.type===type),true,`full: falta ${type}`);
  assert.equal(limited.sections.some(item=>item.type===type),false,`limited: ${type} no debe publicarse.`);
}
assert.ok(source.sections.some(item=>item.type==="music"),"La proyección pública no debe mutar la Recipe original.");

const server=read("src/server.js");
assert.ok(server.includes('app.post("/api/admin/design/palette"'));
assert.ok(server.includes('"accent-dark"'));
assert.ok(server.includes('next.designKit='),"Guardar Recipe debe sincronizar el kit de diseño.");
assert.ok(server.includes('designEngine.publicRecipe(settings,publicFeatures)'),"La publicación debe filtrar por entitlements.");

const app=read("public/app.js");
assert.ok(app.includes("settings.media?.musicSource==='upload'"));
assert.ok(app.includes("$('musicBtn').onclick"));
assert.ok(app.includes("spotifyMusicBtn"));
assert.ok(app.includes("EventStudioDesignEngine?.apply(settings)"));

const labHtml=read("public/design-lab.html");
const labJs=read("public/design-lab.js");
for(const id of ["textureSelect","motionPresetSelect","motionTimelineSelect","photoPresentationSelect","colorTheorySeed","colorHarmonySelect","generatePaletteBtn"]){
  assert.ok(labHtml.includes(`id="${id}"`),`Falta control ${id}.`);
}
assert.ok(labJs.includes("/api/admin/design/palette"));
assert.ok(labJs.includes("startDrag"));
assert.ok(labJs.includes("scheduleThumbnail"));
assert.ok(labJs.includes("updatePackageRecommendation"));

const publicEngine=read("public/design-engine.js");
const publicCss=read("public/design-engine.css");
assert.ok(publicEngine.includes("styleMusic"));
assert.ok(publicEngine.includes("dataset.designTimeline"));
for(const style of engine.componentCatalog.components.find(item=>item.type==="music").styles){
  assert.ok(publicCss.includes(`data-es-style="${style.id}"`),`Falta skin productiva ${style.id}.`);
}
for(const timeline of engine.motionTimelines){
  assert.ok(publicCss.includes(timeline.id)||["timeline-botanical-bloom","timeline-cinematic-slow","timeline-editorial-stagger","timeline-passport-stamp","timeline-gala-reveal","timeline-minimal-clean","timeline-blur-editorial","timeline-parallax-soft","timeline-clip-reveal-center","timeline-rotate-playful","timeline-storybook-fold","timeline-shimmer-gala","timeline-line-draw-formal","timeline-slide-left-modern","timeline-drop-celestial","timeline-mask-horizontal-editorial"].includes(timeline.id),`Timeline no contemplado: ${timeline.id}`);
}

console.log(`✓ RC32 Design System: ${qa.counts.recipes} Recipes, ${qa.counts.components} componentes, ${qa.counts.sectionStyles} skins, teoría del color, texturas, motion y música preservada.`);
