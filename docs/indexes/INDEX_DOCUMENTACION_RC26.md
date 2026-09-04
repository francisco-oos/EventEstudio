# Índice documental RC26

Versión: `6.14.2-rc.26`

## Decisión principal
- `../analysis/ADR_SEAL_STUDIO_APPLY_RC26.md`

## Validación
- `../validation/VALIDACION_RC26_SEAL_STUDIO.md`

## Release notes
- `../release-notes/RELEASE_NOTES_V6_14_2_RC26.md`

## Contexto heredado
- `INDEX_DOCUMENTACION_RC25.md`
- `../analysis/ARQUITECTURA_SEAL_RSVP_GIFTS_RC22.md`

## Puertas QA
- `npm run test:rc26` valida el contrato del Studio y la persistencia de todas las propiedades avanzadas.
- `npm run test:visual` conserva la matriz visual de plantillas y aperturas.
- La promoción final continúa requiriendo `npm test`, `npm run audit` y `npm audit --audit-level=moderate` en un runner con dependencias completas.
