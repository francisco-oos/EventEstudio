# ADR — Criterios de aceptación QA y multi-tenancy — EventStudio 6.14.2-rc.23

## Estado

Aceptado para la candidata RC23. La promoción a estable continúa condicionada a que la suite completa `npm test`, el E2E concurrente RC23 y la prueba visual obligatoria terminen en verde en un entorno con dependencias instaladas.

## Base documental revisada antes de modificar

Antes de aplicar cambios se revisaron, como mínimo, los documentos vigentes que gobiernan las áreas afectadas:

- `docs/analysis/ARQUITECTURA_COMERCIAL_RC13.md`
- `docs/analysis/PUBLICACION_Y_PERFILES_RC13.md`
- `docs/analysis/RSVP_SEATING_RC13.md`
- `docs/analysis/PERFORMANCE_RC17.md`
- `docs/analysis/DECISIONES_TECNICAS_RC20.md`
- `docs/analysis/DECISIONES_TECNICAS_RC21.md`
- `docs/analysis/ARQUITECTURA_SEAL_RSVP_GIFTS_RC22.md`
- `docs/validation/VALIDACION_RC21.md`
- `docs/validation/VALIDACION_RC22.md`

Las decisiones históricas siguen vigentes salvo donde RC23 documenta una modificación explícita.

## Decisión 1 — Matriz de roles y módulos críticos

### Motivo

Los tests existentes cubrían permisos, Smoke, 1,200 usuarios y módulos específicos, pero no existía una prueba única que ejercitara de forma concurrente Constructor de Perfiles, Mi Negocio, Planos/Layouts, clientes de distintos planes y acceso público independiente.

### Decisión

Se añade `tests/rc23-concurrent-e2e.js` como prueba de aceptación. La matriz conserva la semántica vigente:

- `owner` y `developer` son roles de plataforma y pueden operar herramientas protegidas por `ownerOnly`.
- `client` sólo puede operar eventos vinculados a su cuenta y módulos permitidos por plan/concesión.
- un cliente nunca puede acceder al evento de otro cliente.
- `seating` requiere `eventAllowed` y `featureRequired("seating")`.
- Mi Negocio y Constructor de Perfiles permanecen fuera del alcance del rol `client`.

La prueba genera cuentas independientes, transfiere eventos, modifica un perfil comercial desde Developer, guarda un layout Premium, comprueba el bloqueo de Express y lanza una ráfaga concurrente de lecturas autorizadas, accesos cruzados esperadamente rechazados y solicitudes públicas.

### Alternativas evaluadas

1. Extender únicamente `tests/smoke.js`: descartado porque aumentaría aún más un test monolítico y dificultaría identificar regresiones de multi-tenancy.
2. Usar mocks de permisos/SQLite: descartado porque no valida middleware, sesión, consultas ni aislamiento real.
3. Crear una prueba RC23 separada: elegida por trazabilidad y por permitir límites de rendimiento propios.

### Riesgos y mitigación

- **Variación de rendimiento en CI:** p95 configurable mediante `EVENTSTUDIO_CONCURRENT_P95_LIMIT_MS`; el valor por defecto es 1,500 ms local.
- **Falsos positivos por carga excesiva del runner:** número de rondas configurable con `EVENTSTUDIO_CONCURRENT_ROUNDS`.
- **Contaminación de datos:** almacenamiento temporal aislado y borrado al finalizar.

## Decisión 2 — QA visual obligatorio y medible

### Motivo

Las pruebas CSS/DOM previas demuestran contratos estáticos, pero no miden layout real, CLS ni cadencia de frames. El criterio de aceptación exige detectar traslapes, parpadeos y caídas de fluidez.

### Decisión

Se añade `tests/visual-acceptance.py`. La prueba utiliza Chromium headless y el HTML/CSS/JavaScript reales de EventStudio. La configuración QA se inyecta mediante `fetch` determinista para eliminar variaciones de red y datos; no se reemplaza la lógica de render o animación.

La prueba recorre:

- 64 plantillas en 390×844 y 1440×900: 128 casos.
- las 21 aperturas activas en 390×844.
- nombres largos y contenido dinámico suficientemente extenso para forzar geometría real.

Umbrales:

- overflow horizontal: máximo 2 px.
- traslape crítico copy/sobre/acción: ninguno.
- CLS: ≤ 0.05.
- FPS medido durante la transición: ≥ 48 FPS; objetivo observado ~60 FPS.
- intervalo p95 de `requestAnimationFrame`: ≤ 40 ms.
- errores de consola/page errors: cero.

La evidencia detallada se escribe en `docs/validation/evidence/RC23_VISUAL_ACCEPTANCE.json`. La prueba complementaria `tests/visual-device-matrix.py` cubre las cinco integraciones nuevas en 320×568, 360×800, 390×844, 412×915, 768×1024 y 1440×900.

### Alternativas evaluadas

1. Capturas manuales: descartadas como única evidencia porque no son reproducibles ni miden FPS/CLS.
2. Screenshots pixel-perfect: descartados por sensibilidad a fuentes/antialiasing entre sistemas.
3. Geometría + métricas de navegador: elegida como puerta automática; la revisión visual humana sigue siendo complementaria.

### Incidencia encontrada y corrección

La matriz detectó una colisión aproximada de 4 px entre un nombre largo y el sobre `cinematic-fold` en 390×844. La causa era la rotación de −2° del sobre, que aumenta su rectángulo efectivo.

Se evaluaron tres soluciones:

- eliminar la rotación: descartado porque cambia la identidad visual aprobada;
- reducir globalmente el sobre: descartado porque degrada escritorio y móviles grandes;
- reservar separación móvil específica: elegida.

Se añadió `.opening-cinematic-fold .opening-envelope-button{margin-top:.65rem}` dentro del breakpoint móvil y un contrato de regresión en `tests/animation-contracts.js`. Después de la corrección la apertura volvió a pasar sin overlap, overflow ni CLS.

## Decisión 3 — Enlace público independiente de invitados/RSVP

### Motivo

Una invitación debe poder compartirse en cuanto el evento está listo, incluso si el anfitrión no utilizará lista de invitados o confirmaciones.

### Decisión

RC23 conserva y eleva a criterio de aceptación la arquitectura RC22:

- `/api/admin/events/:id/public-url` deriva la URL directamente del evento.
- `/e/:slug` no consulta invitados, tokens ni RSVP.
- `/api/config/:slug` sirve configuración pública por evento publicado.
- el token `?i=` sólo activa personalización individual; su ausencia no bloquea el contenido.
- el formulario RSVP se oculta si el evento lo desactiva o si no existe invitación individual.

`tests/rc23-concurrent-e2e.js` obtiene la URL antes de crear invitados, publica el evento y valida página/config anónimas sin token.

### Alternativas evaluadas

1. Crear automáticamente un invitado genérico: descartado porque mezcla distribución pública con gestión de invitados.
2. Exigir RSVP aunque esté desactivado: descartado porque contradice el feature flag.
3. URL pública por slug independiente: conservada por ser la opción desacoplada.

## Decisión 4 — Puerta de release

RC23 no puede declararse terminada sólo porque pasen contratos estáticos. Para promoverla deben quedar registrados en verde:

1. `npm test`
2. `npm run test:rc23`
3. `npm run test:visual`
4. `npm run audit`
5. `npm audit --audit-level=moderate`

Si una dependencia nativa o herramienta del runner impide ejecutar una de estas puertas, la candidata se considera **no aprobada**, aunque el código que sí pudo probarse haya pasado.
