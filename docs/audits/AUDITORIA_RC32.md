# Auditoría técnica RC32 — Design Engine

## Alcance

Auditoría de la migración visual de EventStudio desde temas estáticos hacia `Assets + Components + Recipes`, preservando servicios productivos y reglas comerciales existentes.

## Inventario del nuevo sistema

- 64 Design Recipes v2.
- 17 assets iniciales registrados en AssetManifest.
- 12 componentes funcionales.
- 103 skins/variantes de sección, incluyendo música.
- 34 presentaciones fotográficas.
- 16 motion timelines.
- 12 frames QR.
- 8 layouts físicos catalogados.
- 10 armonías de Color Studio.

## Hallazgos corregidos durante QA físico automatizado

### Drag de assets

El handler retenía `event.currentTarget` después del evento `pointerdown`. En navegador real el valor puede volver a `null`, provocando excepción durante el desplazamiento y al retirar listeners.

Corrección: capturar el nodo en una variable estable al iniciar el drag.

### Overflow de Recipes en móvil

Once Recipes excedían entre 3 y 29 px el ancho a 360 px. El origen no eran assets individuales, sino reglas legacy de layout:

- desplazamiento alternado en `botanical`;
- márgenes laterales en `split`;
- rotación en `scrapbook`.

Corrección: contrato responsive específico para `body.theme-recipe` que neutraliza esas transformaciones en pantallas compactas sin afectar desktop.

Resultado: 128/128 renderizados Recipe en móvil/escritorio sin overflow.

### Colisión selector de idioma / música

En móvil, ambos controles flotantes ocupaban el mismo espacio inferior derecho. El selector de idioma tenía mayor z-index y bloqueaba el toque del botón de música.

Corrección: elevar verticalmente el selector de idioma en viewport compacto, preservando safe-area.

### Galería y pointer capture

El contenedor de galería capturaba el puntero también para mouse con el fin de detectar swipe. En Chromium el `pointer capture` podía impedir que la tarjeta recibiera el clic final para abrir lightbox.

Corrección: pointer capture sólo para touch/pen; mouse conserva clic normal. La detección de swipe móvil permanece.

### Harness RC30

El test visual RC30 esperaba la secuencia antigua de scripts y no cargaba `design-engine.js`. Se actualizó únicamente el harness para reflejar el loader productivo actual.

Resultado: 2/2 casos RC30 nuevamente en PASS, incluida sincronización cromática Stationery.

## Color

Las 64 Recipes tienen paletas distintas y metadata de teoría del color. El generador produce diez familias de armonía y el audit de contraste no reporta fallos en el catálogo prehecho.

`accent-dark` se incluye en la sincronización de `designKit` para evitar divergencia entre constructor, invitación y superficies coordinadas.

La paleta efectiva de Stationery continúa teniendo prioridad cuando corresponde.

## Música

Se verificó que:

- Recipe incluye sección music;
- entitlement filtra music en la proyección pública;
- con pista configurada, el botón real de EventStudio se muestra;
- reproducir y pausar actualizan el estado esperado;
- el Design Engine sólo aplica skin, no sustituye el reproductor.

## QA ejecutado

- catálogo RC31/RC32: PASS;
- Design System RC32: PASS;
- Design Lab interaction: PASS;
- Recipe visual: 128 casos, 0 fallos, 0 overflow;
- visual acceptance legacy: 128 temas/viewports, 0 fallos;
- aperturas: 22 casos, 0 fallos, FPS mínimo 59.99, CLS 0;
- device matrix: 30 casos, 0 fallos;
- gifts RC24: 10 casos, 0 fallos;
- gifts RC25: 27 casos, 0 fallos, CLS 0, overlaps 0;
- Stationery Studio: 2 casos + 5 perfiles, 0 fallos, FPS mínimo 60.00;
- RC30 public envelope: 2 casos, 0 fallos;
- public interactions RC32: PASS.

## Limitación del entorno

La entrega limpia no incluye `node_modules`. La reinstalación mediante `npm ci` no completó dentro del entorno aislado disponible, por lo que las pruebas que requieren módulos nativos/servidor (`better-sqlite3`, Express y dependencias asociadas) deben ejecutarse también en el entorno local del usuario después de `npm ci`.

No se sustituyeron esas pruebas por mocks para declarar un PASS artificial.
