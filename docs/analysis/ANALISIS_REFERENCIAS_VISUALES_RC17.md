# Análisis de referencias visuales — RC17

Las referencias entregadas por el propietario se consideran **inspiración técnica/visual**, no código que deba entrar completo. La regla es extraer la capacidad útil y reimplementarla dentro de los contratos de EventStudio.

## Candidatas útiles para laboratorio

### EditorialMasonry / Memories Board

Origen conceptual: grids/masonry con fotografía y mensaje. Encaja con fotografías aprobadas + mensaje del invitado que EventStudio ya conserva.

Uso previsto: página conmemorativa o álbum global. Debe usar lazy loading, filtros por mesa, moderación existente y lightbox táctil.

### FocusStrip

Foto principal + tira de miniaturas. Buena candidata para invitación/álbum con swipe móvil y teclado/focus en desktop.

### FeaturedMemoriesOrbit

La galería circular SCSS/Compass tiene valor para 6–12 recuerdos destacados. No debe recibir cientos de fotografías ni introducir Compass/Sass sólo por ese efecto.

### Product Preview Card

La tarjeta que amplía el preview puede mejorar Product Studio/Store, adaptada a `hover` + `focus` + `tap`, usando miniaturas propias y no URLs externas embebidas.

### Editorial Memories

La composición tipo Polaroid, papel y espacio negativo puede convertirse en una plantilla completa. Se descarta copiar alturas artificiales (`600vh`) o transiciones de blur/rotación que comprometan elegancia.

## Aperturas/efectos recibidos antes de RC17

- Rosa: ya tiene renderer propio y configurable; se mejora el ciclo existente en vez de duplicarlo.
- Sobre/sello: candidato a unificar renderers similares y a una futura experiencia entrada/salida.
- Margarita/manzanilla: candidata a renderer floral original con color/Design Kit configurable; no se publica en esta RC.
- Líquido/partículas/avión/caja/regalo/libro: sólo se considerarán si existe un caso de evento claro y una mejora de producto; no se incorporan por espectacularidad aislada.

## Regla de Store

Una experiencia experimental puede existir técnicamente sin ser comercializable. El catálogo público requiere readiness aprobado y estado comercial permitido. El propietario decide cuándo pasa de laboratorio a Store.
