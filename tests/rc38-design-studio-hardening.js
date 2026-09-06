"use strict";

/*
  RC38 hardening contract.
  This suite intentionally uses only Node core + the project Design Engine so it
  can run even before npm dependencies are installed on a clean QA machine.
*/
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const design=require("../src/design-engine");

const audit=design.validateCatalog();
assert.equal(audit.pass,true,`Catálogo inválido: ${audit.issues.join("; ")}`);
assert.equal(audit.counts.recipes,65,"Se esperaban 65 Recipes verificadas.");
assert.ok(audit.counts.headingFonts>=14,"RC38 debe ampliar las familias de títulos/caligrafía.");
assert.ok(audit.counts.bodyFonts>=9,"RC38 debe ampliar las familias de texto.");

// Cada Recipe prediseñada debe conservar una paleta legible AA tras normalizar.
for(const raw of design.recipeCatalog.recipes){
  const recipe=design.normalizeRecipe(raw,raw);
  assert.equal(design.paletteAudit(recipe.design.palette).pass,true,`${recipe.id}: paleta sin AA`);
  assert.ok(recipe.sections.some(section=>section.type==="hero"&&section.visible!==false),`${recipe.id}: hero ausente`);
  assert.equal(typeof recipe.design.heroMedia.enabled,"boolean",`${recipe.id}: heroMedia.enabled no normalizado`);
}

// Los overrides de color directo sólo aceptan HEX seguro y siguen siendo opcionales.
const base=design.normalizeRecipe(design.recipeCatalog.recipes[0],design.recipeCatalog.recipes[0]);
const first=base.sections[0];
const direct=design.normalizeRecipe({...base,sections:base.sections.map(section=>section.uid===first.uid?{...section,props:{...(section.props||{}),headingColor:"#123456",bodyColor:"#abcdef"}}:section)},base);
const directSection=direct.sections.find(section=>section.uid===first.uid);
assert.equal(directSection.props.headingColor,"#123456");
assert.equal(directSection.props.bodyColor,"#abcdef");
const unsafe=design.normalizeRecipe({...base,sections:base.sections.map(section=>section.uid===first.uid?{...section,props:{...(section.props||{}),headingColor:"red;position:fixed",bodyColor:"javascript:alert(1)"}}:section)},base);
const unsafeSection=unsafe.sections.find(section=>section.uid===first.uid);
assert.notEqual(unsafeSection.props.headingColor,"red;position:fixed");
assert.notEqual(unsafeSection.props.bodyColor,"javascript:alert(1)");

const lab=read("public/design-lab.js");
const labHtml=read("public/design-lab.html");
const labCss=read("public/design-lab.css");
const admin=read("public/admin.js");
const adminHtml=read("public/admin.html");
const adminCss=read("public/styles.css");
const publicApp=read("public/app.js");
const publicEngine=read("public/design-engine.js");
const server=read("src/server.js");
const stationery=read("public/stationery-studio.js");
const experiences=JSON.parse(read("config/experiences.json"));

// Conflicto 409: cliente conserva revisionado y cuenta con recuperación explícita.
assert.match(lab,/DESIGN_DRAFT_CONFLICT/);
assert.match(lab,/latestDraft\(\)/);
assert.match(lab,/El borrador cambió en otra sesión/);
assert.match(lab,/expectedRevision:draftRevision/);

