"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const themes=require("../config/themes.json");
const experiences=require("../config/experiences.json");
const {loadThemeDesigns,contrastRatio}=require("../src/theme-design");

const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const styles=read("public/styles.css"),rendererSource=read("public/experience-renderers.js"),app=read("public/app.js"),admin=read("public/admin.js"),server=read("src/server.js"),index=read("public/index.html"),adminHtml=read("public/admin.html");

assert.equal((styles.match(/\{/g)||[]).length,(styles.match(/\}/g)||[]).length,"El CSS debe conservar sus bloques balanceados.");
const original=experiences.openings.find(item=>item.id==="night-flower-original");assert.ok(original);assert.equal(original.renderer,"OriginalNightFlowerScene");assert.equal(original.colorControl,"floralPetalColor");
for(const id of ["newspaper-fold","vintage-parchment","olive-universe-orbit","olive-nectar-seal","blue-aurora-reveal","botanical-cosmos-orbit"]){const opening=experiences.openings.find(item=>item.id===id);assert.ok(opening,`Falta ${id}.`);assert.equal(opening.renderer,"css");assert.match(styles,new RegExp(`\\.opening-${id}`));}
for(const id of ["wedding-gazette","vintage-parchment","sage-photo-editorial","olive-universe","olive-nectar","blue-breeze-aurora","botanical-cosmos"]){assert.ok(themes.some(theme=>theme.id===id),`Falta la plantilla ${id}.`);}
/* El add-on no cambia la semántica de música/click que caracteriza a la base funcional. */
assert.equal((app.match(/if\(playMusic\)void playOpeningMusic\(\);/g)||[]).length,2,"El add-on no debe convertir la reproducción musical en un await bloqueante.");
assert.doesNotMatch(app,/if\(playMusic\)await playOpeningMusic\(\);/);
assert.match(rendererSource,/class OriginalNightFlowerScene/);assert.match(rendererSource,/petalIndex<4/);assert.match(rendererSource,/OriginalNightFlowerScene\}\);/);assert.match(styles,/\.opening-night-flower-original/);assert.match(styles,/\.original-night-flower-scene\.bloomed \.original-petals i/);
assert.match(app,/'night-flower-original':\{replay:6800,normal:6200\}/);assert.match(admin,/\[\.\.\.floralOpeningsRc19,'night-flower-original'\]/);

/* La capa del sobre conserva el orden aprobado de RC13; sólo cambia la cadencia. */
const layerOrder=["opening-envelope-back","opening-card","opening-flap","opening-envelope-front","opening-seal"].map(value=>index.indexOf(value));
assert.ok(layerOrder.every((value,indexValue)=>value>=0&&(indexValue===0||value>layerOrder[indexValue-1])),"Las capas del sobre cambiaron de orden.");
for(const style of ["wax-envelope","floral-envelope","minimal-envelope","cinematic-fold","ivory-seal"]){
  const timing=new RegExp(`'${style}':\\{replay:(\\d+),normal:(\\d+)\\}`).exec(app);assert.ok(timing,style);assert.ok(Number(timing[2])>=3500,`${style} volvió a una salida imperceptible.`);
}

/* El cálculo del corazón usa rectángulos reales para reservar el intervalo
   entre copy y acción, tanto en escritorio como en teléfono. */
const windowMock={matchMedia:()=>({matches:false}),devicePixelRatio:1,addEventListener(){},removeEventListener(){}};
const context={window:windowMock,navigator:{connection:{saveData:false}},document:{visibilityState:"visible",addEventListener(){},removeEventListener(){},body:{}},performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout,clearTimeout,getComputedStyle:()=>({getPropertyValue:()=>""})};
vm.createContext(context);vm.runInContext(rendererSource,context);
const {ParticleTraceScene}=windowMock.EventStudioExperiences;
for(const viewport of [{width:1365,height:724,copyBottom:242,actionTop:565},{width:390,height:844,copyBottom:205,actionTop:660}]){
  const host={querySelector(selector){return selector===".opening-copy"?{getBoundingClientRect:()=>({bottom:viewport.copyBottom})}:{getBoundingClientRect:()=>({top:viewport.actionTop})};}};
  const canvas={closest:()=>host,getBoundingClientRect:()=>({top:0,width:viewport.width,height:viewport.height}),getContext:()=>({})};
  const scene=new ParticleTraceScene(canvas);scene.width=viewport.width;scene.height=viewport.height;
  const frame=scene.measureDrawingFrame(),top=frame.centerY-frame.spread*.68,bottom=frame.centerY+frame.spread*.68;
  assert.ok(top>viewport.copyBottom,`El corazón invade el texto en ${viewport.width}px.`);assert.ok(bottom<viewport.actionTop,`El corazón invade la acción en ${viewport.width}px.`);
}

const designs=loadThemeDesigns(themes,path.join(root,"public/styles.css"));
assert.equal(designs.size,themes.length);
for(const [id,design] of designs){
  assert.ok(contrastRatio(design.palette.ink,design.palette.paper)>=4.5,`${id}: texto principal sin contraste.`);
  assert.ok(contrastRatio(design.palette.muted,design.palette.paper)>=4.5,`${id}: texto secundario sin contraste.`);
  assert.ok(contrastRatio(design.palette.accentText,design.palette.paper)>=4.5,`${id}: acento textual sin contraste.`);
}

function assertUniqueIds(html,label){const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length,`${label} contiene IDs repetidos.`);}
assertUniqueIds(index,"Invitación");assertUniqueIds(adminHtml,"Panel");
for(const id of ["openingEnvelopeButton","skipOpeningButton","galleryPrev","galleryNext","rsvpForm","musicBtn","spotifyMusicBtn"]){assert.ok(index.includes(`id="${id}"`));assert.ok(app.includes(`$('${id}')`),`${id} no está enlazado en app.js.`);}
for(const id of ["previewOpeningBtn","storePreviewReplay","simulateCartBtn","phonePreviewBtn","saveOpeningStyleBtn"]){assert.ok(adminHtml.includes(`id="${id}"`));assert.ok(admin.includes(`$('${id}')`),`${id} no está enlazado en admin.js.`);}
assert.match(admin,/ensureEventPreviewBaseUrl/);assert.match(admin,/replayablePreviewUrl/);assert.match(server,/function previewAccess\(/);assert.match(server,/sharedCreator/);assert.match(server,/catalogOpeningAllowed/);
for(const source of [rendererSource,app,admin,server]){assert.doesNotMatch(source,/chrome-extension:\/\//);assert.doesNotMatch(source,/addEventListener\(['"]unload['"]/);}

console.log(`✓ Contratos RC21: geometría sin solapamiento, ${themes.length} paletas, sobres, botones y previews verificados`);
