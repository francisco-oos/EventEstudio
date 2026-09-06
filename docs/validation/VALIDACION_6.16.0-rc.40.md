# Validación — EventStudio 6.16.0-rc.40

Estado: **QA candidate avanzada**.

| Área | Resultado |
|---|---|
| Sintaxis JS modificada | PASS |
| Catálogo | PASS: 65 Recipes / 31 Assets |
| Experiencia superior → Recipe | PASS por contrato RC40 |
| Recipe → Stationery al forzar sobre | PASS por contrato RC40 |
| Portada fondo/izquierda/derecha | PASS Chromium |
| Portada diferida por apertura | PASS Chromium |
| Scroll independiente editor | PASS Chromium |
| Coherencia lógica | PASS: 175,500 combinaciones |
| Rol/perfil lógico | PASS: 1,300 proyecciones |
| Wiring UI | PASS: 139 controles |
| Recipe render | PASS: 130 casos |
| Readability | PASS: 130 casos |
| Catálogo Design Lab | PASS: 65 casos |
| Responsive focal | PASS: 9 casos |
| Feature visibility | PASS: 32 casos |
| Contenido largo | PASS: 64 casos |
| Álbum | PASS: 2 casos |
| Interacciones públicas | PASS en harness |
| Stationery/opening | PASS en harness |
| DB/media | PASS integridad; 1 portada referenciada ausente |
| E2E Express/SQLite real | BLOCKED_ENV |
| npm audit online | BLOCKED_ENV |

## Pruebas ejecutadas en esta candidata

`test:rc31`, `test:rc33`, `test:rc34`, `test:rc35`, `test:rc38`, `test:rc39`, `test:rc40`, `test:animations`, `test:rc27`, `test:rc28`, `test:rc29`, `test:rc30`, RC34 visual, RC38 visual, RC33 feature/content/album visual, RC32 Design Lab/Recipe/public interactions y Stationery visual.

`test:v5` no pudo completar porque este runtime no tiene `node_modules`; `src/seed.js` se detuvo en `Cannot find module 'bcryptjs'`. `npm ci --offline --ignore-scripts` confirma que la caché tampoco contiene todos los paquetes. Esto es una limitación del entorno, no un PASS.

## Hallazgo media

La BD se inspeccionó en modo lectura. `quick_check=ok`. El único recurso local referenciado y ausente es la portada del evento 2. Las tres fotos de galería, música y referencia de vestimenta presentes en la BD sí existen en el ZIP.

## Gate requerido antes de producción

En un entorno con dependencias:

```text
npm ci
npm run test:preproduction
npm audit --audit-level=moderate
```

Después realizar el checklist físico RC40 en Edge/Chrome y al menos un móvil real. No promover ante FAIL funcional, seguridad, permisos, persistencia, media, contraste, overflow o sincronización.