// Preview no depende del endpoint que produjo 401 en RC37.
assert.ok(!/api\/admin\/preview-links/.test(lab),"Design Lab no debe depender de preview-links.");
assert.match(lab,/searchParams\.set\('designMode','draft'\)/);
assert.match(publicApp,/\['designMode','previewTheme'/,'La invitación debe reenviar designMode al cargar \/api\/config.');
assert.match(server,/draftDesignPreviewApplied=true/,'El preview DRAFT debe simular aperturas Store sin publicarlas.');

// Catálogo: buscar-as-you-type + preview + aplicar directamente.
for(const id of ["recipeSuggestions","themeSearchSuggestions","themePreviewApplyBtn","themePreviewEditBtn"]){
  assert.ok(labHtml.includes(`id="${id}"`)||adminHtml.includes(`id="${id}"`),`${id}: control faltante`);
}
assert.match(lab,/renderRecipeSuggestions/);
assert.match(admin,/renderThemeSearchSuggestions/);
assert.match(admin,/applyCatalogTheme/);
assert.match(admin,/editCatalogTheme/);
assert.match(admin,/Ver y aplicar/);
assert.match(lab,/ArrowDown/,'Las sugerencias del constructor deben ser navegables con teclado.');
assert.match(admin,/themeSearchSuggestions.*ArrowDown|ArrowDown.*themeSearchSuggestions/s,'Las sugerencias del catálogo deben ser navegables con teclado.');

// El selector de color de apertura no regenera toda la biblioteca por pixel.
assert.match(admin,/scheduleDeferredTask\('opening-color-preview',refreshOpenInvitationPreview,180\)/);
assert.match(admin,/const base=`\/e\/\$\{encodeURIComponent\(slug\)\}\?preview=1`;/,'La vista de apertura debe reconstruir su URL con los colores actuales.');
assert.match(server,/const draftOpeningColors=Object\.fromEntries/,'El preview DRAFT debe proyectar los colores de apertura guardados en la Recipe.');
assert.ok(!/\['rosePetalColor','floralPetalColor','floralCenterColor'\]\.forEach\(id=>\$\(id\)\?\.addEventListener\('input',\(\)=>\{renderThemes\(\)/.test(admin));

// Color granular y HEX preciso para títulos/texto.
for(const id of ["sectionHeadingColor","sectionHeadingHex","sectionBodyColor","sectionBodyHex"]){
  assert.ok(labHtml.includes(`id="${id}"`),`${id}: selector granular faltante`);
}
assert.match(lab,/data-color-hex/);
assert.match(lab,/sectionColorFeedback/);
assert.match(lab,/contraste .*:1/);
assert.match(labCss,/contrast-warning/);
assert.match(labCss,/Paleta \+ HEX/);

// Preview del constructor utiliza datos/media reales con coste acotado.
assert.match(lab,/lab-gallery-preview/);
assert.match(lab,/galleryItems\.slice\(0,8\)/);
assert.match(lab,/ensureSelectedSectionVisible/);
assert.match(lab,/Pista de música vinculada/);

// Hero: no cargar una imagen irrelevante debajo de una apertura y respetar ocultación.
assert.match(publicEngine,/media\.enabled!==false/);
assert.match(publicEngine,/esDeferredHeroImage/);
assert.match(publicApp,/activateDeferredHeroMedia/);
assert.match(publicApp,/recipeSectionVisible/);
assert.match(publicApp,/recipeSectionVisible\('gallery'\)/);
assert.match(publicApp,/recipeSectionVisible\('music'\)/);
assert.match(server,/function printableEventHeroPath/);
assert.equal((server.match(/const heroPath=printableEventHeroPath\(settings\);/g)||[]).length,3,"QR card, invitación física y QR set deben compartir la regla de hero activo.");

// Preview de Recipe interna/autorizada no debe caer silenciosamente al ACTIVE actual.
assert.match(server,/platformPreview\|\|catalogThemeAllowed/);
assert.match(server,/_designAccess:designAccessForEvent\(event\)/,'El panel debe distinguir privilegio de plataforma de derechos comerciales del evento.');
assert.match(server,/_designPreviewAccess:designAccessForEvent\(event,\{platform:platformUser\}\)/);
assert.match(admin,/previewTheme=/);

// Todas las aperturas no retiradas poseen una ruta de render o estilo público.
const openings=experiences.openings||[];
const visible=openings.filter(item=>!item.retired&&!item.hidden&&item.id!=="none");
for(const opening of visible){
  const id=opening.id;
  const known=publicApp.includes(`'${id}'`)||publicApp.includes(`\"${id}\"`)||adminCss.includes(`opening-${id}`);
  assert.ok(known,`Apertura ${id}: sin contrato público visible`);
}
assert.ok(visible.length>=14,"Se esperaba el catálogo completo de aperturas visibles.");

// Textos/aperturas y countdown no deben salir del viewport.
assert.match(adminCss,/RC38 · Aperturas: el texto introductorio nunca/);
assert.match(adminCss,/data-es-type="countdown"/);
assert.match(adminCss,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);

// Papelería embebida: copy coherente y favicon servido desde public/.
assert.match(stationery,/Volver al Estudio de diseño/);
assert.ok(fs.existsSync(path.join(root,"public","favicon.ico")),"favicon.ico faltante");
assert.ok(fs.statSync(path.join(root,"public","favicon.ico")).size>100,"favicon.ico inválido");

// UX compacta: acciones secundarias viven en un menú y Aplicar sigue primario.
assert.match(labHtml,/class="lab-more-menu"/);
assert.match(labHtml,/id="applyBtn"/);
assert.match(labHtml,/Vista previa/);

console.log(`✓ RC38 hardening: ${audit.counts.recipes} Recipes AA, ${visible.length} aperturas, conflictos, preview, catálogo, color, media, impresión y responsive verificados.`);
