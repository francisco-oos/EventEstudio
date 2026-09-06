# EventStudio 6.16.0-rc.37 — V5 Fluidez integral

Estado: **candidata QA**. No es Production Ready hasta completar la matriz visual y física descrita en `docs/checklists/QA_FISICO_FINAL_6.16.0-rc.37.md`.

## Resultado principal

El área de diseño se comporta como una sola sesión: Panel → Plantillas → Estudio de diseño → Sobre/Lacre → Vista previa → Aplicar → regreso al contexto de Plantillas. El borrador, el diseño activo y las recetas de catálogo ya no comparten una acción ambigua.

## Cambios funcionales

- DRAFT y ACTIVE independientes, con revisiones, conflicto optimista y promoción transaccional/idempotente.
- Autosave con estados visibles; CTA exacto `Aplicar cambios a mi invitación`; descarte confirmado del borrador.
- Acciones de catálogo ocultas por capability y validadas también en backend.
- Stationery montado como modo interno del mismo Estudio, sin nueva pestaña ni segundo encabezado perceptible.
- Memoria de `eventId`, tab de origen, panel, dispositivo, selección y scroll; Back/Forward mantiene los modos internos.
- Inspector contextual para elementos y bloques; transformación por arrastre, controles precisos, teclado, duplicado y eliminación.
- Tipografía de bloques: tamaño, peso, color semántico, alineación, ancho, interlineado, tracking, casing, superficie y espaciado.
- Reordenamiento/visibilidad/variante de bloques bajo zonas responsivas; Event Data permanece fuera de Recipe.
- Color Engine semántico compartido entre editor y publicación, con advertencia de contraste y ajuste sólo bajo acción explícita.
- Sincronización de Recipe/tokens con invitación, preview, miniatura, álbum, QR, QR de mesa, Stationery y configuración de impresión.
- Biblioteca con búsqueda, categorías, paginación y carga bajo demanda; el público carga únicamente los assets usados.
- Terminología visible normalizada al español en el flujo de diseño y catálogo.

## Biblioteca Gemini

Se recibieron dos SVG físicos utilizables y cuatro JSON con referencias adicionales no materializadas. Se integraron sólo:

- `botanical-elegant-frame.svg`
- `botanical-elegant-divider.svg`

Ambos fueron normalizados al AssetManifest nativo y se añadió la Recipe `botanica-elegante-gemini`. No se crearon plantillas HTML estáticas ni un motor paralelo. Detalle en `docs/traceability/ASSET_INGEST_REPORT_6.16.0-rc.37.md`.

## Catálogo resultante

- 65 Recipes
- 19 assets
- 12 componentes
- 103 estilos de sección
- 34 presentaciones fotográficas
- 16 secuencias de movimiento
- 12 marcos QR
- 8 layouts de impresión

## Estabilidad y rendimiento

- Restaurado `.github/workflows/ci.yml` exigido por la integridad del proyecto.
- Auditoría separada por perfil QA/RELEASE.
- Catálogo comercial cacheado con invalidación después de mutaciones; RC23 registró p95 de 218–244 ms frente al límite de 1,500 ms.
- Protección RC36 de SQLite conservada; no hubo seed ni migración destructiva sobre la BD recibida.

## Validación

Las suites Node de V5, RC33–RC36, seguridad, E2E comercial/diseño y auditoría QA pasaron. La cadena `npm test` llegó hasta el contrato Node de RC32 y se detuvo exclusivamente al importar Playwright, ausente en este entorno. Las suites Node posteriores se ejecutaron por separado y pasaron.

No ejecutado: navegadores Playwright, 10 viewports × 3 motores, touch físico, lector de pantalla, escaneo QR impreso y despliegue Railway. Estas pruebas permanecen `NOT_RUN`, nunca inferidas como PASS.

## Alcance deliberado

No se implementó Fase B (Agency, timeline familiar, marketplace, personajes originales ni VideoRenderer). La arquitectura queda extensible, sin botones ficticios ni placeholders de producción.
