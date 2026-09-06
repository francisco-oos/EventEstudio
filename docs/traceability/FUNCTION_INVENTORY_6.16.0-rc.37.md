# Inventario funcional — 6.16.0-rc.37

Método: inspección de 163 rutas Express, 9 pantallas HTML, 492 controles con ID, catálogos, migraciones y suites. `CORE` indica función existente; no se implementó ninguna función `FUTURE_IMPLEMENTED`. Una fila sin ejecución visual no se marca PASS visual.

| Clase | Módulo/pantalla | Controles o rutas | Permiso / entitlement | Comportamiento esperado | Evidencia | Estado |
|---|---|---|---|---|---|---|
| CORE | Auth | login/register/Google/logout/me/password | público/sesión | sesión, cambio forzado y límites | smoke, security | PASS |
| CORE | Multi-evento | selector, nuevo, transferir, eliminar/restaurar | owner/developer/client autorizado; límites de plan | aislamiento y cambio de contexto | smoke, rc20 | PASS |
| CORE | Publicación | status/request/approve/public-url | cliente solicita; plataforma decide | no publicar por preview | commerce journeys, V5 | PASS |
| CORE | Settings/Event Data | formularios de pareja, fecha, historia, agenda, lugar | eventAllowed + feature gates | persistir datos sin introducirlos en Recipe | smoke, rc22 | PASS |
| CORE | I18N | locale ES/EN/PT, traducción | eventAllowed; proveedor server-side | ES por defecto, locale persistente | rc15.1, rc20 localization | PASS funcional |
| CORE | Invitados | CRUD, lote, import/export XLSX | eventAllowed, límites | datos y validación aislados | smoke, security DB/XLSX | PASS |
| CORE | RSVP público | token/formulario | invitación válida + feature | confirmación, composición y cierre | smoke, rc21/22 | PASS |
| CORE | Mesas | CRUD implícito, layout, assignment, PDF | eventAllowed + seating | posiciones/asignaciones persistentes | rc23, functional parity | PASS |
| CORE | Fotos/álbum | upload, moderación, lightbox, ZIP | token/eventAllowed + photos | carga idempotente y aislamiento | functional parity, smoke | PASS funcional |
| CORE | Música | upload/Spotify/play/pause/delete | eventAllowed + music | fuente real independiente de Recipe | rc20, rc32/33 | PASS funcional |
| CORE | QR e impresión | PNG, card/set/physical PDF, mesa | eventAllowed + qr/print | contraste y datos correctos | qr-photo-matrix, rc33 | PASS funcional; escaneo físico NOT_RUN |
| CORE | Gifts | sobres, registry, banco, Openpay | feature + config | métodos combinables y validación | rc24/25 | PASS |
| CORE | Store | catálogo, carrito, orden, checkout | cliente/evento | no concede derechos antes de pago | commerce journeys, rc33 E2E | PASS |
| CORE | Grants/cortesía/promoción | admin commerce | owner/developer | concesión auditable y revocable | rc20, security | PASS |
| CORE | Planes/productos/categorías | Mi negocio | owner/developer | catálogo gobernado e invalidación cache | rc23, commerce migration | PASS |
| CORE | Perfiles comerciales | Mi negocio | owner/developer | curación sin convertirse en permiso | rc23/34 | PASS |
| CORE | Backups/restore/orphans | administración | plataforma | backup, inspección, rollback | data-safety, restore | PASS |
| CORE | Auditoría/analytics | administración | plataforma | trazabilidad y funnel | functional parity | PASS |
| CORE | WhatsApp/cola | preparación, queue, webhook | plataforma/config completa | mocks/readiness, sin envío real | whatsapp readiness | PASS sin envío externo |
| CORE | Dominios | add/delete/status | plataforma | configurar sin debilitar origen | origin-policy | PASS |
| CORE | Catálogo visual | 65 diseños, búsqueda/paginación | evento autorizado | cargar Recipe sin Event Data | rc31/32, catalog validation | PASS |
| CORE | Asset Library | 19 assets, búsqueda/filtro/paginación/lazy | `editDraft` para usar | sólo assets aprobados y usados | V5, rc31 | PASS funcional |
| CORE | Bloques/capas | subir/bajar, visible, variante, inspector | `editDraft`; feature puede quedar pendiente | layout ordenado, no activar servicios | rc33/34/V5 | PASS funcional |
| CORE | Elementos | drag, teclado, X/Y, escala, rotación, z, opacidad, tono, motion, duplicar/eliminar | `editDraft` | transformación sanitizada | rc31/V5 | PASS funcional; visual NOT_RUN |
| CORE | Texto visual | fuentes globales; tamaño/peso/color/alineación/ancho/line-height/spacing/casing por bloque | `editDraft` | Recipe guarda presentación, no texto real | rc34/V5 | PASS funcional |
| CORE | Color | armonía, tokens semánticos, warning/ajuste | `editDraft` | AA y mismo resolver | rc34/35/V5 | PASS lógico; visual NOT_RUN |
| CORE | Aperturas | seleccionar/probar; motores distintos | diseño + entitlement al aplicar | no “Guardar entrada” paralelo | animations, rc21, rc28–35 | PASS funcional |
| CORE | Stationery/lacre | editor interno, presets, materiales, sello, guardar draft | `editStationery` | mismo borrador, datos heredados | rc27–30/V5 | PASS funcional; visual NOT_RUN |
| CORE | DRAFT | autosave, undo/redo, descarte, revisión | `editDraft` | nunca publica | V5 | PASS |
| CORE | Preview | preview interno autorizado | `previewDraft` | renderiza DRAFT | V5 | PASS de datos; visual NOT_RUN |
| CORE | Apply | CTA explícito | `apply` | transacción DRAFT→ACTIVE, entitlement, retry | V5 | PASS |
| CORE | CATALOG | guardar/publicar reusable | `saveTemplate`/`publishCatalog` | clonar sólo presentación | V5 | PASS |
| CORE | Público | `/e/:slug`, config, renderers | publicación/token | ACTIVE, módulos filtrados | rc21/33/V5 | PASS funcional; visual RC37 NOT_RUN |
| CORE | Landing/showcase/sandbox | catálogo y demos | público | diseño primero, servicios después | rc33 contracts | PASS funcional; visual RC37 NOT_RUN |
| CORE | SQLite sidecars | arranque | sistema | aislar WAL/SHM incompatibles | rc36 | PASS |
| FUTURE | Agency/designer dedicado | no hay control | no existe rol/capability persistente en schema actual | requiere especificación y tenancy | no test | NOT_RUN / no implementado |
| FUTURE | Timeline/marketplace/personajes/video | no hay control | no aplica | arquitectura preparada, sin placeholders | no test | NOT_RUN / no implementado |

## Familias de endpoints inventariadas

`public/auth/analytics/showcase`, `admin/events/users/clients`, `settings/features/publication`, `guests/rsvp`, `photos/media`, `tables/seating`, `qr/print/reports`, `store/orders/payments`, `commerce/plans/products/categories/profiles/promotions/grants`, `messaging/WhatsApp`, `backups/audit/storage`, `domains/billing`, `design/catalog/assets/recipe/stationery-draft/discard/apply/catalog-recipes`. Total detectado: 163.

## Regla de cierre

Los estados visuales `NOT_RUN` se mantienen así hasta generar nueva evidencia RC37. La evidencia visual histórica RC33–RC35 no se presenta como sustituto de la ejecución actual.
