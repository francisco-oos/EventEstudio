# Índice documental RC28

- `docs/analysis/ADR_STATIONERY_STUDIO_RC28.md`: decisión de separar el estudio avanzado, flujo de estado y política cromática.
- `docs/audits/AUDITORIA_RC28.md`: comparación RC26/RC27, capacidades conservadas y código legado retirado.
- `docs/validation/VALIDACION_RC28.md`: contratos, matriz cromática, perfiles y evidencia de ejecución.
- `docs/release-notes/RELEASE_NOTES_V6_14_2_RC28.md`: cambios de la candidata.
- `tests/rc28-stationery-studio.js`: regresión específica del estudio, sincronización y contraste.
- `src/opening-coordination.js`: política de coordinación de aperturas basada en catálogo.
- `public/stationery-studio.html`: vista avanzada cargada bajo demanda.
- `public/stationery-studio.js`: estado local de edición y persistencia atómica.
- `public/stationery-studio.css`: presentación del estudio separada del Design System del panel.

RC27 se conserva como antecedente del motor unificado y de la auditoría de aperturas. Cuando una decisión RC27 sobre ubicación del editor contradiga RC28, prevalece este índice y su ADR asociado.
