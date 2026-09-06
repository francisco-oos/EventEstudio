# Matriz de cobertura — 6.16.0-rc.41

| Requisito RC41 | Implementación | Evidencia | Estado |
|---|---|---|---|
| Sobre varía por Recipe | `synchronizeStationeryFromRecipe` palette/material/liner | `rc41-production-readiness.js` | PASS |
| Preview no queda pegado | iframe `about:blank` + cache bust | contrato RC41 | PASS |
| Apply no pierde Stationery | `EventStudioStationeryStudio.flush()` | contrato RC41 | PASS |
| No exigir Guardar ahora | autosave + flush Apply | RC41 static | PASS |
| Punto de partida ACTIVE | `activeRecipe` + `baseline=active` | RC41 static | PASS |
| Editar catálogo usa DRAFT | `baseline=draft` | RC41 static | PASS |
| Portada del panel heredada | `resolvedLocalMediaUrl` | RC41 visual dataset | PASS |
| Media restaurada segura | alias único mismo original | RC41 static/visual | PASS |
| Portada móvil/escritorio | heroMedia device fields | RC41 visual | PASS |
| Drag de portada | pointer handler Design Lab | RC41 static | PASS |
| Assets públicos visibles | `aspectRatio` + CSS mask box | RC41 visual | PASS |
| Drag/escala Assets | pointer + Ctrl/Alt wheel | RC41 static | PASS |
| Evitar revisiones idénticas | PUT idempotente | RC41 static | PASS |
| Catálogo completo | 65 Recipes | RC31/RC34/RC41 | PASS |
| Recipe visual | 65×2 viewports | RC32 visual | PASS 130 |
| Color parity | 65×2 viewports | RC35 visual | PASS 130 |
| Responsive | 320/390/1366 | RC38 visual | PASS 9 |
| Servicios ocultos | desmontaje DOM | RC33 feature visual | PASS 32 |
| Contenido largo | 8 layouts×8 devices | RC33 device visual | PASS 64 |
| Álbum | renderer | RC33 album visual | PASS 2 |
| Stationery | engine/studio/delivery | RC27–RC30 + RC28 visual | PASS |
| Perfiles | feature/commerce projection | RC34 | PASS 1,300 |
| E2E servidor real | preproduction | npm deps requeridas | BLOCKED_ENV |
