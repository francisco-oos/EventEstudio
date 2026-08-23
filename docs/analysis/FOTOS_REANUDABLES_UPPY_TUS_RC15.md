# Fotografías con mala señal: Uppy + Tus — estado RC15

## Estado real

**No está integrado todavía en producción RC15.** La subida actual continúa usando multipart HTTP, ahora con fallback de identificador de idempotencia y firma de mesa para QR nuevos.

## Por qué sigue aprobado

Documentación oficial: https://uppy.io/docs/tus/
Repositorio/licencia: https://github.com/transloadit/uppy

Tus está diseñado para reanudar cargas cuando se pierde conectividad o se cierra accidentalmente la pestaña. Uppy dispone de `@uppy/tus`, pero una integración fiable requiere cliente **y servidor Tus**; no basta con cambiar el botón del navegador.

## Arquitectura futura

`GuestUploadProvider`
- `MultipartUploadAdapter` (actual)
- `TusUploadAdapter` (futuro)

La promoción de Tus exigirá:
1. servidor `tusd` o implementación compatible;
2. metadatos firmados `event_id/table_id` que el navegador no pueda falsificar;
3. reanudación después de pérdida real de red;
4. límites de plan y moderación idénticos al flujo actual;
5. almacenamiento local/S3 compatible mediante adaptador;
6. pruebas con 20–50 archivos y señal intermitente.

No se añadió un CDN externo a RC15 para evitar convertir disponibilidad de terceros en dependencia de la boda/producción.
