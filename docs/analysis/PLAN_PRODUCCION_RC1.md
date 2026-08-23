# Plan de producción RC1

## Fase 1 — staging privado

- Desplegar una sola réplica con HTTPS y volumen persistente.
- Crear propietario real y cambiar la contraseña temporal.
- Importar únicamente una copia de los invitados reales.
- Mantener evento no publicado y módulos experimentales ocultos.
- Crear y descargar un respaldo; ejecutar restauración de ensayo en otro volumen.

Salida: salud correcta, sesión segura, respaldo verificado y aislamiento entre eventos.

## Fase 2 — prueba de familia

- Publicar durante una ventana controlada.
- Enviar manualmente cinco invitaciones por `wa.me`.
- Probar RSVP: sí, no, niños, restricciones, cambio de respuesta y cierre.
- Subir fotos desde iPhone/Android, revisar mensaje, aprobar y ocultar.
- Probar Spotify con conexión normal y deficiente; confirmar fallback a “Abrir en Spotify”.

Salida: cero pérdida de datos, mensajes comprensibles y correcciones sólo del evento activo.

## Fase 3 — imprenta y recinto

- Imprimir un ejemplar de cada formato realmente elegido, al 100 %, sin “ajustar a página”.
- Escanear a 30, 60 y 100 cm con tres teléfonos y luz tenue.
- Confirmar que cada QR abre el slug y mesa correctos.
- Revisar plano confirmado, pista, entradas, pasillos, capacidad y nombres con el recinto.

Salida: checklist de QR firmado y reporte operativo exportado.

## Fase 4 — publicación real

- Congelar diseño y datos 24 horas antes del primer envío masivo.
- Crear respaldo “pre-publicación”.
- Publicar y enviar en lotes pequeños; revisar respuestas y rebotes entre lotes.
- Mantener WhatsApp manual hasta aprobar Cloud API.
- Descargar un respaldo diario durante la ventana RSVP y el día del evento.

## Fase 5 — producto comercial

- Migrar PostgreSQL/objetos antes de escalar a réplicas múltiples.
- Integrar un proveedor de pago real con webhooks idempotentes.
- Incorporar dominio y correo transaccional reales.
- Completar aviso de privacidad, términos, retención y atención de derechos de datos.
- Medir activación, RSVP, entrega, carga de fotos, almacenamiento y soporte por evento.
