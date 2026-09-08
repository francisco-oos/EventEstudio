# Checklist go-live Railway — 7 de septiembre de 2026

## Bloqueantes antes de Deploy

- [ ] CI verde: `preproduction`, `node20-compatibility`, `container`.
- [ ] Snapshot/backup del volumen creado y respaldo integral descargado.
- [ ] Volumen existente montado en `/app/storage`.
- [ ] Una sola réplica.
- [ ] `NODE_ENV=production`, `SITE_URL=https://...`, `TRUST_PROXY=true`.
- [ ] `STORAGE_ROOT=/app/storage`.
- [ ] `SESSION_SECRET` existente de 32 bytes o más; no rotarlo accidentalmente.
- [ ] Registro público, pagos demo y purga automática desactivados.
- [ ] Conteos productivos anotados antes del cambio.
- [ ] No existe `.env`, BD, multimedia real ni `node_modules` en el commit/ZIP.

## Smoke después de Deploy

- [ ] `/api/health` sano.
- [ ] Login con usuario existente.
- [ ] Mismos usuarios, eventos, invitados y fotos esperados.
- [ ] Evento real mantiene nombre, slug, Recipe ACTIVE, portada y música.
- [ ] Preview y URL pública cargan sin 401/409/404 inesperados.
- [ ] RSVP personal acepta y valida cupos en un invitado de prueba controlado.
- [ ] Galería/álbum, mapa, agenda, vestimenta y regalos respetan su configuración.
- [ ] QR, set de mesa, invitación física y PDF se generan.
- [ ] Backup posterior al despliegue descargado y legible.
- [ ] Logs sin errores de migración, almacenamiento o proveedores.

## Credenciales opcionales

- [ ] Mercado Pago sólo si token y webhook secret están completos.
- [ ] WhatsApp Cloud sólo si las siete variables y plantilla aprobada están completas.
- [ ] Openpay primero en sandbox; producción sólo tras prueba de webhook/cargo.
- [ ] Traducción automática sólo con endpoint HTTPS y clave en Railway.

Si falla cualquier bloqueante, no promover. Si falla el smoke con riesgo para datos, detener escrituras y ejecutar el rollback documentado.
