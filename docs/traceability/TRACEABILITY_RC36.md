# Trazabilidad RC36

| Requisito | Implementación | Evidencia | Estado |
|---|---|---|---|
| No declarar corrupta una BD sana por WAL/SHM antiguo | `scripts/iniciar-local.js` verifica copia aislada | `tests/rc36-local-db-sidecars.js` | PASS |
| No borrar WAL/SHM automáticamente | Cuarentena en `backups/local-sidecar-quarantine/` | Test RC36 verifica archivos conservados | PASS |
| No reseed por fallo de integridad | `inspectDatabaseState` mantiene bloqueo | Contrato del launcher + test RC36 | PASS |
| No tocar una BD principal realmente dañada | La cuarentena requiere `quick_check=ok` en copia aislada | Caso `AlwaysBrokenDatabase` | PASS |
| Preservar la BD entregada | QA usa el mismo archivo y SHA-256 | `VALIDACION_RC36.md` | PASS |
| No introducir regresión visual | No se modifica renderer; QA cromático/público/Stationery repetido | RC35 visual tests | PASS |
