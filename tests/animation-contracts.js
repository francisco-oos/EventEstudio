"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const catalog=require(path.join(root,"config","experiences.json"));
const rendererSource=read("public/experience-renderers.js");
const styles=read("public/styles.css");
const app=read("public/app.js");
const commerce=read("src/commerce-schema.js");

// Ejecuta el runtime real con preferencias simuladas. Los renderers sólo crean
// DOM al llamar start(), por lo que esta prueba no necesita un navegador.
let reduced=false;
const windowMock={
  matchMedia:()=>({matches:reduced}),devicePixelRatio:1,
  addEventListener(){},removeEventListener(){}
};
const context={
  window:windowMock,navigator:{connection:{saveData:false}},
  document:{visibilityState:"visible",addEventListener(){},removeEventListener(){},body:{}},
  performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},
  setTimeout,clearTimeout,getComputedStyle:()=>({getPropertyValue:()=>""})
};
vm.createContext(context);
vm.runInContext(rendererSource,context,{filename:"experience-renderers.js"});
const {MotionRuntime}=windowMock.EventStudioExperiences;

const expectedDurations={still:0,subtle:1200,balanced:1080,dynamic:980};
for(const [level,duration] of Object.entries(expectedDurations)){
  const runtime=new MotionRuntime({motionLevel:level});
  assert.equal(runtime.duration(1000),duration,`Duración perceptible incorrecta en ${level}.`);
}
reduced=true;
assert.equal(new MotionRuntime({motionLevel:"dynamic"}).animated,false,"La experiencia pública debe respetar movimiento reducido.");
assert.equal(new MotionRuntime({motionLevel:"dynamic",forceMotion:true}).animated,true,"La vista previa explícita debe poder mostrar movimiento aun si Windows lo reduce.");
assert.equal(new MotionRuntime({motionLevel:"still",forceMotion:true}).duration(1000),1080,"Forzar una vista still debe aplicar una cadencia visible, no una animación de 1 ms.");
reduced=false;

assert.deepEqual(catalog.motionLevels.map(item=>item.id),["still","subtle","balanced","dynamic"]);
assert.equal(new Set(catalog.openings.map(item=>item.id)).size,catalog.openings.length,"No puede haber aperturas duplicadas.");

for(const opening of catalog.openings){
  if(opening.id==="none"||opening.retired)continue;
  if(opening.renderer==="css"){
    assert.ok(styles.includes(`.opening-${opening.id}`),`Falta presentación CSS para ${opening.id}.`);
  }
  if(opening.renderer!=="css"&&opening.renderer!=="StationeryEngine"){
    assert.ok(app.includes(`'${opening.id}'`),`app.js no inicializa ${opening.id}.`);
    assert.ok(rendererSource.includes(`class ${opening.renderer}`),`Falta renderer ${opening.renderer}.`);
    assert.ok(rendererSource.includes(opening.renderer),`No se exporta ${opening.renderer}.`);
  }
  if(opening.commercial){
    assert.ok(opening.productCode&&commerce.includes(`code:"${opening.productCode}"`),`Falta producto de ${opening.id}.`);
    assert.ok(opening.grant&&commerce.includes(opening.grant),`Falta concesión de ${opening.id}.`);
  }
}

assert.match(rendererSource,/for\(let i=0;i<16;i\+\+\)/,"La margarita debe conservar 16 pétalos.");
assert.match(rendererSource,/petals:14[\s\S]*petals:12[\s\S]*petals:12/,"El jardín debe conservar tres flores y 38 pétalos.");
assert.match(rendererSource,/for\(let index=0;index<18;index\+\+\)/,"El jardín debe conservar 18 estrellas.");
assert.match(rendererSource,/for\(let index=0;index<12;index\+\+\)/,"El jardín debe conservar 12 luces.");
assert.match(rendererSource,/class OriginalNightFlowerScene/,"Falta el renderer de la flor original.");
assert.match(rendererSource,/petalIndex<4/,"Cada flor original debe conservar exactamente cuatro pétalos.");
assert.match(rendererSource,/\{x:50,scale:1[\s\S]*\{x:35,scale:\.78[\s\S]*\{x:66,scale:\.84/,"La escena original debe conservar sus tres flores.");

const center=styles.match(/\.daisy-center\{[^}]*width:(\d+)px;height:(\d+)px/);
const bloom=styles.match(/\.daisy-bloom-scene\.bloomed \.daisy-petals i\{[^}]*translateY\(-([\d.]+)px\)/);
assert.ok(center&&bloom,"No se pudo verificar la geometría de la margarita.");
assert.equal(center[1],center[2],"El centro de la margarita debe ser circular.");
assert.ok(Number(center[1])/2-Number(bloom[1])>=10,"El centro debe solapar visualmente los pétalos al menos 10 px.");

assert.match(styles,/@media\(max-width:760px\)\{[^}]*\.daisy-plant\{transform:scale\(\.78\)/);
assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(styles,/\.daisy-bloom-scene\.force-motion/);
assert.match(styles,/\.luminous-garden-scene\.force-motion/);
assert.match(styles,/\.original-night-flower-scene\.force-motion/);
assert.match(styles,/body\.force-motion-preview/);
assert.match(styles,/\.opening-skip-button/);

for(const style of ["rose-bloom","daisy-bloom","luminous-garden","night-flower-original"]){
  const timing=new RegExp(`'${style}':\\{replay:(\\d+),normal:(\\d+)\\}`).exec(app);
  assert.ok(timing,`Falta temporización visible para ${style}.`);
  assert.ok(Number(timing[1])>=4300&&Number(timing[2])>=3900,`${style} termina demasiado rápido para ser perceptible.`);
}

for(const [style,minimum] of Object.entries({
  "unified-envelope":4200,"newspaper-fold":4300,"vintage-parchment":4500,
  "olive-universe-orbit":4600,"blue-aurora-reveal":4400,"botanical-cosmos-orbit":4700,
  "gala-curtain":4500,"constellation-veil":4700,"reserve-uncork":4600,"particle-heart":3700
})){
  const timing=new RegExp(`'${style}':\\{replay:(\\d+),normal:(\\d+)\\}`).exec(app);
  assert.ok(timing,`Falta temporización legible para ${style}.`);
  assert.ok(Number(timing[2])>=minimum,`${style} termina antes de ser perceptible.`);
  assert.ok(Number(timing[1])>=Number(timing[2]),`${style} no puede acelerar durante replay.`);
}
assert.match(read("public/stationery-engine.css"),/\.opening-unified-envelope/);
for(const style of ["newspaper-fold","vintage-parchment","olive-universe-orbit","blue-aurora-reveal","botanical-cosmos-orbit","gala-curtain","constellation-veil","reserve-uncork"]){
  assert.match(styles,new RegExp(`opening-${style}\\.is-opening|opening-${style}\\.is-opening`),`${style} no define su estado de apertura.`);
}
assert.match(styles,/body\.force-motion-preview \.opening-olive-universe-orbit/);
assert.match(styles,/body\[data-motion="still"\]:not\(\.force-motion-preview\)[\s\S]*opening-botanical-cosmos-orbit/);
assert.match(styles,/data-seal-preset="frosted"|\[data-seal-preset="frosted"\]/);
assert.match(styles,/\.opening-seal \.seal-monogram/);

console.log("✓ Contratos de animación, accesibilidad y geometría verificados");
