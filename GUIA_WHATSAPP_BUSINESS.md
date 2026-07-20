# WhatsApp Business: activación gradual

El envío manual con enlaces `wa.me` sigue siendo la opción recomendada para la boda hasta completar la configuración oficial. No usa credenciales y el administrador decide cuándo marcar una invitación como enviada.

## Lo implementado

- proveedores `manual`, `simulation` y `whatsapp-cloud`;
- cola por evento e invitado con llave idempotente;
- exclusión de registros de prueba y teléfonos inválidos;
- máximo de cinco intentos, reintento explícito y cancelación;
- estados enviado, entregado, leído y fallido;
- verificación HMAC `X-Hub-Signature-256` y eventos webhook idempotentes.

## Requisitos de Meta

1. Crear o usar un Business Portfolio y una app de Meta.
2. Agregar WhatsApp Business Platform, número remitente y cuenta WABA.
3. Obtener un token permanente con los permisos necesarios; no usar el token temporal del asistente para producción.
4. Crear una plantilla de invitación y esperar aprobación. El cuerpo esperado por RC1 recibe familia y URL como dos parámetros.
5. Publicar `https://TU_DOMINIO/api/messaging/webhook` y configurar el token de verificación.
6. Cargar todas las variables `WHATSAPP_*` del `.env.example` y cambiar `WHATSAPP_PROVIDER=whatsapp-cloud`.
7. Habilitar el módulo `whatsappBusiness` sólo para el evento piloto.

Meta documenta que las notificaciones webhook se firman con SHA-256 en `X-Hub-Signature-256`: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/

## Prueba sin costo de integración

Usa `WHATSAPP_PROVIDER=simulation` únicamente en staging. La cola y estados se prueban sin enviar mensajes ni consumir conversaciones. Nunca lo presentes como entrega real.

## Política operativa

- documentar consentimiento/expectativa del invitado;
- usar plantilla aprobada fuera de la ventana permitida;
- enviar lotes pequeños y detener ante fallas de calidad;
- no registrar tokens ni el contenido completo del webhook en logs;
- revisar precios y categorías vigentes directamente en Meta antes de cada campaña;
- mantener `wa.me` como contingencia.

La Cloud API no se declara validada hasta completar una entrega real, recepción de webhook y reconciliación de estado con una cuenta de Meta del negocio.
