# Validación EventStudio 6.14.2-rc.22

## Ejecutado con PASS

- `node tests/rc22-modules.js`
- `node tests/project-integrity.js`
- `node tests/source-references.js`
- `node tests/mobile-ui.js`
- `node tests/local-network.js`
- `node tests/rc14-regressions.js`
- `node tests/rc15-regressions.js`
- `node tests/rc15-1-login-hotfix.js`
- `node tests/rc17-regressions.js`
- `node tests/rc19-regressions.js`
- `node tests/animation-contracts.js`
- `node tests/rc20-regressions.js`
- `node tests/rc21-visual-contracts.js`
- `node scripts/audit-project.js`
- verificación sintáctica de JavaScript con `node --check` incluida por la auditoría estructural.
- extracción del bloque principal de esquema SQLite y ejecución en `sqlite3` en memoria: PASS; `gift_contributions` se crea junto con `events`, `guests` y `rsvps`.

## Perfiles simulados

`tests/rc22-modules.js` comprueba las decisiones de disponibilidad para `owner`, `developer`, cliente Starter, cliente Express y vista pública. El switch `rsvp.enabled` se valida como una decisión de uso del evento independiente de la concesión comercial del módulo.

## Suite completa

Se intentó `npm test`. La instalación de dependencias del entorno de ejecución quedó incompleta por timeout del entorno y la suite se detuvo al requerir el módulo nativo `better-sqlite3`. El fallo no corresponde a una aserción de EventStudio; ocurre antes de ejecutar las pruebas que dependen de base de datos.

Por esta razón no se marca como ejecutada en este entorno la matriz HTTP completa de `smoke`, permisos RC20, journeys RC21, seguridad de base de datos y restauración.

## Openpay

La integración se validó estructuralmente. No se realizó un cargo real ni sandbox porque no se proporcionaron credenciales Openpay. Sin `OPENPAY_MERCHANT_ID`, `OPENPAY_PUBLIC_KEY` y `OPENPAY_PRIVATE_KEY`, la ruta responde `OPENPAY_NOT_CONFIGURED` y no intenta cobrar.

La implementación mantiene PAN, CVV y expiración fuera de las rutas de EventStudio; Openpay.js tokeniza los datos en navegador y el servidor recibe únicamente token y `device_session_id`.
