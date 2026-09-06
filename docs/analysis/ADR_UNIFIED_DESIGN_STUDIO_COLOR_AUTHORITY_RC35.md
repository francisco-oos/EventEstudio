# ADR RC35 — Design Studio unificado y autoridad cromática compartida

**Estado:** Aceptado para EventStudio 6.15.0-rc.35.

## Contexto
RC34 resolvió la relación entre apertura y Recipe, pero el flujo de edición todavía exponía dos aplicaciones visibles: Design Lab y Stationery Studio. Además, el QA físico mostró una divergencia perceptible: una combinación podía verse legible dentro del constructor y publicarse con texto demasiado claro sobre una superficie clara. La causa arquitectónica era que preview y publicación podían terminar consumiendo tokens semánticos calculados por rutas distintas.

## Decisión
1. EventStudio presenta un solo **Design Studio** al usuario.
2. Stationery conserva su motor especializado, porque su geometría, sello y cinemática están estabilizados, pero se monta dentro del mismo workspace mediante un iframe controlado con `embedded=1`.
3. El acceso desde Administración a Stationery navega primero al Design Studio con `open=stationery`; ya no abre una pestaña aparte.
4. El Design Studio guarda cambios pendientes antes de entrar al editor especializado para evitar pérdida de Recipe.
5. Stationery comunica `apply` y `close` al contenedor mediante `postMessage` y conserva `BroadcastChannel` como mecanismo de sincronización compatible.
6. Al aplicar Stationery, `presentation` y `designRecipe.design` se sincronizan en servidor. No se permiten dos verdades persistidas para opening, galería, motion o recorrido.
7. Se incorpora `public/design-color-engine.js` como algoritmo cromático compartido en navegador.
8. Design Lab y Public Design Engine consumen el mismo `ensureAccessiblePalette()` para derivar `ink`, `muted`, `accentText`, `goldText`, `paperContrast`, `bgContrast`, `accentContrast` y `goldContrast`.
9. El servidor sigue aplicando `src/theme-design.ensureAccessiblePalette()` como primera defensa. El cliente repite la validación deliberadamente para proteger previews, payloads parciales, cachés antiguas o integraciones que envíen solamente la paleta cruda.
10. Una hero sin imagen usa una superficie de papel explícita y `paperContrast`. Una hero con imagen conserva texto blanco, pero el overlay mínimo sigue protegiendo legibilidad.
11. Los nombres reales del evento no forman parte del runtime ni de reglas CSS; el ajuste tipográfico opera sobre datos dinámicos.

## Alternativas descartadas
- Abrir Stationery con `window.open()` o `target=_blank`: fragmenta el flujo y hace visible la separación técnica.
- Reescribir Stationery dentro de Design Lab en este sprint: arriesga un motor de sobre/lacre ya estabilizado sin aportar valor funcional equivalente.
- Corregir solamente las 64 paletas: una personalización futura podría volver a introducir contraste insuficiente.
- Confiar exclusivamente en el servidor para contraste: previews aislados o payloads parciales podrían divergir de publicación.
- Forzar blanco/negro global: destruye armonía cromática y no distingue superficies semánticas.

## Consecuencias
- El usuario percibe un solo editor aunque internamente existan motores especializados.
- Preview y publicación comparten el mismo contrato cromático.
- Stationery continúa desacoplado como motor, pero ya no mantiene estado visual paralelo.
- Se conserva la posibilidad de extraer Stationery del iframe hacia componentes nativos en una migración futura sin cambiar el contrato de Recipe.
