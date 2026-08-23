# Plantilla de invitación para WhatsApp

## Objetivo

Crear en WhatsApp Manager una plantilla aprobada para iniciar la conversación con cada familia. EventStudio envía dos parámetros en este orden:

1. nombre de la familia;
2. enlace personalizado de la invitación.

Ejemplo de cuerpo sugerido:

```text
Hola {{1}}, nos dará mucha alegría compartir este día con ustedes.

Consulta los detalles y confirma tu asistencia aquí: {{2}}
```

El nombre definitivo se configura únicamente en el servidor mediante `WHATSAPP_INVITATION_TEMPLATE`; el idioma mediante `WHATSAPP_TEMPLATE_LANGUAGE`, por ejemplo `es_MX`.

## Lista de aprobación

- La categoría, redacción y propósito coinciden con las reglas vigentes de Meta.
- Los dos ejemplos de parámetros son reales en forma, pero no contienen datos privados de invitados.
- La URL usa el dominio HTTPS definitivo.
- El mensaje identifica a los anfitriones y no incluye promociones no solicitadas.
- La plantilla aparece aprobada, no pendiente ni rechazada.
- El número remitente y la cuenta WABA pertenecen al negocio que operará el evento.

No actives el módulo para clientes hasta que un mensaje real devuelva `message_id` y su webhook alcance por lo menos el estado `delivered`.
