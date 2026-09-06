"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const recipes=require("../config/design/recipes.json").recipes;
const components=require("../config/design/components.json").components;
const experiences=require("../config/experiences.json");
const profilesSource=read("src/commerce-schema.js");
const designEngine=require("../src/design-engine");
const {ensureAccessiblePalette,contrastRatio}=require("../src/theme-design");

assert.ok(recipes.length>=64,"El catálogo debe conservar las 64 Recipes base aunque agregue diseños auditados.");
assert.ok(components.some(item=>item.type==="music"&&item.requiredFeature==="music"),"Música debe seguir siendo una capacidad funcional del motor.");

// Contraste semántico: los colores decorativos pueden conservar su armonía, pero
// los tokens destinados a texto deben ser legibles sobre las superficies activas.
for(const raw of recipes){
  const recipe=designEngine.normalizeRecipe(raw,raw);
  const palette=ensureAccessiblePalette(recipe.design.palette);
  for(const [foreground,background,label] of [
    [palette.ink,palette.paper,"ink/paper"],
    [palette.ink,palette.bg,"ink/bg"],
    [palette.muted,palette.paper,"muted/paper"],
    [palette.muted,palette.bg,"muted/bg"],
    [palette.accentText,palette.paper,"accentText/paper"],
    [palette.accentText,palette.bg,"accentText/bg"],
    [palette.goldText,palette.paper,"goldText/paper"],
    [palette.goldText,palette.bg,"goldText/bg"],
    [palette.paperContrast,palette.paper,"paperContrast/paper"],
    [palette.bgContrast,palette.bg,"bgContrast/bg"]
  ]) assert.ok(contrastRatio(foreground,background)>=4.5,`${recipe.id}: ${label} no alcanza WCAG AA.`);
  assert.ok(contrastRatio(palette.accentContrast,palette.accent)>=4.5,`${recipe.id}: texto sobre primario no alcanza WCAG AA.`);
  assert.ok(contrastRatio(palette.goldContrast,palette.gold)>=4.5,`${recipe.id}: texto sobre dorado no alcanza WCAG AA.`);
  assert.ok(recipe.design.colorTheory?.seed&&recipe.design.colorTheory?.harmony,`${recipe.id}: falta metadata de teoría del color.`);
}

// Matriz exhaustiva del panel superior: cada Recipe debe poder recibir cualquier
// combinación declarada de apertura, recorrido, movimiento y galería sin perder
// estructura ni introducir IDs externos. Es validación lógica, no visual cartesiana.
const openings=experiences.openings.filter(item=>!item.hidden);
const galleries=experiences.galleries;
const motions=experiences.motionLevels;
const modes=["auto","classic","story","poster","gallery"];
let matrixCases=0;
for(const raw of recipes){
  for(const opening of openings){
    for(const gallery of galleries){
      for(const motion of motions){
        for(const mode of modes){
          const input=JSON.parse(JSON.stringify(raw));
          input.design={...input.design,openingId:opening.id,galleryStyleId:gallery.id,motionPreset:motion.id,experienceMode:mode,openingProps:{rosePetalColor:"#8a3b4f",floralPetalColor:"#f2eee7",floralCenterColor:"#b28b35"}};
          const normalized=designEngine.normalizeRecipe(input,raw);
          assert.equal(normalized.design.openingId,opening.id,`${raw.id}: apertura no persistió.`);
          assert.equal(normalized.design.galleryStyleId,gallery.id,`${raw.id}: galería no persistió.`);
          assert.equal(normalized.design.motionPreset,motion.id,`${raw.id}: movimiento no persistió.`);
          assert.equal(normalized.design.experienceMode,mode,`${raw.id}: recorrido no persistió.`);
          assert.equal(normalized.sections.length,raw.sections.length,`${raw.id}: la personalización no debe destruir bloques.`);
          matrixCases++;
        }
      }
    }
  }
}
assert.equal(matrixCases,recipes.length*openings.length*galleries.length*motions.length*modes.length);

