# Matriz de trazabilidad — RC17

| Requisito / hallazgo | Implementación RC17 | Evidencia | Estado |
|---|---|---|---|
| No perder control owner/developer | Seeds no sobrescriben planes/productos; trial no se repuebla; perfiles/Showcase bootstrap one-shot | `src/commerce-schema.js`, `tests/rc17-regressions.js` | Implementado |
| No datos comerciales rígidos en runtime | Store/temas resuelven derechos desde BD; eliminado fallback `featureDecision(...premiumTemplates...)` | `src/server.js` | Implementado |
| Multimedia vieja en BD no debe generar 404 continuos | `existingFile`, `safePublicMediaUrl`, `_mediaHealth` | `src/server.js` | Implementado |
| Upload móvil intermitente | XHR, watchdog 45 s, retry, `x-upload-key`, recibos servidor | `admin.js`, `album.js`, `server.js` | Implementado sin TUS |
| Reanudación por byte en señal pobre | TUS requiere cliente+servidor con offset | documentación | Diferido a laboratorio |
| Panel lento al “actualizar evento” | carga crítica 5 endpoints; invitados/fotos/mesas/negocio diferidos | `admin.js` | Implementado |
| No recargar todo tras editar invitado | `refreshGuestsAfterMutation` | `admin.js`, test RC17 | Implementado |
| Rosa salta transición en escritorio | doble `requestAnimationFrame` + lifecycle explícito | renderer + harness Chromium | Implementado |
| Replay de apertura redundante | apertura consume CTA y finaliza directamente | `app.js` | Implementado |
| Color de Rosa | `rosePetalColor` + variables calculadas | admin/settings/renderer | Implementado |
| Margarita/manzanilla | referencia aprobada sólo para estudio | análisis visual | Diferido/oculto |
| Invitación física muestra lugar incorrecto | `primaryEventLocation()` | `server.js`, test RC17 | Implementado |
| Texto físico promocional no deseado | eliminado | `server.js`, test RC17 | Implementado |
| Settings enorme | `details.settings-collapsible` + máximo 2 | HTML/JS | Implementado |
| Perfil comercial cortado | grid 2→1 columnas | CSS | Implementado |
| Settings no se traduce | 161/161 cadenas estáticas EN/PT | auditoría RC17 | Implementado para Settings |
| Hidden/draft no visible público | filtros `published/approved/available` + `no-store` | servidor/showcase/tests | Implementado |
| Nuevas referencias no deben hacer Frankenstein | no se integran dependencias SCSS/Compass ni efectos sin gate | análisis visual | Cumplido |
| Docs dispersos | docs clasificados por carpeta, raíz sólo README | audit-project | Implementado |
| Archivos basura | `.gitignore`, `.dockerignore`, auditoría de runtime artifacts | scripts | Implementado |
