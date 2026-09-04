# EventStudio 6.14.2-rc.28

Fecha: 2 de septiembre de 2026

## Papelería y entradas

- El estudio avanzado de sobre, tarjeta y lacre vuelve a una ventana independiente del panel.
- El estudio sólo se carga cuando se selecciona `Sobre personalizable` y el usuario abre el editor.
- Se recupera `Guardar entrada` para persistir una apertura sin obligar a entrar al estudio.
- Nombres, fecha y tipografía se heredan del evento y no se vuelven a capturar.
- Se preservan presets, materiales, liners, overlays, estampillas, marcos, divisores y controles avanzados del lacre.
- `Aplicar a la invitación` guarda presentación, papelería y lacre en una operación.

## Sincronización visual

- La paleta completa del sobre sólo gobierna los demás módulos mientras el sobre unificado esté activo y la sincronización esté habilitada.
- Las entradas independientes pueden coordinar únicamente acentos según política del catálogo.
- `Sin apertura` no hereda una paleta antigua del sobre.
- QR, álbum de invitados e invitación física continúan consumiendo la paleta efectiva calculada por servidor y corregida para contraste.

## Arquitectura

- Nuevos `public/stationery-studio.*`.
- Nuevo `src/opening-coordination.js`.
- Metadatos `editor`, `coordination` y `colorControls` en `config/experiences.json`.
- Límites de controles de papelería/lacre y sugerencias del conector trasladados a catálogos.
- El panel ya no carga los renderers del estudio avanzado.

## Compatibilidad

- Se mantienen los alias históricos de las ocho entradas redundantes de sobre.
- No se modifican las mecánicas independientes.
- El pergamino mantiene la varilla Onfalós integrada en RC27.
- Las plantillas compatibles con lacre siguen consumiendo el renderer central.
