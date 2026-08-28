"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const packageJson=JSON.parse(read("package.json"));
const {numberSetting}=require("../src/config");
const {featureDecision}=require("../src/features");
const {
  REQUIRED_PALETTE_KEYS,
  loadThemeDesigns,
  printFamilyFor
}=require("../src/theme-design");

assert.equal(packageJson.name,"eventstudio");
assert.match(packageJson.version,/^6\.14\.2-rc\.\d+(?:\.\d+)?$/);
assert.equal(packageJson.private,true);
assert.equal(packageJson.scripts.local,"node scripts/iniciar-local.js");

const previousNumericTest=process.env.EVENTSTUDIO_NUMERIC_TEST;
process.env.EVENTSTUDIO_NUMERIC_TEST="sin-limite-valido";
assert.throws(()=>numberSetting("EVENTSTUDIO_NUMERIC_TEST",10,{min:1,max:20}),/número válido/);
if(previousNumericTest===undefined)delete process.env.EVENTSTUDIO_NUMERIC_TEST;
else process.env.EVENTSTUDIO_NUMERIC_TEST=previousNumericTest;

for(const relative of [
  "INICIAR.bat",
  "iniciar_linux.sh",
  "scripts/iniciar-local.js",
  "GUIA_PRUEBA_MOVIL_LOCAL.md",
  "RELEASE_NOTES_V6_14_2_RC10.md",
  "VALIDACION_RC10.md",
  "RELEASE_NOTES_V6_14_2_RC11.md",
  "VALIDACION_RC11.md",
  "AUDITORIA_RC11.md",
  "RELEASE_NOTES_V6_14_2_RC12.md",
  "VALIDACION_RC12.md",
  "AUDITORIA_RC12.md",
  "docs/INDEX_DOCUMENTACION_RC12.md",
  "docs/MATRIZ_TRAZABILIDAD_RC12.md",
  "docs/ANALISIS_REFERENCIAS_Y_COMPETENCIA_RC12.md",
  "RELEASE_NOTES_V6_14_2_RC13.md",
  "VALIDACION_RC13.md",
  "AUDITORIA_RC13.md",
  "docs/INDEX_DOCUMENTACION_RC13.md",
  "docs/MATRIZ_TRAZABILIDAD_RC13.md",
  "docs/ARQUITECTURA_COMERCIAL_RC13.md",
  "docs/DAISY_ATELIER_RC13.md",
  "docs/PUBLICACION_Y_PERFILES_RC13.md",
  "docs/ANALITICA_CONVERSION_RC13.md",
  "docs/PREVIEW_MULTIDISPOSITIVO_RC13.md",
  "docs/RSVP_SEATING_RC13.md",
  "docs/SHOWCASE_RC13.md",
  "docs/REFERENCIAS_TECNICAS_RC13.md",
  "RELEASE_NOTES_V6_14_2_RC14.md",
  "VALIDACION_RC14.md",
  "AUDITORIA_RC14.md",
  "docs/INDEX_DOCUMENTACION_RC14.md",
  "docs/MATRIZ_TRAZABILIDAD_RC14.md",
  "docs/DECISION_UI_PLAN_EXTRAS_RC14.md",
  "docs/SEGURIDAD_Y_REGRESIONES_RC14.md",
  "docs/CIERRE_INVITACION_RC14.md",
  "tests/rc14-regressions.js",
  "RELEASE_NOTES_V6_14_2_RC15.md",
  "VALIDACION_RC15.md",
  "AUDITORIA_RC15.md",
  "docs/INDEX_DOCUMENTACION_RC15.md",
  "docs/MATRIZ_TRAZABILIDAD_RC15.md",
  "docs/ANALISIS_ANIMACIONES_GALERIA_Y_ROSA_RC15.md",
  "docs/FOTOS_REANUDABLES_UPPY_TUS_RC15.md",
  "docs/KONVA_SEATING_LAB_RC15.md",
  "docs/labs/konva-seating/index.html",
  "docs/labs/konva-seating/README.md",
  "docs/PAGINA_PUBLICIDAD_Y_SHOWCASE_RC15.md",
  "docs/EFECTOS_IMAGEN_RC15.md",
  "docs/I18N_RC15.md",
  "tests/rc15-regressions.js",
  "public/showcase.html",
  "public/showcase.js",
  "public/sandbox.html",
  "public/sandbox.js",
  "public/experience-renderers.js",
  "public/assets/daisy-paper-orbit.svg",
  "public/assets/daisy-meadow-air.svg",
  "public/assets/daisy-editorial-light.svg",
  "public/assets/daisy-shadow-studio.svg",
  "docs/BENCHMARK_PRODUCTO_2026.md",
  "docs/ANALISIS_COMPETENCIA_RC7.md",
  "docs/ANALISIS_PRODUCTO_TEMATICO_RC8.md",
  "src/config.js",
  "src/commerce.js",
  "src/commerce-schema.js",
  "src/media-validation.js",
  "src/theme-design.js",
  ".github/workflows/ci.yml",
  ".gitignore",
  ".dockerignore"
]){
  const direct=path.join(root,relative);
  const basename=path.basename(relative);
  const findByBasename=dir=>fs.readdirSync(dir,{withFileTypes:true}).some(entry=>entry.isDirectory()?findByBasename(path.join(dir,entry.name)):entry.name===basename);
  const exists=fs.existsSync(direct)||(relative.endsWith('.md')&&fs.existsSync(path.join(root,'docs'))&&findByBasename(path.join(root,'docs')));
  assert.ok(exists,`Falta ${relative}`);
}
assert.equal(fs.existsSync(path.join(root,".env")),false,"La entrega limpia no debe incluir .env.");
const gitignore=read(".gitignore");
for(const ignored of [".env","node_modules/","data/*","uploads/*","backups/","*.db-wal","*.db-shm"]){
  assert.ok(gitignore.includes(ignored),`.gitignore debe excluir ${ignored}`);
}

