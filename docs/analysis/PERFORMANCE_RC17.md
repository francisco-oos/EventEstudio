# Performance — RC17

## Hallazgo principal

La sensación de “Actualizando/Cargando espacio de trabajo” no provenía de una sola consulta. RC16 cargaba de inicio varias colecciones que podían ser grandes aunque el usuario no fuera a abrirlas: invitados, fotos y mesas, además del núcleo del evento.

## Cambio de ruta crítica

RC16: 8 recursos secundarios después de features (dashboard, settings, guests, photos, tables, themes, QR templates, event types).

RC17: 5 recursos críticos (dashboard, settings, themes, QR templates, event types).

Invitados, fotos, mesas, QR, negocio, usuarios, pagos y otras superficies se cargan al abrir la vista. La cantidad de `await load()` explícitos en `admin.js` se redujo de 21 en RC16 a 6 en RC17; los restantes corresponden a login/restauración, cambio de evento, cambio de vista cliente, registro o eliminación del evento activo.

## Render y multimedia

- `loading="lazy"` en fotografías y Showcase.
- `decoding="async"` para no exigir que la decodificación bloquee otros paints.
- `content-visibility:auto` + `contain-intrinsic-size` en tarjetas largas cuando el navegador lo soporta.
- `ParticleTraceScene` adapta partículas al área: en el harness RC17 se observaron 284 partículas a 1280×800 y 180 a 390×844.
- Galería de profundidad limita las tarjetas activas a 7.
- No se montan nuevas experiencias de referencia en producción.

## Backend

EventStudio ya usa `compression`. La documentación oficial de Express recomienda compresión, evitar trabajo síncrono costoso en rutas de producción y manejar correctamente errores. RC17 no introduce procesamiento de imagen pesado en el servidor; la preparación de fotos se realiza principalmente en el cliente.

## Deuda técnica medida

Al cierre del audit, los principales archivos fuente eran aproximadamente:

- `admin.js`: 293 KiB;
- `styles.css`: 190 KiB;
- `app.js`: 60 KiB;
- `experience-renderers.js`: 9 KiB;
- `album.js`: 11 KiB;
- `server.js`: ~297 KiB.

La modularización futura debe reducir coste de mantenimiento y permitir code-splitting, pero se realizará por módulos con pruebas equivalentes, no mediante una reescritura total en una RC de corrección.
