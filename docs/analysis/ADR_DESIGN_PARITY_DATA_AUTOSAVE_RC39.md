# ADR — paridad de Recipe, datos reales y autosave transparente — 6.16.0-rc.39

## Contexto

La QA manual posterior a RC38 confirmó que el constructor ya era usable, pero todavía existían diferencias perceptibles entre la miniatura del catálogo, el modal de preview, el lienzo del Estudio, Stationery y la invitación pública. También se observaron referencias de media borrada que producían `404`, preview que requería un segundo clic para volver al editor, cambios de sobre que parecían exigir `Guardar borrador`, secciones de servicios ocultos que podían dejar huecos y propiedades tipográficas cuyo efecto no era suficientemente visible.

RC39 no introduce otro renderer. Mantiene `Assets + Components + Recipes + Presentation Engines` como autoridad de presentación y refuerza la paridad entre las superficies existentes.

## Decisiones

1. **La Recipe predefinida es un punto de partida completo.** Cuando se selecciona desde catálogo, su paleta, apertura y preset de Stationery se proyectan juntos. Una miniatura no debe prometer un aspecto que el preview seleccionado no reproduce.
2. **La personalización del evento no reescribe el catálogo.** La Recipe curada conserva su identidad de catálogo; las decisiones del usuario viven en DRAFT/ACTIVE del evento.
3. **Autosave no equivale a publicar.** Los cambios del Estudio y del Sobre/Lacre se persisten silenciosamente como DRAFT. `Aplicar cambios` es la acción explícita que promueve a ACTIVE. `Guardar como plantilla` continúa siendo una operación distinta.
4. **Stationery y Recipe se sincronizan en ambos sentidos.** Cambiar el sobre/lacre actualiza el DRAFT; aplicar una Recipe curada puede restaurar su Stationery previsto sin heredar accidentalmente un sobre viejo.
5. **Preview de catálogo usa la Recipe solicitada.** Filtros de apertura sirven para recomendar, no para sustituir destructivamente la apertura propia del diseño predefinido.
6. **El lienzo usa datos reales disponibles.** Historia, ubicación, programa, vestimenta, portada, galería y música reutilizan datos del evento. Los textos de fallback sólo aparecen cuando el dato real no existe.
7. **Media inexistente se considera referencia obsoleta, no un recurso que deba reintentarse.** El cliente filtra rutas conocidas como ausentes para evitar `404` repetidos y trabajo inútil.
8. **Servicios ocultos no reservan geometría.** Si una sección no está visible o el servicio no debe mostrarse, el renderer la desmonta/colapsa para no dejar huecos grandes.
9. **Propietario/desarrollador pueden validar experiencias comerciales.** El override es técnico para QA y edición; no concede al evento/cliente un derecho comercial persistente.
10. **Colores directos y tamaños deben ser observables en el mismo lienzo.** El inspector conserva tokens semánticos, añade override directo donde corresponde y hace visible el cambio de tamaño/alineación/espaciado sin esperar al preview completo.
11. **El Color Studio actúa sobre la paleta efectiva del DRAFT.** La armonía no puede quedar desconectada por una paleta heredada de Stationery anterior.
12. **Cinemático sin portada mantiene contraste.** En el editor, el hero cinematográfico usa `bg/bgContrast` de la Recipe en vez de derivar fondo desde `ink`, evitando texto claro sobre claro u oscuro sobre oscuro.
13. **Volver del preview es determinista.** `Volver al Estudio de diseño` reconstruye la URL del panel de origen en un único clic en vez de depender del historial del navegador.

## Consecuencias

- El cliente puede probar una plantilla predefinida como composición armonizada y luego personalizarla.
- Cambiar color/forma del sobre no requiere un clic manual adicional en Guardar borrador antes de Apply.
- Las miniaturas continúan siendo livianas, mientras el modal y el preview completo reflejan la Recipe real con datos del evento.
- Un archivo eliminado por el usuario deja de generar solicitudes repetidas cuando ya fue identificado como ausente.
- Un owner/developer puede recorrer todo el catálogo para QA sin alterar el modelo de venta de servicios.
- La invitación pública sólo cambia al ejecutar `Aplicar cambios`.

## Evidencia

- `tests/rc39-design-parity.js`
- `tests/rc39-design-parity-visual.py`
- `tests/rc39-design-lab-catalog-visual.py`
- `docs/validation/evidence/RC39_DESIGN_PARITY_VISUAL.json`
- `docs/validation/evidence/RC39_DESIGN_LAB_CATALOG_VISUAL.json`
