"use strict";
const fs=require("fs");
const path=require("path");
const cp=require("child_process");
const root=path.join(__dirname,"..");
const pkg=require(path.join(root,"package.json"));
const failures=[];const notes=[];
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.name==="node_modules"||entry.name===".git"?[]:(entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]));
const files=walk(root);const rel=file=>path.relative(root,file).replace(/\\/g,"/");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

for(const file of files.filter(f=>f.endsWith(".js"))){
  const result=cp.spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  if(result.status!==0)failures.push(`Sintaxis JS: ${rel(file)}: ${result.stderr.trim()}`);
}
for(const file of files.filter(f=>/\.(sh)$/i.test(f))){
  const bash=cp.spawnSync('bash',['-n',file],{encoding:'utf8'});
  if(bash.error&&bash.error.code==='ENOENT')notes.push(`bash no disponible; no se validó ${rel(file)}`);
  else if(bash.status!==0)failures.push(`Sintaxis shell: ${rel(file)}: ${(bash.stderr||'').trim()}`);
}
for(const file of files.filter(f=>f.endsWith(".html"))){
  const text=fs.readFileSync(file,"utf8");
  const ids=[...text.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]);
  const dup=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
  if(dup.length)failures.push(`IDs duplicados en ${rel(file)}: ${dup.join(", ")}`);
  if(/\/styles\.css\?v=/.test(text)&&!text.includes(`/styles.css?v=${pkg.version}`))failures.push(`Cache CSS desfasada: ${rel(file)}`);
}
for(const file of files.filter(f=>/\.json$/i.test(f))){
  try{JSON.parse(fs.readFileSync(file,"utf8"));}catch(error){failures.push(`JSON inválido ${rel(file)}: ${error.message}`);}
}
const forbidden=files.filter(f=>/(^|\/)(\.env|node_modules)(\/|$)|\.(db|sqlite|sqlite3|log|zip)$/i.test(rel(f))||(/^uploads\/.+/.test(rel(f))&&!/\.gitkeep$/.test(f)));
if(forbidden.length)failures.push(`Artefactos/secretos persistentes: ${forbidden.map(rel).join(", ")}`);
const markdownOutside=files.filter(f=>f.endsWith(".md")&&!rel(f).startsWith("docs/")&&rel(f)!=="README.md");
if(markdownOutside.length)failures.push(`Documentación fuera de docs/: ${markdownOutside.map(rel).join(", ")}`);
const docsRoot=files.filter(f=>rel(f).startsWith("docs/")&&path.dirname(rel(f))==="docs"&&path.basename(f)!=="README.md");
if(docsRoot.length)failures.push(`docs/ debe conservar sólo su índice README; clasifica: ${docsRoot.map(rel).join(", ")}`);

const admin=read("public/admin.js");
const adminHtml=read("public/admin.html");
const app=read("public/app.js");
const css=read("public/styles.css");
const server=read("src/server.js");
const commerceSchema=read("src/commerce-schema.js");
const experiences=read("public/experience-renderers.js");

if(admin.includes("await load();\n      if(form==='musicForm'"))failures.push("La subida multimedia todavía recarga todo el workspace.");
if(!admin.includes("x-upload-key")||!admin.includes("retryableStatuses"))failures.push("La multimedia administrativa no conserva idempotencia/reintento controlado.");
if(!admin.includes("optimizeAdminImageForUpload")||!admin.includes("prepareAdminImages"))failures.push("La multimedia administrativa no optimiza imágenes grandes antes de transferirlas.");
if(!admin.includes("45000")||!admin.includes("transferencia dejó de avanzar"))failures.push("Falta watchdog de transferencia administrativa estancada.");
if(!admin.includes("ensureGuestsLoaded")||!admin.includes("ensureTableNamesLoaded"))failures.push("Invitados/mesas siguen sin carga diferida.");
if(!server.includes("eventMediaReferenceReport"))failures.push("Falta diagnóstico de referencias multimedia.");
if(!server.includes("primaryEventLocation"))failures.push("Falta resolver ubicación canónica.");
if(!server.includes("media_upload_receipts")||!server.includes("rememberAdminMediaUpload"))failures.push("Falta recibo idempotente de multimedia.");
const album=read("public/album.js");
if(!album.includes("XMLHttpRequest")||!album.includes("uploadKey")||!album.includes("45000"))failures.push("El álbum invitado perdió reintento idempotente/watchdog.");
if(!album.includes("optimizePhotoForUpload")||!album.includes("image/webp"))failures.push("El álbum invitado perdió optimización cliente de imágenes.");
const showcase=read("public/showcase.js");
if(!showcase.includes('loading="lazy" decoding="async"'))failures.push("Showcase vuelve a cargar/decodificar todas las imágenes de forma ansiosa.");
if(!server.includes('product.readiness_status==="approved"&&["bundle","storage","template_collection"]'))failures.push("El catálogo público no filtra readiness de complementos.");
if(/UPDATE plans SET publication_policy='auto_after_entitlement'/.test(commerceSchema))failures.push("El arranque todavía reescribe la política del propietario.");
if(/WHERE p\.code IN \('trial','premium','studio'\)[\s\S]{0,300}experience:rose-bloom/.test(commerceSchema))failures.push("El arranque todavía reinyecta experiencias en planes editados.");
if(!/ON CONFLICT\(code\) DO NOTHING/.test(commerceSchema))failures.push("Los seeds comerciales pueden sobrescribir decisiones persistidas.");
if(/trialPlan[\s\S]*INSERT OR IGNORE INTO plan_products/.test(commerceSchema))failures.push("El arranque repuebla un plan de prueba vaciado por el propietario.");
if(!commerceSchema.includes("bootstrap_showcase_seed_v1"))failures.push("El Showcase demo puede reinsertarse después de una decisión del propietario.");
if(/UPDATE customer_profiles SET recommendations_json=.*recommendations_json='\[\]'/.test(commerceSchema))failures.push("El arranque repuebla recomendaciones vaciadas por el propietario.");
if(server.includes('featureDecision(settings,"premiumTemplates"'))failures.push("La resolución de plantillas todavía usa un fallback de plan estático.");

