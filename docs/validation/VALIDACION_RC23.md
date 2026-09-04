# Validación EventStudio 6.14.2-rc.23

## Estado de la candidata

RC23 incorpora una puerta de aceptación más estricta para perfiles, Mi Negocio, planos/layouts, multi-tenancy, plantillas, animaciones y enlace público. No se debe promover a estable hasta completar todas las puertas de release descritas en el ADR RC23.

## Evidencia ejecutada en el entorno de construcción

Se ejecutó `tests/visual-acceptance.py` sobre Chromium con el frontend real de EventStudio y datos QA deterministas.

Resultado:

- plantillas: 128/128 casos en verde (64 temas × 390×844 y 1440×900).
- overflow máximo de plantillas: 0 px.
- aperturas: 21/21 en verde.
- FPS mínimo observado en la última ejecución completa: 59.99.
- FPS medio observado: 60.00.
- peor intervalo p95 entre frames: 16.8 ms.
- CLS máximo: 0.
- overflow máximo de aperturas: 0 px.
- errores de consola/page errors: 0.

La evidencia completa está en `docs/validation/evidence/RC23_VISUAL_ACCEPTANCE.json`. Además, las cinco plantillas/aperturas nuevas se verificaron en 30/30 combinaciones sobre 320×568, 360×800, 390×844, 412×915, 768×1024 y 1440×900, con overflow máximo 0; esa matriz queda en `docs/validation/evidence/RC23_NEW_TEMPLATES_DEVICE_MATRIX.json`.

Durante esta prueba se detectó una colisión de aproximadamente 4 px en `cinematic-fold` con nombre largo y viewport 390×844. Se corrigió reservando separación móvil y se agregó una aserción de regresión en `tests/animation-contracts.js`. La matriz completa volvió a quedar en verde después del cambio.

También se ejecutaron previamente sobre la misma base los contratos que no requieren dependencias externas: integridad, referencias DOM, UI móvil, red local, regresiones RC14/15/15.1/17/19/20, contratos de animación, contratos visuales RC21 y módulos RC22; todos quedaron en verde antes de elevar la versión a RC23. Deben repetirse como parte de la suite final.

## Pruebas añadidas

- `tests/rc23-acceptance-contracts.js`: contratos de autorización, catálogo, animaciones, enlace público y documentación.
- `tests/rc23-concurrent-e2e.js`: Owner, Developer, clientes Premium/Starter/Express, Constructor de Perfiles, Mi Negocio, Planos/Layouts, acceso cruzado y ráfaga concurrente con medición p95.
- `tests/visual-acceptance.py`: render real de 64 plantillas y 21 aperturas con overflow, overlap, CLS, errores y FPS.
- `tests/visual-device-matrix.py`: seis viewports para las cinco integraciones visuales nuevas.

## Puertas pendientes del entorno actual

El entorno de construcción actual no tiene `node_modules` y el registro npm no respondió dentro del tiempo disponible. Por ello todavía no existe evidencia honesta de una ejecución completa de `npm test` ni del nuevo `tests/rc23-concurrent-e2e.js`, ambos dependientes de Express, bcrypt, better-sqlite3 y el resto de dependencias reales.

Esto es un bloqueo de validación, no un PASS implícito. De acuerdo con el Definition of Done, RC23 permanece como candidata hasta ejecutar en un runner con dependencias instaladas:

```text
npm ci
npm test
npm run test:rc23
npm run test:visual
npm run audit
npm audit --audit-level=moderate
```

No se permite sustituir estas pruebas por mocks de SQLite o permisos para declarar el release aprobado.
