# Trazabilidad RC34

| Requisito | Implementación | Prueba |
|---|---|---|
| Paletas predefinidas legibles | tokens semánticos en `src/theme-design.js`; Recipe-first en `themeDescriptor` | `rc34-design-coherence.js`, `rc34-readability-visual.py` |
| Apertura recomienda Recipes | `openingRecipeAffinity()` + `renderThemes()` | `rc34-design-coherence.js`, `rc34-control-wiring.js` |
| Sin guardado paralelo | eliminado `saveOpeningStyleBtn` | `rc28-stationery-studio.js`, `rc34-control-wiring.js` |
| Overrides al aplicar Recipe | `presentationOverrides` API | `rc34-design-coherence.js` |
| Sobre abre estudio avanzado | metadata `editor.type=stationery-studio` | RC28 estático/visual |
| Nombres largos | `fitSmartEventName` + contrato CSS keep-all | `rc34-readability-visual.py`, `visual-acceptance.py` |
| Roles/perfiles coherentes | entitlement projection independiente de perfil comercial | 1,280 casos en `rc34-design-coherence.js` |
| Todas las combinaciones del panel | normalización declarativa | 172,800 casos en `rc34-design-coherence.js` |
| Animaciones | motores existentes preservados | `visual-acceptance.py` |
