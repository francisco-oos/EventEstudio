"use strict";

/*
  RC39 · paridad de Recipes, papelería y vista previa.
  Suite sin dependencias externas: puede ejecutarse antes de `npm ci` y cubre
  los contratos que originaron las regresiones detectadas en QA manual RC38.
*/
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const design=require("../src/design-engine");
const stationery=require("../config/stationery.json");
const experiences=require("../config/experiences.json");

const admin=read("public/admin.js");
const lab=read("public/design-lab.js");
const labCss=read("public/design-lab.css");
const publicEngine=read("public/design-engine.js");
const publicCss=read("public/design-engine.css");
const studio=read("public/stationery-studio.js");
const server=read("src/server.js");

const audit=design.validateCatalog();
assert.equal(audit.pass,true,`Catálogo inválido: ${audit.issues.join("; ")}`);
assert.equal(audit.counts.recipes,65,"RC39 debe conservar las 65 Recipes.");
for(const raw of design.recipeCatalog.recipes){
  const recipe=design.normalizeRecipe(raw,raw);
  assert.equal(design.paletteAudit(recipe.design.palette).pass,true,`${recipe.id}: paleta no AA`);
  assert.ok((experiences.openings||[]).some(item=>item.id===recipe.design.openingId),`${recipe.id}: apertura desconocida ${recipe.design.openingId}`);
  assert.ok(recipe.sections.some(section=>section.type==="hero"&&section.visible!==false),`${recipe.id}: portada ausente`);
}

// RC40 supersede este contrato: la Recipe conserva apariencia, pero los controles superiores gobiernan la experiencia.
const openThemePreview=admin.slice(admin.indexOf("async function openThemePreview"),admin.indexOf("async function previewStoreProduct"));
assert.match(openThemePreview,/previewUrlFromOptions\(\{previewTheme:themeId,\.\.\.presentationPreviewOptions\(\)\},base\)/);
assert.ok(openThemePreview.includes("presentationPreviewOptions()"),"El preview de catálogo debe usar la experiencia seleccionada en los controles superiores.");
const editCatalog=admin.slice(admin.indexOf("async function editCatalogTheme"),admin.indexOf("async function openThemePreview"));
assert.ok(editCatalog.includes("presentationOverrides=presentationDraftFromForm()"),"Aplicar/editar catálogo debe guardar overrides de experiencia sin destruir la apariencia de la Recipe.");
assert.match(admin,/Usará:/);

// La vista temporal de una Recipe proyecta también apertura, paleta y papelería.
assert.match(server,/catalogThemePresentationApplied=true/);
assert.match(server,/settings\.presentation=normalizePresentation\(settings\.presentation\|\|\{\}, \{/);
assert.match(server,/settings\.stationery=synchronizeStationeryFromRecipe/);
assert.match(server,/previewOpeningBypass=draftDesignPreviewApplied\|\|catalogThemePresentationApplied/);

// Recipe y Stationery son una sola identidad sincronizada, no dos paletas rivales.
assert.match(server,/function synchronizeStationeryFromRecipe/);
assert.match(server,/function synchronizeRecipeFromStationery/);
assert.match(server,/function stationeryPresetForRecipe/);
for(const preset of ["wax-envelope","olive-nectar-seal","powder-blue-seal","ivory-seal"]){
  assert.ok((stationery.presets||[]).some(item=>item.id===preset),`Preset coordinado inexistente: ${preset}`);
}
assert.ok(!/stationeryActive&&settings\?\._themePalette/.test(lab),"El canvas no debe dejar que una papelería antigua tape la paleta de la Recipe.");
assert.match(lab,/function effectivePalette\(\)\{const source=recipe\?\.design\?\.palette/);

// El estudio utiliza datos y medios reales y evita referencias locales ya perdidas.
for(const marker of ["agendaItems()","firstVenue()","missingMediaSet()","liveMediaList(settings?.media?.gallery)","lab-dress-preview","lab-agenda-preview"]){
  assert.ok(lab.includes(marker),`Falta proyección real: ${marker}`);
}
assert.match(lab,/Sin relato adicional capturado todavía/);
assert.match(lab,/Sin ubicación capturada todavía/);
assert.match(lab,/Usando la portada ya cargada en el evento/);

// Controles por bloque deben producir un cambio visible tanto en canvas como público.
assert.match(labCss,/2\.35rem \* var\(--section-heading-size/);
assert.match(publicCss,/1\.55rem \* var\(--es-heading-size/);
assert.match(publicEngine,/paper:"--paper-contrast"/);
assert.match(lab,/paper:'var\(--paper-contrast,var\(--ink\)\)'/);


// El preview autorizado conserva el bloque RSVP para diseño aun sin token de invitado,
// pero no habilita el formulario ni inventa un huésped.
const publicApp=read("public/app.js");
assert.match(server,/_preview:\{enabled:Boolean\(preview\),designMode:/);
assert.match(publicApp,/designPreviewWithoutGuest/);
assert.match(publicApp,/Vista de diseño · el formulario personalizado aparece/);
assert.match(publicApp,/rsvpForm'\)\?\.classList\.add\('hidden'\)/);

// Countdown y CTA usan contraste contextual de papel, no el color global del fondo.
assert.match(publicCss,/data-es-type="countdown"\] \.countdown strong/);
assert.match(publicCss,/paper-contrast/);
assert.match(publicCss,/data-es-type="countdown"\] \.calendar-link/);

// Volver desde preview/stationery es una transición local de un clic, no history.back doble.
const closePreview=lab.match(/function closePreview\([^\n]+/i)?.[0]||"";
const closeStationery=lab.match(/function closeStationeryWorkspace\([^\n]+/i)?.[0]||"";
assert.ok(closePreview&&!closePreview.includes("history.back"),"closePreview no debe depender de history.back().");
assert.ok(closeStationery&&!closeStationery.includes("history.back"),"closeStationery no debe depender de history.back().");
assert.match(closePreview,/searchParams\.delete\('mode'\)/);

// Dentro del editor de sobres el guardado DRAFT es automático; Aplicar sigue siendo explícito.
assert.match(studio,/setTimeout\(\(\)=>persistDraft\(\{silent:true\}\)/);
assert.match(studio,/Guardar ahora/);
assert.match(studio,/El borrador se guarda automáticamente/);
assert.match(studio,/async function persistDraft/);

// Propietario/desarrollador puede validar experiencias comerciales sin crear una compra.
assert.match(server,/platformExperienceOverrides/);
assert.match(server,/activeOpeningPlatformOverride/);
assert.match(server,/activeGalleryPlatformOverride/);
assert.match(server,/platformOverrides\.push\(`opening:/);
assert.match(server,/platformOverrides\.push\(`gallery:/);
assert.match(lab,/Modo plataforma · puedes aplicar esta apertura/);

console.log(`✓ RC39/RC40 parity: ${audit.counts.recipes} Recipes, experiencia superior dominante, datos reales, Stationery↔Recipe, autosave, owner override y controles por bloque verificados.`);
