# Matriz de paridad de renderers — 6.16.0-rc.37

| Propiedad | Editor DRAFT | Preview DRAFT | Público ACTIVE | Thumbnail/otros | Resultado |
|---|---|---|---|---|---|
| hash/Recipe | `draftHash` | mismo `draftHash` | `activeHash` hasta Apply | hash de Recipe | PASS V5 |
| orden/visibilidad de bloques | Recipe | Recipe | Recipe aplicada + entitlement | thumbnail resume | PASS lógico |
| estilos de componente | `styleId` | `data-es-style` | `data-es-style` | print adapta | PASS contratos |
| colores/títulos/cuerpo | Color Engine | mismo engine | mismo engine | descriptor/aliases | PASS lógico |
| fuente/tamaño/peso/line-height/spacing | inspector | props sanitizadas | props sanitizadas | print adapta | PASS lógico |
| assets | instancias DRAFT | sólo assets usados | sólo ACTIVE usados | SVG real/lazy | PASS V5 |
| apertura | DRAFT | DRAFT | ACTIVE permitido | Stationery/print adapta | PASS funcional |
| datos reales | bindings de Event Data | mismos bindings | mismos bindings | cada renderer adapta | PASS contratos |

La comparación visual captura-a-captura Editor/Preview/Público para las 65 Recipes y diez viewports es NOT_RUN por ausencia de navegador. No se infiere paridad píxel a píxel a partir del JSON.
