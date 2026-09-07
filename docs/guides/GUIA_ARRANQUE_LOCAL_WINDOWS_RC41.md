# Arranque local en Windows — EventStudio 6.16.0-rc.41

## Ruta recomendada

Ejecuta `INICIAR.bat`. El launcher verifica Node.js, dependencias, base local, puerto, assets y salud del servidor antes de abrir el panel.

## Dependencias y `better-sqlite3`

El launcher mantiene un marcador SHA-256 de `package-lock.json`. Desde este hotfix, si `node_modules` ya contiene exactamente las dependencias directas fijadas por el lockfile, reconstruye el marcador y **no ejecuta `npm ci` innecesariamente**. Esto evita que Windows intente borrar `better_sqlite3.node` mientras otra instancia lo mantiene cargado.

Si las dependencias realmente no coinciden, sí se ejecuta `npm ci`.

### Error `EPERM: operation not permitted, unlink ... better_sqlite3.node`

Ese error significa que Windows no permitió sustituir el binario nativo. La causa habitual es otra instancia de Node/EventStudio o un proceso de seguridad que mantiene abierto el archivo.

1. Conserva `data/wedding.db`; **no borres ni reseedes la base**.
2. Cierra únicamente otras instancias de EventStudio/Node que estén usando esta misma copia.
3. Vuelve a ejecutar `INICIAR.bat`.
4. Si persiste, revisa temporalmente antivirus/EDR o permisos del directorio, sin desactivar protecciones de forma permanente.

No es necesario ejecutar como Administrador cuando la carpeta pertenece al usuario y ningún proceso bloquea el archivo.

## Gate antes de producción

En la PC de QA:

```text
npm ci
npm run test:preproduction
npm audit --audit-level=moderate
```

Después completa `docs/checklists/QA_FISICO_FINAL_6.16.0-rc.41.md`.
