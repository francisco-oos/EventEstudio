# Validación RC36 — SQLite local y preservación de datos

## Hallazgo reproducido por QA físico
El usuario recibió:

`quick_check devolvió: Tree ... 2nd reference ... Page ... never used`

al copiar una nueva versión encima de su carpeta local.

## Evidencia sobre el archivo recibido
La `data/wedding.db` incluida en el ZIP recibido fue extraída y validada de forma aislada.

- Tamaño: 585728 bytes.
- SHA-256: `865174a02f7436980080db1765c8a4aa42d984619d13eeb7d74c06ad33fcf270`.
- `PRAGMA quick_check`: `ok` sobre una copia aislada.
- `PRAGMA integrity_check`: `ok` sobre una copia aislada.
- Usuarios: 4.
- Eventos: 2.
- Invitados: 26.
- Fotos: 0.
- Event grants: 1.
- Suscripciones: 5.

El archivo principal no necesita reparación ni reseed.

## Causa compatible con la evidencia
El ZIP limpio no contiene `wedding.db-wal` ni `wedding.db-shm`. Al copiarlo encima de una carpeta previamente ejecutada, Windows conserva sidecars antiguos que no existen en el ZIP. El launcher RC35 evaluaba esos archivos junto con la nueva base y podía interpretar la combinación como corrupción.

## Pruebas RC36
- `tests/rc36-local-db-sidecars.js`: PASS.
  - Base principal simulada válida + WAL/SHM incompatibles: sidecars en cuarentena y reintento correcto.
  - Base principal aislada también inválida: sidecars permanecen intactos y el arranque sigue bloqueado.
  - Base sin sidecars: flujo normal sin cambios.
- Integridad de proyecto: PASS tras recuperar `.github/workflows/ci.yml` que el ZIP limpio del usuario no contenía.
- Source references: PASS.
- Mobile UI: PASS.
- Local network: PASS.
- RC14 animation/regression contracts: PASS.
- RC27–RC35 contracts ejecutados después del hotfix: PASS.
- Sintaxis de `scripts/iniciar-local.js`: PASS.

## Límite del entorno
La suite que necesita `better-sqlite3` real no puede ejecutarse dentro de este contenedor si `node_modules` no está instalado. La lógica RC36 se probó mediante inyección de un adaptador de base controlado y la BD real se verificó con SQLite sobre una copia aislada.

Antes de Railway siguen siendo obligatorios:

```bash
npm ci
npm run test:preproduction
npm audit --audit-level=moderate
```
