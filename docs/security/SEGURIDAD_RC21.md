# Seguridad — EventStudio 6.14.2-rc.21

## Controles validados

| Riesgo | Control | Evidencia |
|---|---|---|
| Preview sin autorización | token aleatorio con hash, expiración, evento y creador activo | `rc21-invitation-journeys` |
| Preview concede producto | configuración temporal no crea grant ni compra | cliente antes/después continúa sin derecho |
| Escalada de rol / IDOR | rol y evento se resuelven en backend | `rc20-permissions` |
| Cortesía como ingreso | concesión con importe cero; resumen suma sólo pagos/órdenes pagadas | `rc21-invitation-journeys` |
| CSRF/origen hostil | mutaciones por cookie exigen origen permitido | `origin-policy` |
| Fuerza bruta | límites de login y registro | `smoke` |
| XSS/config ejecutable | valores sanitizados y renderer local en allowlist | auditoría estructural |
| QR manipulado | HMAC ligado a evento/mesa y comparación constante | `qr-photo-matrix` |
| Archivos/IDOR | MIME por contenido, rutas privadas y autorización | `smoke`, `qr-photo-matrix` |
| Restore/path traversal | manifiesto, checksum, límites y raíz controlada | `data-safety`, `restore` |
| Webhook falso/replay | firma, consulta canónica, monto/moneda e idempotencia | `payments-mercadopago` |
| Secretos | variables de entorno; no viajan al navegador ni al ZIP | `whatsapp-readiness`, `.env.example` |

## Credenciales externas

WhatsApp y Mercado Pago permanecen bloqueados ante configuración incompleta. Las suites usan proveedores simulados; antes de producción se requieren credenciales sandbox, dominio HTTPS, webhook real y una transacción controlada. Ninguna credencial fue solicitada ni incorporada.

## Límite

Una suite automatizada reduce regresiones conocidas, pero no equivale a una auditoría ofensiva independiente. Antes de exposición pública se recomienda análisis SAST/DAST externo, revisión de infraestructura y prueba de penetración autorizada.
