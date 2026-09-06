# Validación RC35 — EventStudio 6.15.0-rc.35

## Objetivo
Cerrar los hallazgos de QA físico de RC34: diferencia de legibilidad entre constructor y publicación, y flujo perceptible de dos editores para sobre/lacre.

## Validaciones ejecutadas
- Contratos RC27–RC35: PASS.
- Catálogo: 64 Recipes y 103 skins preservados: PASS.
- Matriz lógica RC34: 172,800 combinaciones de presentación: PASS.
- Matriz rol/perfil RC34: 1,280 proyecciones: PASS.
- Wiring de controles: 128 botones con referencia funcional verificable: PASS.
- Design Lab Chromium: navegación, Recipes, Assets, drag/transforms, bloques, apertura, Stationery embebido, presentación, Color Studio, undo/redo, guardar y preview: PASS.
- Public interaction Chromium: apertura/skip, música, links, idioma, galería/lightbox y RSVP: PASS.
- Color parity RC35: 64 Recipes × móvil/escritorio = 128 casos con paleta cruda; contraste AA, nombre largo y overflow 0: PASS.
- Recipe renderer: 64 Recipes × móvil/escritorio = 128 casos; assets, texturas, timelines, estilos y música operativa: PASS.
- QA legacy de temas y aperturas: 128 casos de plantilla + 22 aperturas; overflow 0, CLS 0, FPS mínimo 59.99: PASS.
- Matriz multidispositivo: 30 casos en 320×568, 360×800, 390×844, 412×915, 768×1024 y 1440×900: PASS.
- Contenido largo: 64 casos desde 320×568 hasta 3840×2160: PASS.
- Feature toggles: 32 casos; componentes apagados desmontados del DOM: PASS.
- Gifts RC24: 10 casos: PASS.
- Gifts RC25: 27 casos, overflow 0, CLS 0 y overlaps 0: PASS.
- Stationery visual: 2 casos + 5 perfiles; FPS mínimo 59.99: PASS.
- Sobre público/sincronización RC30: 2/2: PASS.
- Landing RC33: 2 casos: PASS.
- Álbum Recipe-first: 2 casos: PASS.
- Auditoría estructural: 425 archivos, 95 JavaScript verificados: PASS.
- Sintaxis: 95 JavaScript y 49 JSON: PASS.

## Hallazgos corregidos durante RC35
1. Design Studio y Stationery abrían superficies separadas visibles.
2. El constructor y renderer público no compartían una implementación única del algoritmo cromático del navegador.
3. Harness RC28 todavía exigía navegación directa al editor especializado.
4. El harness de Design Lab usaba un origen opaco; se sustituyó la base del editor embebido por `document.baseURI`, sin introducir excepción de producción.
5. Se eliminaron nombres reales usados como ejemplo en runtime/comentarios de producción.

## Límite de infraestructura
Se volvió a intentar `npm ci --no-audit --no-fund`, pero el contenedor agotó el tiempo de transporte y no instaló `express`, `better-sqlite3`, `qrcode`, `pdfkit` ni `bcryptjs`. Se ejecutó además `npm test`: integridad, referencias, UI móvil, red local y regresión RC14 pasaron; la cadena se detuvo en `tests/data-safety.js` exclusivamente por `MODULE_NOT_FOUND: better-sqlite3`. Los journeys que lanzan `src/seed.js` presentan la misma limitación. Por ello la suite E2E que levanta servidor/SQLite/checkout real no se declara ejecutada en este entorno.

**Gate antes de Railway:**

```bash
npm ci
npm run test:preproduction
npm audit --audit-level=moderate
```

No se sustituyó ese gate por mocks.