const publicCopy=[
  read("public/admin.html"),
  read("public/index.html"),
  read("public/album.html"),
  read("public/catalogo.html"),
  read("public/muestra.html"),
  read("public/app.js"),
  read("public/album.js"),
  read("public/catalogo.js")
  ,read("public/muestra.js")
].join("\n");
assert.ok(!publicCopy.includes("Event Studio"),"La marca visible debe escribirse EventStudio.");
assert.ok(!read("public/album.html").includes("Álbum de la boda"),"El álbum debe ser neutral para cualquier evento.");
assert.ok(!read("public/index.html").includes("mensaje para los novios"),"El RSVP no debe asumir que el evento es una boda.");
assert.ok(!read("public/app.js").includes("Fotografía de la pareja"),"La galería no debe asumir que existe una pareja.");
assert.ok(
  read("src/server.js").includes('"upgrade-insecure-requests":IS_PRODUCTION?[]:null'),
  "HTTP local debe conservar CSS y JavaScript; producción debe continuar forzando HTTPS."
);
assert.ok(
  read("src/server.js").includes('req.path.startsWith("/api/config")'),
  "La configuración pública debe impedir respuestas obsoletas de caché."
);
for(const file of ["public/index.html","public/admin.html","public/album.html","public/catalogo.html","public/muestra.html","public/showcase.html","public/sandbox.html"]){
  assert.ok(read(file).includes(`styles.css?v=${packageJson.version}`),`${file} debe invalidar la caché del CSS.`);
}
assert.ok(read("public/index.html").includes(`app.js?v=${packageJson.version}`));
assert.ok(read("public/admin.html").includes(`admin.js?v=${packageJson.version}`));
assert.ok(read("public/album.html").includes(`album.js?v=${packageJson.version}`));
assert.ok(read("public/catalogo.html").includes(`catalogo.js?v=${packageJson.version}`));
assert.ok(read("public/muestra.html").includes(`muestra.js?v=${packageJson.version}`));
assert.ok(read("public/showcase.html").includes(`showcase.js?v=${packageJson.version}`));
assert.ok(read("public/sandbox.html").includes(`sandbox.js?v=${packageJson.version}`));

