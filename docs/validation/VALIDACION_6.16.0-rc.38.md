# Validación — EventStudio 6.16.0-rc.38

Estado: **QA candidate**. Esta entrega corrige los hallazgos de las capturas RC37 y amplía cobertura visual real con Chromium. No se marca Production Ready.

## Resultado automatizado ejecutado

| Área | Resultado | Evidencia |
|---|---|---|
| Sintaxis JS | PASS | 98 archivos `node --check` |
| Auditoría estructural QA | PASS | 480 archivos revisados; versión 6.16.0-rc.38 |
| Design Engine RC31/32 | PASS | 65 Recipes, 19 assets, 12 componentes, 103 skins |
| Color/coherencia RC34/35 | PASS | 175,500 combinaciones + 1,300 proyecciones rol/perfil; AA en presets |
| Wiring controles | PASS | 139 botones/controles verificables |
| Hardening RC38 | PASS | 409, preview, catálogo, colores, media, impresión y favicon |
| Recipe browser | PASS | 130 casos, 0 fallos, overflow 0 |
| Aperturas browser | PASS | 22 casos, 0 fallos, CLS 0, overflow 0; FPS min ~57.7 |
| Device matrix | PASS | 30 casos entre 320×568 y 1440×900, 0 fallos |
| Responsive RC38 | PASS | 9 casos focales: apertura/countdown/panel a 320/390/1366 |
| Contenido largo | PASS | 64 casos, 0 fallos |
| Feature visibility | PASS | 32 casos; módulos deshabilitados desmontados |
| Álbum Recipe | PASS | 2 casos |
| Stationery | PASS | RC27–30 + 2 casos browser/5 perfiles |
| Invitación pública/interacciones | PASS | apertura/skip, música, links, idioma, galería/lightbox y RSVP |
| BD incluida | PASS | `quick_check=ok`, 43 tablas, 4 usuarios, 2 eventos |

## Pruebas Node heredadas ejecutadas sin dependencias externas

PASS: integridad de proyecto, referencias DOM/recursos, UI móvil, red local, RC14, RC15/15.1, RC17, RC19, contratos de animación, RC20 regresiones estáticas, RC21 visual contracts, RC22, RC23 acceptance contracts, RC24, RC25, RC27, RC28, RC29, RC30, RC31, RC32, RC33, RC34, RC35, RC36 y RC38.

Los tests históricos `rc26-seal-studio.js`/`rc26-seal-sync-ui.js` no forman parte de `npm test` actual porque validan el módulo de sello aislado que fue retirado deliberadamente al unificarlo en Stationery RC27+.

## BLOCKED_ENV, no PASS

Las pruebas que necesitan iniciar el servidor real no pudieron ejecutarse en este runtime porque no hay resolución DNS hacia `registry.npmjs.org` y el proyecto no vende `node_modules`. Esto afecta, entre otras, a smoke/restore/seguridad BD, permisos dinámicos, 1,200 usuarios, pagos, WhatsApp, migraciones y V5 E2E con SQLite real.

La BD real sí fue inspeccionada de manera no destructiva mediante SQLite de Python; no se ejecutó `seed`.

## Verificación de incidencias concretas

- `409` conserva protección y el cliente puede reconciliar la revisión: PASS por contrato RC38.
- `401 /api/admin/preview-links` eliminado del flujo interno del Design Lab: PASS.
- preview de plantilla distinta a ACTIVE: PASS por contrato servidor + browser Recipe.
- Apply desde modal de catálogo: wiring PASS; integración servidor queda dentro del gate `npm run test:preproduction`.
- sugerencias de búsqueda con teclado: PASS por contrato.
- color por bloque + HEX + contraste: PASS.
- color de apertura sin regeneración por pixel: PASS.
- color de apertura reconstruye URL de preview y DRAFT hereda `openingProps`: PASS por contrato.
- copy “UNA INVITACIÓN PARA TI”, nombres, fecha y countdown sin overflow: PASS en matrices Chromium.
- hero histórico/Bluey no se descarga debajo de una apertura y puede desactivarse: PASS por contrato de renderer.
- música y galería se renderizan sólo si feature + sección están visibles: PASS por browser/interacciones.
- favicon: PASS.

## Gate antes de producción

En la computadora QA con acceso a npm:

```text
npm ci
npm run test:preproduction
npm audit --audit-level=moderate
```

Después completar `docs/checklists/QA_FISICO_FINAL_6.16.0-rc.38.md` en Edge/Chrome móvil y escritorio, probar archivos reales de foto/audio, QR impreso y PDF físico. No promover si aparece un FAIL.
