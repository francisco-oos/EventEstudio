# EventStudio 6.11.0 RC1

## Seguridad y datos

- sesiones por cookie segura y HMAC en SQLite;
- límite de intentos, cambio/restablecimiento de contraseña y cierre de otras sesiones;
- CSP, errores JSON, request ID, logs estructurados y auditoría;
- autorización uniforme por rol, evento, plan y módulo;
- producción sin seed, credenciales ni evento genérico.

## Operación del evento

- cierre RSVP, política de cambios y responsable de confirmación;
- importación parcial con resumen exacto por fila;
- plantilla, importación `.xlsx`/`.csv` y reporte migrados a ExcelJS sin vulnerabilidades detectadas por `npm audit`;
- reporte operativo ampliado y validado como libro Excel de nueve hojas;
- plano de mesas disponible para cliente, con pista, capacidad y modo confirmado;
- evento de boda protegido contra purga o borrado accidental.
- PDFs de QR e invitación física usan fuentes TTF embebidas para evitar espaciado irregular al imprimir.

## Fotografías

- mensaje opcional por lote, idempotencia y validación binaria;
- moderación pendiente/aprobado/oculto;
- originales no expuestos por directorio público;
- publicación opcional de mensajes aprobados.

## Mensajería y continuidad

- enlaces manuales `wa.me` preservados;
- cola WhatsApp con simulación y adaptador Cloud API;
- firma de webhook, estados, reintento y cancelación;
- respaldo integral descargable y verificado con SQLite/SHA-256;
- purga automática desactivada por defecto.

## Compatibilidad preservada

Se mantienen selección dinámica de música y punto de inicio, Spotify embebido con fallback, plantillas/tipografías, QR por mesa, PDF por formato, invitación física, RSVP familiar y configuración multi-evento.

## Pendientes externos para producción general

- credenciales y prueba real de Meta WhatsApp;
- proveedor de pago real;
- despliegue HTTPS con volumen y restauración ensayada;
- prueba física de QR en imprenta;
- documentos legales del negocio.
