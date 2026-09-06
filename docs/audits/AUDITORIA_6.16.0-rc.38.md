# Auditoría integral — EventStudio 6.16.0-rc.38

Estado: **candidata QA**.

## Baseline

Se trabajó sobre `EventEstudio_20260904_105304_844346.zip`, que contenía la línea 6.16.0-rc.37 y la `wedding.db` usada por el usuario durante las capturas. No se ejecutó `seed` sobre esa base.

Integridad de la BD incluida:

- `quick_check=ok`
- 43 tablas
- 4 usuarios
- 2 eventos
- SHA-256 registrado en `docs/validation/evidence/RC38_DB_INTEGRITY.json`.

## Fallos reportados y tratamiento

| ID | Severidad | Hallazgo | Corrección RC38 |
|---|---:|---|---|
| RC38-01 | alta | `409 Conflict` en `/api/admin/design/recipe` y `/design/apply` dejaba la UI atrapada | revisión optimista conservada, reconciliación explícita, serialización de autosave y retry controlado |
| RC38-02 | alta | `/api/admin/preview-links` podía responder 401 al previsualizar desde el editor | preview interno basado en sesión; ya no depende de crear un enlace compartible |
| RC38-03 | alta | preview de catálogo podía mostrar la plantilla ACTIVE en lugar de la seleccionada | autorización de preview separada de entitlement; Recipe solicitada se proyecta realmente |
| RC38-04 | alta | aperturas Store parecían el mismo sobre | preview DRAFT bypass sólo de visualización; Apply reporta derechos pendientes en vez de sustituir silenciosamente |
| RC38-05 | media | color floral/apertura podía quedarse con parámetros viejos en el iframe | URL del preview se reconstruye con controles actuales; `openingProps` pasan al preview DRAFT |
| RC38-06 | alta | texto blanco sobre fondo claro en presets | auditoría de paleta/contraste y fallback legible en hero sin media |
| RC38-07 | media | color de texto por bloque limitado a tokens | selector visual + HEX directo seguro + advertencia de contraste + reset a tono heredado |
| RC38-08 | media | catálogo sin Apply directo y demasiados botones repetidos | tarjeta abre preview; modal incorpora Editar/Aplicar; topbar del Lab compacta acciones secundarias |
| RC38-09 | media | buscador no anticipaba coincidencias | sugerencias desde escritura, normalización de acentos y navegación por teclado |
| RC38-10 | alta | fecha/countdown/copy de apertura podían salir del viewport | reglas responsive específicas verificadas en 320/390/1366 y matriz general 320–1440 |
| RC38-11 | media | panel “Apertura animada” colapsaba el texto | grid con mínimos y breakpoints explícitos |
| RC38-12 | media | foto de portada histórica podía verse/descargarse antes del diseño correcto | hero diferido tras apertura y `heroMedia.enabled`; PDF/QR respetan la misma regla |
| RC38-13 | media | canvas no enseñaba media real del evento | preview acotado de galería, portada y estado de música; máximo 8 miniaturas lazy |
| RC38-14 | media | editar un bloque lejos de la posición visible | auto-scroll al bloque seleccionado/modificado |
| RC38-15 | baja | `/favicon.ico` 404 | favicon local incluido |
| RC38-16 | media | pocas opciones tipográficas | 14 familias de título y 9 de cuerpo con fallbacks locales seguros |

## Hallazgos que no son defectos de EventStudio

- `Permissions policy violation: unload is not allowed` observado en `Grammarly.js`/`Grammarly-check.js` proviene de la extensión Grammarly del navegador.
- El mensaje de Edge sobre imágenes lazy reemplazadas por placeholders es una intervención de rendimiento del navegador y coincide con la carga diferida intencional.

## Rendimiento y carga

- Se evita `renderThemes()` por cada evento `input` del selector de color de apertura.
- Búsqueda del catálogo usa debounce.
- Hero se difiere mientras la apertura está visible.
- Galería/vestimenta/música no se materializan si Recipe/feature las oculta.
- Las imágenes del canvas se limitan a ocho previews lazy.
- Auditoría estructural: 480 archivos, 98 JavaScript, sintaxis válida.

## Cobertura automatizada ejecutada en este entorno

- 65 Recipes: contrato y contraste AA.
- 130 renders Recipe (65 × 2 viewports): 0 fallos, overflow 0.
- 175,500 combinaciones lógicas de presentación: PASS.
- 1,300 proyecciones rol/perfil: PASS.
- 139 controles/botones con wiring verificable: PASS.
- 22 casos de apertura en Chromium: 0 fallos, CLS 0, overflow 0, FPS mínimo medido ~57.7, promedio ~59.9.
- 30 casos de matriz de dispositivo: 0 fallos, overflow 0.
- 64 casos de contenido largo en 8 layouts × 8 dispositivos: PASS.
- 32 casos visuales de features: PASS.
- Stationery visual: 2 casos + 5 perfiles, sin fallos, ~60 FPS.
- QR/sobre público y paridad de Stationery: PASS.
- BD QA: `quick_check=ok`.

## Límite del entorno

No se pudo instalar `node_modules` porque este runtime no resuelve `registry.npmjs.org`. Por ello las suites que arrancan el servidor real y requieren `better-sqlite3`, `express`, `bcryptjs`, `exceljs`, etc. se clasifican **BLOCKED_ENV**, no PASS. El ZIP incluye `package-lock.json` íntegro; el gate final en un equipo con red es `npm ci && npm run test:preproduction`.

No se declara Production Ready hasta ese gate y la prueba física final en dispositivos reales.