// El mismo genoma visual se proyecta de forma distinta por derechos; apagar un
// feature elimina su bloque del DOM futuro sin mutar la Recipe privada.
const featureSets={
  owner:Object.fromEntries(components.map(item=>[item.requiredFeature,true]).filter(([key])=>key)),
  developer:Object.fromEntries(components.map(item=>[item.requiredFeature,true]).filter(([key])=>key)),
  courtesy:{invitation:true,locations:true,program:true,gallery:true,dressCode:true,rsvp:true,gifts:true,qrCards:true,music:true},
  hostFree:{invitation:true,locations:false,program:false,gallery:false,dressCode:false,rsvp:false,gifts:false,qrCards:false,music:false},
  hostPaid:{invitation:true,locations:true,program:true,gallery:true,dressCode:true,rsvp:true,gifts:true,qrCards:true,music:true}
};
const commercialProfiles=["couple-diy","family-simple","planner","company"];
for(const profile of commercialProfiles)assert.match(profilesSource,new RegExp(`\\["${profile}"`),`Falta el perfil comercial ${profile}.`);
let accessProjectionCases=0;
for(const raw of recipes){
  const original=designEngine.normalizeRecipe(raw,raw),originalHash=designEngine.recipeHash(original);
  for(const [accessCase,features] of Object.entries(featureSets)){
    const baselineTypes=designEngine.publicRecipe({designRecipe:original},features).sections.map(item=>item.type).sort().join('|');
    for(const commercialProfile of commercialProfiles){
      /* El perfil comercial recomienda UX/productos, pero no entra al resolver de
         seguridad. La misma concesión debe producir la misma proyección. */
      const projected=designEngine.publicRecipe({designRecipe:original},features);
      const types=new Set(projected.sections.map(item=>item.type));
      assert.equal([...types].sort().join('|'),baselineTypes,`${raw.id}/${accessCase}/${commercialProfile}: el perfil comercial alteró permisos.`);
      for(const component of components){
        const shouldRender=!component.requiredFeature||features[component.requiredFeature]!==false;
        if(original.sections.some(section=>section.type===component.type&&section.visible!==false))assert.equal(types.has(component.type),shouldRender,`${raw.id}/${accessCase}/${commercialProfile}/${component.type}: proyección incoherente.`);
      }
      assert.equal(designEngine.recipeHash(original),originalHash,`${raw.id}/${accessCase}/${commercialProfile}: la proyección pública mutó la Recipe privada.`);
      accessProjectionCases++;
    }
  }
}

const adminHtml=read("public/admin.html"),admin=read("public/admin.js"),app=read("public/app.js"),styles=read("public/styles.css"),designCss=read("public/design-engine.css"),server=read("src/server.js");
assert.ok(!adminHtml.includes('id="saveOpeningStyleBtn"'),"No debe quedar un guardado paralelo de apertura.");
assert.ok(adminHtml.includes('id="previewOpeningBtn"'),"Debe conservarse Probar apertura.");
assert.ok(adminHtml.includes('id="openingCompatibilitySummary"'),"Debe explicarse la recomendación de Recipes por apertura.");
assert.match(admin,/openingRecipeAffinity/);
assert.match(admin,/editCatalogTheme/,"Elegir un diseño debe guardar la Recipe seleccionada como DRAFT antes de continuar al Estudio unificado.");
assert.match(admin,/\['openingStyleSelect','experienceModeSelect','motionLevelSelect','galleryStyleSelect'\]\.forEach\(id=>\$\(id\)\?\.addEventListener\('change',updateDesignProductControls\)\)/,"Los cuatro ajustes superiores deben reaccionar sin un botón Guardar entrada.");
assert.match(admin,/renderThemes\(\)/,"Cambiar apertura debe reordenar las Recipes reactivamente.");
assert.match(server,/code:"THEME_REQUIRED"/,"La API debe impedir aplicar una Recipe comercial no adquirida.");
assert.match(server,/pendingEntitlements/,"La intención visual premium debe persistir sin activar el servicio no comprado.");
assert.match(styles,/word-break:keep-all!important/,"Los nombres no deben partirse dentro de una palabra.");
assert.match(app,/fitSmartEventName/);
assert.match(app,/previewExperience/);assert.match(app,/previewMotion/);
assert.match(designCss,/es-hero-no-media/);assert.match(designCss,/paper-contrast/);

console.log(`✓ RC34 coherencia: ${recipes.length} Recipes, ${matrixCases.toLocaleString("en-US")} combinaciones de presentación y ${accessProjectionCases.toLocaleString("en-US")} proyecciones rol/perfil, contraste semántico y paywall coherentes.`);