const server=read("src/server.js");
assert.match(server,/app\.listen\(PORT,HOST,/);
assert.match(server,/const HOST=/);
assert.match(server,/function mutationOriginAllowed/);
assert.ok(!server.includes('FAMILIA:"Familia Hernández"'),"La plantilla vacía no debe incluir datos de ejemplo estáticos.");
assert.ok(!server.includes("Con mucha emoción queremos compartirles"),"WhatsApp no debe asumir que todos los eventos son bodas.");
assert.match(server,/gallery:Array\.isArray\(current\.gallery\)\?current\.gallery:\[\]/);
assert.match(read("public/app.js"),/src="\$\{esc\(u\)\}"/);
assert.ok(/<button[^>]*id="googleLoginBtn"[^>]*class="google-btn hidden"|<button[^>]*class="google-btn hidden"[^>]*id="googleLoginBtn"/.test(read("public/admin.html")));
assert.match(read("src/seed.js"),/Seed cancelado: la base ya contiene/);
assert.match(read("src/db.js"),/eventstudio-pre-migration-v1/);

const routePattern=/app\.(get|post|put|patch|delete)\((['"`])([^'"`]+)\2,([^\n]+)/g;
const routes=[];
let routeMatch;
while((routeMatch=routePattern.exec(server))){
  routes.push({method:routeMatch[1].toUpperCase(),path:routeMatch[3],tail:routeMatch[4]});
}
const adminWithoutAuthentication=routes.filter(route=>route.path.startsWith("/api/admin/")&&!route.tail.includes("authRequired"));
assert.deepEqual(adminWithoutAuthentication,[],"Toda ruta administrativa debe exigir autenticación.");
const routeKeys=routes.map(route=>`${route.method} ${route.path}`);
assert.equal(new Set(routeKeys).size,routeKeys.length,"No debe haber rutas HTTP duplicadas.");

const forbiddenRuntimeLiterals=/Francisco|Ariana|Comalcalco|owner@eventstudio\.local|client@eventstudio\.local|Cambiar123!/i;
for(const relative of ["src/server.js","src/db.js","public/admin.js","public/app.js","public/album.js","public/catalogo.js","public/catalogo.html","public/muestra.js","public/muestra.html","config/default-settings.json"]){
  assert.doesNotMatch(read(relative),forbiddenRuntimeLiterals,`${relative} contiene datos personales o demo en ejecución.`);
}

function storedFiles(directory){
  if(!fs.existsSync(directory))return [];
  const entries=[];
  for(const item of fs.readdirSync(directory,{withFileTypes:true})){
    const itemPath=path.join(directory,item.name);
    if(item.isDirectory())entries.push(...storedFiles(itemPath));
    else if(item.name!==".gitkeep")entries.push(itemPath);
  }
  return entries;
}

for(const relative of ["data","uploads"]){
  assert.deepEqual(storedFiles(path.join(root,relative)),[],`${relative} debe estar vacío en la entrega.`);
}

for(const relative of ["config/default-settings.json","config/event-types.json","config/qr-templates.json","config/themes.json","config/commercial-plans.json","railway.json"]){
  assert.doesNotThrow(()=>JSON.parse(read(relative)),`${relative} no contiene JSON válido`);
}

const commercialPlans=JSON.parse(read("config/commercial-plans.json"));
assert.deepEqual(commercialPlans.plans.filter(plan=>plan.public).map(plan=>plan.code),["express","starter","basic","premium"]);
assert.equal(commercialPlans.plans.find(plan=>plan.code==="premium").includesAllAvailable,true);
assert.ok(commercialPlans.addons.some(addon=>addon.key==="premiumTemplates"));
assert.ok(!commercialPlans.addons.some(addon=>["thematicExperience","music","gallery"].includes(addon.key)),"Las funciones base no deben repetirse como complementos.");
for(const plan of commercialPlans.plans.filter(plan=>plan.public)){
  for(const feature of ["invitation","templates","music","gallery","thematicExperience"]){
    assert.ok(plan.includesAllAvailable||plan.included.includes(feature),`${plan.code} debe conservar ${feature}.`);
  }
}
const defaultSettings=JSON.parse(read("config/default-settings.json"));
assert.equal(featureDecision(defaultSettings,"thematicExperience",{role:"client",planCode:"express"}).allowed,true);
assert.equal(featureDecision(defaultSettings,"music",{role:"client",planCode:"express"}).allowed,true);
assert.equal(featureDecision(defaultSettings,"gallery",{role:"client",planCode:"express"}).allowed,true);
assert.equal(featureDecision(defaultSettings,"rsvp",{role:"client",planCode:"express"}).allowed,false);
assert.equal(featureDecision(defaultSettings,"rsvp",{role:"client",planCode:"starter"}).allowed,true);
const eventTypes=JSON.parse(read("config/event-types.json"));
assert.ok(eventTypes.some(type=>type.id==="baby-shower"));
assert.ok(eventTypes.some(type=>type.id==="gender-reveal"));
for(const expected of ["kids-party","anniversary","baptism","first-communion"]){
  assert.ok(eventTypes.some(type=>type.id===expected),`Falta el tipo de evento ${expected}.`);
}
const themes=JSON.parse(read("config/themes.json"));
assert.equal(themes.length,59,"La base conserva 52 plantillas y el add-on suma 7 sin sustituir ninguna.");
assert.equal(new Set(themes.map(theme=>theme.id)).size,themes.length,"Las plantillas deben tener identificadores únicos.");
const themeDesigns=loadThemeDesigns(themes,path.join(root,"public","styles.css"));
assert.equal(themeDesigns.size,themes.length,"Cada plantilla debe tener una paleta de impresión derivada de su CSS.");
for(const [themeId,design] of themeDesigns){
  for(const key of [...REQUIRED_PALETTE_KEYS,"accentText","accentContrast","bgContrast"])assert.ok(design.palette[key],`${themeId} no tiene ${key} en su paleta efectiva.`);
  assert.ok(["cinematic","storybook","lavender","botanical","playful","editorial"].includes(printFamilyFor(design.theme)),`${themeId} no tiene familia de impresión.`);
}
const publicApp=read("public/app.js");
const publicStyles=read("public/styles.css");
for(const theme of themes){
  for(const key of ["layoutFamily","layoutLabel","motionPreset","motionLabel","photoStyle","photoStyleLabel","motif","defaultExperience"]){
    assert.ok(theme[key],`${theme.id} no define ${key}.`);
  }
  assert.ok(theme.eventTypes.every(type=>eventTypes.some(item=>item.id===type)),`${theme.id} referencia un tipo de evento inexistente.`);
  assert.ok(publicApp.includes(`'${theme.layoutFamily}'`),`${theme.id} usa el layout no reconocido ${theme.layoutFamily}.`);
  assert.ok(publicApp.includes(`'${theme.photoStyle}'`),`${theme.id} usa el estilo fotográfico no reconocido ${theme.photoStyle}.`);
  assert.ok(publicStyles.includes(`[data-photo-style=${theme.photoStyle}]`),`${theme.id} no tiene comportamiento CSS para ${theme.photoStyle}.`);
}
for(const id of ["destination-passport","eternal-rose","cinematic-journey","petal-letter","achievement-path","family-memories","daisy-paper-orbit","daisy-meadow-air","daisy-editorial-light","daisy-shadow-studio","wedding-gazette","vintage-parchment","sage-photo-editorial","olive-universe","olive-nectar","blue-breeze-aurora","botanical-cosmos"]){
  assert.ok(themes.some(theme=>theme.id===id),`Falta la plantilla requerida ${id}.`);
}
const protectedBrands=/Disney|Pixar|Zootopia|Toy Story|Bluey|Paw Patrol|Marvel|Nintendo/i;
assert.doesNotMatch(JSON.stringify(themes),protectedBrands,"El catálogo no debe apropiarse de personajes o franquicias protegidas.");
assert.doesNotMatch(read("public/admin.js"),/spotifySearch(Query|Results|Btn)|\/api\/admin\/spotify\/search/,"La interfaz no debe conservar la búsqueda de Spotify sin configurar.");
assert.doesNotMatch(read("src/server.js"),/SPOTIFY_CLIENT_(?:ID|SECRET)|\/api\/admin\/spotify\/search/,"No debe existir una API Spotify sin uso en RC10.");
assert.doesNotMatch(read("src/server.js"),/api\.spotify\.com/,"La política de red no debe abrir la Web API de Spotify retirada.");
assert.doesNotMatch(read("public/styles.css"),/spotify-search-(?:box|results)|\.spotify-result/,"No deben quedar estilos de la búsqueda Spotify eliminada.");
assert.doesNotMatch(read("src/server.js"),/botanical-cream|mayan-cenote|const THEME_PALETTES/,"La impresión no debe depender de temas inexistentes ni paletas duplicadas.");
assert.match(read("public/admin.js"),/qr-table-scene theme-\$\{settings\.themeId/,"La vista previa QR debe aplicar cualquier tema del catálogo.");
const commerceSchema=read("src/commerce-schema.js");
for(const table of ["product_catalog","plan_products","event_grants","promotions","promotion_products","carts","cart_items","orders","order_items","store_categories","product_category_links","customer_profiles","account_commercial_controls","platform_settings","publication_requests","conversion_events","preview_links","showcase_items"]){
  assert.match(commerceSchema,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`),`Falta la tabla comercial ${table}.`);
}
assert.match(commerceSchema,/source IN \('purchase','courtesy','promotion','legacy'\)/,"Los derechos deben conservar su origen auditable.");
assert.match(commerceSchema,/experience:rose-bloom/);
assert.match(commerceSchema,/experience:cinematic-depth/);
assert.match(commerceSchema,/experience:particle-heart/);
assert.match(read("public/experience-renderers.js"),/class ParticleTraceScene/);
assert.match(read("public/admin.html"),/id="storeSearchInput"/);
assert.match(read("public/admin.html"),/id="storePreviewFrame"/);
assert.doesNotMatch(read("public/admin.js"),/function storeCategoryFor\(/,"Las categorías de Store deben venir de datos, no de una función estática.");
assert.match(read("src/server.js"),/function publicBaseUrl\(/);
assert.match(read("src/server.js"),/function publicationAccess\(/);
assert.match(read("public/showcase.html"),/Showcase/);
assert.match(read("public/sandbox.html"),/Empieza sin registro/);
assert.match(read("src/server.js"),/VALUES\(\?,\?,'courtesy'/,"Las concesiones manuales deben registrarse como cortesía.");
assert.match(read("src/server.js"),/DESIGN_PRODUCT_REQUIRED/,"El servidor debe impedir experiencias no adquiridas.");
const experienceConfig=JSON.parse(read("config/experiences.json"));
for(const id of ["rose-bloom","particle-heart","daisy-bloom","ivory-seal","newspaper-fold","vintage-parchment","olive-universe-orbit","olive-nectar-seal","blue-aurora-reveal","botanical-cosmos-orbit"]){assert.ok(experienceConfig.openings.some(item=>item.id===id),`Falta la apertura ${id}.`);}
for(const id of ["cinematic-depth","focus-strip","editorial-masonry","memories-orbit"]){assert.ok(experienceConfig.galleries.some(item=>item.id===id),`Falta la galería ${id}.`);}
assert.match(read("src/server.js"),/status:"pending_payment"/,"El carrito no debe acreditarse antes de confirmar el pago.");
assert.match(read("public/admin.html"),/id="commerceProductGrid"/,"Mi negocio debe contener el catálogo único.");
assert.match(read("public/admin.html"),/id="commercePlanGrid"/,"Mi negocio debe contener el constructor de planes.");
assert.match(read("public/admin.html"),/id="clientCommerceDialog"/,"Debe existir un perfil comercial por cliente.");
assert.match(read("public/admin.html"),/id="clientStoreCard"/,"El cliente debe tener una tienda contextual.");
assert.doesNotMatch(read("public/admin.html"),/id="featureControlCard"|id="addonGrantGrid"/,"La configuración comercial duplicada no debe seguir en la interfaz.");
assert.match(read("public/admin.js"),/quickCreativeTypes=new Set\(\['birthday','kids-party','baby-shower','gender-reveal','custom'\]\)/,"Temática Express debe limitarse a eventos sencillos.");
assert.match(read("public/admin.js"),/Quitar de la cola/,"La cola automática debe permitir retirar una persona.");

console.log("✓ Nombre, textos multi-evento, lanzadores y configuración validados");
