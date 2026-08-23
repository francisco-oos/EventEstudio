# Validación — EventStudio 6.14.2-rc.17

Fecha de auditoría: 2026-08-10.

## Base

Se trabajó sobre la RC16-clean-optimization proporcionada por el propietario. SHA-256 del ZIP base verificado durante el trabajo:

`036630eefbefa983eef0967bd82cf4b8ea777a9bb9e892b9d1e3e622d3ac9402`

## Pruebas ejecutadas y aprobadas

- `node tests/project-integrity.js`
- `node tests/source-references.js`
- `node tests/mobile-ui.js`
- `node tests/local-network.js`
- `node tests/rc14-regressions.js`
- `node tests/rc15-regressions.js`
- `node tests/rc15-1-login-hotfix.js`
- `node tests/rc17-regressions.js`
- `node scripts/audit-project.js`
- `bash -n iniciar_linux.sh`
- `bash -n docker-entrypoint.sh`

Resultado de auditoría estructural al cierre previo a empaquetado:

- 208 archivos revisados por la auditoría estructural RC17.
- 38 JavaScript verificados con `node --check`.
- 161 textos estáticos de Configuración detectados; 0 sin clave literal en el mapa EN/PT.
- No se detectaron IDs HTML duplicados, JSON inválidos, DB/logs/ZIP de runtime ni uploads reales dentro del árbol de trabajo.

## Prueba de renderers en Chromium

Se inyectaron `styles.css` y `experience-renderers.js` directamente en Chromium headless del entorno y se probaron dos viewports:

- escritorio: 1280×800;
- móvil: 390×844.

Rosa eterna:

- 49 pétalos generados;
- 5 sépalos;
- estado a ~120 ms: `growing`;
- estado a ~880 ms: `growing leaves-visible`;
- estado a ~2.28 s: `growing leaves-visible bloomed`;
- 0 errores de página en ambos viewports.

ParticleTrace:

- escritorio: 284 partículas en el viewport probado;
- móvil: 180 partículas (límite adaptativo inferior);
- `requestAnimationFrame` activo en ambos;
- 0 errores de página.

Esta prueba valida el ciclo de los renderers, no sustituye una prueba end-to-end de la invitación con servidor/BD reales.

## Suite runtime bloqueada

Se intentó:

```text
npm ci --ignore-scripts --no-audit --no-fund
```

El mirror npm de este entorno respondió antes de ejecutar EventStudio:

```text
404 Not Found ... zip-stream-7.0.5.tgz
```

Por tanto **no se declara `npm test` completo como aprobado en este entorno**. La suite runtime que depende de `better-sqlite3`, ExcelJS, Express, etc. debe ejecutarse en la PC del propietario o CI con registro npm funcional antes de promover a producción.

## Pruebas físicas recomendadas antes de promoción

- música e imágenes desde teléfono con Wi-Fi estable e inestable;
- desconectar red durante upload y comprobar reintento sin duplicado;
- restaurar una copia de BD antigua con multimedia ausente y verificar el panel de salud;
- Rosa eterna y demás aperturas en Chrome/Edge desktop y Android real;
- invitación física con ceremonia/recepción configuradas;
- ocultar/draft/publicar Showcase y reiniciar servidor;
- vaciar temporalmente un plan/perfil y reiniciar para verificar persistencia;
- cliente Basic/Premium, compra, cortesía y Store sin duplicados;
- i18n EN/PT en Configuración y rutas dinámicas pendientes.

## Paquete de intercambio RC17

La copia preparada para intercambio se auditó nuevamente después de excluir datos de runtime y binarios de tipografías. En esa copia:

- 192 archivos fueron revisados por `scripts/audit-project.js`;
- 38 JavaScript volvieron a pasar `node --check`;
- no se incluyeron `node_modules`, `.env`, bases SQLite, logs, archivos multimedia de runtime ni binarios `.woff/.woff2/.ttf/.otf/.eot`;
- se conservaron únicamente archivos de licencia/README de tipografías y placeholders `.gitkeep`;
- la misma suite estática de RC17 volvió a aprobarse sobre la copia empaquetable.

La exclusión de binarios de fuentes es una decisión del paquete de intercambio; para conservar exactamente las tipografías locales, el propietario puede reutilizar `public/fonts/` de su propia RC16.
