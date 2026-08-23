"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const themes=require("../config/themes.json");
const {loadThemeDesigns,contrastRatio}=require("../src/theme-design");

const album=read("public/album.js");
assert.match(album,/function makeClientUploadKey\(/);
assert.match(album,/crypto\?\.randomUUID|crypto\.randomUUID/);
assert.match(album,/getRandomValues/);
assert.doesNotMatch(album,/data\.append\(["']uploadKey["'],\s*(?:globalThis\.)?crypto\.randomUUID\(\)\)/);

const app=read("public/app.js");
for(const key of ["previewTheme","previewOpening","previewGallery"]){
  assert.ok(app.includes(key),`El preview público debe reenviar ${key}.`);
}
assert.match(app,/function validateRsvpCounts\(/);
assert.match(app,/function renderSavedRsvpSummary\(/);
assert.match(app,/reportValidity/);

const db=read("src/db.js");
assert.match(db,/CREATE TABLE IF NOT EXISTS seating_legacy_imports/);
const serverPlaceholder=read("src/server.js");
assert.match(serverPlaceholder,/function initializeLegacySeating\(/);
assert.match(serverPlaceholder,/SELECT 1 FROM seating_legacy_imports WHERE event_id=\?/);
assert.match(serverPlaceholder,/INSERT OR IGNORE INTO seating_legacy_imports/);

const commerce=read("src/commerce.js");
assert.match(commerce,/function productOwnedForEvent\(/);
assert.match(commerce,/themeAllowed\(theme,event,entitlement\)/);
assert.match(commerce,/owned:productOwnedForEvent/);

const server=serverPlaceholder;
assert.match(server,/CART_CONTAINS_OWNED_PRODUCT/);
for(const route of [
  '/api/admin/commerce/products',
  '/api/admin/commerce/plans',
  '/api/admin/commercial-profiles',
  '/api/admin/events/:id/grants',
  '/api/admin/clients/:id/commercial-controls'
]){
  const escaped=route.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  assert.match(server,new RegExp(`app\\.(?:post|put|patch|delete)\\(\\"${escaped}\\",authRequired,ownerOnly`),`${route} debe mantenerse ownerOnly.`);
}

const adminHtml=read("public/admin.html");
for(const id of ["themePreviewDialog","storePreviewDialog","notificationDetailDialog","clientMenuPreviewDialog"]){
  assert.ok(adminHtml.includes(`id="${id}"`),`Falta ${id}.`);
}
const admin=read("public/admin.js");
assert.match(admin,/function fitPreviewStage\(/);
assert.match(admin,/setStorePreviewDevice\('phone'\)/);
assert.match(admin,/setStorePreviewDevice\('desktop'\)/);
assert.match(admin,/CART_CONTAINS_OWNED_PRODUCT/);

const commerceSchema=read("src/commerce-schema.js");
assert.match(commerceSchema,/product_id/);
assert.match(commerceSchema,/grant_id/);

const designs=loadThemeDesigns(themes,path.join(root,"public","styles.css"));
assert.equal(designs.size,themes.length,"Todas las plantillas deben tener diseño analizable.");
for(const [id,design] of designs){
  const {paper,ink,muted,accentText}=design.palette;
  assert.ok(contrastRatio(ink,paper)>=4.5,`${id}: ink debe alcanzar 4.5:1 sobre paper.`);
  assert.ok(contrastRatio(muted,paper)>=4.5,`${id}: muted debe alcanzar 4.5:1 sobre paper.`);
  assert.ok(contrastRatio(accentText,paper)>=4.5,`${id}: accentText debe alcanzar 4.5:1 sobre paper.`);
}

console.log("✓ Regresiones específicas 6.14.2-rc.14 verificadas");
