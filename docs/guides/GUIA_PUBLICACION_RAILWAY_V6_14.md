# Publicar EventStudio de forma económica

## Recomendación para la boda

Railway es la ruta más sencilla para este proyecto porque admite el `Dockerfile`, dominio HTTPS y un volumen persistente para SQLite, fotos, música y respaldos. A julio de 2026 el plan Free incluye hasta 0.5 GB de volumen y crédito mensual limitado; Hobby tiene un mínimo de USD 5 al mes e incluye crédito de uso y hasta 5 GB de volumen. Para una prueba corta se puede comenzar en Free, pero para la boda recomiendo Hobby y un límite de gasto.

Si en **Uso** aparece “Plan gratuito”, USD 1 de asignación mensual y uso actual USD 0.00, la cuenta Free está activa aunque la prueba inicial haya terminado. No pulses “Desbloquea el plan de pasatiempos” todavía: intenta primero el despliegue gratuito y revisa el consumo real.

SQLite y el volumen obligan a usar **una sola réplica**. Railway no monta un
volumen en varias réplicas; no actives escalado horizontal.

## Antes de subir

1. En la producción actual entra como propietario, abre **Configuración →
   Respaldos completos**, crea un respaldo y descárgalo.
2. Confirma que aparezca como `ready`, que muestre SHA-256 y que el ZIP incluya
   `data/wedding.db`, `uploads/` y `manifest.json`.
3. Configura también el respaldo del volumen en Railway. El respaldo interno de
   EventStudio y el del proveedor se complementan.
4. No copies `.env`, contraseñas ni tokens dentro del proyecto.
5. Ejecuta localmente `npm test` y conserva una copia del ZIP de esta versión.

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
INITIAL_OWNER_NAME=Propietario EventStudio
INITIAL_OWNER_EMAIL=TU_CORREO
INITIAL_OWNER_PASSWORD=UNA_CONTRASENA_TEMPORAL_DE_12_O_MAS
ALLOW_PUBLIC_REGISTRATION=false
TRIAL_DAYS=7
PAYMENT_PROVIDER=disabled
ENABLE_DEMO_PAYMENTS=false
BACKUP_RETENTION=14
MAX_UPLOAD_MB=25
MAX_RESTORE_MB=4096
MAX_RESTORE_UNPACKED_MB=8192
MAX_RESTORE_FILES=10000
```

Después del primer inicio y de confirmar que la cuenta propietaria existe, elimina `INITIAL_OWNER_PASSWORD` de las variables y vuelve a desplegar. Activa `ALLOW_PUBLIC_REGISTRATION=true` sólo cuando quieras que otras personas creen cuentas de cliente. El registro crea un evento privado y una prueba; no publica nada automáticamente.

RC6 se niega a iniciar en producción si:

- `SITE_URL` no es HTTPS;
- `TRUST_PROXY` no está activo;
- falta almacenamiento persistente;
- `SESSION_SECRET` tiene menos de 32 caracteres;
- queda activa una cuenta `@eventstudio.local` o marcada como demo.

En el primer arranque de una base anterior, RC6 guarda además
`/app/storage/backups/pre-migration-*.db` con manifiesto SHA-256 antes de
migrarla. Este archivo no sustituye el respaldo ZIP descargado antes del
despliegue porque el ZIP también conserva multimedia.

## Restaurar los datos actuales

Railway no ofrece SFTP integrado para el volumen. Usa el restaurador autenticado
de EventStudio: carga el ZIP, revisa su manifiesto y escribe `RESTAURAR`; la
aplicación prepara la operación y la aplica durante el reinicio controlado. No
descomprimas archivos sobre una base activa.

Después del reinicio:

1. Abre `/api/health`.
2. Inicia sesión y verifica invitados, una confirmación, el plano, dos fotos,
   un QR y un PDF.
3. Genera un respaldo nuevo ya desde producción.
4. Conserva además un respaldo/snapshot del volumen en Railway.

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

Referencias oficiales: [volúmenes persistentes](https://docs.railway.com/volumes/reference),
[respaldos de volúmenes](https://docs.railway.com/volumes/backups),
[variables y secretos](https://docs.railway.com/variables) y
[compilación/despliegue](https://docs.railway.com/build-deploy).
