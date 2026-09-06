# ADR — endurecimiento del Estudio de diseño y paridad de preview — 6.16.0-rc.38

## Contexto

Durante QA manual sobre 6.16.0-rc.37 se observaron conflictos `409` al guardar/aplicar Recipes, `401` al crear previews, vistas previas que mostraban la Recipe ACTIVE en lugar de la seleccionada, aperturas Store que parecían no cambiar, texto de apertura/fecha fuera de sus límites, portada/fotos históricas cargadas aunque el diseño no las mostrara y una barra superior con demasiadas acciones primarias.

El objetivo de RC38 es corregir esos fallos sin crear un segundo motor visual. `Assets + Components + Recipes` continúa siendo la autoridad de presentación y DRAFT/ACTIVE/CATALOG mantiene el modelo definido en RC37.

## Decisiones

1. **409 sigue siendo una protección, no se elimina.** El cliente conserva `draftRevision`, refresca la revisión ante `DESIGN_DRAFT_CONFLICT`, serializa guardados y sólo reintenta después de reconciliar el borrador.
2. **Preview interno no crea enlaces compartibles.** El panel y Design Lab usan la sesión autenticada y `/e/:slug?preview=1`; el endpoint de enlaces temporales queda reservado a su propósito compartible.
3. **Preview DRAFT puede simular Store sin conceder derechos.** Propietario/desarrollador puede probar una apertura/Recipe; `Apply` usa los derechos reales del evento y reporta `pendingEntitlements`.
4. **La Recipe solicitada debe ser la Recipe renderizada.** Un preview autorizado de catálogo no puede caer silenciosamente al ACTIVE vigente.
5. **Color granular conserva tokens.** Cada bloque puede heredar tonos semánticos o usar un HEX seguro. Los presets propios mantienen contraste AA; una personalización del usuario recibe advertencia si baja de 4.5:1.
6. **Media bajo demanda.** La portada puede desactivarse por Recipe y se difiere mientras exista una apertura; galería, vestimenta y música sólo se materializan cuando su sección/feature es visible.
7. **Preview de apertura reconstruido desde controles actuales.** Los colores de pétalos/centro no reutilizan parámetros viejos; el preview DRAFT también proyecta `openingProps` guardados.
8. **Barra de acciones compacta.** Navegación, undo/redo, preview y Apply permanecen visibles; descartar/guardar plantilla/publicar catálogo se agrupan como acciones secundarias y siguen gobernadas por capabilities.
9. **El editor desplaza el lienzo al bloque seleccionado.** Cambiar estilo, visibilidad, orden o propiedades mantiene visible el bloque afectado.
10. **No se introduce un renderer alterno para el lienzo.** El lienzo inmediato sigue siendo de edición y muestra datos/media reales de forma acotada; `Vista previa` utiliza el renderer público DRAFT para verificar la invitación completa.

## Consecuencias

- La invitación pública no cambia por autosave; sólo por Apply.
- Un propietario puede ver Store en preview sin que el evento lo haya adquirido, pero la publicación no recibe derechos implícitos.
- El flash de una portada anterior se evita al no descargarla hasta finalizar la apertura.
- Los PDF/QR/impresión comparten la regla de visibilidad de portada activa.
- El selector de color deja de regenerar el catálogo en cada pixel del arrastre.
- Las acciones comerciales siguen diferenciadas de la edición del evento.

## Evidencia

- `tests/rc38-design-studio-hardening.js`
- `tests/rc38-responsive-visual.py`
- `docs/validation/evidence/RC38_RESPONSIVE_VISUAL.json`
- `docs/validation/evidence/RC38_DB_INTEGRITY.json`
