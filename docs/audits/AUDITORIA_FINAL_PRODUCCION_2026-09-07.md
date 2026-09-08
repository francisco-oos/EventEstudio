# Auditoría final de preproducción — 7 de septiembre de 2026

## Dictamen

Estado: **GO CONDICIONADO** para desplegar el código en Railway sobre el volumen productivo existente.

La aplicación, seguridad, estabilidad, perfiles y migraciones superaron las puertas automatizadas disponibles. Antes de pulsar Deploy todavía deben cumplirse las condiciones operativas del checklist: snapshot/backup del volumen, montaje `/app/storage`, una sola réplica, variables obligatorias y smoke posterior con el usuario y evento reales.

El ZIP fuente recibido no contiene `wedding.db`, sidecars SQLite ni multimedia real. Por ello esta auditoría no declara validada la BD concreta de Railway; sí valida migraciones realistas y preservación sobre fixtures. Para comprobar la BD real sin exponer producción, exportar un respaldo integral y ejecutar `EVENTSTUDIO_IMPORTED_DB=/ruta/wedding.db node tests/imported-db-compatibility.js` en staging.

## Hallazgos corregidos

1. Se añadió `.github/workflows/ci.yml`, ausente en el paquete recibido.
2. Se actualizaron contratos RC20, RC22 y RC23 que contradecían refactors posteriores ya documentados.
3. Se normalizaron a LF `iniciar_linux.sh` y `docker-entrypoint.sh`; `.gitattributes` evita reincidencia.
4. Se fijó `qs@6.16.0` mediante override compatible. `npm audit --omit=dev` pasó con cero vulnerabilidades.
5. Se completaron 37 traducciones EN/PT del bloque RSVP/regalos/Openpay. Configuración queda 189/189 y el auditor ahora falla si falta alguna.
6. CI instala Playwright desde `requirements-qa.txt`; la matriz visual exhaustiva corre en Node 22 y Node 20 mantiene compatibilidad crítica.

## Evidencia ejecutada

| Área | Resultado |
|---|---|
| Integridad, sintaxis y referencias | PASS |
| Smoke HTTP funcional | PASS |
| Seguridad BD/XLSX y restauración | PASS |
| Ataques HTTP, traversal, exposición de BD y rate limit | PASS |
| Cabeceras, HTTPS, origen y CSRF | PASS |
| Owner, developer, clientes, aislamiento y cortesías | PASS |
| Mercado Pago, WhatsApp readiness y regalos | PASS |
| Migración legacy v0 e idempotencia | PASS |
| Reset productivo reversible conservando usuarios | PASS |
| 1,200 usuarios/eventos | PASS; alta 60 ms, permisos 296 ms |
| Concurrencia | PASS; 108 solicitudes, p95 296 ms en Node 24 y 376 ms en Node 22 aislado |
| Presentación | PASS; 65 Recipes, 31 assets, 103 skins, 175,500 combinaciones |
| Roles/perfiles | PASS; 1,300 proyecciones |
| Controles UI | PASS; 139 controles |
| Dependencias | PASS; 0 vulnerabilidades |
| Node 22 limpio | PASS: instalación, smoke, seguridad, concurrencia, comercio, RC41 y auditoría |
| Arranque `NODE_ENV=production` | PASS: health sano y BD creada sólo en `STORAGE_ROOT` temporal |
| Node 20 limpio | BLOCKED_ENV: `node-gyp` no pudo usar `fchown` al extraer headers en este sandbox; queda cubierto por CI |
| Playwright de esta pasada | BLOCKED_ENV: Chromium agotó reintentos de descarga; se conserva evidencia RC41 previa y CI lo reinstala |
| Docker build local | NOT_RUN: motor Docker/Podman no disponible |
| BD real de Railway | NOT_RUN: no fue entregada ni se accedió a producción |

## Límites del dictamen

- No se modificó Railway, GitHub ni ningún dato productivo.
- Las credenciales opcionales pendientes no bloquean el núcleo si sus proveedores permanecen desactivados.
- Mercado Pago, WhatsApp Cloud, Openpay y traducción automática sólo deben activarse cuando todas sus variables estén completas.
- SQLite exige una sola réplica y un volumen persistente. El despliegue de código no sustituye el contenido del volumen.

## Regla de promoción

Promover sólo si CI termina verde y el checklist `CHECKLIST_GO_LIVE_RAILWAY_2026-09-07.md` queda completado. Ante una migración fallida, recuperar juntos la imagen anterior y el snapshot previo del volumen.
