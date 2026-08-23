# Reintentos y fallos de WhatsApp

## Estados operativos

`queued`, `pending`, `sent`, `delivered`, `read`, `failed` y `cancelled`.

## Procedimiento ante un fallo

1. Abre la cola del evento y filtra `failed`.
2. Revisa el código y mensaje resumido del proveedor.
3. Corrige primero teléfono, credenciales, plantilla, calidad o conectividad.
4. Usa **Reintentar** sólo después de resolver la causa.
5. Procesa un lote pequeño y confirma el nuevo estado.

Cada mensaje admite como máximo cinco intentos. El reintento reutiliza el registro trazable; no crea una campaña duplicada. La llave idempotente evita volver a encolar la misma combinación de evento, invitado, tipo y campaña.

## Cancelación y contingencia

- Una cola aún no terminada puede cancelarse antes de procesarla.
- Los invitados de prueba y quienes no tienen teléfono válido quedan excluidos.
- Si Cloud API no está configurada o muestra fallos generales, detén la cola automática y usa los enlaces `wa.me`.
- No marques como entregado un mensaje sólo porque se abrió `wa.me`; sigue la política manual definida por el administrador.

No reintentes masivamente ante errores de plantilla, autenticación o calidad: esos problemas afectan a todo el lote y pueden perjudicar el número remitente.
