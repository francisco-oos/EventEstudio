# Reporte de bugs — 6.16.0-rc.37

| ID | Antes | Causa | Corrección | Estado/evidencia |
|---|---|---|---|---|
| V5-01 | “Guardar diseño” no aclaraba si publicaba | DRAFT, ACTIVE y catálogo compartían semántica | autosave, Apply y catálogo separados | PASS · `tests/v5-design-workflow.js` |
| V5-02 | Volver llevaba a Resumen | no se conservaba tab/contexto de entrada | retorno con `eventId` y `returnTab` | PASS estático/contrato; recorrido visual NOT_RUN |
| V5-03 | Sobre/Lacre parecía otra aplicación | navegación independiente | modo embebido bajo el shell del Estudio | PASS contrato RC35; visual físico NOT_RUN |
| V5-04 | Colores correctos en editor divergían en público | resolutores cromáticos paralelos | motor y aliases semánticos compartidos | PASS lógico RC34/RC35/V5; paridad de píxel NOT_RUN |
| V5-05 | Cliente sólo transformaba adornos | inspector incompleto | estilo y orden de bloques, texto, tipografía y layout seguro | PASS contrato V5 |
| V5-06 | Acciones de diseñador podían contaminar UX cliente | permiso implícito por rol/UI | capabilities granulares y validación backend | PASS seguridad V5 |
| V5-07 | Doble clic en Apply podía duplicar trabajo | falta de exclusión/idempotencia | bloqueo UI y promoción idempotente | PASS V5 |
| V5-08 | No había forma segura de descartar DRAFT | endpoint/acción inexistentes | descarte confirmado con restauración de ACTIVE | PASS V5 |
| V5-09 | `npm test` fallaba por CI ausente | archivo omitido del ZIP anterior | workflow CI restaurado | PASS `project-integrity.js` |
| V5-10 | Auditoría rechazaba el paquete QA por incluir BD/.env | una sola política de paquete | perfiles `qa` y `release` | PASS en ambos perfiles |
| V5-11 | RC23 p95 era 2.2–2.34 s | consultas repetidas al catálogo inmutable | cache e invalidación explícita | PASS · 218–244 ms |
| V5-12 | RC28–30 suponían persistencia anterior a V5 | contratos desactualizados | pruebas alineadas con Stationery en DRAFT | PASS RC28–RC30 |
| V5-13 | manifests Gemini referían archivos no recibidos | confianza en metadata externa | ingest sólo de los dos SVG físicos | PASS validación catálogo |
| V5-14 | un fallo al descartar podía marcar la copia local como limpia | `dirty=false` antes de confirmar HTTP | el estado se limpia sólo tras respuesta válida | PASS contrato/sintaxis |
| V5-15 | catálogo público mezclaba “Recipe/Assets/Components” | vocabulario técnico visible | etiquetas españolas orientadas al usuario | PASS inspección estática |

## Observaciones abiertas

No hay bugs automatizados conocidos pendientes en el alcance ejecutable. Las diferencias que sólo puedan detectarse mediante render real, interacción touch, lector de pantalla o impresión siguen abiertas como riesgo de QA porque esas pruebas están `NOT_RUN`.
