# Despliegue económico de EventStudio

Precios verificados el 17 de julio de 2026. La recomendación para la boda es **Railway Hobby con una sola réplica y volumen en `/app/storage`**: el proyecto ya incluye Dockerfile, healthcheck y almacenamiento unificado.

## Comparación útil

| Opción | Precio publicado relevante | ¿Sirve para la boda? | Motivo |
|---|---:|---|---|
| Railway Free | prueba de 30 días con USD 5 de crédito; después USD 1/mes, con 0.5 GB de volumen | Sólo smoke/staging corto | 0.5 GB puede agotarse rápidamente con fotos originales |
| Railway Hobby | mínimo de USD 5/mes con crédito de uso incluido y hasta 5 GB de volumen | Sí, inicio recomendado | HTTPS, dominio, Docker y volumen en el mismo flujo |
| Render Free | USD 0 para exploración | No para datos reales | El nivel gratuito no debe usarse como garantía de almacenamiento persistente de esta app |
| VPS administrado por ti | variable | Más adelante | Puede ser barato, pero exige firewall, parches, TLS, monitoreo y copias externas |

Fuentes oficiales: https://railway.com/pricing, https://docs.railway.com/networking/public-networking, https://docs.railway.com/volumes/reference, https://docs.railway.com/volumes/backups, https://render.com/pricing y https://render.com/docs/disks.

## Railway paso a paso

1. Sube el código a un repositorio privado.
2. Crea un proyecto Railway desde el repositorio; se usará `railway.json` y el `Dockerfile`.
3. Agrega un volumen persistente montado exactamente en `/app/storage`.
4. Configura como mínimo:

```env
NODE_ENV=production
STORAGE_ROOT=/app/storage
SITE_URL=https://TU-DOMINIO
TRUST_PROXY=true
SESSION_SECRET=UNA_CADENA_ALEATORIA_DE_32_BYTES_O_MAS
INITIAL_OWNER_NAME=Tu nombre
INITIAL_OWNER_EMAIL=tu-correo-real
INITIAL_OWNER_PASSWORD=una-clave-temporal-unica-de-12-o-mas
ALLOW_PUBLIC_REGISTRATION=false
PAYMENT_PROVIDER=disabled
ENABLE_DEMO_PAYMENTS=false
ENABLE_AUTOMATIC_PURGE=false
WHATSAPP_PROVIDER=manual
```

5. Despliega una sola réplica. No escales horizontalmente SQLite.
6. Genera el dominio HTTPS, corrige `SITE_URL` para que coincida exactamente y redespliega.
7. Abre `/api/health` y `/admin.html`; cambia la contraseña temporal.
8. Crea y descarga un respaldo antes de importar invitados reales.
9. Mantén el evento no publicado hasta completar `CHECKLIST_PUBLICACION_BODA.md`.

Después de crear el propietario, conviene retirar `INITIAL_OWNER_PASSWORD` de las variables del servicio. La cuenta ya permanece en la base.

## Copias fuera del proveedor

El volumen evita perder datos al recrear el contenedor, pero no sustituye un respaldo. Descarga el ZIP integral:

- antes de publicar;
- diariamente mientras RSVP esté abierto;
- antes de cambiar mesas o importar;
- al finalizar la boda.

Conserva al menos una copia fuera de Railway y ensaya una restauración en staging.

## Camino comercial

Railway Hobby es suficiente para una boda y primeras demostraciones supervisadas. Antes de vender con varios eventos simultáneos:

- migra fotos a almacenamiento de objetos;
- migra SQLite a PostgreSQL;
- añade monitoreo y backups externos programados;
- integra pagos y correo reales;
- completa aviso de privacidad y política de retención.
