# EventStudio 6.14.2-rc.25

## Regalos multimétodo

- Se sustituye la selección excluyente del panel por toggles independientes para lluvia de sobres, mesa de regalos y transferencia bancaria.
- Openpay continúa como switch independiente y puede coexistir con cualquier combinación.
- Se incorpora `gifts.methods` como modelo modular, manteniendo `gifts.mode` derivado para compatibilidad.
- Lluvia de sobres incorpora instrucciones propias del buzón físico.
- Transferencia añade `referenceConcept` como concepto sugerido.

## Mensaje motivador del anfitrión

- Nuevo catálogo `config/gift-persuasion-presets.json` con cuatro estrategias configurables.
- Nuevo módulo `src/gift-persuasion-presets.js` para validación, normalización y resolución.
- El mensaje elegido se muestra antes de los datos bancarios.
- Se admite mensaje completamente personalizado.
- Los IDs internos de selección no se exponen en la configuración pública.

## Dedicatoria del invitado

- Se conserva `openpayGiftMessage`.
- Se conservan las sugerencias RC24 del invitado y la posibilidad de escribir o editar una dedicatoria propia.
- Ambos flujos de mensajes permanecen independientes.

## QA

- Nueva regresión `tests/rc25-gifts-modular.js`.
- Nueva matriz visual `tests/rc25-gifts-visual.py`.
- Se mantienen activas las regresiones RC24.

## Estado

Candidata QA. La promoción continúa condicionada a la suite integral, pruebas visuales y auditoría de dependencias en un runner con dependencias instaladas.

## Endurecimiento de privacidad pública

- Los datos de transferencia guardados no se incluyen en la configuración pública cuando Transferencia está desactivada.
- Las instrucciones de lluvia de sobres no se exponen cuando ese método está apagado.
- El enlace de mesa de regalos sólo se proyecta cuando la mesa está activa.
- La lógica se concentra en `publicGiftProjection()` para permitir pruebas input/output sin depender del DOM.
