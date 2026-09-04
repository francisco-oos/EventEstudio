# Índice documental RC29

Fuente vigente para la candidata `6.14.2-rc.29`.

- `docs/analysis/ADR_STATIONERY_INDEX_PARITY_RC29.md`: decisión de recuperar la experiencia del generador maestro sin revertir la arquitectura desacoplada de RC28.
- `docs/audits/AUDITORIA_RC29.md`: comparación visual/funcional, recursos, sincronización, perfiles y hardcode.
- `docs/validation/VALIDACION_RC29.md`: pruebas ejecutadas, matriz 64x15, evidencia visual, perfiles y puerta npm pendiente.
- `docs/release-notes/RELEASE_NOTES_V6_14_2_RC29.md`: cambios de la candidata.
- `docs/validation/evidence/RC29_STATIONERY_INDEX_PARITY_VISUAL.json`: evidencia estructurada de navegador.
- `tests/rc29-stationery-index-parity.js`: contrato estático y cromático RC29.
- `tests/rc28-stationery-studio-visual.py`: QA visual actualizado a RC29; el nombre histórico se conserva por compatibilidad del script.
- `public/stationery-studio.html`: estructura de la herramienta avanzada.
- `public/stationery-studio.css`: paridad visual/responsive del generador maestro.
- `public/stationery-studio.js`: herencia, bibliotecas, clic abrir/cerrar y persistencia.
- `public/stationery-engine.js`: renderer compartido de papelería.
- `public/stationery-engine.css`: composición y animación compartida estudio/invitación.
- `src/opening-coordination.js`: autoridad/armonización de paletas según entrada.
- `config/stationery.json`: catálogos y recetas del generador.
- `config/seals.json`: catálogo y límites del lacre.
- `config/experiences.json`: apertura editable, editor y política de coordinación.

RC28 continúa siendo el antecedente arquitectónico para la ventana separada. Cuando RC28 describa la interfaz simplificada del estudio y contradiga RC29, prevalece este índice y `ADR_STATIONERY_INDEX_PARITY_RC29.md`.
