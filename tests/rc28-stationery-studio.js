"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const packageJson=require("../package.json");
const experiences=require("../config/experiences.json");
const stationeryCatalog=require("../config/stationery.json");
const defaultSettings=require("../config/default-settings.json");
const themes=require("../config/themes.json");
const experienceCatalog=require("../src/experience-catalog");
const {normalizeStationery,designTokens}=require("../src/stationery-config");
const {coordinationFor,applyOpeningCoordination,stationeryIsAuthoritative}=require("../src/opening-coordination");
const {loadThemeDesigns,ensureAccessiblePalette,contrastRatio}=require("../src/theme-design");

assert.equal(packageJson.version,"6.14.2-rc.30");
for(const file of ["public/stationery-studio.html","public/stationery-studio.css","public/stationery-studio.js","src/opening-coordination.js"]){
  assert.ok(fs.existsSync(path.join(root,file)),`Falta ${file}.`);
}

const unified=experiences.openings.find(item=>item.id===stationeryCatalog.openingId);
assert.ok(unified,"La apertura del motor unificado debe estar registrada.");
assert.deepEqual(unified.editor,{type:"stationery-studio",path:"/stationery-studio.html",label:"Abrir estudio avanzado"});
assert.equal(unified.coordination?.mode,"stationery");
const publicUnified=experienceCatalog.publicCatalog.openings.find(item=>item.id===stationeryCatalog.openingId);
assert.equal(publicUnified?.editor?.path,"/stationery-studio.html");
assert.equal(experienceCatalog.publicCatalog.openings.filter(item=>item.editor).length,1,"Sólo el sobre editable debe cargar el estudio avanzado.");
const dateSealOpening=experienceCatalog.publicCatalog.openings.find(item=>item.id==="particle-heart");
assert.deepEqual(dateSealOpening?.seal,{compatible:true,contentMode:"date"},"El fechador de partículas debe declararse en catálogo y consumir el sello central.");

