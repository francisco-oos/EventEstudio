# Trazabilidad RC35

| Requisito | Implementación | Validación |
|---|---|---|
| Un solo editor percibido | `design-lab.html`, workspace Stationery embebido | `rc32-design-lab-visual.py`, `rc35-unified-design-studio.js` |
| No abrir Stationery en pestaña | Administración navega a Design Studio con `open=stationery` | `rc35-unified-design-studio.js` |
| Preview y publicación con mismos criterios de color | `design-color-engine.js` compartido | `rc35-color-parity-visual.py` |
| Paletas predefinidas y personalizadas legibles | derivación semántica runtime | 128 casos RC35, contraste AA |
| Sin doble verdad de apertura | sincronización `presentation` → `designRecipe.design` en server | `rc35-unified-design-studio.js` |
| Sobre/lacre estable | Stationery Engine preservado | RC28 visual + RC30 visual |
| Nombres dinámicos sin cortes arbitrarios | smart name + CSS keep-all | RC35 color visual y contratos RC34 |
| Música funcional | Public Design Engine conserva sección y `app.js` controla play/pause | `rc32-recipe-visual.py`, `rc32-public-interactions.py` |
| Responsive | contratos globales, sin parche Recipe por Recipe | visual acceptance + device matrix + long-content |
| Roles/perfiles | Entitlement Resolver desacoplado de perfil comercial | `rc34-design-coherence.js` |
| Botones/acciones | wiring + Chromium Design Lab/public | `rc34-control-wiring.js`, `rc32-design-lab-visual.py`, `rc32-public-interactions.py` |
