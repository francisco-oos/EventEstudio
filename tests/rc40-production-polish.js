"use strict";

/*
  RC40 · contratos de pulido preproducción.
  No requiere dependencias npm externas: valida la autoridad de los controles
  superiores, portada reutilizable, scroll independiente e ingestión segura de
  assets antes de levantar el servidor real.
*/
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const admin=read("public/admin.js");
const lab=read("public/design-lab.js");
const labHtml=read("public/design-lab.html");
const labCss=read("public/design-lab.css");
const publicEngine=read("public/design-engine.js");
const publicCss=read("public/design-engine.css");
const publicApp=read("public/app.js");
const server=read("src/server.js");
const nodeEngine=read("src/design-engine.js");
const design=require("../src/design-engine");
const manifest=require("../config/design/assets-manifest.json");

// 1) La Recipe gobierna apariencia; la experiencia superior gobierna apertura,
// recorrido, movimiento y álbum tanto al probar como al aplicar/editar.
const previewFn=admin.slice(admin.indexOf("async function openThemePreview"),admin.indexOf("async function previewStoreProduct"));
assert.match(previewFn,/previewTheme:themeId,\.\.\.presentationPreviewOptions\(\)/);
const editFn=admin.slice(admin.indexOf("async function editCatalogTheme"),admin.indexOf("async function openThemePreview"));
assert.match(editFn,/presentationOverrides=presentationDraftFromForm\(\)/);
assert.match(editFn,/catalogRecipeId:themeId,presentationOverrides/);
const liveFn=admin.slice(admin.indexOf("function updateThemeLivePreview"),admin.indexOf("if\(\$\('applyEventTypePresetBtn'\)"));
assert.match(liveFn,/previewTheme:activeTheme,\.\.\.presentationPreviewOptions\(\)/);
assert.match(admin,/Usará:/);
assert.match(admin,/diseños usarán .* como apertura actual/i);
assert.match(lab,/function currentPresentationOverrides\(\)/);
assert.match(lab,/catalogRecipeId:id,presentationOverrides:currentPresentationOverrides\(\)/);

// 2) Forzar Sobre personalizable en preview también sincroniza el sobre con la
// paleta de la Recipe, en vez de arrastrar Stationery de una plantilla anterior.
assert.match(server,/if\(String\(opening\)===String\(stationeryCatalog\.openingId\|\|""\)&&settings\.designRecipe\)/);
assert.match(server,/synchronizeStationeryFromRecipe\(settings\.stationery\|\|\{\},settings\.designRecipe,\{resetPreset:true\}\)/);
assert.match(server,/settings\.seal=synchronizeSealFromRecipe/);
assert.match(server,/presentationOverrides/);

// 3) Portada: existe control explícito y soporta fondo, izquierda o derecha.
assert.match(labHtml,/id="heroMediaLayout"/);
for(const value of ["background","split-left","split-right"])assert.ok(labHtml.includes(`value="${value}"`),`Falta layout de portada ${value}`);
assert.match(nodeEngine,/\["background","split-left","split-right"\]\.includes\(design\.heroMedia\?\.layout\)/);
assert.match(lab,/heroMediaLayout/);
assert.match(lab,/lab-hero-media-panel/);
assert.match(publicEngine,/es-hero-media-panel/);
assert.match(publicEngine,/esDeferredHeroPanelSrc/);
assert.match(publicCss,/es-hero-media-split-left/);
assert.match(publicCss,/es-hero-media-split-right/);

// DesignEngine es la única autoridad cuando está cargado: se evita doble decode,
// flash y dos escrituras del mismo background en app.js.
assert.match(publicApp,/!window\.EventStudioDesignEngine/);
assert.match(publicApp,/DesignEngine es la única autoridad de presentación de portada/);

// 4) El seguimiento de la sección editada desplaza sólo el canvas, no toda la UI.
const followFn=lab.slice(lab.indexOf("function ensureSelectedSectionVisible"),lab.indexOf("function selectSection"));
assert.ok(followFn.includes("stage.scrollTo"),"El seguimiento debe mover únicamente lab-stage.");
assert.ok(!followFn.includes("scrollIntoView"),"scrollIntoView causaba saltos entre paneles.");
assert.match(labCss,/\.lab-panel,\.lab-stage,\.lab-inspector\{overscroll-behavior:contain;scrollbar-gutter:stable\}/);
assert.match(labCss,/@media\(min-width:761px\)/);
assert.match(labCss,/html,body\{overflow:hidden\}/);

// 5) La copia QA no debe insistir en descargar medios locales ya eliminados.
assert.match(server,/safePublicMediaUrl/);
assert.match(lab,/missingMediaSet\(\)/);
assert.match(lab,/Portada referenciada, archivo no disponible en esta copia/);

// 6) Ingestión Gemini auditada: sólo assets estáticos; SMIL queda en cuarentena
// hasta contar con un renderer explícito de animación SVG.
const accepted=[
  "wedding.art-deco.divider.001","quince.neon-cyber.corner.001","social.tropical-beach.corner.001",
  "wedding.dark-gothic.flourish.001","corporate.minimal-geo.accent.001","wedding.floral-geo.diamond.001",
  "wedding.minimal-line.wreath.001","wedding.romantic-heart.multiline.001","wedding.autumn-burgundy.circle.001",
  "wedding.succulent-geo.heart.001","wedding.floral-geo.divider.001","wedding.romantic-heart.corner.001"
];
const quarantined=["wedding.ethereal-breath.branch.001","social.cosmic-glitter.leaf.001","wedding.ethereal-breath.overlay.001"];
assert.ok(["1.2.0","1.3.0"].includes(manifest.version));
assert.equal(manifest.assets.length,31,"RC40 debe exponer 31 assets aprobados.");
const ids=new Set(manifest.assets.map(a=>a.id));
for(const id of accepted){
  assert.ok(ids.has(id),`Asset RC40 ausente: ${id}`);
  const asset=manifest.assets.find(a=>a.id===id);
  assert.equal(asset.status,"approved");
  assert.equal(asset.source,"gemini-batch-050-051-audited-static");
  assert.ok(asset.url.startsWith("/design-assets/decorations/"));
  const svg=read(path.join("public",asset.url));
  assert.match(svg,/^<svg[\s>]/);
  assert.ok(!/<script\b/i.test(svg),`${id}: script no permitido`);
  assert.ok(!/<animate\b/i.test(svg),`${id}: SMIL no debía entrar en RC40`);
  assert.ok(!/(?:href|xlink:href)\s*=\s*["']https?:/i.test(svg),`${id}: URL externa no permitida`);
}
for(const id of quarantined)assert.ok(!ids.has(id),`Asset SMIL debe permanecer en cuarentena: ${id}`);
assert.match(labCss,/\.asset-thumb \.asset-library-mask/);

// 7) El catálogo y sus contrastes siguen sanos después de ampliar assets.
const audit=design.validateCatalog();
assert.equal(audit.pass,true,`Catálogo inválido: ${audit.issues.join("; ")}`);
assert.equal(audit.counts.recipes,65);
for(const raw of design.recipeCatalog.recipes){
  const recipe=design.normalizeRecipe(raw,raw);
  assert.equal(design.paletteAudit(recipe.design.palette).pass,true,`${recipe.id}: contraste insuficiente`);
}

console.log(`✓ RC40 static: ${audit.counts.recipes} Recipes, ${manifest.assets.length} assets, experiencia dominante, portada split, scroll independiente y medios faltantes verificados.`);
