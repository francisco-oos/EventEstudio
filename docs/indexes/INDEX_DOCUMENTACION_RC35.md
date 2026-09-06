# Índice documental EventStudio 6.15.0-rc.35

## Arquitectura
- `docs/analysis/ADR_DESIGN_ENGINE_ASSETS_COMPONENTS_RECIPES_RC32.md`
- `docs/analysis/ADR_DESIGN_ECOSYSTEM_SYNC_RC33.md`
- `docs/analysis/ADR_RECIPE_OPENING_RECOMMENDER_CONTRAST_RC34.md`
- `docs/analysis/ADR_UNIFIED_DESIGN_STUDIO_COLOR_AUTHORITY_RC35.md`

## Auditoría y validación
- `docs/audits/AUDITORIA_RC35.md`
- `docs/validation/VALIDACION_RC35.md`
- `docs/traceability/TRACEABILITY_RC35.md`

## Release
- `docs/release-notes/RELEASE_NOTES_V6_15_0_RC35.md`

## Evidencia automatizada relevante
- `docs/validation/evidence/RC35_COLOR_PARITY_VISUAL.json`
- `docs/validation/evidence/RC32_RECIPE_VISUAL.json`
- `docs/validation/evidence/RC23_VISUAL_ACCEPTANCE.json`
- `docs/validation/evidence/RC33_FEATURE_MATRIX_VISUAL.json`
- `docs/validation/evidence/RC33_DEVICE_CONTENT_VISUAL.json`

## Gate de promoción
1. `npm ci`
2. `npm run test:preproduction`
3. `npm audit --audit-level=moderate`
4. QA físico del anfitrión en móvil/escritorio.
