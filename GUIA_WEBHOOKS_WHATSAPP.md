# Webhook de WhatsApp Business

## Endpoint

```text
GET  https://TU_DOMINIO/api/messaging/webhook
POST https://TU_DOMINIO/api/messaging/webhook
```

La verificación GET compara el valor recibido con `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. El POST exige `X-Hub-Signature-256`, calculado con `WHATSAPP_APP_SECRET`; un cuerpo sin firma o modificado se rechaza.

## Configuración

1. Despliega primero con HTTPS y `SITE_URL` definitivo.
2. Genera un token de verificación largo y guárdalo sólo como variable de entorno.
3. Registra la URL y el token en la app de Meta.
4. Suscribe los eventos de estado de mensajes.
5. Confirma en logs una verificación correcta sin imprimir el token.
6. Envía una invitación real de prueba y comprueba `sent`, `delivered` y, si aplica, `read`.

## Seguridad e idempotencia

- La firma se verifica sobre el cuerpo crudo antes de aceptar el evento.
- Sólo se aplican estados permitidos y `message_id` que ya existen en la cola local.
- Cada combinación de mensaje, estado y marca temporal genera una llave de evento; repetir el webhook no duplica cambios.
- El payload se limita antes de persistirse y nunca se registra el token de acceso.

La prueba automática incluye firma inválida, firma válida, cambio a fallo e idempotencia de la cola. La prueba contra Meta real sigue siendo obligatoria antes de habilitar el proveedor.
