# EventStudio 6.14.2-rc.24

## Regalos

- Datos bancarios separados en Banco, Titular, CLABE, Número de cuenta e Indicaciones.
- Transferencia bancaria completamente funcional con Openpay desactivado.
- Render público condicional: sólo aparecen datos activados y realmente capturados.
- Compatibilidad de lectura con el antiguo campo `bankInfo`.
- Openpay conserva un switch independiente.
- El monto sugerido puede quedar vacío; en ese caso el invitado captura la cantidad.
- Mensajes de felicitación opcionales con catálogo dinámico por tipo de evento.
- El invitado puede usar una sugerencia, editarla o escribir un mensaje propio.
- Los textos del catálogo se mantienen fuera del frontend para evitar hardcoding.

## Arquitectura y QA

- Nuevos módulos `src/gift-settings.js` y `src/gift-message-presets.js`.
- Nuevo catálogo `config/gift-message-presets.json`.
- Nueva regresión `tests/rc24-gifts.js`.
- Se conservan todas las puertas de aceptación RC23.

## Estado

Candidata QA. No promover a estable hasta completar la suite integral en un runner con dependencias instaladas y acceso al registro npm.
