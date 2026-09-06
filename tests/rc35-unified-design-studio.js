"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const adminHtml=read("public/admin.html");
const admin=read("public/admin.js");
const labHtml=read("public/design-lab.html");
const lab=read("public/design-lab.js");
const stationery=read("public/stationery-studio.js");
const publicEngine=read("public/design-engine.js");
const publicCss=read("public/design-engine.css");
const colorEngine=read("public/design-color-engine.js");
const server=read("src/server.js");
const index=read("public/index.html");
const packageJson=require("../package.json");
const recipes=require("../config/design/recipes.json").recipes;
const {ensureAccessiblePalette,contrastRatio}=require("../src/theme-design");
const clientWindow={};vm.runInNewContext(colorEngine,{window:clientWindow,Math,String,Number,parseInt,RegExp,Object,Array});

assert.match(packageJson.version,/^6\.(?:15|16)\.0-rc\.(?:35|36|37|38|39|40|41)$/);
assert.ok(recipes.length>=64);

// Un único flujo visual: las entradas de administración navegan al Design Studio
// y el motor Stationery se monta como herramienta especializada dentro de él.
assert.doesNotMatch(adminHtml,/id="openDesignLabBtn"[^>]+target="_blank"/);
assert.doesNotMatch(adminHtml,/id="openStationeryStudioBtn"[^>]+target="_blank"/);
assert.match(admin,/location\.assign\(`\/design-lab\.html\?eventId=/);
assert.match(admin,/url\.searchParams\.set\('open','stationery'\)/);
assert.match(labHtml,/id="stationeryWorkspace"/);
assert.match(labHtml,/id="stationeryFrame"/);
assert.match(labHtml,/id="openStationeryBtn"/);
assert.doesNotMatch(labHtml,/href="\/stationery-studio\.html"[^>]+target="_blank"/);
assert.match(lab,/searchParams\.set\('embedded','1'\)/);
assert.match(lab,/document\.body\.classList\.add\('stationery-embedded-open'\)/);
assert.match(lab,/eventstudio:stationery-draft-saved/);
assert.match(stationery,/eventstudio:stationery-close/);
assert.match(stationery,/eventstudio:stationery-draft-saved/);
assert.match(stationery,/document\.body\.classList\.add\("embedded-mode"\)/);

// Una sola autoridad cromática de cliente para preview y publicación.
assert.ok(index.indexOf('/design-color-engine.js')<index.indexOf('/design-engine.js'));
assert.ok(labHtml.indexOf('/design-color-engine.js')<labHtml.indexOf('/design-lab.js'));
assert.match(publicEngine,/EventStudioColorEngine\?\.ensureAccessiblePalette/);
assert.match(lab,/EventStudioColorEngine\?\.ensureAccessiblePalette/);
assert.match(colorEngine,/ensureAccessiblePalette/);
assert.match(publicCss,/es-hero-no-media \.hero-content/);
assert.match(publicCss,/paper-contrast/);
assert.match(publicCss,/accent-contrast/);

for(const recipe of recipes){
  const p=ensureAccessiblePalette(recipe.design.palette);
  const client=clientWindow.EventStudioColorEngine.ensureAccessiblePalette(recipe.design.palette);
  assert.deepEqual(JSON.parse(JSON.stringify(client)),JSON.parse(JSON.stringify(p)),`${recipe.id}: cliente y servidor deben derivar los mismos tokens cromáticos.`);
  for(const [fg,bg,label] of [
    [p.ink,p.paper,"ink/paper"],[p.ink,p.bg,"ink/bg"],
    [p.accentText,p.paper,"accentText/paper"],[p.goldText,p.paper,"goldText/paper"],
    [p.paperContrast,p.paper,"paperContrast/paper"],[p.bgContrast,p.bg,"bgContrast/bg"],
    [p.accentContrast,p.accent,"accentContrast/accent"],[p.goldContrast,p.gold,"goldContrast/gold"]
  ])assert.ok(contrastRatio(fg,bg)>=4.5,`${recipe.id}: ${label}`);
}

// El editor especializado sincroniza presentación y Recipe para evitar dos verdades.
assert.match(server,/RC35: los editores especializados no mantienen una segunda verdad/);
assert.match(server,/openingId:normalized\.presentation\.openingStyle/);
assert.match(server,/galleryStyleId:normalized\.presentation\.galleryStyle/);
assert.match(server,/motionPreset:normalized\.presentation\.motionLevel/);

// Nombres reales no forman parte del runtime de producción.
const runtime=["public/admin.html","public/admin.js","public/app.js","public/design-lab.js","public/styles.css","src/server.js"].map(read).join("\n");
assert.doesNotMatch(runtime,/Ariana y Francisco/);

console.log(`✓ RC35 contrato: Design Studio unificado, Stationery embebido, autoridad cromática compartida, ${recipes.length} Recipes AA y sincronización Recipe/presentación.`);
