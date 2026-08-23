# Seguridad — EventStudio 6.14.2-rc.20

## Controles validados

| Riesgo | Control | Evidencia |
|---|---|---|
| Escalada de rol | Backend resuelve rol y evento; owner/developer platform, cliente sólo `user_events` | `tests/rc20-permissions.js` |
| IDOR entre eventos | Cliente A recibe 403 al consultar evento B | `tests/rc20-permissions.js` |
| Concesión filtrada | Courtesy ligada a `event_id`; cliente B continúa sin derecho | `tests/rc20-permissions.js` |
| Cobro falso por retorno | El redirect no activa; sólo webhook verificado | `src/server.js`, `tests/payments-mercadopago.js` |
| Webhook falsificado | HMAC `x-signature` con comparación constante | `src/payments.js` |
| Importe/moneda alterados | Consulta GET al proveedor y comparación exacta en centavos/moneda | prueba 409 `PAYMENT_AMOUNT_MISMATCH` |
| Replay de webhook | Activación idempotente por estado y referencia de grant | webhook repetido devuelve 200 sin doble ingreso |
| Secretos | Variables de entorno; logger filtra password/secret/token/cookie/authorization | `.env.example`, `src/logger.js` |
| QR de mesa manipulado | HMAC ligado a evento, slug y mesa; comparación constante | firma cruzada → 400 |
| Foto directa | Contenido sólo mediante endpoint autenticado; carpeta guest-photos no expuesta | directo → 404 |
| Archivo falso/corrupto | MIME por contenido y validación estructural | `tests/smoke.js` |
| CSRF | Mutaciones por cookie exigen origen válido; webhooks firmados son excepciones explícitas | `tests/origin-policy.js` |
| XSS/config ejecutable | BD sólo guarda valores; renderer procede de allowlist local | contratos de experiencias |
| Fuerza bruta | login y registro conservan límites acotados en memoria | smoke/regresión histórica |
| Path traversal/restores | rutas resueltas dentro de raíz, checksums y límites de archivos/tamaño | data-safety/restore |

## Mercado Pago

Variables:

```text
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_WEBHOOK_SECRET=...
```

La preferencia se crea por servidor con referencia `eventstudio-order:<id>` o `eventstudio-plan:<id>`. La URL productiva debe ser HTTPS y el webhook configurado es `/api/payments/mercadopago/webhook`. La implementación sigue la API oficial para [crear preferencias](https://www.mercadopago.com.mx/developers/es/reference/online-payments/checkout-pro/preferences/create-preference/post), [consultar pagos](https://www.mercadopago.com.mx/developers/es/reference/online-payments/checkout-api-payments/get-payment/get) y [validar webhooks](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/additional-content/notifications/webhooks).

## Límite

La prueba usa un servidor proveedor simulado y credenciales ficticias; no realiza un cobro real. Antes de producción deben ejecutarse las cuentas/tarjetas de prueba oficiales y luego una transacción mínima controlada.
