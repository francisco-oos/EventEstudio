"use strict";
/* RC41 · contratos de fidelidad Editor → DRAFT → ACTIVE → invitación pública. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const server=read("src/server.js"),admin=read("public/admin.js"),lab=read("public/design-lab.js"),labHtml=read("public/design-lab.html"),labCss=read("public/design-lab.css"),stationery=read("public/stationery-studio.js"),publicEngine=read("public/design-engine.js"),publicCss=read("public/design-engine.css"),nodeEngine=read("src/design-engine.js");
const design=require("../src/design-engine"),manifest=require("../config/design/assets-manifest.json");

assert.equal(require("../package.json").version,"6.16.0-rc.41");

// 1) Abrir el constructor desde Plantillas parte del ACTIVE; Editar una Recipe preparada conserva DRAFT.
assert.match(admin,/panel=recipes&baseline=active/);
assert.match(admin,/panel=recipes&baseline=draft/);
assert.match(server,/activeRecipe:state\.activeRecipe/);
assert.match(lab,/initialParams\.get\('baseline'\)==='active'/);
assert.match(lab,/recipeData\.activeRecipe/);

// 2) Portada: hereda media del evento, recupera alias único de ZIP/restauración y admite encuadre por dispositivo + drag.
assert.match(server,/function resolveStoredMedia\(/);
assert.match(server,/candidates\.length!==1/);
assert.match(server,/heroImage:resolvedLocalMediaUrl/);
assert.match(server,/recoveredCount:recovered\.length/);
for(const key of ["mobilePositionX","mobilePositionY","desktopPositionX","desktopPositionY","mobileFit","desktopFit"])assert.ok(nodeEngine.includes(key),`Falta ${key} en normalización heroMedia`);
assert.match(lab,/function bindHeroMediaDrag\(/);
assert.match(lab,/hero-media-drag-target/);
assert.match(labHtml,/Reemplazar portada \(opcional\)/);
assert.match(labHtml,/id="heroMediaDeviceHint"/);
assert.match(publicEngine,/media\.mobilePositionX/);
assert.match(publicEngine,/media\.desktopPositionX/);

// 3) Assets deben tener caja física en público y conservar relación de aspecto real.
assert.equal(manifest.version,"1.3.0");
assert.equal(manifest.assets.length,31);
for(const asset of manifest.assets){assert.ok(Number(asset.aspectRatio)>0,`${asset.id}: aspectRatio inválido`);}
assert.match(nodeEngine,/aspectRatio/);
assert.match(publicEngine,/--es-asset-ratio/);
assert.match(publicCss,/\.es-design-asset\.is-colorizable[\s\S]*aspect-ratio:var\(--es-asset-ratio,1\)/);
assert.match(lab,/node\.style\.aspectRatio/);
assert.match(lab,/event\.ctrlKey.*event\.altKey/);

// 4) Stationery: Apply/Preview fuerza flush del iframe y no depende de esperar el debounce.
assert.match(stationery,/window\.EventStudioStationeryStudio=/);
assert.match(stationery,/flush:async/);
assert.match(lab,/async function flushStationeryWorkspace\(/);
assert.match(lab,/applyDesign\(\).*flushStationeryWorkspace/);
assert.match(lab,/preview\(\{history=true\}.*flushStationeryWorkspace/);
assert.match(lab,/previewOpening\(\).*flushStationeryWorkspace/);

// 5) Las Recipes con sobre comparten geometría pero derivan color + material/liner/textura de la Recipe.
assert.match(server,/textureMaterial=\{none:"smooth-paper",paper:"smooth-paper",linen:"cinematic-linen","soft-grain":"ivory-fiber",wash:"blue-aurora"\}/);
assert.match(server,/outerColor:blendDesignHex\(p\.bg\|\|p\.paper,p\.accent,\.18\)/);
assert.match(server,/innerColor:blendDesignHex\(p\.paper\|\|p\.bg,p\.accent,\.27\)/);
assert.match(server,/resetPreset&&genericPreset/);
const parseHex=value=>[0,2,4].map(offset=>parseInt(String(value||"#000000").replace("#","").slice(offset,offset+2),16)||0);
const blend=(left,right,amount)=>{const a=parseHex(left),b=parseHex(right);return `#${a.map((value,index)=>Math.round(value+(b[index]-value)*amount).toString(16).padStart(2,"0")).join("")}`;};
const envelopeIdentities=design.recipeCatalog.recipes.map(raw=>{const p=raw.design?.palette||{};return `${blend(p.bg||p.paper,p.accent,.18)}|${blend(p.paper||p.bg,p.accent,.27)}|${raw.design?.texture||"none"}`;});
assert.ok(new Set(envelopeIdentities).size>=60,`Las Recipes deben producir identidades de sobre variadas; sólo hubo ${new Set(envelopeIdentities).size}.`);

// 6) Evita escrituras/revisiones redundantes que alimentaban lag y carreras de autosave.
const recipePut=server.slice(server.indexOf('app.put("/api/admin/design/recipe"'),server.indexOf('app.get("/api/admin/design/stationery-draft"'));
assert.match(recipePut,/alreadySaved:true/);
const stationeryPut=server.slice(server.indexOf('app.put("/api/admin/design/stationery-draft"'),server.indexOf('app.post("/api/admin/design/discard"'));
assert.match(stationeryPut,/alreadySaved:true/);
assert.match(lab,/autosaveTimer=setTimeout\(\(\)=>save\(\)\.catch\(\(\)=>\{\}\),950\)/);
assert.match(stationery,/setTimeout\(\(\)=>persistDraft\(\{silent:true\}\)\.catch\(\(\)=>\{\}\),900\)/);

// 7) Preview modal fuerza documento nuevo, evitando que un iframe visualmente pegado parezca otra Recipe.
assert.match(admin,/frame\.src='about:blank';const previewSrc=replayablePreviewUrl\(url\)/);

// 8) Catálogo completo y colorimetría siguen válidos.
const audit=design.validateCatalog();
assert.equal(audit.pass,true,`Catálogo inválido: ${audit.issues.join("; ")}`);
assert.equal(audit.counts.recipes,65);
for(const raw of design.recipeCatalog.recipes){const recipe=design.normalizeRecipe(raw,raw);assert.equal(design.paletteAudit(recipe.design.palette).pass,true,`${recipe.id}: contraste insuficiente`);}

console.log(`✓ RC41 static: ${audit.counts.recipes} Recipes, ${manifest.assets.length} assets, portada heredada/drag/device, Stationery flush, previews y autosave idempotente verificados.`);