const visibleOpenings=experiences.openings.filter(item=>!item.hidden);
const presets=new Map(stationeryCatalog.presets.map(item=>[item.id,item]));
for(const opening of visibleOpenings){
  const policy=opening.coordination;
  assert.ok(policy&&typeof policy.mode==="string",`${opening.id} requiere una política de coordinación explícita.`);
  if(policy.mode==="accent-harmony"&&policy.source==="stationery-preset"){
    const preset=presets.get(policy.presetId);
    assert.ok(preset,`${opening.id} referencia un preset inexistente.`);
    for(const key of [policy.accentKey,policy.goldKey,policy.lineKey].filter(Boolean)){
      assert.match(String(preset[key]||""),/^#[0-9a-f]{6}$/i,`${opening.id}.${key} debe provenir de un color válido del preset.`);
    }
  }
  if(policy.mode==="accent-harmony"&&policy.source==="presentation"){
    for(const field of [policy.accentField,policy.goldField,policy.lineField].filter(Boolean)){
      assert.match(String(defaultSettings.presentation?.[field]||""),/^#[0-9a-f]{6}$/i,`${opening.id}.${field} requiere un valor predeterminado configurado.`);
    }
  }
}

const base={bg:"#efe9df",paper:"#fffdf8",ink:"#312d27",muted:"#625e58",accent:"#7b3a4c",gold:"#9a7c45",line:"#c9c0b3"};
assert.deepEqual(applyOpeningCoordination(base,{presentation:{openingStyle:"none"}}),base,"Sin apertura no debe introducir colores de otro motor.");
const rose=coordinationFor({presentation:{openingStyle:"rose-bloom",rosePetalColor:"#123456"}});
assert.equal(rose.mode,"template");assert.deepEqual(rose.tokens,{});
const gala=coordinationFor({presentation:{openingStyle:"gala-curtain"}});
assert.equal(gala.mode,"template");assert.deepEqual(gala.tokens,{});

const custom=normalizeStationery({}, {...stationeryCatalog.defaults,customized:true,syncDesignTokens:true,outerColor:"#223344"},{openingStyle:stationeryCatalog.openingId});
assert.equal(stationeryIsAuthoritative({presentation:{openingStyle:stationeryCatalog.openingId}},custom),true);
assert.equal(stationeryIsAuthoritative({presentation:{openingStyle:"gala-curtain"}},custom),false,"Cambiar a otra entrada debe cortar la autoridad global de la paleta del sobre.");
assert.equal(stationeryIsAuthoritative({presentation:{openingStyle:stationeryCatalog.openingId}},{...custom,syncDesignTokens:false}),true,"El sobre personalizado siempre sincroniza los entregables.");

const designs=loadThemeDesigns(themes,path.join(root,"public/styles.css"));
const presentationDefaults=defaultSettings.presentation||{};
for(const theme of themes){
  const themePalette=designs.get(theme.id).palette;
  for(const opening of visibleOpenings){
    const settings={presentation:{...presentationDefaults,openingStyle:opening.id}};
    const coordinated=ensureAccessiblePalette(applyOpeningCoordination(themePalette,settings));
    assert.ok(contrastRatio(coordinated.ink,coordinated.paper)>=4.5,`${theme.id}/${opening.id}: ink/paper sin contraste.`);
    assert.ok(contrastRatio(coordinated.muted,coordinated.paper)>=4.5,`${theme.id}/${opening.id}: muted/paper sin contraste.`);
    assert.ok(contrastRatio(coordinated.accentText,coordinated.paper)>=4.5,`${theme.id}/${opening.id}: accentText/paper sin contraste.`);
  }
  const fullStationery=ensureAccessiblePalette({...themePalette,...designTokens(custom)});
  assert.ok(contrastRatio(fullStationery.ink,fullStationery.paper)>=4.5,`${theme.id}: papelería sincronizada sin contraste.`);
}

const adminHtml=read("public/admin.html"),admin=read("public/admin.js"),studioHtml=read("public/stationery-studio.html"),studio=read("public/stationery-studio.js"),app=read("public/app.js"),server=read("src/server.js");
for(const id of ["saveOpeningStyleBtn","previewOpeningBtn","stationeryLaunchCard","openStationeryStudioBtn"]){assert.ok(adminHtml.includes(`id="${id}"`),`Falta ${id} en el panel.`);}
assert.doesNotMatch(adminHtml,/stationery-engine\.js|stationery-engine\.css|stationeryAdminMount|sealFontSize/,"El panel no debe cargar ni incrustar el editor avanzado.");
assert.match(admin,/editor\?\.type==='stationery-studio'/);
assert.match(admin,/new URL\(editor\.path,window\.location\.origin\)/);
assert.match(admin,/body:JSON\.stringify\(\{presentation:presentationDraftFromForm\(\)\}\)/,"Guardar entrada debe ser independiente del estudio.");
assert.match(admin,/BroadcastChannel\('eventstudio-stationery'\)/);
assert.match(admin,/reloadStationeryStateFromServer/);
assert.match(admin,/api\('\/api\/admin\/settings',\{cache:'no-store'\}\)/,"El panel debe volver a leer el estado persistido después de una aplicación externa.");

assert.match(studioHtml,/stationery-engine\.js/);assert.match(studioHtml,/seal-renderer\.js/);
assert.match(studioHtml,/id="view-editor"/);assert.match(studioHtml,/class="sidebar-nav"/);assert.match(studioHtml,/class="sidebar-panel"/);assert.match(studioHtml,/class="main-stage"/);
for(const tab of ["formats","materials","settings","seals","frames","dividers","liners","laces","stamps"]){assert.match(studioHtml,new RegExp(`data-tab="${tab}"`),`Falta la sección ${tab} del generador maestro.`);}
assert.doesNotMatch(studioHtml,/id="(?:names|date|displayName|dateLabel)"/,"El estudio no debe volver a pedir nombres ni fecha.");
assert.match(studio,/eventSettings\?\.couple\?\.displayName/);assert.match(studio,/eventSettings\?\.event\?\.dateLabel/);assert.match(studio,/eventSettings\?\.typography\?\.heading/);
assert.match(studio,/inheritedControl\("Nombres principales",displayName\(\)\)/);assert.match(studio,/inheritedControl\("Fecha",dateLabel\(\)/);
assert.match(studio,/body:JSON\.stringify\(\{presentation,stationery:stationeryState,seal:sealState\}\)/,"Aplicar debe persistir presentación, papelería y lacre atómicamente.");
assert.match(studio,/openingStyle:stationeryCatalog\.openingId/);
assert.match(studio,/features\?\.role==="owner"\|\|features\?\.role==="developer"\|\|templates\?\.allowed/);
assert.match(studio,/controlLimit\("textureStrength"/);assert.match(studio,/sealCatalog\.connectorSuggestions/);
assert.match(studio,/stationeryStudioMount.*addEventListener\("click",toggleEnvelope\)/s,"La apertura y cierre del estudio deben responder al clic sobre el sobre.");
assert.doesNotMatch(studioHtml,/openEnvelopeBtn|closeEnvelopeBtn/,"El flujo maestro no debe depender de botones separados para abrir o cerrar el sobre.");
assert.match(server,/stationeryIsAuthoritative\(settings,stationery\)/);
assert.doesNotMatch(server,/applyOpeningCoordination\(manualBase,settings\)/);
assert.match(server,/:manualBase;/,"Las aperturas independientes deben conservar la paleta de la plantilla.");
assert.match(server,/_openingCoordination/);
assert.match(app,/function openingSupportsSeal\(style\)\{return openingDefinition\(style\)\?\.seal\?\.compatible===true;\}/,"La compatibilidad de lacre debe venir del catálogo, no de una lista de IDs.");
assert.match(app,/openingSealContentMode\(style\)===['"]date['"]/,"El fechador debe consumir el modo declarado por la entrada.");
assert.doesNotMatch(app,/SEAL_COMPATIBLE_OPENINGS/,"No debe existir una lista hardcodeada de aperturas compatibles con lacre.");
assert.match(app,/const unified=settings\?\.presentation\?\.openingStyle===settings\?\._stationeryCatalog\?\.openingId/);
assert.match(app,/\?\[settings\?\.stationery\?\.sealColor,settings\?\._palette\?\.accent,settings\?\._palette\?\.gold\]\s*:\[settings\?\._palette\?\.accent,settings\?\._palette\?\.gold\]/,"Una entrada independiente no debe reutilizar el color de lacre de un sobre guardado.");

for(const file of ["public/stationery-studio.js","src/opening-coordination.js","src/server.js"]){
  assert.doesNotMatch(read(file),/[😀-🙏🌀-🫿]/u,`${file} no debe incluir emojis en comentarios técnicos.`);
}

console.log(`✓ RC28 regresión: estudio avanzado separado, herencia y permisos preservados bajo contrato RC30`);
