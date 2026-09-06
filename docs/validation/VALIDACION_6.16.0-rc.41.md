# Validación — EventStudio 6.16.0-rc.41

Estado: **QA candidate avanzada**.

| Área | Resultado |
|---|---|
| Sintaxis JS | PASS: 101 archivos |
| Integridad/proyecto | PASS |
| Referencias DOM/estáticos | PASS |
| Catálogo | PASS: 65 Recipes / 31 Assets / 103 skins |
| Contraste catálogo | PASS: 65 Recipes |
| Coherencia presentación | PASS: 175,500 combinaciones |
| Roles/perfiles lógicos | PASS: 1,300 proyecciones |
| Wiring UI | PASS: 139 controles |
| Stationery RC27–RC30 | PASS |
| Sobre Recipe→paleta/textura | PASS contrato RC41; 65 identidades / 59 exteriores únicos |
| Flush Stationery antes de Apply | PASS contrato RC41 |
| Preview iframe fresco | PASS contrato RC41 |
| Portada heredada | PASS; alias único recuperado en dataset actual |
| Portada drag + encuadre móvil/escritorio | PASS Chromium |
| Asset público con caja real | PASS Chromium |
| Recipe visual móvil/escritorio | PASS: 130 casos / 0 overflow |
| Color parity visual | PASS: 130 casos |
| Design Lab catálogo | PASS: 65 casos |
| Responsive focal | PASS: 9 casos |
| Feature visibility | PASS: 32 casos |
| Contenido largo | PASS: 64 casos |
| Álbum | PASS: 2 casos |
| Stationery visual | PASS: 2 + 5 perfiles, ~60 FPS |
| DB | PASS: quick_check=ok |
| E2E servidor Express real | BLOCKED_ENV |
| npm audit online | BLOCKED_ENV |

## Evidencia del caso de portada

BD evento 2:

`/uploads/site-media/1788585988969-9695834f-IMG_20250823_101925.jpg`

El archivo exacto no está en la copia. Existe un único candidato del mismo directorio y mismo nombre original:

`1788586875269-3241656b-IMG_20250823_101925.jpg`

RC41 proyecta ese alias sólo para lectura/render. La referencia persistida en BD permanece intacta.

## Pruebas reejecutadas

`project-integrity`, `source-references`, `animation-contracts`, RC27, RC28, RC29, RC30, RC31, RC32, RC33, RC34, RC35, RC38, RC39, RC40 y RC41 en sus componentes estáticos aplicables. En Chromium se reejecutaron Stationery, Design Lab, Recipe visual, color parity, responsive, feature matrix, contenido largo, álbum, RC40 portada y RC41 readiness.

## Gate faltante por entorno

`npm ci` fue intentado y terminó por timeout de transporte. No se marca como fallo funcional de EventStudio ni como PASS. En un equipo con dependencias y red:

```text
npm ci
npm run test:preproduction
npm audit --audit-level=moderate
```

Después ejecutar el checklist físico RC41.
