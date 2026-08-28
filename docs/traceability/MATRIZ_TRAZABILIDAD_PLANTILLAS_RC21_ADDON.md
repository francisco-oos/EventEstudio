# Matriz de trazabilidad — Add-on de plantillas sobre RC21

| Solicitud | Implementación | Evidencia |
|---|---|---|
| Usar la versión que reproduce bien | base `EventEstudio(2).zip` | diff inicial idéntico a la base funcional revisada |
| No modificar nada más | cambios limitados a catálogo, CSS, mapa de tiempos, tests y documentación | diff final contra base |
| Trasladar periódico | `wedding-gazette` + `newspaper-fold` | config + CSS namespaced + contratos |
| Trasladar vintage | `vintage-parchment` + apertura homónima | config + CSS namespaced + contratos |
| Trasladar editorial | `sage-photo-editorial` | config + CSS namespaced |
| Universo | `olive-universe` + `olive-universe-orbit` | config + CSS + timing |
| Néctar | `olive-nectar` + `olive-nectar-seal` | config + CSS + timing |
| Aurora | `blue-breeze-aurora` + `blue-aurora-reveal` | config + CSS + timing |
| Cosmos | `botanical-cosmos` + `botanical-cosmos-orbit` | config + CSS + timing |
| Conservar motor | mismo DOM; mismo `setupInvitationOpening`; sin renderer nuevo | pruebas RC21 + diff |
| Visibilidad | geometría móvil 390×844, escritorio y no overflow | contratos + QA Chromium headless |
| Movimiento accesible | reduced-motion público + force preview | CSS + `animation-contracts` |
| No copiar proveedor | cero assets/código Linvia importados | inventario/diff |
