# EventStudio 6.14.2 RC2

Documento histórico. La versión vigente es `6.14.2-rc.3`.

## Objetivo

Corregir el primer arranque en Windows detectado durante la validación real de
`6.14.2-rc.1`, sin reducir la seguridad de PowerShell ni modificar los datos
persistentes.

## Correcciones

- El lanzador ya no intenta ejecutar `npm.cmd` directamente con `spawnSync`,
  combinación que puede devolver `EINVAL` en versiones recientes de Node para
  Windows.
- Cuando npm forma parte de la instalación de Node, el lanzador ejecuta
  `npm-cli.js` con el mismo `node.exe`.
- Si no encuentra ese archivo, Windows usa `cmd.exe /d /c npm.cmd` como
  alternativa controlada; Linux conserva el comando `npm`.
- `INICIAR.bat` sólo exige Node.js y delega al lanzador la detección real de
  npm, evitando comprobaciones contradictorias.
- La guía explica cómo usar `npm.cmd` desde PowerShell cuando `npm.ps1` está
  bloqueado por la política de firmas.
- Se añadieron pruebas para las tres rutas de ejecución: npm integrado en Node,
  alternativa mediante `cmd.exe` y comando POSIX.

## Datos y compatibilidad

- No cambia el esquema de SQLite.
- No vuelve a sembrar una base que ya contiene usuarios y eventos.
- No modifica `.env`, fotografías, respaldos ni el volumen persistente.
- Conserva todas las correcciones funcionales de `6.14.2-rc.1`.

## Validación requerida en Windows

1. Extraer el ZIP en una carpeta normal.
2. Ejecutar `INICIAR.bat`.
3. Confirmar instalación de dependencias sin `spawnSync npm.cmd EINVAL`.
4. Abrir la URL local en la computadora y la URL LAN en el teléfono.
5. Cerrar con `Ctrl+C` y confirmar un segundo arranque sin reinstalación.
