# Ingesta de biblioteca Gemini — 6.16.0-rc.37

## Archivos físicos recibidos

| Tipo | Cantidad | Resultado |
|---|---:|---|
| SVG | 2 | aceptados tras inspección; sin script ni URL externa |
| JSON | 4 | usados como metadata/usage/collection/batch, no copiados ciegamente |
| Markdown/HTML descriptivo | 1 | referencia, no runtime |
| thumbnails/previews | 0 | ausentes, reconocido por batch |

El batch declara nombres (`assets-batch-001.json`, etc.) que no coinciden con los nombres físicos genéricos entregados. Se resolvió por contenido/IDs, no por rutas declaradas.

## Decisiones por asset

| ID Gemini | Archivo normalizado | Estado | Normalización |
|---|---|---|---|
| `wedding.botanical-elegant.frame.001` | `public/design-assets/decorations/botanical-elegant-frame.svg` | ACEPTADO | URL nativa, categoría, tags, anchors y motions allowlisted |
| `wedding.botanical-elegant.divider.001` | `public/design-assets/decorations/botanical-elegant-divider.svg` | ACEPTADO | URL nativa, categoría, tags, anchors y motions allowlisted |
| thumbnails/previews declarados opcionales | — | RECHAZADO/AUSENTE | no se inventaron; miniatura usa SVG real |
| motions `fade`, `fade-up`, `slide-left`, `slide-right` no soportados | — | NORMALIZADOS | sólo `none`, `float-soft`, `sway-soft`, `soft-rise`, `rotate-slow` |
| anchors/componentes externos al schema | — | NORMALIZADOS | se mapearon a componentes/anchors existentes |

## Integración

Manifest EventStudio actualizado a `1.1.0`, fuente `gemini-batch-001-audited`. Se añadió el diseño `botanica-elegante-gemini` usando los dos assets sin crear HTML por colección. Catálogo final: 19 assets, 65 Recipes; validación PASS. El endpoint público entrega exactamente los assets referenciados por la Recipe activa/draft autorizada.

## Propiedad intelectual

La metadata recibida declara `original-generated-for-eventstudio`, uso comercial y sin atribución. La auditoría técnica no puede sustituir validación jurídica externa; se conserva esta procedencia en metadata.
