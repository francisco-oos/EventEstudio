# Matriz de trazabilidad funcional · RC12

La “decisión” resume la justificación técnica verificable; no representa
razonamiento privado. Cada fila conecta requisito, implementación y prueba.

| Sección o requisito | Evidencia/decisión | Implementación principal | Verificación |
|---|---|---|---|
| Invitación pública | Sólo publicar módulos y medios autorizados. | `src/server.js: publicConfig`, `public/app.js` | `tests/smoke.js`, `tests/security-headers.js` |
| Apertura | Debe usar datos reales, teclado y movimiento reducido. | `public/index.html`, `setupInvitationOpening`, `styles.css` | Integridad DOM, prueba móvil y regresión RC12 |
| Rosa eterna | Producto separado; el HTML no debe concederlo. | `DESIGN_PRODUCT_KEYS`, `experience:rose-bloom` | Bloqueo 403, cortesía, revocación y degradación pública |
| Galería | Navegación y lightbox existentes son la base estable. | `renderGallery`, `moveGallery`, `openLightbox` | `tests/source-references.js`, `tests/smoke.js` |
| Historia cinemática | Profundidad en escritorio, cuadrícula segura en móvil. | `galleryStyle:cinematic-depth`, CSS responsivo | Compra, publicación y reglas móviles RC12 |
| Plantillas | Un tema debe declarar ocho metadatos y una paleta segura. | `config/themes.json`, `src/theme-design.js` | 48 ids únicos, campos, paletas y familia imprimible |
| Estilos fotográficos | Ningún valor declarado puede caer silenciosamente a `cards`. | Conjunto `allowedPhotos` y selectores `data-photo-style` | Bucle exhaustivo sobre los 48 temas |
| Pasaporte al sí | Metáfora del video, identidad original y salida imprimible. | tema `destination-passport`, layout/photo `passport` | Catálogo, muestra, paleta y matriz PDF/QR |
| Carta entre pétalos | Reutilizar estructura storybook evita duplicar lógica. | tema `petal-letter` | Contrato de tema y familia de impresión |
| Camino al logro | Línea de tiempo compatible con graduación/corporativo. | tema `achievement-path` | Tipos de evento y layout reconocido |
| Raíces y recuerdos | Galería familiar sin asumir pareja o boda. | tema `family-memories` | Copia neutral y filtro por evento |
| Catálogo público | Filtros deben derivar de configuración, no listas duplicadas. | `/api/public/catalog`, `catalogo.js` | Conteo 48, muestras y filtros |
| Muestra animada | Debe propagar layout, foto, motivo y movimiento. | `muestra.js` | Referencias DOM e integridad de metadatos |
| Store | Mostrar sólo productos públicos compatibles con el evento. | `commerce.relevantProducts`, `renderStore` | Recorrido de cliente y filtro de compatibilidad |
| Derechos | Plan, compra, cortesía o promoción activa son las únicas fuentes. | `commerce.accessForEvent` | Migración y recorridos comerciales |
| Pagos | Pedido pendiente no concede; confirmación demo es idempotente. | rutas `/api/store/orders` | `tests/commerce-journeys.js`, `tests/smoke.js` |
| Planes completos | Trial/Premium/Studio deben incluir nuevas experiencias. | `plan_products` con `INSERT OR IGNORE` | `designAccess` durante Trial |
| RSVP | Límites y respuestas pertenecen al evento activo. | rutas RSVP y normalización | `tests/smoke.js` |
| Invitados/WhatsApp | Envío manual, sin prometer automatización no conectada. | invitados, cola y `whatsapp-batch` | aislamiento, cola y URL en smoke |
| Música/Spotify | Archivo propio o reproductor oficial; sin búsqueda huérfana. | normalización media y reproductor público | integridad y smoke |
| Agenda/ubicaciones | URLs sanitizadas y módulo gobernado por plan. | `safeHttpUrl`, `eventFeatureDecision` | smoke y política de origen |
| Vestimenta/regalos/menús | Guardado condicionado por función y evento. | PUT settings, normalizadores | smoke por rol y módulo |
| Fotos de invitados | Validación estructural, moderación y cuota. | `media-validation.js`, rutas de fotos | datos, archivos dañados y almacenamiento |
| QR e impresión | Paleta única por tema y formatos independientes. | `theme-design.js`, PDF/QR | 48 × 8 combinaciones y PDFs físicos |
| Plano y mesas | Datos aislados por evento y exportables. | rutas seating/reportes | smoke |
| Idiomas | Interfaz ES/EN/PT y textos personalizados persistentes. | `UI_COPY`, localización | smoke de guardado/publicación |
| Seguridad HTTP | Autenticación, origen, CSRF, CSP y no-cache público. | `server.js`, Helmet | origin-policy y security-headers |
| Respaldo/restauración | Validar antes de sustituir y reiniciar para aplicar. | módulos backup/restore | `tests/restore.js`, data-safety |
| Datos existentes | Migrar con copia previa, nunca resembrar una base parcial. | `db.js`, lanzadores y `seed.js` | commerce-migration y local-network |
| Documentación | Una sola entrada vigente y evidencia por decisión. | `docs/INDEX_DOCUMENTACION_RC12.md` | `tests/project-integrity.js` |
