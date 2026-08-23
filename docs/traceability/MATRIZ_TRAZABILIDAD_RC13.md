# Matriz de trazabilidad funcional · RC13

| Requisito | Decisión | Implementación | Verificación |
|---|---|---|---|
| Autoridad del propietario | Seguridad y perfil comercial separados. | `account_commercial_controls`, owner APIs | inspección + integridad |
| Perfiles editables | No codificar perfiles ni sus recomendaciones en UI de cliente. | `customer_profiles`, `recommendations_json`, CRUD owner | JS syntax/integridad |
| Categorías Store editables | Runtime lee DB, no `if` por producto. | `store_categories`, links, Product Studio | ausencia `storeCategoryFor` + integridad |
| Crear producto | Sólo capacidades previamente autorizadas. | POST `/api/admin/commerce/products` | validación whitelist + QA gate |
| Publicación manual actual | Global `manual_owner`. | `platform_settings.publication` | inspección |
| Auto Premium futuro | Sólo con vigencia/cupo/política global. | `publicationAccess`, request endpoint | ruta y condiciones |
| Límites por cuenta | Owner puede sobrescribir eventos/publicados. | `account_commercial_controls` | UI + API |
| Daisy Atelier | 4 variantes originales a partir de 5 referencias. | SVGs + `themes.json` + CSS | 52 temas / IDs únicos |
| QR floral | Motivo reutilizado por PDF. | `drawThemeMotif` `daisy` | integridad |
| Kit de diseño | Paleta opcional sobre tema. | `designKit`, `themeDescriptor`, CSS vars | sintaxis + revisión |
| Store 2.0 | Buscar/probar sin volver a preguntar evento. | `renderStore`, categorías DB | source refs/mobile |
| Composer | Probar carrito sin comprar/persistir. | preview options + slots | revisión |
| Preview teléfono | Token temporal hash/expiración. | `preview_links` | rutas + revisión |
| Sandbox | Empezar sin cuenta, guardar al registrarse. | `sandbox.html/js`, registro draft | integridad |
| Showcase | Sólo demos/muestras autorizadas. | `showcase_items`, página pública | integridad |
| Analytics | First-party, whitelist y metadata limitada. | `conversion_events` | API + revisión |
| RSVP seating | Candidato a liberar, nunca reemplazo automático. | `seatReleaseAt`, `releaseEligible` | UI + revisión |
| Corazón partículas | Renderer propio, reduced motion. | `experience-renderers.js` | integridad |
| URLs públicas | Hostname verificado antes de fallback. | `publicBaseUrl` | revisión |
| Marca EventStudio | Referencia discreta configurable. | branding settings + renderers | revisión |
| Dependencias gratuitas | No introducir dependencia si no aporta neto. | decisiones RC13 | `REFERENCIAS_TECNICAS_RC13.md` |
