"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

const pkg=JSON.parse(read("package.json"));
const server=read("src/server.js");
const admin=read("public/admin.js");
const app=read("public/app.js");
const album=read("public/album.js");
const styles=read("public/styles.css");
const commerceSchema=read("src/commerce-schema.js");
const commerce=read("src/commerce.js");
const showcase=read("public/showcase.js");
const renderers=read("public/experience-renderers.js");
const catalog=read("public/catalogo.js");

assert.match(pkg.version,/^6\.14\.2-rc\.\d+(?:\.\d+)?$/);
assert.ok(pkg.scripts["test:rc15"].includes("rc15-regressions"));

// Login móvil: una interfaz oculta no puede reaparecer por el !important del layout responsive.
assert.match(styles,/\.admin-layout\.hidden\{display:none!important\}/);
assert.match(styles,/\.admin-layout:not\(\.hidden\)/);

// Carrito: limpiar selección, no cobrar de nuevo lo ya adquirido y mostrar estado de propiedad.
assert.match(server,/app\.delete\("\/api\/store\/cart"/);
assert.match(server,/productOwnedForEvent/);
assert.match(admin,/function storeOwnershipLabel/);
assert.match(admin,/Adquirido/);
assert.match(admin,/Incluido en tu plan/);
assert.match(admin,/Probar no agrega al carrito/);
assert.doesNotMatch(admin,/filter\(product=>!product\.owned\)/);
assert.match(styles,/composer-cart-item/);

// Perfil comercial: la curación de catálogo es distinta de la seguridad y persiste en datos.
assert.match(commerceSchema,/product_profile_links/);
assert.match(commerceSchema,/catalog_mode/);
assert.match(commerce,/function productVisibleForProfile/);
assert.match(commerce,/function productOriginForEvent/);
assert.match(admin,/Sólo productos asignados/);

// Showcase: oculto/borrador no sale por API pública ni por caché del navegador.
assert.match(server,/FROM showcase_items WHERE status='published'/);
assert.match(server,/Cache-Control","no-store, max-age=0/);
assert.match(showcase,/cache:'no-store'/);

// Rosa: renderer propio de crecimiento/florecimiento y reproducción completa en preview.
assert.match(renderers,/class RoseBloomScene/);
assert.match(renderers,/bloom\(\)/);
assert.match(renderers,/rose-petal/);
assert.match(app,/start\(\{autoplay:false\}\)/);
assert.match(app,/rose-bloom-playing/);
assert.match(app,/6500/);

// Galería: gesto y presentación de tarjeta protagonista en móvil.
assert.match(app,/pointerdown/);
assert.match(app,/moveGallery\(dx<0\?1:-1\)/);
assert.match(app,/--stack-index/);
assert.match(styles,/touch-action:pan-y/);
assert.match(styles,/object-fit:cover/);

// Preview móvil: cierre visible y etiqueta de qué se está simulando.
assert.match(styles,/experience-preview-toolbar\{position:sticky!important/);
assert.match(admin,/Simulando: \$\{product\.name\}/);
assert.match(admin,/setStorePreviewDevice\(currentIsMobile\?'desktop':'phone'\)/);

// Fotos: QR firmado por mesa, moderación por estado y descarga final.
assert.match(server,/function tableQrSignature/);
assert.match(server,/mesaSig/);
assert.match(album,/tableSig/);
assert.match(server,/\/api\/admin\/photos-export\.zip/);
assert.match(server,/guestPhotoUpload/);
assert.match(admin,/photoStatusFilter/);
assert.match(admin,/Descargar selección/);

// Invitación física: lugar heredado o ubicaciones ceremonia/recepción.
assert.match(server,/physicalVenue/);
assert.match(server,/settings\.venues/);

// Analítica: nombres internos se presentan de forma humana y el catálogo público mide campañas.
assert.match(admin,/function\s*\(?humanAnalyticsValue|const humanAnalyticsValue/);
assert.match(catalog,/utm_source/);
assert.match(catalog,/trackCatalog\('landing_view'/);

// Mi negocio: se limita la cantidad de acordeones abiertos.
assert.match(admin,/function enforceBusinessAccordionLimit/);
assert.match(admin,/while\(opened\.length>limit\)/);

// i18n: cambio bidireccional sin conservar el idioma previo como texto fuente.
assert.match(admin,/function canonicalStaticSpanish/);
assert.match(admin,/MutationObserver\(scheduleStaticInterfaceTranslation\)/);
assert.doesNotMatch(admin,/interfaceOriginalText=new WeakMap/);

console.log("✓ Regresiones específicas 6.14.2-rc.15.1 verificadas");
