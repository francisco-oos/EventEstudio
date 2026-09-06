# Matriz de cobertura — 6.16.0-rc.39

| Requisito/hallazgo | Implementación principal | Prueba/evidencia | Estado |
|---|---|---|---|
| Recipe predefinida usa su identidad visual | `src/server.js`, `public/admin.js` | RC39 parity + catálogo visual | PASS |
| Apertura/Stationery por Recipe | `synchronizeStationeryFromRecipe`, `stationeryPresetForRecipe` | RC39 parity | PASS contrato |
| Personalización Stationery vuelve a DRAFT | `synchronizeRecipeFromStationery` | RC39 parity | PASS contrato |
| Apply sin Guardar borrador manual | `public/stationery-studio.js`, Design Lab autosave | RC39 parity | PASS contrato |
| Volver de preview en un clic | `public/design-lab.js` | Design Lab visual/contrato | PASS |
| Media borrada no reintenta 404 | `missingMediaSet`, `liveMediaUrl/list` | RC39 parity | PASS contrato |
| Datos reales Historia/Ubicación/Programa | `sectionText`, helpers settings | RC39 parity / Design Lab visual | PASS |
| Reutilizar portada existente | `settings.media.heroImage` | RC39 parity | PASS contrato |
| Bloque oculto sin hueco | public renderer/CSS | RC39 visual | PASS browser |
| Sliders/tamaño de título visibles | Design Lab variables de sección | RC39 visual | PASS browser |
| Color directo título/texto | inspector Design Lab | RC39 parity + catálogo visual | PASS |
| Color Studio afecta paleta efectiva | effective palette | RC39 parity | PASS contrato |
| Cinemático sin hero conserva contraste | `design-lab.css/js` | `RC39_DESIGN_LAB_CATALOG_VISUAL.json` | PASS 65/65 |
| Owner/developer puede QA Store | `platformExperienceOverrides` | RC39 parity | PASS lógico |
| Cliente sigue sujeto a derechos | servidor entitlements | RC34/RC39 | PASS lógico; E2E servidor BLOCKED_ENV |
| Recipe preview/readability | renderer | RC32/RC34/RC35 visual | PASS 130×3 matrices |
| Countdown/CTA contraste | renderer/CSS | RC39 visual | PASS focal |
| Responsive estrecho | CSS/renderers | RC38 responsive + device long | PASS Chromium |
| Apertura/skip/música/galería/RSVP | public renderer | RC32 public interactions | PASS Chromium |
| Stationery | Stationery RC27+ | RC28/29/30 visual | PASS Chromium |
| Álbum | Recipe gallery | RC33 album visual | PASS Chromium |
| Wiring botones | UI | RC34 control wiring | PASS 139 |
| Roles/perfiles | capabilities | RC34 coherence | PASS 1,300 proyecciones |
| Combinaciones de presentación | engine | RC34 coherence | PASS 175,500 |
| BD QA | `data/wedding.db` | hash + SQLite quick_check | PASS |
| Login/roles dinámicos Express | servidor real | necesita npm deps | BLOCKED_ENV |
| Upload foto/audio real | media routes | necesita servidor/deps | BLOCKED_ENV |
| Pagos/WhatsApp/migración/stress | suites heredadas | necesita servidor/deps | BLOCKED_ENV |
| Safari/Firefox/touch/lector/QR impreso/PDF físico | QA físico | checklist RC39 | NOT_RUN |
