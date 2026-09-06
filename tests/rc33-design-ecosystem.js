"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const engine=require("../src/design-engine");

const root=path.join(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const deep=value=>JSON.parse(JSON.stringify(value));

const qa=engine.validateCatalog();
assert.equal(qa.pass,true,qa.issues.join(" | "));
assert.ok(qa.counts.recipes>=64);
assert.ok(qa.counts.assets>=17);
assert.ok(qa.counts.layoutFamilies>=8);
assert.ok(qa.counts.headingFonts>=8);
assert.ok(qa.counts.bodyFonts>=5);

// Las Recipes deben conservar su armonía predefinida y permitir un override completo sin mutar el catálogo.
const base=engine.catalogRecipe("gran-reserva");
assert.ok(base?.design?.colorTheory?.harmony);
const customPalette={bg:"#f6f3ef",paper:"#ffffff",ink:"#16191d",muted:"#5b626b",accent:"#2f5a6f","accent-dark":"#173b4f",gold:"#a37b3f",line:"#d5d8dc"};
const override=engine.normalizeRecipe({...base,design:{...base.design,palette:customPalette,typography:{heading:"cinzel",body:"montserrat",scale:"large",nameCase:"uppercase"},layoutFamily:"editorial"}},base);
assert.deepEqual(override.design.palette,customPalette);
assert.equal(override.design.typography.heading,"cinzel");
assert.equal(override.design.typography.body,"montserrat");
assert.equal(override.design.typography.scale,"large");
assert.equal(override.design.typography.nameCase,"uppercase");
assert.equal(override.design.layoutFamily,"editorial");
assert.equal(override.design.heroMedia.fit,"cover");
for(const raw of engine.recipeCatalog.recipes){
  const recipe=engine.catalogRecipe(raw.id);const qr=engine.scanSafeQrColors(recipe.design.palette);
  assert.ok(qr.ratio>=4.5,`${raw.id}: QR sin contraste suficiente ${qr.ratio}`);
}
const hostileQr=engine.scanSafeQrColors({ink:"#ffffff",accent:"#fefefe","accent-dark":"#eeeeee",gold:"#fff9dd"});
assert.ok(hostileQr.ratio>=7,"El motor QR debe usar fallback oscuro si la paleta no tiene color escaneable.");
assert.notDeepEqual(engine.catalogRecipe("gran-reserva").design.palette,{},"La Recipe de catálogo debe seguir disponible.");

// Matriz combinatoria: cualquier feature deshabilitada desaparece de la proyección pública sin destruir la Recipe original.
const componentByType=new Map(engine.componentCatalog.components.map(item=>[item.type,item]));
const allFeatureNames=[...new Set(engine.componentCatalog.components.map(item=>item.requiredFeature).filter(Boolean))];
const source=engine.catalogRecipe("romantic-wine");
assert.ok(source.sections.length>=10);
const original=deep(source);
const optionalFeatures=allFeatureNames.filter(name=>name!=="invitation");
const combinations=1<<optionalFeatures.length;
for(let mask=0;mask<combinations;mask++){
  const features={invitation:true};
  optionalFeatures.forEach((name,index)=>{features[name]=Boolean(mask&(1<<index));});
  const projected=engine.publicRecipe({designRecipe:source,themeId:source.id},features);
  for(const section of projected.sections){
    const required=componentByType.get(section.type)?.requiredFeature;
    assert.notEqual(features[required],false,`Se publicó ${section.type} con ${required}=false.`);
  }
  for(const [feature,enabled] of Object.entries(features)){
    if(enabled)continue;
    const blockedTypes=engine.componentCatalog.components.filter(item=>item.requiredFeature===feature).map(item=>item.type);
    for(const type of blockedTypes)assert.equal(projected.sections.some(section=>section.type===type),false,`${feature}: ${type} dejó un contenedor residual.`);
  }
}
assert.deepEqual(source,original,"La matriz de entitlements no debe mutar la Recipe privada.");

// Los Assets de una Recipe pública sólo pueden provenir del manifiesto y de anchors renderizados.
const manifestIds=new Set(engine.assetManifest.assets.map(item=>item.id));
for(const raw of engine.recipeCatalog.recipes){
  const recipe=engine.catalogRecipe(raw.id);
  const payload=engine.assetsForRecipe(recipe);
  for(const asset of payload.assets)assert.ok(manifestIds.has(asset.id),`${recipe.id}: asset fuera de manifiesto ${asset.id}`);
}

const server=read("src/server.js");
for(const contract of [
  'designEngine.publicRecipe(settings,publicFeatures)',
  'function qrRasterOptions(settings',
  'designEngine.scanSafeQrColors(qrPalette(settings)',
  'drawRecipePrintAssets(doc,{settings,palette,pageW,pageH})',
  'doc._eventStudioTypography=pdfTypography(settings)',
  'app.get("/api/public/design/recipes/:recipeId/thumbnail"',
  'next.typography=normalizeTypography(current.typography,recipe.design.typography||{})'
])assert.ok(server.includes(contract),`Falta contrato servidor: ${contract}`);

const labHtml=read("public/design-lab.html"),labJs=read("public/design-lab.js");
for(const id of ["layoutFamilySelect","headingFontSelect","bodyFontSelect","typographyScaleSelect","nameCaseSelect","colorTheorySeed","colorHarmonySelect","heroImageFile","heroMediaFit","heroMediaX","heroMediaY","heroMediaOverlay"]){
  assert.ok(labHtml.includes(`id="${id}"`),`Falta control reactivo ${id}.`);
}
for(const token of ["layoutFamilySelect","headingFontSelect","bodyFontSelect","typographyScaleSelect","nameCaseSelect","setCanvasTokens","scheduleThumbnail"]){
  assert.ok(labJs.includes(token),`Design Lab no conecta ${token}.`);
}

const publicEngine=read("public/design-engine.js"),publicCss=read("public/design-engine.css"),album=read("public/album.js");
assert.ok(publicEngine.includes("--font-heading"));
assert.ok(publicEngine.includes("--font-body"));
assert.ok(publicEngine.includes("dataset.designRecipe"));
assert.ok(publicEngine.includes("styleHeroMedia"),"El renderer público debe aplicar encuadre/tratamiento de portada desde Recipe.");
assert.ok(publicCss.includes("overflow-wrap:anywhere"));
assert.ok(publicCss.includes("data-es-type=\"music\"")||publicCss.includes("data-es-type='music'")||publicCss.includes("data-es-type=music")||publicCss.includes("data-es-style"));
assert.ok(album.includes("theme-recipe"),"El álbum colaborativo debe heredar identidad Recipe-first.");
assert.ok(album.includes("applyAlbumDesignAssets"),"El álbum debe reutilizar Assets aprobados de la Recipe.");
assert.ok(album.includes("_assetManifest"),"El álbum sólo debe cargar Assets expuestos por el manifiesto público.");
assert.ok(labJs.includes("accent-dark"),"Color Studio debe permitir sobreescribir el acento secundario.");

const landing=read("public/catalogo.html"),landingJs=read("public/catalogo.js"),seal=read("public/seal-renderer.js"),stationeryCss=read("public/stationery-engine.css");
assert.ok(landing.includes("Diseña primero · decide servicios después"));
assert.ok(landing.includes('id="heroRecipePreview"'));
assert.ok(landing.includes('id="landingSealPreview"'));
assert.ok(landingJs.includes("recipeCatalogItems"));
assert.ok(landingJs.includes("renderLandingSeal"));
assert.ok(seal.includes(`${"specularExponent=\"18\""}`));
assert.ok(seal.includes("-gloss"));
assert.ok(stationeryCss.includes("rotate(13deg)"));

const musicApp=read("public/app.js");
assert.ok(musicApp.includes("settings.media?.musicSource==='upload'"));
assert.ok(musicApp.includes("spotifyMusicBtn"));
assert.ok(musicApp.includes("$('musicBtn').onclick"));

console.log(`✓ RC33 Design Ecosystem: ${qa.counts.recipes} Recipes, ${combinations} combinaciones de entitlement, tokens tipográficos/layout, QR/PDF/álbum sincronizados, landing Recipe-first y lacre reforzado.`);
