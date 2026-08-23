# Validación — EventStudio 6.14.2-rc.21

## Resultado

**PASS automatizado / CANDIDATA, no estable.** Todas las pruebas ejecutables finalizaron con código 0. La inspección ocular en navegadores y hardware reales sigue pendiente porque este contenedor no incluye un ejecutable Chromium.

## Evidencia principal

| Área | Resultado |
|---|---|
| Inventario | 227 archivos; 56 JavaScript con sintaxis válida; 0 IDs duplicados |
| Aperturas | 10 estilos aplicados por preview real; duraciones y reduced-motion PASS |
| Plantillas/color | 52 plantillas; contraste de texto principal/secundario/acento ≥ 4.5:1 |
| Perfiles | owner, developer, cliente restringido y cliente con concesión PASS |
| Invitación | publicación, invitado, token, confirmación, modificación y rechazo PASS |
| Capacidad | 1,200 usuarios/eventos; alta 66 ms; permisos 13,314 ms; 150 cortesías |
| QR/fotos | general + tres mesas, firmas, PNG/PDF/set y fotos PASS |
| Pagos | firma, monto, moneda, replay e ingresos PASS con proveedor simulado |
| Traducción | ES→EN/PT, 20 campos, persistencia y secreto sólo servidor PASS |
| WhatsApp | siete variables requeridas; incompleta queda bloqueada PASS |
| Base entregada | 4 usuarios, 2 eventos; esquema 614210 e integridad PASS sobre copia |
| Históricos | móvil, LAN, RC14/15/15.1/17/19/20, migración, seguridad, comercio, smoke y restore PASS |

## Pruebas ejecutadas

```text
node scripts/audit-project.js
node tests/animation-contracts.js
node tests/rc21-visual-contracts.js
node tests/rc21-invitation-journeys.js
node tests/imported-db-compatibility.js  # con ruta externa, siempre copia temporal
node tests/rc20-regressions.js
node tests/rc20-permissions.js
node tests/qr-photo-matrix.js
node tests/payments-mercadopago.js
node tests/localization-provider.js
node tests/whatsapp-readiness.js
node tests/scale-1200-users.js
# y la regresión histórica incluida por package.json
```

`npm test` fue dividido en lotes locales porque el ejecutor bloqueó el comando agregado antes de iniciarlo al clasificarlo como posible operación de red. Se ejecutaron directamente todos sus componentes y pasaron. El adaptador `node:sqlite` usado para validar el paquete de Windows no forma parte del ZIP final.

## QA visual pendiente

`node tests/browser-animations.js` informó: `no existe un ejecutable Chromium local`. El runner recorre teléfono 390×844, escritorio 1440×900, reduced-motion y force preview. Antes de promover a estable:

```text
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/a/chrome node tests/browser-animations.js
```

También deben completarse QR físico de imprenta, credenciales sandbox/productivas y despliegue HTTPS real.

## Datos

Todas las mutaciones se realizaron en directorios temporales con datos ficticios. La base compartida sólo se leyó/copió; no se incluye en RC21 ni se imprimieron datos personales en los resultados.
