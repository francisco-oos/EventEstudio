"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const pkg=require("../package.json");
const themes=require("../config/themes.json");
const experiences=require("../config/experiences.json");
const stationeryCatalog=require("../config/stationery.json");
const {normalizeStationery,designTokens}=require("../src/stationery-config");
const {coordinationFor,stationeryIsAuthoritative,applyOpeningCoordination}=require("../src/opening-coordination");
const {loadThemeDesigns,ensureAccessiblePalette,contrastRatio}=require("../src/theme-design");

assert.equal(pkg.version,"6.14.2-rc.30");
assert.equal(stationeryCatalog.openingId,"unified-envelope");

const custom=normalizeStationery({}, {
  ...stationeryCatalog.defaults,
  customized:true,
  syncDesignTokens:false,
  outerColor:"#203126",
  innerColor:"#0d1712",
  cardColor:"#f5f0df",
  textColor:"#33402f",
  ornamentColor:"#b49355",
  sealColor:"#7a3344"
},{openingStyle:stationeryCatalog.openingId});

assert.equal(custom.syncDesignTokens,true,"El sobre unificado personalizado debe persistir sincronización obligatoria.");
assert.equal(stationeryIsAuthoritative({presentation:{openingStyle:stationeryCatalog.openingId}},custom),true);
assert.equal(stationeryIsAuthoritative({presentation:{openingStyle:"gala-curtain"}},custom),false);
assert.deepEqual(designTokens(custom),{
  bg:custom.outerColor,paper:custom.cardColor,ink:custom.textColor,muted:custom.innerColor,
  accent:custom.sealColor,gold:custom.ornamentColor,line:custom.innerColor
});

const visible=experiences.openings.filter(item=>!item.hidden);
for(const opening of visible){
  if(opening.id===stationeryCatalog.openingId){
    assert.equal(opening.coordination?.mode,"stationery");
  }else{
    assert.equal(opening.coordination?.mode,"template",`${opening.id} debe conservar la paleta propia de la plantilla.`);
    const base={bg:"#eee8db",paper:"#fffdf8",ink:"#302d26",muted:"#766f63",accent:"#a77c12",gold:"#c8a551",line:"#ddd1bb"};
    assert.deepEqual(applyOpeningCoordination(base,{presentation:{openingStyle:opening.id}}),base);
    assert.deepEqual(coordinationFor({presentation:{openingStyle:opening.id}}).tokens,{});
  }
}

const indexHtml=read("public/index.html");
const app=read("public/app.js");
assert.match(indexHtml,/id="openingActionLabel">Abrir invitación<\/strong>/);
assert.match(app,/const openingActionLabel=\$\('openingActionLabel'\)/);
assert.doesNotMatch(app,/openingButton\.querySelector\(['"]strong['"]\)/,"El CTA no debe volver a sobrescribir el nombre dentro de la tarjeta del sobre.");
assert.match(app,/renderer\.renderInto\(mount,settings\?\.stationery\|\|\{\}/,"La apertura pública debe usar el mismo renderer de papelería persistida.");

const studio=read("public/stationery-studio.js");
assert.match(studio,/syncDesignTokens:true,fontMode:"event"/);
assert.doesNotMatch(studio,/id="stationerySyncDesignTokens"/);
assert.match(studio,/Sincronización automática:/);
assert.match(studio,/Aplicado\. La paleta del sobre coordina invitación, fotos, QR e impresión\./);

const css=read("public/styles.css");
assert.match(css,/\.theme-storybook-seal \.hero-content\.has-template-seal:after\{display:none!important;animation:none!important\}/);
assert.match(css,/\.theme-storybook-seal \.hero-content\.has-template-seal \.hero-wax-seal\{/);

/* Las variables de cada tema siguen siendo sus defaults. Fuera del bloque que
   declara esos defaults, una regla de la misma plantilla no debe repetir
   literalmente uno de esos colores: debe consumir var(--token). */
const paletteByClass=new Map();
for(const theme of themes){
  const match=css.match(new RegExp(`\\.${theme.className}\\s*\\{([^}]*)\\}`));
  assert.ok(match,`Falta el bloque base de ${theme.id}.`);
  const values=new Map();
  for(const found of match[1].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-f]{6})/gi))values.set(found[2].toLowerCase(),found[1]);
  paletteByClass.set(theme.className,values);
}
let leakedLiteralCount=0;
for(const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  const selector=rule[1],body=rule[2];
  if(body.includes("--bg:")||selector.includes(".opening-"))continue;
  const classes=[...selector.matchAll(/\.((?:theme-)[\w-]+)/g)].map(item=>item[1]).filter(item=>paletteByClass.has(item));
  if(!classes.length)continue;
  for(const literal of body.matchAll(/#[0-9a-f]{6}(?:[0-9a-f]{2})?/gi)){
    const rgb=literal[0].slice(0,7).toLowerCase();
    const tokens=new Set(classes.map(cls=>paletteByClass.get(cls).get(rgb)));
    if(tokens.size===1&&!tokens.has(undefined))leakedLiteralCount++;
  }
}
assert.equal(leakedLiteralCount,0,"Las reglas visuales de plantilla no deben fijar nuevamente sus tokens de paleta.");

const designs=loadThemeDesigns(themes,path.join(root,"public/styles.css"));
for(const theme of themes){
  const base=designs.get(theme.id).palette;
  const coordinated=ensureAccessiblePalette({...base,...designTokens(custom)});
  assert.equal(coordinated.bg,custom.outerColor,`${theme.id}: fondo no heredó el sobre.`);
  assert.equal(coordinated.paper,custom.cardColor,`${theme.id}: papel no heredó la tarjeta.`);
  assert.equal(coordinated.accent,custom.sealColor,`${theme.id}: acento no heredó el lacre.`);
  assert.equal(coordinated.gold,custom.ornamentColor,`${theme.id}: ornamento no heredó el sobre.`);
  assert.ok(contrastRatio(coordinated.ink,coordinated.paper)>=4.5,`${theme.id}: contraste WCAG insuficiente.`);
}

const album=read("public/album.js");
assert.match(album,/const palette=settings\._palette\|\|\{\}/);
assert.match(album,/document\.body\.style\.setProperty\(`--\$\{cssKey\}`/);

const server=read("src/server.js");
assert.match(server,/const merged=stationeryLinked\s*\? \{\.\.\.manualBase,\.\.\.stationeryDesignTokens\(stationery\)\}\s*:manualBase;/s);
assert.doesNotMatch(server,/applyOpeningCoordination\(manualBase,settings\)/);
assert.match(server,/if\(stationeryIsAuthoritative\(settings,stationery\)\)return themeDescriptor\(settings\)\.palette;/);
assert.match(server,/function drawPhysicalInvitation[\s\S]*?const palette=descriptor\.palette;/);
assert.match(server,/function drawQrCard[\s\S]*?const palette=qrPalette\(settings\);/);
assert.match(server,/_palette:themeDescriptor\(settings\)\.palette/);
assert.match(server,/_surfaceTexture:themeDescriptor\(settings\)\.texture/);

console.log(`✓ RC30: nombre de tarjeta, lacre único y sincronización total del sobre en ${themes.length} plantillas; aperturas independientes conservan defaults.`);
