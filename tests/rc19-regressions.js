"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const pkg=require(path.join(root,"package.json"));
const experiences=require(path.join(root,"config","experiences.json"));

assert.match(pkg.version,/^6\.14\.2-rc\.(?:19|[2-9]\d)$/);
for(const file of ["public/admin.html","public/index.html","public/album.html","public/catalogo.html","public/muestra.html","public/showcase.html","public/sandbox.html"]){
  assert.ok(read(file).includes(`styles.css?v=${pkg.version}`),`${file} debe invalidar la caché CSS de RC19.`);
}

const garden=experiences.openings.find(item=>item.id==="luminous-garden");
assert.deepEqual(garden&&{
  renderer:garden.renderer,productCode:garden.productCode,grant:garden.grant
},{
  renderer:"LuminousGardenScene",productCode:"experience:luminous-garden",grant:"opening:luminous-garden"
});

const renderer=read("public/experience-renderers.js");
assert.match(renderer,/class LuminousGardenScene extends BloomSceneBase/);
assert.match(renderer,/layouts=\[/);
assert.match(renderer,/root\.classList\.add\('force-motion'\)/);
assert.match(renderer,/balanced:\{animate:true,particleScale:1,durationScale:1\.08\}/);
assert.match(renderer,/dynamic:\{animate:true,particleScale:1\.16,durationScale:\.98\}/);
assert.match(renderer,/window\.EventStudioExperiences=Object\.freeze\([^)]*LuminousGardenScene/);

const css=read("public/styles.css");
assert.match(css,/\.daisy-center\{[^}]*width:88px;height:88px/);
assert.match(css,/\.daisy-bloom-scene\.bloomed \.daisy-petals i\{[^}]*translateY\(-30px\)/);
assert.match(css,/\.daisy-bloom-scene\.force-motion\.bloomed \.daisy-petals i/);
assert.match(css,/\.opening-luminous-garden/);
assert.match(css,/\.luminous-garden-scene\.force-motion\.lights-visible/);
assert.match(css,/body\.force-motion-preview \.opening-flap/);
assert.match(css,/\.opening-skip-button/);
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,"CSS debe conservar balance de llaves.");

const app=read("public/app.js");
assert.match(app,/document\.body\.classList\.toggle\('force-motion-preview',forceMotion\)/);
assert.match(app,/new window\.EventStudioExperiences\.LuminousGardenScene/);
assert.match(app,/style==='luminous-garden'\?opening\._gardenScene/);
assert.match(app,/skipButton\.onclick=\(\)=>finishOpen/);
assert.match(app,/previewToken.*query\.set\('previewToken'/s);
assert.match(app,/const queryString=query\.toString\(\)/);
assert.match(app,/photo-messages\/\$\{encodeURIComponent\(eventSlug\)\}\$\{queryString\?/);
assert.match(app,/'luminous-garden':\{replay:6100,normal:5600\}/);

const server=read("src/server.js");
assert.match(server,/capabilities:\{automaticTranslation:Boolean\(TRANSLATION_ENDPOINT\)\}/);
assert.match(server,/req\.query\.optional==="1"/);
assert.match(server,/authenticated:false/);
assert.match(server,/!event\.published&&!previewAllowed\(req,event\)/);

const admin=read("public/admin.js");
assert.match(admin,/function configureAutomaticTranslation/);
assert.match(admin,/automaticTranslation!==true/);
assert.match(admin,/\/api\/auth\/me\?optional=1/);
assert.match(admin,/publicCatalog\?\.experiences\?\.openings\?\.some/);
assert.doesNotMatch(admin,/product\.code==='experience:rose-bloom'/,"Las vistas previas no deben mantener una lista manual divergente.");
assert.match(admin,/\['daisy-bloom','luminous-garden'\]/);

const commerce=read("src/commerce-schema.js");
assert.match(commerce,/code:"experience:luminous-garden"/);
assert.match(commerce,/"experience:luminous-garden"\]\.includes\(code\)/);
assert.match(commerce,/release_version='6\.14\.2-rc\.19'/);

const index=read("public/index.html");
const adminHtml=read("public/admin.html");
assert.match(index,/id="skipOpeningButton"/);
assert.match(adminHtml,/id="translationProviderHint"/);
assert.match(adminHtml,/id="autoTranslateBtn"[^>]*disabled/);

for(const source of [app,admin,server,renderer]){
  assert.doesNotMatch(source,/chrome-extension:\/\//);
  assert.doesNotMatch(source,/addEventListener\(['"]unload['"]/);
}

console.log("✓ Regresiones específicas 6.14.2-rc.19 verificadas");
