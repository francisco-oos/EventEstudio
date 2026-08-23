# Auditoría — EventStudio 6.14.2-rc.21

## Hallazgos corregidos

1. El preview del panel dependía de autorización por encabezado, que el iframe no podía heredar. Se unificó en enlaces temporales por evento.
2. Un cliente no podía probar productos públicos sin concesión; ahora puede previsualizarlos sin adquirirlos ni guardarlos.
3. Corazón, título y acción compartían coordenadas rígidas. El renderer reserva un intervalo medido entre copy y CTA.
4. La flor del ZIP no existía como opción separada. Se añadió sin sustituir Jardín luminoso y con controles de color ya existentes.
5. Cambiar de evento podía conservar estado temporal de Store/preview. El workspace ahora limpia esas referencias.

## Consola reportada

| Mensaje | Resolución |
|---|---|
| `/api/auth/me` 401 | El panel usa `/api/auth/me?optional=1`; la ruta protegida normal conserva 401. |
| `/api/public/photo-messages/...` 404 repetido | Un preview válido lleva token temporal; un evento privado sin autorización conserva 404 por seguridad. |
| `/api/admin/localization/translate` 503 | El botón se desactiva si el proveedor no está configurado; con proveedor simulado se validaron 20 campos ES→EN/PT. |
| `Permissions policy violation: unload` | EventStudio no registra `unload`; corresponde al contenedor o una extensión. |
| `chrome-extension://... Extension context invalidated` | Pertenece a una extensión del navegador, no al proyecto. No se añadió código para ocultarlo. |
| `Receiving end does not exist` | Canal de extensión sin receptor; no existe esa referencia en el código de EventStudio. |

## Conservación de funciones

- No se reescribieron QR, fotos, RSVP, reportes, respaldos, pagos, WhatsApp ni traducción.
- No se publicaron automáticamente productos internos.
- No se incluyó ni modificó la base real en el entregable.
- La allowlist de renderers permanece local; SQLite no puede inyectar JavaScript.
- Los datos de pruebas usan dominios `example.test` y nombres sintéticos.
