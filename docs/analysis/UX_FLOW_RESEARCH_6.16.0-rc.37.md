# Investigación de flujo UX — 6.16.0-rc.37

Fecha de revisión: 2026-09-04. Alcance: Panel → Plantillas → Estudio de diseño → Apertura → Sobre/lacre → Vista previa → Aplicar → Panel.

## Hallazgos del flujo recibido

| Hallazgo | Evidencia | Causa | Resolución RC37 |
|---|---|---|---|
| “Guardar diseño” no explicaba si guardaba o publicaba | Captura QA y UI RC36 | DRAFT, ACTIVE y catálogo compartían lenguaje | Autosave visible; CTA separado “Aplicar cambios a mi invitación”; catálogo sólo para plataforma |
| Volver terminaba en Resumen | Captura QA | no se transportaban `eventId`/tab de origen | `eventId`, `returnTab`, panel, selección, dispositivo y scroll se preservan |
| Sobre/lacre parecía otra aplicación | Capturas QA | navegación y header propios | submodo interno; header duplicado oculto; misma sesión y endpoint DRAFT |
| Editor y público discrepaban en color | Captura QA | resolución semántica distinta | Color Engine compartido, `headingColor`/`bodyColor`, advertencia y ajuste explícito |
| Cliente sólo manipulaba adornos | Inspección RC36 | inspector limitado | bloques ordenables/ocultables, estilo, superficie, ancho, spacing, alineación, tipografía y color |

## Referencias estudiadas y adaptación

| Fuente primaria | Principio extraído | Adaptación EventStudio | Descartado |
|---|---|---|---|
| [Canva: guardado](https://www.canva.com/help/save/) | autosave con estado visible | `Guardando…`, `Borrador guardado`, `Cambios sin guardar`, error/retry | hacer que autosave publique |
| [Canva: historial](https://www.canva.com/help/version-history/) | recuperar versiones y restringir por permiso | revisión optimista, conflicto 409, undo/redo y descarte confirmado | copiar un historial comercial completo |
| [Figma: propiedades](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) | inspector dependiente de selección | elemento y bloque muestran controles distintos | panel permanente con controles irrelevantes |
| [Figma: navegación](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) | estructura estable y reversible | izquierda: modos; centro: canvas; derecha: propiedades; topbar persistente | copiar la apariencia de Figma |
| [Figma: selección](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) | reglas consistentes de selección | outline, foco, drag, inspector y flechas de teclado | selección opaca o sólo táctil |
| [Wix Studio: breakpoints](https://support.wix.com/en/article/studio-editor-designing-across-breakpoints) | responsive por comportamiento | una Recipe, grid/flex y overrides acotados | duplicar plantillas por viewport |
| [Wix Studio: inspector](https://support.wix.com/en/article/studio-editor-using-the-inspector-panel) | precisión desde inspector | transformaciones exactas y propiedades de bloque | coordenadas absolutas para bloques funcionales |
| [WCAG 2.2: contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) | 4.5:1 para texto normal | resolver texto sobre fondo/papel y reportar ajustes | usar `accent` como color universal |
| [WCAG 2.2: foco](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) | foco visible | anillo de 3 px en navegación, controles y assets | interacción sólo por puntero |

## Patrón adoptado

El shell conserva evento y acciones. Los modos cambian dentro del mismo documento. Stationery y Preview usan un workspace interno visualmente continuo; el iframe temporal no presenta header o menú propio y no abre pestañas. La URL conserva panel/modo para Back/Forward y `sessionStorage` conserva contexto no publicable.

El contenido permanece en Event Data. La Recipe sólo contiene presentación. DRAFT se guarda automáticamente; Preview consume DRAFT; el público consume ACTIVE; Aplicar promueve transaccionalmente. Guardar/publicar catálogo es una capability de plataforma.

## Riesgo residual

La comprobación visual real multidispositivo/navegador de RC37 queda `NOT_RUN` en este entorno porque no existe Playwright ni binario de navegador. Debe ejecutarse en QA físico antes de promover RELEASE.
