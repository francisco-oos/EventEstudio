# Railway — desplegar código conservando usuario y evento

## Principio

El contenedor contiene la aplicación; `/app/storage` contiene la BD, fotos, música y respaldos. Al desplegar esta versión, Railway debe reemplazar sólo la imagen y reutilizar el mismo volumen montado en `/app/storage`.

## Antes del despliegue

1. En Railway, confirmar una sola réplica.
2. Confirmar que el volumen actual está montado exactamente en `/app/storage`.
3. Crear un backup/snapshot del volumen y conservar además un respaldo integral descargado.
4. Registrar conteos actuales: usuarios activos, eventos, invitados, fotos y nombre/slug del evento real.
5. No copiar una BD local al repositorio y no ejecutar `npm run seed`.

## Variables obligatorias

```text
NODE_ENV=production
SITE_URL=https://TU-DOMINIO
TRUST_PROXY=true
STORAGE_ROOT=/app/storage
SESSION_SECRET=CADENA_ALEATORIA_DE_32_BYTES_O_MAS
ALLOW_PUBLIC_REGISTRATION=false
ENABLE_DEMO_PAYMENTS=false
ENABLE_AUTOMATIC_PURGE=false
```

Con una BD productiva existente, no hace falta configurar `INITIAL_OWNER_*`. Si esas variables siguen presentes de un aprovisionamiento anterior, retirar al menos `INITIAL_OWNER_PASSWORD` después de confirmar el acceso existente. No cambiar `SESSION_SECRET` durante un despliegue normal: hacerlo invalida sesiones y firmas derivadas.

## Proveedores opcionales

- Mantener `PAYMENT_PROVIDER=disabled` hasta completar Mercado Pago.
- Mantener `WHATSAPP_PROVIDER=manual` hasta completar las siete variables de WhatsApp Cloud.
- Mantener `OPENPAY_SANDBOX=true` hasta validar merchant/public/private keys en staging.
- Dejar `TRANSLATION_ENDPOINT` y `TRANSLATION_API_KEY` vacíos si no hay proveedor.

Una configuración parcial se considera desactivada o debe ser rechazada por las pruebas de readiness; nunca completar secretos dentro de Git, ZIP o `.env.example`.

## Despliegue

1. Subir este árbol a una rama de release sin `node_modules`, `.env`, `data`, `uploads` ni backups.
2. Esperar CI verde en `preproduction`, `node20-compatibility` y `container`.
3. Desplegar el commit exacto en el servicio Railway existente; no crear un servicio nuevo si se desea reutilizar el volumen.
4. Esperar que `/api/health` quede sano antes de abrir el panel.

## Verificación posterior

1. Iniciar sesión con el usuario productivo existente.
2. Confirmar los conteos registrados y el evento real.
3. Abrir panel, Design Studio, preview y URL pública.
4. Verificar portada, galería, música, RSVP, mapa, QR y una descarga/backup.
5. Revisar logs: no debe haber errores de migración, cuentas demo activas, rutas persistentes o credenciales incompletas.

## Rollback

Si falla antes de aceptar escrituras, volver a desplegar la imagen anterior. Si el nuevo proceso ya migró o escribió la BD, restaurar también el snapshot previo del volumen; no mezclar una imagen antigua con una BD parcialmente migrada.
