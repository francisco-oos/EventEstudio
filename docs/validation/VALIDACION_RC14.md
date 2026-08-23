# Validación EventStudio 6.14.2-rc.14

## Puertas locales sin dependencias externas
- `node --check` para JavaScript de `src`, `public`, `tests`, `scripts`.
- `tests/project-integrity.js`.
- `tests/source-references.js`.
- `tests/mobile-ui.js`.
- `tests/local-network.js`.
- `tests/rc14-regressions.js`.

## Regresiones RC14 cubiertas
- fallback de ID de lote de fotos en LAN.
- forwarding de previews de tema/apertura/galería.
- validación y refresco RSVP.
- migración única de seating heredado.
- detección de producto ya incluido.
- modales de preview/notification/client menu.
- rutas owner-only sensibles.
- contraste de todas las plantillas cargadas.

## Validación manual requerida antes de producción
1. Actualizar una copia de RC13/BD real a RC14 y comprobar quick/integrity check.
2. Cambiar un solo invitado de mesa y confirmar que ningún otro se mueve.
3. Probar RSVP con -1, cero asistentes marcando “sí”, exceso de cupo y confirmación válida.
4. Subir fotos desde PC, `localhost` y teléfono vía IP LAN.
5. Probar tema y apertura en modal, Store, teléfono y escritorio.
6. Confirmar que un tema incluido por plan no aparece como venta al cliente.
7. Conceder/revocar cortesía y revisar notificación + `NEW` + menú preview.
8. Revisar planes, constructor de paquetes y Mi negocio en 360/390/430 px y desktop.

## Limitación del entorno de construcción
El registro npm interno disponible durante esta construcción devuelve HTTP 404 para la dependencia transitiva `zip-stream@7.0.5`; por ello `npm ci` no puede completar en este entorno y la suite que requiere dependencias no se declara ejecutada aquí. Debe repetirse con el registro npm normal antes de promoción.
