# Publicar EventStudio de forma económica

## Recomendación para la boda

Railway es la ruta más sencilla para este proyecto porque admite el `Dockerfile`, dominio HTTPS y un volumen persistente para SQLite, fotos, música y respaldos. A julio de 2026 el plan Free incluye hasta 0.5 GB de volumen y crédito mensual limitado; Hobby tiene un mínimo de USD 5 al mes e incluye crédito de uso y hasta 5 GB de volumen. Para una prueba corta se puede comenzar en Free, pero para la boda recomiendo Hobby y un límite de gasto.

Si en **Uso** aparece “Plan gratuito”, USD 1 de asignación mensual y uso actual USD 0.00, la cuenta Free está activa aunque la prueba inicial haya terminado. No pulses “Desbloquea el plan de pasatiempos” todavía: intenta primero el despliegue gratuito y revisa el consumo real.

SQLite obliga a usar **una sola réplica**. No actives escalado horizontal.

## Antes de subir

1. En tu instalación actual entra como propietario, abre **Configuración → Respaldos completos**, crea un respaldo y descárgalo.
2. Conserva el ZIP intacto. Incluye `data/wedding.db`, `uploads/` y `manifest.json`.
3. No copies `.env`, contraseñas ni tokens dentro del proyecto.
4. Ejecuta localmente `npm test` y conserva una copia del ZIP de esta versión.

## Crear el servicio

1. Crea una cuenta propia en Railway y un proyecto vacío.
2. Despliega este directorio desde GitHub o con Railway CLI. El archivo `railway.json` selecciona el `Dockerfile` y comprueba `/api/health`.
3. Agrega un volumen al mismo servicio y móntalo en `/app/storage`.
4. Genera un dominio de Railway. Cuando tengas dominio propio, se puede cambiar sin migrar los datos.
5. Mantén una réplica y despliegue regional cercano a México.

## Variables mínimas

```dotenv
NODE_ENV=production
SITE_URL=https://TU-DOMINIO.up.railway.app
TRUST_PROXY=true
STORAGE_ROOT=/app/storage
SESSION_SECRET=UNA_CADENA_ALEATORIA_DE_64_CARACTERES_O_MAS
SESSION_COOKIE=eventstudio_session
SESSION_HOURS=12
INITIAL_OWNER_NAME=Francisco
INITIAL_OWNER_EMAIL=TU_CORREO
INITIAL_OWNER_PASSWORD=UNA_CONTRASENA_TEMPORAL_DE_12_O_MAS
ALLOW_PUBLIC_REGISTRATION=false
TRIAL_DAYS=7
PAYMENT_PROVIDER=disabled
ENABLE_DEMO_PAYMENTS=false
BACKUP_RETENTION=14
MAX_UPLOAD_MB=25
```

Después del primer inicio y de confirmar que la cuenta propietaria existe, elimina `INITIAL_OWNER_PASSWORD` de las variables y vuelve a desplegar. Activa `ALLOW_PUBLIC_REGISTRATION=true` sólo cuando quieras que otras personas creen cuentas de cliente. El registro crea un evento privado y una prueba; no publica nada automáticamente.

## Restaurar los datos actuales

La restauración debe hacerse con el servicio detenido:

1. Descomprime el respaldo en tu computadora.
2. Sube su carpeta `data` y `uploads` al volumen `/app/storage`. Railway permite administrar archivos del volumen con su CLI.
3. Comprueba que la base quede exactamente en `/app/storage/data/wedding.db` y las fotos en `/app/storage/uploads`.
4. Inicia una sola réplica y abre `/api/health`.
5. Inicia sesión y verifica invitados, una confirmación, el plano, dos fotos, un QR y un PDF.
6. Genera un respaldo nuevo ya desde producción.

No mezcles un respaldo con una base activa ni copies sólo el archivo SQLite mientras el servidor escribe.

## QR y dominio definitivo

Los QR se generan con `SITE_URL`. Antes de imprimir el lote final:

1. configura el dominio definitivo;
2. reinicia el servicio;
3. vuelve a generar QR y PDFs;
4. escanea desde dos teléfonos usando datos móviles;
5. sube una foto de prueba y comprueba el visor administrativo.

Un QR generado con `localhost` nunca funcionará desde el teléfono de un invitado.

## Qué necesito para ayudarte a publicarlo

Puedes compartir el proyecto y el respaldo completo, pero no contraseñas. Para hacer la publicación juntos, crea tú la cuenta de Railway y conserva la propiedad. Después ejecutamos los pasos desde tu sesión o me das acceso de colaborador al proyecto. Meta y Railway deben quedar a tu nombre.

Referencias oficiales: [precios de Railway](https://railway.com/pricing), [volúmenes persistentes](https://docs.railway.com/volumes/reference), [prueba gratuita](https://docs.railway.com/pricing/free-trial).
