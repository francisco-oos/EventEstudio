# ADR — DRAFT, ACTIVE y CATALOG — 6.16.0-rc.37

Estado: aceptado para QA. Fecha: 2026-09-04.

## Problema

El flujo anterior mezclaba guardar el trabajo, aplicar una Recipe al evento y crear una plantilla reusable. Eso producía acciones ambiguas, cambios públicos involuntarios y una experiencia fragmentada entre Panel, Design Lab y Stationery.

## Alternativas

1. Mantener `settings.designRecipe` como único estado: simple, pero autosave publicaría.
2. Clonar eventos por cada edición: alto costo, duplica datos privados y derechos.
3. Separar Recipe de evento en DRAFT/ACTIVE y catálogo de plataforma: elegida.

## Decisión

- `settings.designRecipe` es ACTIVE.
- `settings.designState.draftRecipe` y sus borradores de Stationery/lacre son DRAFT.
- `draftRevision`, `activeRevision`, timestamps, hashes y `lastAppliedDraftRevision` definen concurrencia y publicación.
- `PUT /api/admin/design/recipe` y `PUT /api/admin/design/stationery-draft` sólo guardan DRAFT.
- `POST /api/admin/design/apply` promueve DRAFT → ACTIVE en transacción, filtra experiencias por entitlement y es idempotente.
- `POST /api/admin/design/discard` restaura DRAFT desde ACTIVE sin modificar el público.
- `POST /api/admin/design/catalog-recipes` clona sólo la Recipe sanitizada y exige usuario de plataforma.
- el público normal resuelve ACTIVE; una URL de preview autorizada con `designMode=draft` resuelve DRAFT.

## Consecuencias

Positivas: no hay publicación por autosave; conflictos no sobrescriben; Stationery participa del mismo borrador; permisos quedan en backend. Costos: se mantienen dos revisiones y hay que migrar gradualmente controles heredados del Panel hacia el Estudio.

## Privacidad y seguridad

La Recipe no contiene nombres, fotos, invitados, direcciones ni RSVP. Los endpoints usan `authRequired` + `eventAllowed`; assets y props pasan allowlists; cliente no publica catálogo. Un `expectedRevision` obsoleto devuelve `409 DESIGN_DRAFT_CONFLICT`.

## Evidencia

`tests/v5-design-workflow.js`, `tests/rc33-commerce-design-e2e.js`, `tests/rc34-design-coherence.js`, `tests/security-adversarial.js`.