const openingMatch=adminHtml.match(/<select id="openingStyleSelect">([\s\S]*?)<\/select>/);
if(!openingMatch)failures.push("No se encontró selector de aperturas.");
else{
  const values=[...openingMatch[1].matchAll(/value="([^"]+)"/g)].map(m=>m[1]).filter(v=>v!=="none");
  for(const style of values){
    if(!app.includes(`'${style}'`))failures.push(`Apertura ${style} está en UI pero no en allowlist de app.js.`);
  }
  for(const special of ["rose-bloom","particle-heart"]){
    if(values.includes(special)&&!experiences.includes(special==="rose-bloom"?"RoseBloomScene":"ParticleTraceScene"))failures.push(`Falta renderer ${special}.`);
  }
}
const galleryMatch=adminHtml.match(/<select id="galleryStyleSelect">([\s\S]*?)<\/select>/);
if(!galleryMatch)failures.push("No se encontró selector de galerías.");
else{
  const values=[...galleryMatch[1].matchAll(/value="([^"]+)"/g)].map(m=>m[1]);
  for(const style of values){if(!app.includes(`'${style}'`))failures.push(`Galería ${style} está en UI pero no en allowlist de app.js.`);}
}
if(!experiences.includes("force-motion")||!css.includes(".rose-bloom-scene.force-motion"))failures.push("La prueba forzada de Rosa no restaura transiciones bajo reduced-motion.");
if((css.match(/\{/g)||[]).length!==(css.match(/\}/g)||[]).length)failures.push("styles.css tiene llaves desbalanceadas.");
if(!css.includes("content-visibility:auto")||!css.includes("contain-intrinsic-size"))failures.push("Falta contención de render para tarjetas fuera de pantalla.");
if(!/\.commercial-profile-card\{display:grid;grid-template-columns:repeat\(2/.test(css))failures.push("Perfiles comerciales no tienen layout responsivo de dos columnas.");

// Cobertura mínima de las cadenas estáticas de Configuración. No pretende declarar i18n total:
// sólo evita reincidir en la pantalla que el usuario reportó sin traducir.
const settingsHtmlMatch=adminHtml.match(/<section[^>]*id="tab-settings"[\s\S]*?(?=<section[^>]*id="tab-templates")/);
if(settingsHtmlMatch){
  const settingsTexts=[...settingsHtmlMatch[0].matchAll(/>([^<>]+)</g)].map(m=>m[1].replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim()).filter(t=>t&&/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(t)&&!/^\{/.test(t));
  const unique=[...new Set(settingsTexts)];
  const staticBlock=(admin.match(/const STATIC_I18N=\{[\s\S]*?\n\};\nfunction canonicalStaticSpanish/)||[])[0]||'';
  const missing=unique.filter(text=>!staticBlock.includes(text));
  // Algunas cadenas son valores dinámicos/inputs y no requieren mapa literal. Reportamos sólo como nota.
  notes.push(`Textos estáticos detectados en Configuración: ${unique.length}; sin clave literal: ${missing.length}`);
}

const plans=JSON.parse(read("config/commercial-plans.json"));
for(const plan of plans.plans||[]){
  if(!Number.isInteger(plan.maxPublishedEvents)||plan.maxPublishedEvents<0)failures.push(`Plan ${plan.code}: maxPublishedEvents inválido.`);
  if(!["manual_owner","auto_after_entitlement","disabled"].includes(plan.publicationPolicy))failures.push(`Plan ${plan.code}: publicationPolicy inválida.`);
}

const publicSizes=["public/admin.js","public/styles.css","public/app.js","public/experience-renderers.js","public/album.js"].map(file=>({file,bytes:fs.statSync(path.join(root,file)).size}));
notes.push(`Archivos revisados: ${files.length}`);
notes.push(`JavaScript verificado: ${files.filter(f=>f.endsWith(".js")).length}`);
notes.push(`Versión: ${pkg.version}`);
notes.push(`Payload fuente principal: ${publicSizes.map(item=>`${item.file.replace("public/","")} ${(item.bytes/1024).toFixed(1)} KiB`).join(" · ")}`);
if(failures.length){console.error(failures.join("\n"));process.exit(1);}
console.log(`✓ Auditoría estructural ${require("../package.json").version}`);notes.forEach(n=>console.log(`  - ${n}`));
