# Auditoría RC36 — Arranque local y SQLite

## Alcance
Hotfix limitado a resiliencia del launcher local ante sidecars SQLite incompatibles después de copiar una versión encima de una carpeta usada previamente.

## No modificado
- Renderer público.
- Design Studio / Stationery.
- Recipes, Assets y Componentes.
- Comercio, entitlements y roles.
- Esquema SQLite y migraciones.

## Hallazgo
La base recibida es íntegra de forma aislada. El error observado es compatible con `wedding.db-wal` / `wedding.db-shm` residuales que no viajan dentro del ZIP limpio.

## Control añadido
Verificación aislada + cuarentena reversible de sidecars únicamente cuando la base principal pasa `quick_check` sin ellos.

## Resultado
Contratos RC27–RC36: PASS. QA cromático y público RC35: PASS. Stationery visual: PASS.
