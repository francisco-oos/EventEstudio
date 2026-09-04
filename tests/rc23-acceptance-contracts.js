"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const pkg=require("../package.json");
const themes=require("../config/themes.json");
const experiences=require("../config/experiences.json");

const rcNumber=Number((pkg.version.match(/^6\.14\.2-rc\.(\d+)$/)||[])[1]);
assert.ok(rcNumber>=23,"Los AC RC23 deben conservarse en RC23 y candidatas posteriores.");

const server=read("src/server.js");
const app=read("public/app.js");
const admin=read("public/admin.js");
const adminHtml=read("public/admin.html");
const styles=read("public/styles.css");

/* AC1: perfiles, negocio y planos conservan fronteras de seguridad explícitas. */
for(const route of [
  'app.get("/api/admin/commerce/catalog",authRequired,ownerOnly',
  'app.post("/api/admin/commercial-profiles",authRequired,ownerOnly',
  'app.put("/api/admin/commercial-profiles/:id",authRequired,ownerOnly',
  'app.get("/api/admin/clients/:id/commercial-profile",authRequired,ownerOnly',
  'app.get("/api/admin/seating",authRequired,eventAllowed,featureRequired("seating")',
  'app.put("/api/admin/seating/layout",authRequired,eventAllowed,featureRequired("seating")',
  'app.put("/api/admin/seating/assignment",authRequired,eventAllowed,featureRequired("seating")'
]) assert.ok(server.includes(route),`Falta el contrato de autorización: ${route}`);
assert.match(server,/\["owner","developer"\]\.includes\(req\.user\.role\)/,"Owner y developer deben compartir herramientas de plataforma sin concederlas a clientes.");
for(const id of ["ownerTabBtn","commercialProfileAdminRows","commerceProductGrid","commercePlanGrid","seatingCanvas"]){
  assert.ok(adminHtml.includes(`id="${id}"`),`Falta la vista crítica ${id}.`);
}
for(const route of ["/api/admin/commerce/catalog","/api/admin/seating","/api/admin/seating/layout","/api/admin/seating/assignment"]){
  assert.ok(admin.includes(route),`El panel no enlaza ${route}.`);
}

/* AC2: catálogo completo, cadencias y geometría de aperturas. */
assert.equal(themes.length,64,"Las 64 plantillas activas deben permanecer disponibles.");
assert.equal(experiences.openings.filter(item=>item.id!=="none"&&!item.retired).length,14,"Las mecánicas activas y el motor unificado deben permanecer disponibles.");
assert.doesNotMatch(styles,/transition\s*:\s*all\b/i,"Las animaciones públicas no deben usar transition: all; dificulta aislar layout/repaint.");
assert.match(read("public/stationery-engine.css"),/\.opening-unified-envelope/,"Debe existir la presentación del motor unificado.");
for(const opening of experiences.openings.filter(item=>item.id!=="none"&&!item.retired&&item.renderer==="css")){
  assert.ok(styles.includes(`.opening-${opening.id}`),`${opening.id} debe tener reglas CSS reales.`);
}
for(const id of ["gala-curtain","constellation-veil","reserve-uncork"]){
  assert.match(app,new RegExp(`'${id}':\\{replay:(\\d+),normal:(\\d+)\\}`),`${id} necesita cadencia centralizada.`);
}

/* AC3: el enlace general no depende de invitados ni de RSVP. */
const publicRoute=server.slice(server.indexOf('app.get("/e/:slug"'),server.indexOf('function cookiesOf'));
assert.ok(publicRoute.includes('res.sendFile(path.join(publicDir,"index.html"))'),"La URL pública debe servir la invitación por slug.");
assert.doesNotMatch(publicRoute,/guest|rsvp|token/i,"La ruta pública general no puede depender de invitados, RSVP o tokens.");
const publicUrlRoute=server.slice(server.indexOf('app.get("/api/admin/events/:id/public-url"'),server.indexOf('function cookiesOf'));
assert.match(publicUrlRoute,/publicInvitationUrl\(req\.event\)/,"El panel debe obtener la URL inmediatamente desde el evento.");
assert.match(app,/const hasPersonalInvitation=Boolean\(new URLSearchParams\(location\.search\)\.get\('i'\)\)/,"La personalización por invitado debe ser opcional.");
assert.match(app,/settings\.rsvp\?\.enabled===false\|\|!hasPersonalInvitation/,"El formulario RSVP no debe bloquear la invitación general.");

/* AC4 / DoD: documentos y tests de la candidata son parte del release. */
for(const file of [
  "docs/analysis/ADR_QA_ACCEPTANCE_RC23.md",
  "docs/validation/VALIDACION_RC23.md",
  "docs/release-notes/RELEASE_NOTES_V6_14_2_RC23.md",
  "docs/indexes/INDEX_DOCUMENTACION_RC23.md",
  "tests/rc23-concurrent-e2e.js",
  "tests/rc23-acceptance-contracts.js"
]) assert.ok(fs.existsSync(path.join(root,file)),`Falta evidencia DoD: ${file}`);

/* Los archivos tocados por RC23 mantienen comentarios técnicos, sin pictogramas decorativos. */
for(const file of ["tests/rc23-acceptance-contracts.js","tests/rc23-concurrent-e2e.js","docs/analysis/ADR_QA_ACCEPTANCE_RC23.md"]){
  assert.doesNotMatch(read(file),/[\u{1F300}-\u{1FAFF}]/u,`${file} contiene emojis.`);
}

console.log("✓ RC23: contratos de perfiles, negocio, planos, animaciones y enlace público verificados");
