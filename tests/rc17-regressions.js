"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const pkg=require(path.join(root,"package.json"));
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

assert.match(pkg.version,/^6\.14\.2-rc\.(?:1[7-9]|[2-9]\d+)$/);
for(const file of ["public/admin.html","public/index.html","public/album.html","public/catalogo.html","public/muestra.html","public/showcase.html","public/sandbox.html"]){
  assert.ok(read(file).includes(`styles.css?v=${pkg.version}`),`${file} debe invalidar caché CSS.`);
}

const server=read("src/server.js");
assert.match(server,/function primaryEventLocation/);
assert.match(server,/settings\.agenda\?\.items/);
assert.doesNotMatch(server,/Esta tarjeta acompaña la versión digital personalizada\./);
assert.match(server,/function eventMediaReferenceReport/);
assert.match(server,/existingFile\(storedPath\)/);
assert.match(server,/SELECT stored_name FROM photos/);
assert.match(server,/CLIENT_UPLOAD_ABORTED/);
assert.match(server,/media_upload_receipts/);
assert.match(server,/rememberAdminMediaUpload/);
assert.ok(server.includes('app.delete("/api/admin/media/missing"'));
assert.match(server,/media\.missing_references_cleaned/);
assert.match(server,/_mediaHealth:eventMediaReferenceReport\(updatedEvent\)/);
assert.match(server,/rosePetalColor/);


