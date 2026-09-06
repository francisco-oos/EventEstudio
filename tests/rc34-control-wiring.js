"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const pairs=[
  ["public/admin.html","public/admin.js"],
  ["public/index.html","public/app.js"],
  ["public/design-lab.html","public/design-lab.js"],
  ["public/stationery-studio.html","public/stationery-studio.js"],
  ["public/album.html","public/album.js"],
  ["public/catalogo.html","public/catalogo.js"]
];
let buttons=0;
for(const [htmlFile,jsFile] of pairs){
  const html=read(htmlFile),js=read(jsFile);
  const buttonIds=[...html.matchAll(/<button\b[^>]*\bid="([^"]+)"[^>]*>/g)].map(m=>m[1]);
  for(const id of buttonIds){
    buttons++;
    if(js.includes(id))continue;
    if(htmlFile==="public/admin.html"&&id==="dashboardTabBtn"){
      assert.match(js,/querySelectorAll\(['"]\.tab-btn['"]\)/,"dashboardTabBtn debe estar cubierto por navegación delegada.");
      continue;
    }
    assert.fail(`${htmlFile}: el botón ${id} no tiene ninguna referencia en ${jsFile}.`);
  }
}
const admin=read("public/admin.js"),adminHtml=read("public/admin.html");
assert.match(admin,/\['openingStyleSelect','experienceModeSelect','motionLevelSelect','galleryStyleSelect'\]\.forEach\(id=>\$\(id\)\?\.addEventListener\('change',updateDesignProductControls\)\)/);
assert.match(admin,/\['rosePetalColor','floralPetalColor','floralCenterColor'\]\.forEach\(id=>\$\(id\)\?\.addEventListener\('input',\(\)=>\{scheduleDeferredTask\('opening-color-preview',refreshOpenInvitationPreview,180\);\}\)\)/,"Los colores de apertura deben actualizar la vista de forma diferida, sin regenerar toda la biblioteca en cada píxel del arrastre.");
assert.ok(!/\['rosePetalColor','floralPetalColor','floralCenterColor'\]\.forEach\(id=>\$\(id\)\?\.addEventListener\('input',\(\)=>\{renderThemes\(\)/.test(admin),"El selector de color no debe regenerar todas las Recipes en cada evento input.");
assert.match(admin,/\$\('previewOpeningBtn'\)\?\.addEventListener\('click'/);
assert.ok(!adminHtml.includes('id="saveOpeningStyleBtn"'));
assert.match(admin,/card\?\.classList\.toggle\('hidden',!editable\)/,"Stationery debe aparecer únicamente cuando la apertura declara editor avanzado.");
console.log(`✓ RC34 controles: ${buttons} botones con wiring verificable; panel de apertura reactivo y sin guardado paralelo.`);
