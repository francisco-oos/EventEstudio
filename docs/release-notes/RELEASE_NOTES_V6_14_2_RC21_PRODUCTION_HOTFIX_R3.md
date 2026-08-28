# EventStudio 6.14.2-rc.21 — Production migration hotfix r3

## Corregido

- Migración desde bases legacy `user_version=0` cuya tabla `plans` no contiene `retention_days`.
- Orden de creación de columnas de planes antes de preparar el seed/upsert comercial.
- Reintentos de migración reutilizan el primer snapshot verificado para evitar múltiples copias pre-migración durante restart loops.

## Añadido

- `npm run test:production-migration`.
- Fixture de regresión que reconstruye físicamente `plans` con esquema antiguo y comprueba migración, retry, Store, FK e integridad.

## Sin cambios

- 59 plantillas y 16 aperturas.
- frontend y CSS.
- Store y precios.
- roles/permisos.
- RSVP/QR/fotografías.
- Mercado Pago/WhatsApp.
