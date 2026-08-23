# Release notes — EventStudio 6.14.2-rc.17

RC17 es una candidata correctiva y de endurecimiento. No es una expansión masiva de catálogo.

## Corregido

- Referencias multimedia a archivos locales inexistentes dejan de publicarse como URLs válidas.
- Panel de salud multimedia y limpieza explícita de referencias faltantes.
- Subidas admin con reintento idempotente, watchdog de estancamiento y limpieza de parciales.
- Optimización cliente de imágenes grandes antes de portada/galería/vestimenta.
- Carga inicial del workspace reducida a información crítica; datos pesados pasan a carga por vista.
- Mutaciones de invitados dejan de recargar todo el workspace.
- Rosa eterna garantiza frame inicial antes de transición; preview owner puede forzar movimiento.
- Apertura consumida no vuelve a mostrar el CTA redundante.
- Ubicación física usa agenda/ceremonia/recepción modernas; se elimina texto promocional innecesario.
- Configuración y Mi negocio usan acordiones limitados.
- Perfiles comerciales corrigen overflow del grid.
- Cobertura de traducción estática de Configuración: 161/161 para EN/PT.
- Showcase usa imágenes reales lazy/async y endpoint no-cache sólo para `published`.
- Catálogo público exige `approved` además del estado comercial.

## Gobierno reforzado

- Startup ya no fuerza autopublicación Premium/Studio.
- Startup no vuelve a insertar experiencias en planes editados.
- Un plan vaciado por el propietario permanece vacío.
- Recomendaciones de perfiles y metadatos de producto dejan de regenerarse después del bootstrap.
- Demos Showcase se inicializan una sola vez.
- Acceso a plantillas deja de usar fallback runtime a planes estáticos del JSON.

## Diferido deliberadamente

- TUS/Uppy completo con reanudación por offset.
- Nuevas galerías SCSS/Compass, Masonry avanzada, FocusStrip y orbit 3D.
- Nuevas aperturas margarita/manzanilla, sello y otras referencias entregadas durante la auditoría.
- Refactor masivo de `admin.js`, `server.js` y `styles.css` en módulos: necesario a futuro, pero demasiado riesgoso dentro de una RC correctiva.

## Compatibilidad

No se eliminan las capacidades aprobadas de RC16. Los cambios comerciales están diseñados para preservar la configuración del propietario al reiniciar.
