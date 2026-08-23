# Página de publicidad, catálogo y Showcase — RC15

Los videos de referencia aportan dos ideas que sí encajan con EventStudio: coherencia físico/digital de una misma colección y una ruta de adquisición móvil desde redes sociales.

## Decisión

No crear otra landing duplicada. `catalogo.html` se consolida como página pública de adquisición:

Red social / anuncio / recomendación
→ `catalogo.html?utm_source=...&utm_campaign=...`
→ plantillas + Showcase + planes + constructor
→ Sandbox
→ registro diferido
→ Store/pago/publicación.

RC15 registra `landing_view`/`catalog_view` junto con fuente, medio/campaña y host referente permitido por el esquema analítico. No se requiere cuenta para esta etapa.

## Showcase

- sólo `published` sale públicamente;
- `draft` y `hidden` permanecen owner-only;
- demos editoriales se identifican como demo;
- un evento de cliente nunca se publica automáticamente;
- el owner conserva la decisión de promover una composición futura al catálogo.
