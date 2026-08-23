# Backlog gobernado posterior a RC17

Este backlog no autoriza implementación automática. Cada punto requiere revisión del propietario y gate de regresión.

## Prioridad alta

1. **TusUploadAdapter**: reanudación real por offset para fotos de invitados y eventualmente multimedia admin; mantener uploader actual como fallback durante validación.
2. **Pruebas runtime completas** en entorno con registry npm funcional y después prueba física Windows + Android/iOS.
3. **Modularización gradual**: separar `admin.js` por áreas (workspace, commerce, media, guests, owner) y `server.js` por routers/servicios sin alterar contratos.
4. **i18n semántico completo**: sustituir traducción por texto literal restante por claves estables, primero negocio/billing/users y después mensajes dinámicos.

## Laboratorios de diseño aprobados para estudiar

- Daisy/Chamomile Bloom configurable por Design Kit.
- Ivory Seal / sobre unificado con posible cierre inverso.
- EditorialMasonry para fotografías aprobadas y mensajes.
- FocusStrip con swipe/teclado.
- FeaturedMemoriesOrbit limitado a recuerdos destacados.
- Editorial Memories / Polaroid como plantilla completa.
- Konva seating PoC comparativo; no reemplazar editor actual sin métricas.

## Visual Composer futuro

Mantener como línea independiente de Store: objetos inteligentes de evento, drag-and-drop, texto/calígrafía, decorativos, galerías, countdown, RSVP, mapa, QR, música y preview responsivo. Ninguna plantilla creada por un usuario se publica/vende sin consentimiento, revisión de derechos y aprobación del propietario.

## No prioritario / rechazado por ahora

- incorporar todos los efectos compartidos;
- Sass/Compass como dependencia por una sola galería;
- Three.js para efectos que Canvas/CSS nativo resuelve;
- migración de Railway o DNS durante la estabilización de la boda;
- code-splitting/refactor total en una sola release.
