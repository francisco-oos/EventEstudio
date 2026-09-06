# ADR RC36 — Recuperación segura de sidecars SQLite en arranque local

## Contexto
Durante una actualización local por sobrescritura de archivos, `wedding.db` puede reemplazarse mientras permanecen en `data/` archivos auxiliares de una ejecución anterior (`wedding.db-wal`, `wedding.db-shm` o `wedding.db-journal`). Un ZIP limpio normalmente excluye esos sidecars, por lo que copiar una nueva versión encima de una carpeta existente no los elimina.

SQLite puede interpretar esos auxiliares como pertenecientes al archivo principal actual. Si corresponden a otra generación de la misma base, `quick_check` puede reportar corrupción aunque el archivo `wedding.db` aislado sea íntegro.

## Decisión
El mecanismo de recuperación automática se limita al lanzador local `scripts/iniciar-local.js`.

Ante un fallo de integridad durante la inspección previa al arranque:

1. Se buscan sidecars existentes junto a `wedding.db`.
2. Si no existen sidecars, se conserva el fallo normal y no se modifica nada.
3. Si existen, se copia únicamente `wedding.db` a un directorio temporal.
4. La copia temporal se abre de forma independiente y debe contener `users` y `events` y superar `PRAGMA quick_check`.
5. Sólo si la copia aislada es válida, los sidecars originales se mueven a `backups/local-sidecar-quarantine/<timestamp>/`.
6. EventStudio reintenta la inspección sobre la base principal sin los auxiliares incompatibles.
7. Si la copia aislada tampoco supera integridad, no se mueve ningún archivo y el arranque permanece bloqueado.

## Razones
- Evita declarar corrupta una base sana por sidecars residuales.
- No borra evidencia ni datos potencialmente recuperables: los auxiliares se ponen en cuarentena.
- No intenta reparar automáticamente una base principal realmente dañada.
- No modifica la política de producción ni el arranque directo de `src/server.js`.

## Alternativas descartadas

### Eliminar siempre `-wal` y `-shm`
Descartado porque un WAL válido puede contener transacciones aún no consolidadas.

### Ejecutar `seed` al detectar corrupción
Descartado porque puede destruir o mezclar datos reales.

### Ignorar `quick_check`
Descartado porque elimina una protección de integridad ya aprobada.

## Consecuencia operativa
La actualización recomendada sigue siendo detener EventStudio y extraer la nueva versión en una carpeta limpia. RC36 añade resiliencia para el caso común de sobrescritura local, pero no sustituye una política correcta de respaldo.
