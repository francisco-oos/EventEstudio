# ADR — Regalos opcionales, transferencia y mensajes de felicitación — EventStudio 6.14.2-rc.24

## Estado

Aceptado para la candidata RC24. La promoción a estable conserva todas las puertas de QA definidas en RC23.

## Contexto

RC22 introdujo transferencia bancaria y Openpay como alternativas de regalo. La implementación permitía ambas modalidades, pero la experiencia de configuración todavía presentaba tres problemas:

1. Los datos bancarios estaban concentrados en un único campo libre, lo que hacía poco evidente dónde capturar banco, titular, CLABE y número de cuenta.
2. El monto sugerido de Openpay no podía permanecer realmente vacío: el panel y el servidor aplicaban un valor implícito.
3. El mensaje de felicitación era un textarea libre sin ayuda contextual para el invitado.

## Decisión 1 — Datos bancarios estructurados y opcionales

La configuración conserva `bankInfoEnabled` como activador explícito y agrega `gifts.bank` con los campos `bankName`, `accountHolder`, `clabe`, `accountNumber` e `instructions`.

La invitación pública sólo renderiza los campos que tengan contenido. Openpay no participa en esta decisión y puede permanecer desactivado. Se mantiene lectura de `bankInfo` como compatibilidad con eventos creados antes de RC24.

### Alternativas evaluadas

- Mantener un único textarea: descartado porque dificulta validación, presentación y evolución futura.
- Obligar a usar CLABE y número de cuenta simultáneamente: descartado porque diferentes anfitriones comparten datos distintos.
- Vincular transferencia a Openpay: descartado porque impondría una pasarela y potenciales comisiones a quien sólo desea publicar sus datos bancarios.

### Riesgos y mitigación

- Datos incompletos: el panel valida CLABE sólo cuando se captura y exige exactamente 18 dígitos.
- Eventos antiguos: el frontend conserva fallback a `gifts.bankInfo`.
- Exposición accidental: el bloque no se renderiza si `bankInfoEnabled` está apagado o no existen datos.

## Decisión 2 — Openpay independiente y monto sugerido anulable

`gifts.openpay.enabled` continúa siendo un switch independiente. `suggestedAmountCents` ahora acepta `null`.

Si el monto sugerido queda vacío, el invitado captura el monto. Para evitar una configuración imposible, `allowCustomAmount` se normaliza a `true` cuando `suggestedAmountCents` es `null`.

### Alternativas evaluadas

- Mantener un monto predeterminado obligatorio: descartado porque puede crear anclaje no deseado y no corresponde a todos los eventos.
- Aceptar monto vacío con `allowCustomAmount=false`: descartado porque dejaría el checkout sin una cantidad utilizable.

## Decisión 3 — Catálogo de mensajes sugeridos sin hardcoding en la UI

Los mensajes sugeridos viven en `config/gift-message-presets.json` y son validados por `src/gift-message-presets.js`. El catálogo permite mensajes generales y específicos por tipo de evento.

Cuando el anfitrión activa `messageEnabled`, el invitado puede elegir una sugerencia o escribir un mensaje completamente personalizado. La selección nunca es obligatoria.

Los principios editoriales utilizados son empatía, gratitud, pertenencia, reconocimiento, memoria compartida y proyección positiva. Se descartaron tácticas basadas en culpa, presión, falsa escasez, comparación social o coerción. El objetivo es facilitar una expresión cálida, no manipular el monto del regalo.

Los metadatos internos `principles` no se envían al invitado; la API pública sólo expone `id`, `label` y `text`.

## Componentes

- `config/gift-message-presets.json`: catálogo editorial.
- `src/gift-message-presets.js`: validación y selección por tipo de evento.
- `src/gift-settings.js`: normalización de datos bancarios y opciones Openpay.
- `public/admin.html` / `public/admin.js`: captura estructurada y vista previa.
- `public/index.html` / `public/app.js`: render condicional, monto opcional y sugerencias editables.
- `tests/rc24-gifts.js`: regresiones de configuración, catálogos y contratos frontend/backend.

## Compatibilidad

No se modifica el contrato de contribuciones ya almacenadas ni el proceso de tokenización de tarjeta. Los datos de tarjeta continúan sin enviarse al servidor de EventStudio; sólo se procesa el token entregado por Openpay.
