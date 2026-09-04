# EventStudio 6.14.2-rc.22
## Arquitectura de sellos, RSVP desacoplado y regalos opcionales

### 1. Fuente funcional y consolidación de plantillas
Los archivos `EventEstudio-main.zip` y `EventEstudio-main(2).zip` recibidos para esta iteración son byte a byte equivalentes en su árbol de proyecto. Por ese motivo no existía una segunda implementación distinta que pudiera fusionarse desde `main(2)`. Las cinco plantillas aprobadas en la iteración anterior se recuperaron de la candidata `EventEstudio-main-video-templates-seals-r1.zip` y se aplicaron sobre la base funcional recibida.

Plantillas conservadas:
- `powder-blue-letter`
- `gala-marquee`
- `celestial-constellation`
- `blush-heart-letter`
- `gran-reserva`

Aperturas reutilizables conservadas:
- `powder-blue-seal`
- `gala-curtain`
- `constellation-veil`
- `blush-heart-emblem`
- `reserve-uncork`

### 2. Motor de sellos
El prototipo monolítico `index.html` fue utilizado como referencia funcional. No se incrustó dentro de la invitación pública. Se separaron responsabilidades:

- `config/seals.json`: catálogo de fuentes, materiales, bordes, ornamentos, calidad y defaults.
- `src/seal-config.js`: validación y normalización en servidor.
- `public/seal-renderer.js`: renderer SVG sin estado de interfaz.
- `public/seal-studio.html`, `public/seal-studio.js`, `public/seal-studio.css`: editor avanzado independiente.
- `public/app.js`: consume el renderer para aperturas; no vuelve a dibujar un sello por CSS específico de cada plantilla.

La irregularidad del borde es determinista. La misma combinación de evento, apertura y monograma conserva la misma forma. La animación transforma el SVG completo y no recalcula textura por frame.

### 3. RSVP
La disponibilidad comercial del módulo sigue controlada por `featureDecision`. Dentro de un evento que sí posee el módulo, el anfitrión puede apagar su uso mediante `settings.rsvp.enabled`.

El enlace público `/e/:slug` no requiere invitados. Cuando no hay token `?i=...`, la invitación se muestra sin formulario RSVP. Los enlaces personalizados continúan existiendo para capacidad, mesa, mensajes y confirmación individual.

### 4. Regalos
La sección bancaria se renderiza solamente cuando concurren todas estas condiciones:
- modo `bank-transfer` o `mixed`;
- `bankInfoEnabled === true`;
- existen datos bancarios no vacíos.

Openpay es independiente de la transferencia. Se activa mediante `gifts.openpay.enabled` y requiere configuración por entorno. Los datos de tarjeta se tokenizan en el navegador mediante Openpay.js; EventStudio recibe únicamente token y `device_session_id` para solicitar el cargo. La clave privada nunca se envía al navegador.

Variables:
- `OPENPAY_MERCHANT_ID`
- `OPENPAY_PUBLIC_KEY`
- `OPENPAY_PRIVATE_KEY`
- `OPENPAY_SANDBOX`

Los cargos aceptados se registran en `gift_contributions` con referencia del proveedor, monto, estado, nombre y mensaje.

### 5. Decisiones descartadas
- No se mantuvo un segundo renderer CSS de sellos junto al SVG.
- No se guardaron iniciales de ejemplo como defaults de producción.
- No se exige lista de invitados para publicar o compartir la invitación.
- No se obliga a utilizar Openpay cuando existen datos de transferencia.
- No se reciben PAN, CVV ni fecha de expiración en las rutas de EventStudio.

### 6. Límites de validación
La integración Openpay puede validarse estructuralmente y en sandbox sólo cuando se proporcionan credenciales de sandbox. Sin credenciales, la pasarela responde `OPENPAY_NOT_CONFIGURED` y no intenta realizar cargos.
