# Auditoría comparativa funcional — RC21 Security r2

Fecha de auditoría: 2026-08-27/28

## Objetivo

Comparar la última versión funcional entregada por el propietario (`EventStudio-6.14.2-rc.21-functional-template-addon-r2`) contra la candidata endurecida (`security-hardened-r1`) y demostrar que los controles de seguridad no alteran perfiles, permisos, asignaciones, Store, plantillas, aperturas, RSVP, QR, multimedia, importaciones, respaldos ni proveedores.

La auditoría se ejecutó siempre sobre copias temporales y datos sintéticos. La base incluida en el ZIP original sólo se abrió mediante la prueba no destructiva `imported-db-compatibility.js`.

## Diferencia de código antes de la regresión

El hardening original no modificaba `public/`, `config/themes.json`, `config/experiences.json` ni `src/theme-design.js`. Sus cambios runtime estaban limitados a:

- `src/db.js`: comprobaciones SQLite y pragmas defensivos.
- `src/backup.js`: integridad referencial del snapshot.
- `src/restore.js`: integridad referencial antes de aceptar una restauración.
- `src/server.js`: límites multipart y preflight XLSX.
- `src/spreadsheet-security.js`: validación ZIP/XLSX previa a ExcelJS.

Se verificaron **29/29 archivos de `public/` byte a byte sin diferencias**. `themes.json` y `experiences.json` también son idénticos entre la versión funcional y la endurecida. Por tanto, el hardening no introduce una variante visual nueva.

Hashes de referencia durante la auditoría:

- `config/themes.json`: `6208eec27a3530039077fb2cdbacdb867be2039d4dbdeee2f22fdcbea65e31c7`
- `config/experiences.json`: `514c3da38fe7608c255f3b2512a104b43882e74bacd1867d5b529b3d93c49a89`
- `src/theme-design.js`: `8a2af8f6dd9fd457c59ce9ed750fb5e5c41788f0a42641a9acc6b90f41dac065`

## Regresión funcional automatizada

Ambas versiones superaron la misma línea base en:

- referencias DOM y recursos;
- panel móvil y red local;
- protección de datos/migraciones;
- Origin/CSRF y cabeceras;
- recorridos nuevo cliente, comprador y propietario;
- login y regresiones RC14/15/17/19/20;
- permisos Owner/Developer/clientes;
- cortesías y aislamiento entre eventos;
- QR general, QR por mesa, firmas, PNG/PDF/set y fotos;
- Mercado Pago (preferencia, firma, importe, webhook, idempotencia e ingresos);
- traducción ES→EN/PT;
- preparación WhatsApp Cloud;
- 1,200 usuarios/eventos y 150 cortesías aisladas;
- contratos de animación;
- RC21 con 59 plantillas y 16 aperturas;
- registro y RSVP HTTP.

La candidata endurecida volvió a superar además `test:security` y la compatibilidad sobre copia de la BD real del ZIP: 4 usuarios, 2 eventos, integridad SQLite y preview RC21 correctos.

## Hallazgo funcional heredado: exportación ZIP de fotografías

El inventario de rutas detectó que `GET /api/admin/photos-export.zip` no tenía cobertura funcional directa. Al probarla sobre la versión original se reprodujo:

- HTTP 500
- mensaje interno: `archiver is not a function`

Causa: `package-lock.json` resuelve Archiver 8, cuya API CommonJS exporta `ZipArchive` como clase; `server.js` conservaba la invocación fábrica de versiones anteriores: `archiver("zip", ...)`.

Este fallo **ya existía en la versión funcional original** y fue heredado por `security-hardened-r1`; no fue introducido por el hardening.

### Corrección aprobada

Se añadió `createZipArchive()` en `src/server.js`, compatible tanto con la API antigua como con Archiver 8. No cambia datos, permisos, rutas ni formato esperado del archivo.

Después de la corrección:

- subida pública de foto: HTTP 200;
- exportación `photos-export.zip?status=all`: HTTP 200;
- `Content-Type: application/zip`;
- archivo ZIP no vacío;
- servidor saludable después de finalizar el stream.

## Cobertura nueva permanente

Se añadió `tests/functional-parity-security-r1.js` y el script:

`npm run test:functional-parity`

La prueba ejecuta 46 controles reales, incluyendo funciones que previamente no estaban cubiertas de forma directa:

- dashboard y tipos de evento;
- mesas y eventos de plataforma;
- controles comerciales y branding;
- analytics track/funnel;
- Showcase público/administrativo;
- creación/edición de categorías Store;
- estado OAuth Google sin configurar;
- alta/listado/baja de dominios;
- marcado de invitaciones enviadas;
- estado WhatsApp;
- estado de publicación;
- auditoría y huérfanos de almacenamiento;
- XLSX legítimo por multipart;
- portada, música, galería y dress code;
- eliminación de multimedia;
- foto pública de invitado;
- exportación ZIP de fotos;
- creación/descarga/inspección de backup;
- guard de confirmación de restore;
- health final.

Tras incorporar esta prueba, el inventario estático encuentra **142 rutas API y 142 con referencia de prueba**. Este conteo no sustituye cobertura de líneas ni demuestra todos los estados posibles, pero elimina las 27 rutas sin referencia detectadas al inicio de esta auditoría.

## QA visual

La ejecución interactiva nueva con Chromium no pudo realizarse dentro de este contenedor porque Chromium está administrado con `URLBlocklist: ["*"]` y bloquea incluso `127.0.0.1` antes de cargar la aplicación. No se alteró ni evadió esa política del entorno.

La equivalencia visual se sostiene por tres evidencias independientes:

1. 29/29 archivos de `public/` son byte-idénticos entre original y hardening previo a la corrección backend.
2. `themes.json` y `experiences.json` son byte-idénticos.
3. `animation-contracts.js` y `rc21-visual-contracts.js` vuelven a pasar con 59 plantillas y 16 aperturas.

Las capturas reales móvil/escritorio realizadas antes del hardening sobre esta misma colección siguen siendo representativas, ya que el cambio final de Archiver afecta únicamente una ruta de descarga ZIP y no toca frontend/CSS/configuración visual.

## Conclusión

No se encontró ninguna regresión causada por los controles de seguridad. Se encontró y corrigió un defecto funcional preexistente en la exportación ZIP de fotografías. La candidata resultante mejora la versión funcional original en seguridad e integridad y conserva sus respuestas legítimas, con la excepción deliberada de que ahora una función rota devuelve correctamente el ZIP esperado.
