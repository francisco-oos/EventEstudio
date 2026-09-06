# Auditoría integral — 6.16.0-rc.37

## Baseline y datos

Baseline: 6.15.0-rc.36 QA con datos. Antes de ejecutar se creó copia binaria. La BD fuente y el respaldo conservan SHA256 `865174a02f7436980080db1765c8a4aa42d984619d13eeb7d74c06ad33fcf270`; `quick_check=ok`, `integrity_check=ok`. Conteos iniciales: 4 usuarios, 2 eventos, 26 invitados, 1 grant y 5 subscriptions. No se ejecutó seed sobre esta BD.

## Bugs encontrados y corregidos

| ID | Severidad | Problema/causa | Corrección | Evidencia |
|---|---|---|---|---|
| V5-01 | alta | Guardar/Aplicar/Catálogo compartían semántica | DRAFT/ACTIVE/CATALOG y CTA separados | V5 workflow |
| V5-02 | alta | regreso a Resumen y pérdida de evento/tab | contexto de retorno y sesión persistidos | control wiring + inspección |
| V5-03 | alta | Stationery guardaba por flujo paralelo | endpoint `stationery-draft` y submodo interno | RC28–RC30 + V5 |
| V5-04 | alta | color de texto divergía en Preview/Público | Color Engine semántico compartido | RC34/RC35/V5 |
| V5-05 | alta | cliente sin edición suficiente de bloques/texto | inspector contextual, orden, visibilidad, pesos, color, ancho y spacing | RC31–V5 |
| V5-06 | alta | cliente podía ver acciones ambiguas de diseñador | capabilities backend y botones ocultos | V5 permissions |
| V5-07 | media | Apply admitía doble clic concurrente | bloqueo UI + endpoint idempotente | V5 double apply |
| V5-08 | media | no existía descarte recuperable de DRAFT | descarte confirmado y transaccional | V5 discard |
| V5-09 | alta | `npm test` fallaba por CI ausente pese a documentación | restaurado `.github/workflows/ci.yml` | project-integrity |
| V5-10 | media | auditor mezclaba reglas QA y RELEASE | perfiles de paquete separados | audit QA/RELEASE |
| V5-11 | alta | p95 concurrente 2.2–2.34 s | cache de catálogo inmutable + invalidación en mutaciones | RC23 p95 218–244 ms |
| V5-12 | media | contratos RC28–30 exigían persistencia pre-V5 | pruebas actualizadas al flujo DRAFT real | RC28–RC30 |
| V5-13 | alta | manifests Gemini declaraban nombres no entregados | sólo 2 SVG físicos normalizados | asset ingest |

## Inventario técnico

- 163 rutas Express.
- 459 archivos revisados y 97 archivos JavaScript verificados por sintaxis en auditoría QA.
- 492 IDs de control en HTML; 154 botones/enlaces con ID; 134 botones verificados por wiring estático.
- Design Engine: 65 Recipes, 19 assets, 12 componentes, 103 estilos, 34 presentaciones fotográficas, 16 timelines, 12 QR frames y 8 print layouts.

## Hallazgos no cerrados por el entorno

La matriz visual RC37 no se pudo ejecutar: `ModuleNotFoundError: playwright` y no hay Chromium/Firefox/WebKit instalados. Se clasifica `NOT_RUN`, no PASS. El lote Gemini tampoco trae thumbnails/previews separados; EventStudio usa el SVG real como miniatura lazy.

## Cambios deliberadamente no implementados

No se implementó Fase B (Agency, timeline familiar, marketplace, personajes o VideoRenderer). Se conserva arquitectura compatible sin placeholders de producción.
