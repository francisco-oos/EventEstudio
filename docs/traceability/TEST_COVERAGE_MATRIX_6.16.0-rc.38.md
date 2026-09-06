# Matriz de cobertura — 6.16.0-rc.38

| Requisito/hallazgo | Implementación principal | Prueba/evidencia | Estado |
|---|---|---|---|
| Guardar/Apply sin 409 bloqueante | `public/design-lab.js`, `src/server.js` | `rc38-design-studio-hardening.js` | PASS contrato |
| Preview sin 401 de preview-links | `public/design-lab.js`, `public/admin.js` | RC38 hardening | PASS contrato |
| Preview muestra Recipe seleccionada | `src/server.js::publicConfig` | RC38 + `rc32-recipe-visual.py` | PASS |
| Apply directo desde catálogo | `public/admin.html/js` | RC38 + RC34 wiring | PASS wiring / E2E servidor BLOCKED_ENV |
| Buscador con sugerencias | `public/admin.js`, `public/design-lab.js` | RC38 | PASS |
| Panel de apertura estable | `public/styles.css` | `RC38_RESPONSIVE_VISUAL.json` | PASS |
| Texto de apertura/fecha contenido | `public/styles.css` | visual acceptance + RC38 responsive | PASS |
| Countdown responsive | `public/styles.css` | RC38 responsive | PASS |
| Color directo por bloque | Design Engine + Lab | RC38 + RC34/35 | PASS |
| Contraste de presets | Design Engine | 65 Recipes AA + RC34/35 browser | PASS |
| Tipografías ampliadas | typography presets + FONT_MAP | RC38 | PASS |
| Scroll al bloque editado | `ensureSelectedSectionVisible` | RC38 contract + Design Lab browser | PASS |
| Gallery/media real en canvas | `renderCanvas` | Design Lab browser | PASS mock/browser |
| Música pública visible sólo si corresponde | `public/app.js` | `rc32-public-interactions.py` | PASS |
| Hero bajo demanda | `public/app.js`, `public/design-engine.js` | RC38 | PASS contrato |
| PDF/QR respetan hero activo | `printableEventHeroPath` | RC38 | PASS contrato / PDF real BLOCKED_ENV |
| Stationery unificado | Stationery RC27+ | RC27–30 + browser | PASS |
| Botones/controles | UI completa | RC34: 139 | PASS |
| Perfiles/roles | Design access/coherence | RC34: 1,300 proyecciones | PASS lógico |
| Presentaciones | Recipe/opening/gallery/motion/mode | RC34: 175,500 combinaciones | PASS lógico |
| Aperturas/animaciones | public renderer/CSS | visual acceptance: 22 casos | PASS Chromium |
| Device responsive | CSS/renderers | 30 + 64 + 9 casos | PASS Chromium |
| BD QA | `data/wedding.db` | RC38_DB_INTEGRITY.json | PASS |
| Upload real foto/audio + persistencia | server/media routes | requiere servidor/deps | BLOCKED_ENV |
| Smoke/seguridad/migración/pagos/WhatsApp | suites heredadas | requiere deps | BLOCKED_ENV |
| Safari/WebKit, Firefox real, touch, lector de pantalla | QA físico | checklist final | NOT_RUN |