const commerceSchema=read("src/commerce-schema.js");
assert.doesNotMatch(commerceSchema,/UPDATE plans SET publication_policy='auto_after_entitlement'/,"El arranque no debe revertir la política de publicación elegida por el propietario.");
assert.doesNotMatch(commerceSchema,/WHERE p\.code IN \('trial','premium','studio'\)[\s\S]*experience:rose-bloom/,"El arranque no debe reinyectar experiencias eliminadas manualmente de un plan.");
assert.match(commerceSchema,/ON CONFLICT\(code\) DO NOTHING/,"Los productos bootstrap existentes no deben sobrescribir configuración comercial guardada.");
assert.doesNotMatch(commerceSchema,/trialPlan[\s\S]*INSERT OR IGNORE INTO plan_products/,"Vaciar un plan de prueba debe seguir siendo una decisión persistente del propietario.");
assert.match(commerceSchema,/bootstrap_showcase_seed_v1/,"Las demos del Showcase deben inicializarse una sola vez.");
assert.match(commerceSchema,/WHERE code=\? AND release_version=''/,"Los metadatos de producto sólo deben inicializarse una vez.");
assert.doesNotMatch(commerceSchema,/UPDATE customer_profiles SET recommendations_json=.*recommendations_json='\[\]'/,"Vaciar recomendaciones de un perfil no debe revertirse al reiniciar.");
assert.doesNotMatch(server,/featureDecision\(settings,"premiumTemplates"/,"El acceso a plantillas no debe caer en planes estáticos del archivo de configuración.");
assert.match(server,/readiness_status==="approved"&&\["bundle","storage","template_collection"\]/,"El catálogo público sólo debe mostrar complementos técnicamente aprobados.");
assert.match(server,/product\.kind==="template"&&product\.public&&product\.commercial_status==="available"&&product\.readiness_status==="approved"/,"Las plantillas públicas deben respetar también el estado técnico.");

const experiences=read("public/experience-renderers.js");
assert.match(experiences,/requestAnimationFrame\(\(\)=>requestAnimationFrame/);
assert.match(experiences,/cachedPalette/);
assert.match(experiences,/forceMotion=false/);
assert.match(experiences,/force-motion/);
assert.match(experiences,/--rose-petal-light/);

const app=read("public/app.js");
assert.match(app,/opening-action-consumed/);
assert.match(app,/loading="lazy" decoding="async"/);
assert.match(app,/Math\.min\(12,ordered\.length\)/);
assert.match(app,/function forceMotionRequested/);
assert.match(app,/style==='particle-heart'\?3000:650/);
assert.match(app,/open\(\{playMusic:false\}\)/);

const admin=read("public/admin.js");
assert.match(admin,/function uploadFormData/);
assert.match(admin,/x-upload-key/);
assert.match(admin,/retryableStatuses/);
assert.match(admin,/optimizeAdminImageForUpload/);
assert.match(admin,/prepareAdminImages/);
assert.match(admin,/45000/);
assert.match(admin,/transferencia dejó de avanzar/);
assert.match(admin,/function ensureGuestsLoaded/);
assert.match(admin,/function ensureTableNamesLoaded/);
assert.match(admin,/function ensurePhotosLoaded/);
assert.match(admin,/function refreshGuestsAfterMutation/);
assert.match(admin,/Promise\.all\(\[ensureGuestsLoaded\(\{force:true\}\),refreshDashboardStats\(\)\]\)/);
assert.match(admin,/if\(n==='photos'\)void ensurePhotosLoaded\(\)/);
assert.match(admin,/function renderMediaHealth/);
assert.match(admin,/function renderHeroMediaPreview/);
assert.match(admin,/cleanMissingMediaBtn/);
assert.match(admin,/commercial-profile-card/);
assert.doesNotMatch(admin,/commercial-profile-row/);
assert.match(admin,/document\.querySelectorAll\('\[placeholder\],\[title\],\[aria-label\]'\)/);
assert.match(admin,/if\(name==='qr'/);
assert.match(admin,/forceMotion=1/);
assert.match(admin,/rosePetalColor/);
for(const text of [
  "Modo desarrollador","Tipografía","Programa y ubicaciones","Referencias multimedia pendientes de restaurar",
  "Guardar modalidad de regalos","Eliminar enlace de Spotify","Revisar lugares sin confirmar desde"
]){
  const escaped=text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  assert.match(admin,new RegExp(`'${escaped}':'[^']+'`),`Falta traducción inglesa para ${text}`);
}

const showcase=read("public/showcase.js");
assert.match(showcase,/loading=\"lazy\" decoding=\"async\"/);
assert.match(showcase,/cache:'no-store'/);

const album=read("public/album.js");
assert.match(album,/XMLHttpRequest/);
assert.match(album,/for\(let attempt=1;attempt<=3;attempt\+\+\)/);
assert.match(album,/uploadKey/);
assert.match(album,/async function optimizePhotoForUpload/);
assert.ok(album.includes("'image/webp'"));
assert.match(album,/2560/);
assert.match(album,/45000/);
assert.match(album,/transferencia dejó de avanzar/);

const html=read("public/admin.html");
assert.ok((html.match(/settings-collapsible/g)||[]).length>=7,"Configuración debe estar dividida en bloques colapsables.");
assert.match(html,/id="mediaHealthNotice"/);
assert.match(html,/id="rosePetalColor"/);

const css=read("public/styles.css");
assert.match(css,/\.commercial-profile-card\{display:grid;grid-template-columns:repeat\(2/);
assert.match(css,/\.rose-bloom-scene\.force-motion/);
assert.match(css,/content-visibility:auto/);
assert.match(css,/contain-intrinsic-size/);
assert.doesNotMatch(css,/commercial-profile-row/);
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,"CSS debe conservar balance de llaves.");

const dbSource=read("src/db.js");
assert.match(dbSource,/const schemaVersion=SCHEMA_VERSION/);
assert.match(dbSource,/CREATE TABLE IF NOT EXISTS media_upload_receipts/);
const commercialPlans=JSON.parse(read("config/commercial-plans.json"));
commercialPlans.plans.forEach(plan=>{assert.ok(Number.isInteger(plan.maxPublishedEvents));assert.ok(["manual_owner","auto_after_entitlement","disabled"].includes(plan.publicationPolicy));});

console.log("✓ Regresiones heredadas de 6.14.2-rc.17 verificadas");
