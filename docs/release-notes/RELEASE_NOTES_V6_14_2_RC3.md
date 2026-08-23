# EventStudio 6.14.2 RC3

## Objetivo

Corregir la carga sin diseño ni botones observada al abrir EventStudio mediante
la IP de la red local, conservando la seguridad HTTPS del despliegue y todos los
datos existentes.

## Causa confirmada

Helmet añadía `upgrade-insecure-requests` a la política CSP en todos los
entornos. Al recibir una página desde `http://192.168.x.x:3000`, el navegador
intentaba solicitar `styles.css`, `app.js` y `admin.js` mediante HTTPS. El
servidor local no ofrece TLS, por lo que sólo quedaba visible el HTML. En
`localhost` podía funcionar por el tratamiento especial que los navegadores dan
a ese origen.

## Correcciones

- HTTP se admite sólo durante desarrollo y prueba LAN.
- Producción conserva `upgrade-insecure-requests` y exige `SITE_URL` HTTPS.
- HTML, CSS y JavaScript llevan una versión de recurso para invalidar cachés
  anteriores.
- Las páginas HTML usan `no-cache`; los recursos versionados conservan caché
  controlada en producción.
- `INICIAR.bat` no muestra el QR hasta descargar y comparar `admin.html`,
  `styles.css`, `admin.js`, `app.js` y `album.js` desde la dirección local.
- Si una actualización mezcló archivos o dejó un recurso ausente, el lanzador
  se detiene con una explicación concreta.
- Se añadieron pruebas separadas para CSP local, CSP de producción, tipos de
  contenido, integridad de recursos y política de caché.

## Datos y compatibilidad

- No cambia el esquema de SQLite.
- No ejecuta `seed` sobre bases con usuarios y eventos.
- No modifica `.env`, fotografías ni respaldos.
- Conserva todas las mejoras funcionales de RC1 y la corrección de npm/Windows
  de RC2.

## Actualización recomendada

Detén el servidor, extrae RC3 en una carpeta nueva y lleva únicamente `.env`,
`data`, `uploads` y `backups`. No mezcles `node_modules` ni recursos web de
versiones anteriores.
