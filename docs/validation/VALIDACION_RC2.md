# Validación técnica 6.14.2 RC2

Documento histórico. La validación vigente está en `VALIDACION_RC3.md`.

## Resultado automatizado

| Comprobación | Resultado |
|---|---|
| Instalación exacta desde `package-lock.json` | Aprobada |
| Integridad de configuración y archivos | Aprobada |
| Selección de red local y generación de URL móvil | Aprobada |
| Resolución de npm en Windows mediante `npm-cli.js` | Aprobada |
| Alternativa de Windows mediante `cmd.exe /d /c npm.cmd` | Aprobada |
| Ruta POSIX de npm | Aprobada |
| Regresión funcional multi-evento | Aprobada |
| Respaldo y restauración en almacenamiento aislado | Aprobada |
| Inicio, `/api/health` y cierre controlado | Aprobada |
| Auditoría de dependencias de producción | 0 vulnerabilidades |

## Hallazgo corregido

En `6.14.2-rc.1`, Windows podía devolver
`spawnSync npm.cmd EINVAL` porque el lanzador intentaba abrir directamente un
archivo de comandos. `6.14.2-rc.2` ejecuta preferentemente el `npm-cli.js`
incluido con Node y conserva una alternativa explícita mediante `cmd.exe`.

La política de firmas de PowerShell puede bloquear `npm.ps1`; no es necesario
relajarla. Los comandos manuales en Windows deben usar `npm.cmd`.

## Validación física pendiente

La ruta de Windows está cubierta por pruebas automatizadas, pero antes del
despliegue se debe ejecutar `INICIAR.bat` en la PC real y confirmar:

1. Primer arranque sin `EINVAL`.
2. Acceso desde la PC.
3. Acceso desde el teléfono conectado a la misma red.
4. Segundo arranque sin reinstalar dependencias.
5. Conservación de la base y fotografías existentes.
