# Auditoría — Hotfix de migración de producción RC21 r3

Fecha: 2026-08-28

## Incidente observado

Durante el primer despliegue de `security-functional-verified-r2` sobre la base persistente de Railway, el arranque creó correctamente un snapshot pre-migración y luego abortó con:

`SqliteError: table plans has no column named retention_days`

La base reportaba `PRAGMA user_version = 0`. La tabla `plans` era anterior a la incorporación de `retention_days`.

## Causa raíz

`src/db.js` ya garantizaba de forma temprana `plans.max_published_events` y `plans.publication_policy`, pero no `plans.retention_days`. Más tarde preparaba INSERT/UPSERT de planes que referencian las tres columnas. `commerce-schema.initialize()` sí garantizaba `retention_days`, pero se ejecutaba después del seed de planes, por lo que llegaba demasiado tarde para una BD legacy real.

La regresión `tests/commerce-migration.js` no detectaba el caso porque degradaba una BD creada primero con el esquema moderno; por ello su tabla `plans` conservaba `retention_days` aunque `user_version` se redujera.

## Corrección

1. `plans.retention_days` se garantiza con el mismo mecanismo idempotente `ensureColumn()` y antes del seed/upsert de planes.
2. Se añadió `tests/legacy-v0-production-migration.js`, que reconstruye físicamente una tabla `plans` legacy sin las columnas nuevas y fija `user_version=0`.
3. Los snapshots pre-migración ahora se reutilizan cuando existe un snapshot verificado del mismo salto de esquema. Esto conserva el primer estado original y evita llenar el volumen si Railway reinicia un proceso que falla antes de actualizar `user_version`.
4. No se incrementa `SCHEMA_VERSION`: el modelo objetivo continúa siendo `614210`; el cambio corrige el camino para alcanzar ese mismo esquema desde bases antiguas.

## Seguridad de los datos

El snapshot creado durante el incidente, `pre-migration-v0-to-v614210-2026-08-28T16-35-11-329Z.db`, se produjo antes de las mutaciones de migración y fue verificado por `integrity_check`. No debe eliminarse hasta terminar y validar el despliegue r3.

El primer intento pudo añadir columnas/tablas de manera parcial antes de fallar. Todos esos cambios son idempotentes/aditivos y r3 se probó también como retry con `user_version=0`.

## Alcance

No cambia frontend, Store, temas, aperturas, RSVP, QR, pagos, fotografías ni permisos. El cambio runtime está limitado a la ruta de migración/backup en `src/db.js`.
