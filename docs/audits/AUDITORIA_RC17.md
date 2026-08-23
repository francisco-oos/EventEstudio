# Auditoría integral — EventStudio 6.14.2-rc.17

## Mandato

Auditar la RC16 entregada por el propietario, corregir los hallazgos reportados y optimizar sin convertir EventStudio en una suma de frameworks/efectos. Sólo modificar una capacidad estable cuando exista una mejora neta verificable o una corrección necesaria.

## Alcance revisado

- estructura y artefactos del paquete;
- arranque y carga del workspace;
- configuración, plantillas, aperturas y galerías;
- invitados, RSVP, QR, fotos y mesas (regresión estática de contratos existentes);
- multimedia administrativa e invitado;
- invitación física y ubicación;
- Store, productos, planes, perfiles y Showcase;
- permisos owner/developer/client;
- i18n de la pantalla Settings reportada;
- seguridad estática de rutas sensibles y entrada de productos;
- documentación, `.gitignore`, `.dockerignore` y basura runtime;
- referencias visuales/código compartido por el propietario.

## Hallazgos críticos/correcciones

### A-01 — Runtime comercial todavía podía consultar configuración estática

`themeAllowedForPlan()` terminaba en un `featureDecision()` que podía usar `commercial-plans.json` como fallback aunque el propietario hubiese cambiado la composición real del plan en SQLite.

**Corrección:** resolución final desde `commerce.planProducts()`/grants; se eliminó el fallback runtime.

### A-02 — Plan trial podía repoblarse después de ser vaciado

Existía un bloque que volvía a llenar Trial si no tenía productos, aunque dejarlo vacío fuera una decisión del propietario.

**Corrección:** eliminado. Los productos iniciales se crean únicamente cuando `plan_products` está globalmente vacío durante bootstrap.

### A-03 — Recomendaciones vacías de perfil podían reaparecer

El arranque interpretaba `recommendations_json='[]'` como falta de inicialización.

**Corrección:** recomendaciones pasan a formar parte del `INSERT` inicial; `ON CONFLICT DO NOTHING` conserva lo editado posteriormente.

### A-04 — Metadatos técnicos podían corregirse repetidamente

El update de `presentation_slot/preview_strategy` también reaccionaba a valores válidos como `feature/none`, pudiendo revertir una edición posterior.

**Corrección:** metadatos de seeds se rellenan sólo si `release_version=''`.

### A-05 — Demo Showcase eliminada podía reaparecer

Las demos se sembraban por ausencia de `theme_id`; borrarlas hacía que un reinicio las recreara.

**Corrección:** marcador `bootstrap_showcase_seed_v1`. Después del primer bootstrap, el propietario mantiene el estado definitivo.

### A-06 — Referencias multimedia de una BD copiada

Una BD puede apuntar a `/uploads/site-media/X` sin que X exista en la nueva copia. Eso generaba imágenes rotas y 404 repetidos.

**Corrección:** verificación física antes de exponer URL, reporte `_mediaHealth` y limpieza explícita de referencias faltantes.

### A-07 — Upload abortado confundido con 500 interno

Una pérdida temporal de conexión podía terminar en `Request aborted` genérico.

**Corrección:** clasificación de desconexión, cleanup de temporales, reintento cliente y recibo idempotente servidor.

### A-08 — Ruta crítica demasiado grande

RC16 descargaba invitados, fotos y mesas aunque el usuario estuviera entrando a Resumen/Configuración.

**Corrección:** carga por demanda. El `load()` inicial baja de 8 colecciones secundarias a 5 recursos críticos. `await load()` explícitos en `admin.js`: 21 → 6.

### A-09 — Rosa podía saltar el crecimiento en escritorio

El estado inicial y la clase de crecimiento podían llegar al navegador dentro del mismo ciclo de pintura.

**Corrección:** doble `requestAnimationFrame` antes de `growing`, lifecycle separado y test Chromium en desktop/móvil.

### A-10 — Invitación física tomaba una estructura de ubicación antigua

**Corrección:** `primaryEventLocation()` prioriza agenda habilitada, después ceremony/reception, luego legacy. Se elimina el copy promocional no deseado.

### A-11 — Configuración sin cobertura i18n completa en la pantalla reportada

**Corrección:** auditoría encuentra 161 cadenas estáticas de `tab-settings`, 0 sin clave literal EN/PT. No se afirma i18n total del panel; aún hay textos dinámicos/históricos fuera de Settings.

## Rendimiento

Medidas aplicadas sin nueva dependencia:

- lazy load de colecciones del admin;
- lazy/async images;
- `content-visibility:auto` donde aplica;
- preparación WebP/resize cliente cuando reduce peso;
- watchdog de upload;
- galería depth limitada a 7 tarjetas visibles;
- ParticleTrace adapta cantidad de partículas.

No se convirtió el servidor en procesador de imágenes, evitando introducir CPU pesada en el event loop.

## Seguridad

- rutas comerciales sensibles permanecen autenticadas/owner-only;
- la BD no ejecuta JavaScript de producto;
- allowlists de renderer se mantienen por diseño;
- Store vuelve a verificar derechos en backend;
- referencias externas/locales se normalizan;
- no se detectó `eval()`/`new Function()` en `src/` o `public/`;
- revisión estática de SQL no identificó interpolación directa de strings de usuario en consultas sensibles revisadas;
- Helmet permanece en el stack;
- no se incluye `.env`, DB, logs ni upload runtime en la entrega.

Limitación: sin `npm ci` no fue posible ejecutar auditoría de dependencias ni la suite servidor/SQLite completa en este entorno.

## Animaciones/referencias

No se añadieron todas las muestras recibidas. Los códigos con SCSS/Compass, hover-only, fondos pesados o efectos no coherentes quedan como referencia. Se documentaron candidatos concretos (`EditorialMasonry`, `FocusStrip`, `FeaturedMemoriesOrbit`, Daisy/Chamomile, sello) sin publicarlos.

## Deuda técnica deliberadamente no mezclada

`admin.js`, `server.js` y `styles.css` siguen grandes. Se recomienda modularización posterior con pruebas por contrato. Un refactor masivo dentro de esta RC habría violado la regla de no dañar capacidades aprobadas por una mejora no demostrada.

## Dictamen

**RC17 = candidata correctiva apta para prueba controlada, no promovida automáticamente a producción.**

Las puertas estáticas y el harness de renderers pasan. Falta ejecutar `npm test` completo y pruebas físicas en el entorno del propietario con dependencias instalables y datos/copias reales.
