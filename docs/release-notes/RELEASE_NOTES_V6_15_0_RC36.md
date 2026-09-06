# EventStudio 6.15.0-rc.36

## Hotfix principal
- El lanzador local detecta colisiones entre `wedding.db` y sidecars SQLite residuales (`-wal`, `-shm`, `-journal`).
- Antes de tocar auxiliares, valida una copia independiente del archivo principal.
- Si la base aislada es íntegra, los sidecars se conservan en `backups/local-sidecar-quarantine/<timestamp>/` y el arranque se reintenta.
- Si la base aislada también falla, RC36 no mueve ni elimina archivos y conserva el bloqueo de seguridad.
- Nunca se ejecuta reseed como mecanismo de recuperación.

## Preservado de RC35
- Design Studio unificado con Stationery embebido.
- 64 Recipes, AssetManifest, Component skins y Presentation Engines.
- Color engine compartido entre constructor y render público.
- Música, QR, físico/PDF, álbum, RSVP y entitlements preservados.
- Sincronización cromática global y contraste semántico.

## Empaquetado
- RELEASE sin `.env`, datos reales ni `node_modules`.
- QA con la `wedding.db` íntegra recibida del usuario.
- `.github/workflows/ci.yml` restaurado en ambos paquetes porque el generador de ZIP limpio del usuario excluye `.github`.
