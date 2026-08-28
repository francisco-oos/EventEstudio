# Validación — Add-on de plantillas papel + Linvia sobre EventStudio RC21

## Criterio de aceptación

El add-on sólo se considera válido si:

1. conserva las 52 plantillas y 10 aperturas originales;
2. suma 7 plantillas y 6 aperturas sin IDs duplicados;
3. las 59 paletas son derivables desde CSS y mantienen contraste contractual ≥ 4.5:1;
4. las aperturas nuevas tienen estado `.is-opening`, tiempo perceptible, responsive y reduced-motion;
5. el DOM del sobre y el controlador original no cambian;
6. `app.js` conserva `void playOpeningMusic()` y no introduce `await` bloqueante;
7. las regresiones RC21 existentes siguen pasando;
8. el QA visual no presenta overflow horizontal ni ocultamiento prematuro.

## Pruebas automáticas

```text
node tests/animation-contracts.js
node tests/rc21-visual-contracts.js
node tests/project-integrity.js        # sobre copia temporal sin la DB entregada
node tests/source-references.js
node tests/mobile-ui.js
node tests/rc20-regressions.js
node tests/rc21-invitation-journeys.js
node tests/browser-animations.js       # recorre todo el catálogo si Playwright está disponible
```

`browser-animations.js` ya itera `config/experiences.json`, de modo que las seis aperturas añadidas quedan automáticamente incluidas cuando exista Playwright. En este entorno Playwright no está instalado, pero existe Chromium del sistema; se complementa con capturas headless de páginas sintéticas que usan el HTML real de las cinco capas y `public/styles.css` real.

## Matriz adicional

| Elemento | Contrato |
|---|---|
| `newspaper-fold` | normal ≥ 4.3 s; móvil; reduced-motion |
| `vintage-parchment` | normal ≥ 4.5 s; móvil; reduced-motion |
| `olive-universe-orbit` | normal ≥ 4.6 s; móvil; reduced-motion |
| `olive-nectar-seal` | normal ≥ 4.3 s; tarjeta sin hueco visual |
| `blue-aurora-reveal` | normal ≥ 4.4 s; velos dentro del viewport |
| `botanical-cosmos-orbit` | normal ≥ 4.7 s; órbitas dentro del viewport |

## Datos

El ZIP funcional contiene su propia carpeta `data`. No se elimina ni modifica como parte del add-on. Las pruebas que exigen una entrega sin DB se ejecutan sobre una copia temporal con esos archivos apartados y luego se restaura la carpeta intacta.

## Resultado ejecutado en esta integración

- `animation-contracts`: PASS.
- `rc21-visual-contracts`: PASS con **59 paletas**.
- `rc21-invitation-journeys`: PASS con **59 plantillas y 16 aperturas** usando la ruta HTTP real de preview/configuración/RSVP.
- `project-integrity`, `source-references` y `mobile-ui`: PASS sobre copia temporal sin alterar la DB/media incluida en la base funcional.
- QA visual Chromium/Playwright del entorno: PASS en **390×844** y **1440×900** para las 7 plantillas añadidas; `scrollWidth == viewportWidth`.
- QA visual de aperturas: PASS para las 6 aperturas añadidas. Durante la primera ejecución se detectó overflow transitorio en `olive-universe-orbit` y `blue-aurora-reveal`; se corrigió con recorte local del contenedor animado y la repetición dio 390×844 sin overflow.
- La ejecución agregada de `npm test` avanzó satisfactoriamente por integridad, referencias, móvil, LAN, RC14, seguridad de datos, migración, orígenes, headers y commerce journeys. El runner quedó consumiendo CPU dentro de `smoke.js` al usar el adaptador `node:sqlite` del entorno Linux para sustituir el binario Windows de `better-sqlite3`; se detuvo sin modificar el proyecto. Las pruebas RC21 relevantes se ejecutaron después de forma individual y finalizaron PASS.

El ZIP conserva el `better-sqlite3` original de la base funcional; el shim sólo se usa mediante `NODE_OPTIONS` durante auditoría en este contenedor y no se activa en producción.
