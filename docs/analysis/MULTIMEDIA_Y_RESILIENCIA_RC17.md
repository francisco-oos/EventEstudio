# Multimedia y resiliencia — RC17

## Problema observado

Los logs entregados mostraban dos situaciones distintas:

1. `ENOENT` al solicitar `/uploads/site-media/...`: la BD copiada conservaba una URL de un archivo que no estaba en el nuevo árbol de `uploads`.
2. `Request aborted` en POST de música/galería: la transferencia desde el navegador se interrumpió antes de completar.

Tratar ambos como un único “error de multimedia” ocultaba la causa.

## Solución aplicada

### Referencias ausentes

- Una URL local sólo se expone si el archivo físico existe.
- `_mediaHealth` reporta referencias faltantes.
- El propietario puede retirar referencias rotas de la configuración explícitamente.
- No se borran URLs externas ni archivos válidos por inferencia automática.

### Transferencias interrumpidas

- XHR permite progreso real en navegador.
- Cada intento comparte `x-upload-key`.
- El servidor registra el resultado de una clave exitosa; un reintento posterior devuelve el mismo resultado y elimina el temporal duplicado.
- Si no hay progreso durante 45 s, el cliente aborta ese intento y vuelve a intentar de forma controlada.
- Abortar desde el cliente no se registra como `INTERNAL_ERROR` genérico; se distinguen desconexiones.

### Imágenes

Las imágenes grandes se preparan en el cliente para reducir red cuando hay ganancia real. No se recomprime audio ni cualquier archivo indiscriminadamente.

## Qué NO es esta implementación

No es TUS. Si se transmitieron 8 MB de un archivo de 12 MB y se corta la red, el retry actual vuelve a enviar ese archivo/lote; la idempotencia evita duplicar el resultado, pero no conserva el byte 8 MB.

TUS define un recurso de upload con offset consultable mediante `HEAD` y continuación mediante `PATCH`. Uppy/Tus requiere integración del cliente y un servidor compatible. Esa es la siguiente mejora correcta para el escenario de boda con señal deficiente, pero debe entrar como `TusUploadAdapter` detrás de un contrato, no sustituyendo el flujo actual sin pruebas.

## Gate para TUS futuro

- reanudar después de desconectar red;
- reanudar después de recargar pestaña cuando sea viable;
- conservar mesa/evento/autorización;
- checksum/validación final;
- cuotas de almacenamiento;
- moderación actual intacta;
- fallback al uploader vigente;
- almacenamiento local primero y S3-compatible opcional después.
