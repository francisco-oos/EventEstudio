# Validación RC34 — EventStudio 6.15.0-rc.34

## Objetivo
Corregir los hallazgos de QA físico móvil: contraste insuficiente en texto de Recipes claras, conflicto conceptual entre selección de apertura y aplicación de Recipe, y cortes dentro de nombres largos.

## Resultados ejecutados
- 64 Recipes: contraste semántico WCAG AA en tokens de texto: PASS.
- Matriz lógica de presentación: 172,800 combinaciones (64 Recipes × 15 aperturas × 9 galerías × 4 niveles de movimiento × 5 recorridos): PASS.
- Matriz rol/perfil: 1,280 proyecciones (64 Recipes × owner/developer/courtesy/free/paid × 4 perfiles comerciales): PASS. Los perfiles comerciales no alteran permisos.
- Wiring estático de controles: 125 botones con referencia funcional verificable; `Guardar entrada` eliminado: PASS.
- 64 Recipes × 2 escenarios móviles de nombres: 128 casos, 0 cortes dentro de palabra, 0 overflow: PASS.
- QA legacy temas: 128 casos móvil/escritorio, overflow 0: PASS.
- Aperturas: 22/22, overflow 0, CLS 0, FPS mínimo 59.99 en harness público: PASS.
- Feature toggles: 32/32, bloques deshabilitados desmontados del DOM: PASS.
- Contenido largo/dispositivos: 64/64 desde 320×568 hasta 3840×2160: PASS.
- Design Lab Chromium: navegación, Recipes, Assets, transforms, teoría del color, undo/redo, guardar y preview: PASS.
- Público Chromium: apertura/skip, música, links, idioma, galería/lightbox y RSVP: PASS.
- Stationery avanzado: 2 casos visuales + 5 perfiles: PASS.
- Sobre público RC30: 2/2, sincronización cromática preservada: PASS.

## Límite de infraestructura
El entorno de construcción no pudo completar `npm ci`; por ello no se marca como ejecutada la suite que requiere Express/better-sqlite3/checkout real. Antes de producción debe ejecutarse `npm ci && npm run test:preproduction && npm audit --audit-level=moderate` en un entorno con acceso al registro npm.
