# Auditoría hotfix de arranque local — EventStudio 6.16.0-rc.41

Fecha: 2026-09-07

## Hallazgo reproducido

En Windows, `INICIAR.bat` podía entrar a `npm ci` cuando faltaba o estaba desfasado el marcador privado `node_modules/.eventstudio-lock-sha256`. `npm ci` reconstruye `node_modules`; si otra instancia de Node/EventStudio mantenía cargado `better_sqlite3.node`, Windows rechazaba el `unlink` con `EPERM` y el launcher terminaba antes de iniciar el servidor.

## Causa raíz

El launcher consideraba las dependencias no preparadas basándose en el marcador SHA-256 + resolución de dos módulos. No distinguía entre:

1. dependencias realmente desfasadas, y
2. dependencias ya instaladas exactamente según `package-lock.json` pero con marcador ausente/desactualizado.

El segundo caso provocaba un `npm ci` destructivo e innecesario.

## Corrección

- Se obtiene la versión exacta de cada dependencia directa desde `package-lock.json`.
- Se compara con el `package.json` instalado de cada dependencia sin cargar módulos nativos.
- Se comprueba la presencia física de `better_sqlite3.node` sin hacer `require()` antes de una posible reinstalación.
- Si todo coincide exactamente, se reconstruye únicamente el marcador SHA-256 y se reutiliza `node_modules`.
- Si existe una discrepancia real, se conserva `npm ci` como mecanismo de instalación exacta.
- Si `npm ci` falla en Windows y existe el binario nativo, el launcher añade un diagnóstico específico para `EPERM/unlink`, indicando cerrar sólo la instancia que mantiene el archivo abierto y conservar la base de datos.

No se altera `wedding.db`, no se ejecuta `seed` y no se relajan verificaciones de integridad.

## Documentación

Se corrigieron referencias vigentes RC40/RC39 que quedaban en `README.md` y `docs/README.md`, dejando RC41 como fuente actual. Se añadió `docs/guides/GUIA_ARRANQUE_LOCAL_WINDOWS_RC41.md` y se enlazó desde el índice RC41.

Los documentos históricos no se movieron: varios índices antiguos los referencian y conservar sus rutas mantiene la trazabilidad.

## Hallazgo adicional

`iniciar_linux.sh` tenía finales de línea CRLF. La auditoría con `bash -n` lo interpretaba incorrectamente y terminaba con `unexpected end of file`. Se normalizó el launcher Linux a LF sin modificar su lógica.

## Verificaciones ejecutadas en este entorno

- `node --check scripts/iniciar-local.js`: PASS.
- `node tests/local-network.js`: PASS.
- `node tests/source-references.js`: PASS.
- `EVENTSTUDIO_PACKAGE_PROFILE=release node scripts/audit-project.js`: PASS.
- Auditoría estructural: 527 archivos y 101 JavaScript con sintaxis verificada.
- Marcadores `TODO/FIXME/HACK/XXX` en `src/`, `public/`, `scripts/`, `tests/`: 0 encontrados.

## Limitación

Este paquete de intercambio no contiene `node_modules`, por diseño. La reproducción exacta del desbloqueo de un DLL de Windows debe completarse en la PC donde ocurrió el `EPERM`. El launcher ya contiene la prevención y diagnóstico correspondientes; el gate completo sigue siendo `npm ci`, `npm run test:preproduction` y el checklist físico RC41 cuando el entorno permita instalar dependencias.
