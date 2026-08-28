# Validación de seguridad — EventStudio 6.14.2-rc.21

Fecha: 2026-08-27

| Control | Resultado |
|---|---|
| SQLite `quick_check` base recibida | PASS |
| SQLite `integrity_check` base recibida | PASS |
| SQLite `foreign_key_check` base recibida | PASS, 0 violaciones |
| Base recibida con código endurecido | PASS |
| Corrupción física simulada | PASS, arranque rechazado |
| Permiso DB `0600` | PASS en Linux de auditoría |
| Snapshot previo a migración | PASS |
| Backup + SHA-256 + integrity check | PASS |
| Restore + checksum + ZIP traversal | PASS |
| Restore con control FK | PASS |
| SQLi de autenticación | PASS, no bypass |
| Rate-limit login | PASS, 429 en sexto intento |
| CSRF/Origin | PASS |
| Headers HTTPS/CSP | PASS |
| Backups sin sesión | PASS, 401 |
| Exposición `/data/wedding.db` | PASS, 404 |
| Path traversal hacia DB | PASS, bloqueado |
| XLSX normal | PASS |
| XLSX bomba de compresión | PASS, rechazado antes de ExcelJS |
| Multer | PASS, lock 2.2.0 |
| QR/fotos | PASS |
| Mercado Pago firma/idempotencia | PASS |
| WhatsApp Cloud readiness/firma | PASS |
| Roles Owner/Developer/client | PASS |
| Store/commerce journeys | PASS |
| RC21 plantillas/aperturas | PASS: 59/16 |
| Animaciones/móvil | PASS |
| Secret scan por patrones comunes fuera de tests | PASS |
| `npm ls --all --omit=dev` | PASS |

## Ejecuciones principales

- `npm run test:security` -> PASS
- `tests/project-integrity.js` -> PASS
- `tests/commerce-migration.js` -> PASS
- `tests/qr-photo-matrix.js` -> PASS
- `tests/rc21-visual-contracts.js` -> PASS
- `tests/rc21-invitation-journeys.js` -> PASS
- `tests/animation-contracts.js` -> PASS
- `tests/mobile-ui.js` -> PASS
- `tests/commerce-journeys.js` -> PASS
- `tests/localization-provider.js` -> PASS

## Nota de entorno

El ZIP recibido contiene `node_modules` construido para Windows y archivos locales ignorados (`data/*.db*`, multimedia). Las pruebas Linux usan el shim `node:sqlite` que ya forma parte del proyecto de auditoría. Un release/commit debe seguir respetando `.gitignore` y no versionar bases, secretos, `node_modules` ni multimedia local.
