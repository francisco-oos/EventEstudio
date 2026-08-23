"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const adminHtml=read("public/admin.html");
const publicHtml=read("public/index.html");
const albumHtml=read("public/album.html");
const catalogHtml=read("public/catalogo.html");
const sampleHtml=read("public/muestra.html");
const adminJs=read("public/admin.js");
const publicJs=read("public/app.js");
const css=read("public/styles.css");

for(const [name,html] of [["administración",adminHtml],["invitación",publicHtml],["álbum",albumHtml],["catálogo",catalogHtml],["muestra",sampleHtml]]){
  const viewportTag=(html.match(/<meta\b(?=[^>]*\bname=["']viewport["'])[^>]*>/i)||[])[0]||"";
  const viewport=(viewportTag.match(/\bcontent=["']([^"']+)["']/i)||[])[1]||"";
  assert.match(viewport,/width=device-width/i,`${name} debe usar el ancho real del dispositivo.`);
  assert.match(viewport,/initial-scale=1/i,`${name} debe iniciar a escala normal.`);
  assert.match(viewport,/minimum-scale=1/i,`${name} no debe restaurarse encogida al volver.`);
  assert.doesNotMatch(viewport,/maximum-scale=1|user-scalable=no/i,`${name} debe permitir ampliar por accesibilidad.`);
}

assert.match(css,/@media\(max-width:760px\), \(hover:none\) and \(pointer:coarse\) and \(max-width:1100px\)/);
assert.match(css,/body\.admin-page\{width:100%;max-width:100%;padding:0!important;overflow-x:clip\}/);
assert.match(css,/\.admin-layout\{display:block!important;width:100%;max-width:100%;min-width:0\}/);
assert.match(css,/\.mobile-menu-btn\{[^}]*min-height:44px[^}]*touch-action:manipulation/);
assert.match(css,/html\.mobile-nav-open\{overflow:hidden;overscroll-behavior:none\}/);
assert.match(css,/body\.mobile-nav-open\{position:fixed;top:var\(--mobile-menu-scroll-offset,0\)/);
assert.match(css,/\.table-wrap table,\.table-wrap tbody\{display:block;width:100%;min-width:0;max-width:100%\}/);
assert.match(css,/\.ownership-action\{display:grid;width:100%;grid-template-columns:1fr/);
assert.match(css,/\.guest-table-wrap \.guest-desktop-cell\{display:none\}/);
assert.match(css,/tbody td\.guest-mobile-overview\{display:grid/);

for(const id of ["guestStatusFilter","guestEmptyState","saveTypographyBtn","previewOpeningBtn"]){
  assert.match(adminHtml,new RegExp(`id="${id}"`),`Falta el control móvil ${id}.`);
}
assert.match(adminHtml,/Mayúsculas y minúsculas automáticas/);
assert.match(adminHtml,/Todo en mayúsculas/);
assert.match(adminJs,/window\.addEventListener\('pageshow',\(\)=>setMobileNavigation\(false\)\)/);
assert.match(adminJs,/mobileMenuScrollY=Math\.max\(0,window\.scrollY/);
assert.match(adminJs,/document\.documentElement\.classList\.toggle\('mobile-nav-open',active\)/);
assert.match(adminJs,/window\.scrollTo\(0,mobileMenuScrollY\)/);
assert.match(adminJs,/guest-mobile-details/);
assert.match(adminJs,/opening=1/);
assert.match(publicJs,/async function refreshConfigIfChanged\(\)/);
assert.match(publicJs,/fetch\(configRequestUrl,\{cache:'no-store'/);
assert.match(publicJs,/nextRevision!==configRevision/);
assert.match(publicJs,/if\(rsvpDirty\)return false/);
assert.match(publicJs,/event\.persisted&&settings&&replayOpeningRequested\(\)/);
assert.match(adminHtml,/id="workspaceTools"/);
assert.match(adminHtml,/id="themeSearch"/);
assert.match(adminHtml,/id="saveLocalizationBtn"/);
assert.match(catalogHtml,/id="catalogThemeGrid"/);
assert.match(catalogHtml,/id="catalogThemeCount"/);
assert.match(sampleHtml,/id="samplePhone"/);
assert.match(publicJs,/function setupThemeExperience\(\)/);
assert.match(css,/body\[data-experience=story\] main>\.section/);
assert.match(css,/\.sample-phone\{position:relative/);
assert.match(css,/\.catalog-theme-grid\{display:grid/);
assert.match(css,/\.register-plan-cards\{display:grid/);

console.log("✓ Panel móvil, bloqueo del menú, tablas, tipografía y sincronización de apertura validados");
