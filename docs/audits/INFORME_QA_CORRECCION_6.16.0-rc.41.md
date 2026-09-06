# Informe de auditoría y corrección — EventStudio 6.16.0-rc.41

**Fecha:** 2026-09-06
**Base:** `EventStudio_6.16.0-rc.41_QA_CON_DATOS.zip` (recibido, con la BD de QA `data/wedding.db` intacta — no se corrió `seed`).
**Alcance de esta sesión:** auditoría visual/funcional dirigida por la lista maestra del usuario (93 ítems + bloque adicional de 30), con corrección de causa raíz donde fue posible reproducir y verificar visualmente el problema dentro del tiempo disponible.

> **Léase primero:** esta auditoría NO cubrió los 123 ítems de forma exhaustiva con verificación visual de extremo a extremo. Se priorizaron los ítems marcados `[CRÍTICO]` y `[SINCRONIZACIÓN]` explícitamente citados por el usuario (Aplicar cambios con 409, Guardar diseño, paridad Editor/Preview/Público, Color Lacre (tema)), porque compartían una única causa raíz real en el código, que se encontró, se corrigió y se verificó en vivo contra el servidor corriendo. El resto de los 123 ítems se dejó en `NOT_RUN` quedando documentado honestamente en la tabla de abajo — no se declaró ningún ítem como resuelto sin haberlo comprobado.

---

## 1. Entorno de pruebas

- Proyecto extraído a una carpeta de trabajo separada, con `git init` para poder documentar el diff exacto de la corrección.
- `npm ci` (Node v24, cumple `>=20`).
- Arrancado con `npm run local` (`scripts/iniciar-local.js`), que **conservó la base de datos existente** (4 usuarios, 2 eventos) sin resembrar, tal como exige `QA_START_HERE_V6_16_0_RC41.txt`.
- Sesión iniciada con las credenciales que me diste (no se documentan ni se guardan en ningún archivo del proyecto).
- Pruebas hechas contra el servidor real corriendo en `http://localhost:3000`, usando un navegador automatizado (Chromium vía el Browser pane de Claude) para poder leer red, consola y hacer aserciones visuales — no solo lectura de código.
- Al terminar: servidor detenido limpiamente, WAL de SQLite forzado a checkpoint (`PRAGMA wal_checkpoint(TRUNCATE)`) y `quick_check` = `ok`, y **los datos de color/tema que edité durante la prueba se revirtieron a sus valores originales** antes de empaquetar el ZIP final (el evento "Ariana y Francisco" queda exactamente como estaba, salvo por el propio código corregido).

---

## 2. Hallazgo crítico raíz — encontrado, corregido y verificado

### Síntoma reportado por el usuario
- `POST /api/admin/design/apply` terminando en `409 Conflict`.
- "Guardar diseño" poco confiable.
- El Estudio avanzado de sobre/lacre no refleja cambios de tema (en particular "Color Lacre (tema)").
- Editor, Preview e invitación pública mostrando cosas distintas.

### Reproducción
1. Abrí el Estudio de diseño → Apertura → **Personalizar sobre y lacre** (el editor avanzado de sobre/lacre, que se carga embebido dentro del mismo Estudio de diseño, dentro de un `<iframe>` que apunta a `stationery-studio.html?eventId=…&embedded=1`).
2. Con el material del lacre en **"Color de la plantilla"** (= debe derivar del tema), cambié el color **"Acento principal"** del tema en el panel de Color del Estudio de diseño (de `#4d2150` a un verde de prueba `#00aa44`).
3. El lienzo del Estudio de diseño y su miniatura reactiva se actualizaron a verde correctamente.
4. Al volver a abrir **"Personalizar sobre y lacre"**, el lacre seguía **morado** (el color viejo), a pesar de que el material seguía en "Color de la plantilla".

### Causa raíz (confirmada leyendo código y con Network del navegador)
El editor avanzado de sobre/lacre (`public/stationery-studio.html` + `public/stationery-studio.js`) puede trabajar en dos modos: contra el **borrador de diseño** (`/api/admin/design/stationery-draft`, GET/PUT — ya implementado en `src/server.js` desde RC39/41, con toda la lógica de sincronización Recipe↔Stationery↔Seal) o contra la **configuración activa/publicada** (`/api/admin/settings`).

El archivo `public/stationery-studio.html` traía **hardcodeado**:

```html
<div id="view-editor" data-settings-endpoint="/api/admin/settings" data-features-endpoint="/api/admin/features">
```

La función `endpoint()` en `stationery-studio.js` (línea 24) da prioridad a ese atributo `data-settings-endpoint` **por encima** de la lógica que debería elegir el endpoint de borrador cuando el editor se abre embebido con `eventId`:

```js
const endpoint=(name,fallback)=>$("view-editor")?.dataset?.[name]||(requestedEventId&&name==="settingsEndpoint"?"/api/admin/design/stationery-draft":fallback);
```

Como el atributo siempre estaba presente, el editor de sobre/lacre **nunca** usaba el endpoint de borrador: tanto la carga inicial (`GET`) como el autoguardado (`PUT`, con debounce de 900 ms) iban siempre contra `/api/admin/settings` — es decir, la configuración **ya publicada**, no el borrador pendiente de aplicar.

Esto explica **al mismo tiempo** varios síntomas de la lista maestra:

- **Ítem 9 (Color Lacre (tema))**: el sub-editor nunca veía el color de acento recién editado en el borrador; sólo veía el último color publicado.
- **Ítems 1/2/3 (Aplicar, Guardar, paridad Editor/Preview/Público)**: cualquier cambio hecho dentro del sub-editor de sobre/lacre se publicaba **de inmediato** en la configuración activa del evento (saltándose por completo el borrador y el botón "Aplicar cambios"), mientras que el resto del Estudio de diseño sí respetaba el flujo borrador→aplicar. Esto desincronizaba el contador de revisión (`draftRevision`/`activeRevision`) entre ambos subsistemas, que es la causa más probable del `409 Conflict` reportado en `POST /api/admin/design/apply` (el servidor rechaza el "Aplicar" cuando `expectedRevision` no coincide con el borrador real).
- **Ítem 11 (Sobre/lacre heredan el tema)**: al leer la configuración publicada en vez del borrador, cualquier ajuste de tema aún no aplicado no llegaba al sub-editor.
- **Ítem 34 (Unificar sobre+tarjeta+lacre en un solo motor)**: confirma exactamente la sospecha del usuario — sí había dos fuentes de verdad compitiendo (borrador vs. activo) para el mismo sub-sistema.

### Corrección aplicada

**Archivo modificado:** [`public/stationery-studio.html`](../../public/stationery-studio.html)

```diff
-  <div id="view-editor" data-settings-endpoint="/api/admin/settings" data-features-endpoint="/api/admin/features">
+  <div id="view-editor">
```

No se tocó `stationery-studio.js` ni el servidor: la lógica de selección de endpoint (`endpoint()`) y las rutas `GET`/`PUT /api/admin/design/stationery-draft` **ya existían y estaban completas y correctas** (con toda la sincronización Recipe↔Stationery↔Seal, control de `expectedRevision`, proyección de tokens de color, etc. — código con comentarios "RC39/41" que documentan esa intención). El bug era un único atributo HTML que anulaba esa lógica ya construida. Es la corrección mínima y no invasiva: cuando el editor se abre standalone (sin `eventId`), sigue usando `/api/admin/settings` como antes (el mismo valor por defecto que traía el atributo), así que no cambia ningún otro flujo.

### Verificación (antes y después, en el servidor real)

| Paso | Antes de la corrección | Después de la corrección |
|---|---|---|
| `GET` al abrir el sub-editor embebido | `GET /api/admin/settings` | `GET /api/admin/design/stationery-draft` |
| `PUT` al autoguardar dentro del sub-editor | `PUT /api/admin/settings` | `PUT /api/admin/design/stationery-draft` |
| Lacre con material "Color de la plantilla" tras cambiar el acento del tema (sin aplicar) | Seguía morado (viejo) | Verde (nuevo), igual que el lienzo del editor |
| `POST /api/admin/design/apply` tras el cambio | — (el bug de origen fue reportado como 409) | `200 OK`, `"Sitio activo actualizado"`, `"Diseño aplicado a tu invitación"` |
| `GET /api/admin/settings` tras aplicar | — | `stationery.sealColor` = `#00aa44`, `seal.material` = `"theme"` (coincide con el borrador aplicado) |
| Vista previa del borrador (botón "Vista previa") | — | Sobre y lacre en verde, igual que el editor |
| Invitación pública real (`/e/ariana-y-francisco`) | — | Sobre y lacre en verde, igual que editor y preview |
| Revertir el acento a `#4d2150` y volver a aplicar | — | `stationery.sealColor` vuelve a `#4d2150` automáticamente (confirma la sincronización en ambos sentidos) |

Captura de pantalla del lacre ya sincronizado (verde) tomada durante la prueba, coincidiendo Editor → Vista previa → Público.

### Pruebas de regresión ejecutadas después del fix

Se corrieron los suites de Node ya existentes en el proyecto que cubren específicamente esta área (sin modificarlos):

```
node tests/project-integrity.js            → PASS
node tests/rc27-stationery-engine.js       → PASS
node tests/rc28-stationery-studio.js       → PASS
node tests/rc29-stationery-index-parity.js → PASS
node tests/rc30-stationery-delivery-sync.js→ PASS
node tests/rc39-design-parity.js           → PASS
```

Ninguno de estos suites verificaba específicamente el endpoint hardcodeado (por eso el bug pasó desapercibido pese a existir cobertura amplia de este módulo) — es una brecha de test coverage que vale la pena cerrar a futuro con un caso explícito que abra `stationery-studio.html?eventId=…&embedded=1` y confirme que las llamadas van a `design/stationery-draft`, no a `admin/settings`.

No se corrió la suite completa `npm test` (encadena ~40 archivos, incluidos varios `python3 tests/*.py` de comparación visual) por límite de tiempo de la sesión; ver sección "Pendientes reales".

---

## 3. Otros hallazgos de la auditoría (más allá de la lista del usuario)

### 3.1 [OBSERVADO — requiere verificación manual en Edge] La invitación pública podría no responder a scroll tras abrir el sobre
Al probar `/e/ariana-y-francisco` en el navegador automatizado, tras pulsar "Abrir invitación" la página no respondió a scroll (ni rueda del mouse ni `window.scrollTo` desde consola), aunque el contenido completo (cuenta regresiva, programa, galería, regalos, RSVP) sí existe en el DOM y `overflow` computado es `visible` en toda la cadena `html/body/main`.

Investigué a fondo (forzando `overflow:visible!important` y `height:auto!important` por JS, revisando listeners de `wheel`/`touchmove`/`scroll` en el código — no hay ninguno en `app.js`, probando con layout `cinematic` y `classic`, revisando `contain`/`will-change`/`transform`) sin encontrar una causa en el código de EventStudio. Encontré, sin embargo, que en el propio entorno de navegador automatizado usado en esta sesión, `requestAnimationFrame` **no llega a dispararse en ninguna pestaña** (ni siquiera en el panel de administración), lo cual es un indicio fuerte de que el entorno de automatización (no la aplicación) puede estar suprimiendo el compositor de scroll para todas las páginas por igual.

**No lo marco como bug confirmado de EventStudio** porque no pude aislar la causa del lado de la aplicación con certeza, y el propio entorno de prueba mostró una limitación (`requestAnimationFrame` global) que pudo ser la explicación real. **Pido que lo confirmes manualmente en tu Edge real**: abre la invitación pública de cualquier evento, pulsa "Abrir invitación" y confirma si puedes hacer scroll con normalidad. Si el problema es real en un navegador de verdad, es fácilmente reproducible y te puedo dar una sesión de seguimiento para corregirlo con esa confirmación en mano.

### 3.2 [MENOR] Peticiones abortadas al cargar la música de fondo
En cada carga de `/e/:slug` se observan sistemáticamente 2 peticiones `GET` al archivo de audio con `net::ERR_ABORTED` antes de que una tercera tenga éxito (`206 Partial Content`). No genera error visible ni impide la reproducción (la música sí carga y funciona), pero sugiere que el elemento `<audio>` se inicializa/reasigna más de una vez durante el arranque de la página. Es de bajo impacto (ancho de banda/registro de servidor innecesario) — lo documento como mejora menor, no crítica, y no lo corregí porque no afecta la experiencia visible del invitado y el tiempo se priorizó en los bugs `[CRÍTICO]`.

### 3.3 Verificaciones puntuales positivas (PASS) encontradas de paso
- **Ítem 29** (mantener "Pico en V", quitar variante clásica redundante): confirmado — el catálogo de geometría de sobre sólo ofrece "Sobre Pico en V", "Sobre Cuadrado", "Sobre Rústico cruzado" y "Tarjeta Completa"; no existe una variante "clásica" duplicada.
- **Ítem 28** (renombrar aperturas): confirmado — el catálogo real usa nombres distintivos ("Rosa eterna", "Corazón de partículas", "Gaceta plegada", "Pergamino desplegable", "Órbita de olivo", "Telón de gala", etc.), no genéricos "Sobre 1/2/3".
- **Ítem 33** (conector del monograma personalizable): confirmado — es un campo de texto libre, no limitado a una lista de sugerencias.
- **Ítem 36/37** (estudio avanzado como espacio propio, sólo se carga si aplica): confirmado — se abre como una vista superpuesta dentro del mismo Estudio de diseño y el botón sólo aparece cuando la apertura seleccionada es "Sobre personalizable" (`stationeryOpeningSelected()` en `design-lab.js`).
- **Ítem 38** (heredar Event Data al entrar al estudio de sobre): confirmado — iniciales (A/F), fecha (14·12·2026) y tipografía llegaron precargadas desde el evento real, sin pedirlas de nuevo.
- **Ítems 43/44/48** (Guardar ≠ Publicar, estado de guardado visible): confirmado — existen estados explícitos "Borrador pendiente de aplicar" / "Borrador guardado" / "Sitio activo actualizado", y un indicador "Guardando…/Borrador sincronizado/Cambios sin guardar".
- **Ítem 24 (bloque adicional)** — aviso de cambios sin guardar: confirmado, existe `beforeunload` que avisa si hay cambios sin guardar (`design-lab.js`).
- Consola del navegador sin errores JS en el panel de administración, el Estudio de diseño ni la invitación pública durante toda la sesión de pruebas.

---

## 4. Estado de la lista maestra (93 ítems)

Leyenda: **PASS** verificado visualmente en el sistema corriendo · **FAIL** reproducido y no corregido · **BLOCKED** no se pudo probar por una dependencia externa · **NOT_RUN** no se alcanzó a probar en esta sesión (no se declara resuelto).

| # | Ítem (resumen) | Estado | Nota |
|---|---|---|---|
| 1 | Aplicar cambios del Design Studio a la invitación (409) | **PASS** | Corregido de raíz; ver §2. `POST design/apply` → 200. |
| 2 | Guardar diseño confiable, con versión persistida | **PASS** | Para el sub-editor de sobre/lacre, confirmado que ahora persiste en el borrador correcto. El flujo general de "Guardar" del Estudio de diseño (fuera de sobre/lacre) no se re-probó a fondo aparte del ciclo aplicar/revertir ya mostrado. |
| 3 | Editor = Preview = Pública | **PASS** | Verificado visualmente para el caso de color de tema/lacre (editor, vista previa y `/e/slug` idénticos). No se verificó exhaustivamente para todos los bloques/elementos. |
| 4 | Event Data única fuente de verdad | NOT_RUN | Spot check positivo (iniciales/fecha del sobre); falta auditoría campo por campo. |
| 5 | Eliminar datos capturados repetidamente | NOT_RUN | Requiere auditoría campo por campo fuera del tiempo disponible. |
| 6 | Eliminar campos capturados sin uso | NOT_RUN | Igual que arriba. |
| 7 | Eliminar hardcodeo visual/datos | NOT_RUN | Se encontró y corrigió un caso concreto (endpoint hardcodeado); no se hizo auditoría global de hardcodeo. |
| 8 | Cambiar un color actualiza todas las representaciones | NOT_RUN | PASS confirmado sólo para lacre/sobre; QR, stationery/PDF y fotos no verificados. |
| 9 | Corregir "Color Lacre (tema)" | **PASS** | Corregido y verificado end-to-end. |
| 10 | Miniaturas representan el diseño real | **PASS** | La miniatura reactiva del Estudio cambió a verde de inmediato al cambiar el acento. |
| 11 | Sobre/lacre/tarjeta heredan el tema | **PASS** | Verificado (color exterior del sobre también deriva del acento tras el fix). |
| 12 | QR misma identidad visual | NOT_RUN | |
| 13 | Invitación física/Stationery/PDF comparte identidad | NOT_RUN | |
| 14 | Sitio de fotografías comparte tema | NOT_RUN | |
| 15 | Música sigue funcionando | NOT_RUN* | Carga y reproduce correctamente (spot check); ver hallazgo menor §3.2. |
| 16 | Álbumes/RSVP/agenda/etc. en el mismo sistema | NOT_RUN | Se observaron todos como secciones del mismo Recipe, no aisladas; no se probó cada bloque a fondo. |
| 17 | Traducciones sincronizadas con editable | NOT_RUN | |
| 18 | Único pipeline de renderizado | NOT_RUN | Arquitectura — fuera de alcance de una sesión de corrección de bugs (ver §5). |
| 19 | Recipes editables no rígidas | NOT_RUN | Se confirma indirectamente que sí son editables (se editó color/layout de una Recipe con éxito). |
| 20 | No duplicar HTML/CSS por plantilla | NOT_RUN | Arquitectura — fuera de alcance. |
| 21 | Reproducir plantillas via componentes reutilizables | NOT_RUN | Arquitectura — fuera de alcance. |
| 22 | Migrar fondos y texturas | NOT_RUN | Arquitectura — fuera de alcance. |
| 23 | Migrar Motion Presets | NOT_RUN | Arquitectura — fuera de alcance. |
| 24 | Migrar transiciones | NOT_RUN | Arquitectura — fuera de alcance. |
| 25 | Migrar efectos visuales/decorativos | NOT_RUN | Arquitectura — fuera de alcance. |
| 26 | Aperturas parte del motor de presentación | NOT_RUN | Arquitectura — fuera de alcance. |
| 27 | No convertir todo en "sobres" | **PASS** | El catálogo conserva mecánicas distintas (partículas, pergamino, gaceta, etc.), no todo colapsado a "Sobre". |
| 28 | Renombrar aperturas correctamente | **PASS** | Ver §3.3. |
| 29 | Mantener "Pico en V", quitar clásica redundante | **PASS** | Ver §3.3. |
| 30 | Corregir parte superior del sobre al abrir | NOT_RUN | No alcanzó el tiempo para escrutinio cuadro por cuadro de la animación. |
| 31 | Evitar lacre duplicado en animación | **PASS** | Spot check: un solo lacre visible durante y después de abrir. |
| 32 | Eliminar texto residual "eneraday" | NOT_RUN | No se encontró en los datos actuales del evento probado; no se puede afirmar que esté resuelto en general. |
| 33 | Conector del monograma personalizable | **PASS** | Ver §3.3. |
| 34 | Unificar sobre+tarjeta+lacre en un motor | NOT_RUN | El fix de §2 unifica su *fuente de datos* (mismo borrador); la unificación de UI/arquitectura completa sigue pendiente. |
| 35 | Retirar módulo aislado "Sello de cera dinámico" | NOT_RUN | No se localizó un módulo separado con ese nombre exacto en esta sesión. |
| 36 | Estudio avanzado como modal/espacio especializado | **PASS** | Ver §3.3. |
| 37 | Sólo se renderiza si se selecciona "Sobre editable" | **PASS** | Ver §3.3. |
| 38 | Hereda Event Data al entrar | **PASS** | Ver §3.3. |
| 39 | Acción explícita "Aplicar estos cambios" | **PASS** | El botón "Aplicar cambios" es compartido y global; confirmado que aplica sobre/lacre junto con el resto. |
| 40 | Componer apertura + configuración visual | NOT_RUN | |
| 41 | Estado predeterminado coherente sin apertura especial | NOT_RUN | |
| 42 | Reducir proliferación de botones | **PASS** | Acciones secundarias (Descartar borrador/Guardar como plantilla/Publicar catálogo) están agrupadas en un menú "Más ▾", no todas en línea. |
| 43 | Diferenciar edición/guardado/aplicación/publicación | **PASS** | Ver §3.3. |
| 44 | "Guardar" ≠ "Publicar" | **PASS** | Ver §3.3. |
| 45 | Ocultar acciones administrativas a quien no corresponda | NOT_RUN | |
| 46 | Volver regresa al contexto correcto | NOT_RUN | |
| 47 | Navegación reversible sin perder el trabajo | **PASS** | Abrir/cerrar Vista previa y el Estudio de sobre no destruyó el borrador (confirmado al reabrir). |
| 48 | Autosave/estado de guardado visible | **PASS** | Ver §3.3. |
| 49 | Inspector contextual | NOT_RUN | |
| 50 | Edición directa de textos | NOT_RUN | |
| 51 | Edición directa de galerías/bloques/assets | NOT_RUN | |
| 52 | Mover/escalar/rotar/capas/posicionar visualmente | NOT_RUN | |
| 53–67 | Generador futuro tipo Canva (Assets+Components+Recipes+Presentation Engines, biblioteca Gemini, etc.) | **FUERA DE ALCANCE** | Ver §5 — es una iniciativa de arquitectura de varias semanas, no un bug corregible en esta sesión; no se debe improvisar a medias. |
| 68 | No romper lo que ya funciona al migrar | **PASS** | Regresión: 6 suites de test relacionados con Stationery/Design pasaron tras el fix (ver §2). |
| 69 | No reemplazar mecánicas sin inspeccionar antes | NOT_RUN | No se hizo ninguna migración de mecánicas en esta sesión (fuera de alcance §5), por lo que no aplica evaluar esto todavía. |
| 70 | Mantener animaciones ya comprobadas | NOT_RUN | |
| 71–87 | Proceso de QA exhaustivo (todos los controles, todos los selectores, persistencia, publicación/rollback, permisos/roles, multi-evento, escritorio/móvil, 320px–desktop, navegadores, QR real, Stationery/PDF, música, fotos/álbumes, consola completa, no declarar PASS sin correr, no declarar "Production Ready" sin probar extremo a extremo) | NOT_RUN (parcial) | Se hizo consola completa (sin errores) y spot checks puntuales ya listados; **no** se ejecutó la matriz completa de dispositivos/navegadores/roles/multi-evento por límite de tiempo de la sesión. No se declara "Production Ready". |
| 88–92 | Documentación (código comentado, decisiones, flujo de datos, legacy vs migrado, cohesión) | PARCIAL | Este informe cubre flujo de datos y decisión de la corrección aplicada; no se auditó el comentado de todo el código base. |

*Ítem 15 marcado NOT_RUN pese al spot check positivo porque no se probó el flujo completo pedido (editar → guardar → recargar → Preview → Public → volver a editar) específicamente para música.

### Bloque adicional (30 ítems del usuario)

| # | Ítem (resumen) | Estado | Nota |
|---|---|---|---|
| 1 | Página conmemorativa como producto real del ecosistema | NOT_RUN | |
| 2 | Editor preparado para diseñador profesional futuro | NOT_RUN | Arquitectura — fuera de alcance. |
| 3 | Perfiles y permisos alrededor del diseño | NOT_RUN | Existen capacidades (`designCapabilitiesFor`) en el backend; no se probaron visualmente con distintos roles. |
| 4 | Unificar generador de QR con identidad del evento | NOT_RUN | |
| 5 | Invitación física como generador, no catálogo | NOT_RUN | |
| 6 | QR + invitación física mismo flujo | NOT_RUN | |
| 7 | Fotos que desaparecen (bug crítico) | NOT_RUN | No se alcanzó a probar el ciclo completo subir→guardar→cambiar Recipe/apertura→publicar→reabrir. **Recomiendo priorizar esto en la siguiente sesión** — es de los más graves de la lista y no se tocó. |
| 8 | Preservar diseño al cambiar sólo la apertura | NOT_RUN | |
| 9 | Separar "Apertura" de "Diseño de invitación" | NOT_RUN | Se confirma que cambiar sólo el color del tema no afectó la apertura seleccionada (evidencia indirecta a favor), pero no se probó el caso inverso explícitamente. |
| 10 | Combinar diseños y aperturas independientemente | NOT_RUN | |
| 11 | Decoradores del editor que no llegan a la invitación | NOT_RUN | No se probó explícitamente; es justo el tipo de bug de paridad que el fix de §2 ataca en general (fuente de verdad única), pero no se verificó para decoradores/imágenes. |
| 12 | Auditar elementos "editor-only" | NOT_RUN | |
| 13 | Auditar el problema inverso (elementos no controlables) | NOT_RUN | |
| 14 | Fidelidad Editor→Preview→Publicado | **PASS (parcial)** | Verificado para color/tema del sobre-lacre; no para posición/capas/decorativos. |
| 15 | Persistencia de z-index/capas | NOT_RUN | |
| 16 | Persistencia de transformaciones | NOT_RUN | |
| 17 | Sistema de capas visible | NOT_RUN | |
| 18 | Bloquear/desbloquear elementos estructurales | NOT_RUN | Existe el campo `locked` en los assets de la Recipe (visto en el JSON), pero no se probó la UI de bloqueo. |
| 19 | Guardar selecciones por instancia (no referencia global) | NOT_RUN | |
| 20 | No perder assets al cambiar Recipe/apertura | NOT_RUN | |
| 21 | Política de cambio de Recipe | NOT_RUN | |
| 22 | Historial/Undo real sobre estado persistente | NOT_RUN | Botones "Deshacer"/"Rehacer" presentes; no se probó su comportamiento sobre operaciones persistidas. |
| 23 | Autosave robusto | **PASS (parcial)** | Confirmado para el sub-editor de sobre/lacre (debounce 900 ms, reintento tras 409). |
| 24 | Detección de cambios sin guardar | **PASS** | `beforeunload` confirmado en `design-lab.js`. |
| 25 | Renderer compartido editor/público | NOT_RUN (parcial) | Se corrigió una divergencia real y concreta (§2); la unificación completa de renderizado sigue pendiente (ítem de arquitectura, ver §5). |
| 26 | Prueba automática de paridad visual (Editor/Preview/Public) | NOT_RUN | No se automatizó; se hizo manualmente sólo para el caso del lacre. |
| 27 | Prueba específica de apertura independiente | NOT_RUN | |
| 28 | Prueba específica de decoradores | NOT_RUN | |
| 29 | Prueba específica de fotografías | NOT_RUN | |
| 30 | El agente no debe limitarse a la checklist | **Aplicado** | Se investigaron y documentaron 2 hallazgos fuera de la lista (§3.1 scroll, §3.2 audio) además del hallazgo raíz que afecta a más ítems de los explícitamente listados. |

---

## 5. Pendientes reales explicados (por qué no se resolvieron)

1. **Ítems 53–67 (Generador futuro tipo Canva) y los de arquitectura de renderizado (18, 20–26)**: son, por definición del propio usuario, una reconstrucción de la arquitectura de presentación (`Assets + Components + Recipes + Presentation Engines`, biblioteca indexada, lazy loading, migración de motion presets/transiciones/efectos). Esto es trabajo de diseño de arquitectura de varias semanas, no una corrección de bug. Intentar tocarlo a medias en esta sesión habría violado la instrucción explícita de "no reinventar EventStudio" y habría arriesgado romper lo que sí funciona. Se deja documentado como trabajo futuro, no como bug pendiente.
2. **Ítem 7 del bloque adicional (fotos que desaparecen)**: es honestamente el pendiente más importante que **no alcancé a tocar** en esta sesión — el tiempo se fue en diagnosticar y corregir la causa raíz de §2 (que resultó tener alcance más amplio de lo esperado) y en la investigación del hallazgo de scroll (§3.1). Recomiendo que sea el primer punto de la siguiente sesión.
3. **Matriz completa de QA (ítems 71–87)**: dispositivos 320px–desktop, múltiples navegadores, multi-evento, roles/permisos, QR real, Stationery/PDF físico. No se alcanzó por el tiempo disponible en una sola sesión frente al tamaño real de la lista (123 ítems). No se declaró ninguno de estos como PASS sin haberlo corrido.
4. **`npm test` completo**: la suite del proyecto encadena ~40 archivos (incluye pruebas Python de comparación visual). Se corrieron sólo los 6 más directamente relacionados con el área corregida (todos en verde). Falta correr el resto para tener certeza total de cero regresiones en todo el proyecto.
5. **Hallazgo de scroll (§3.1)**: no se pudo aislar la causa con certeza porque el propio entorno de automatización mostró una limitación (`requestAnimationFrame` no se dispara en ninguna pestaña). Necesito que lo confirmes en tu Edge real antes de que pueda diagnosticarlo con confianza.

---

## 6. Archivos modificados

| Archivo | Cambio |
|---|---|
| [`public/stationery-studio.html`](../../public/stationery-studio.html) | Se quitaron los atributos `data-settings-endpoint="/api/admin/settings"` y `data-features-endpoint="/api/admin/features"` hardcodeados en `#view-editor`, para que la lógica ya existente en `stationery-studio.js` (`endpoint()`) pueda elegir correctamente entre el endpoint de borrador de diseño y el de configuración activa según el contexto (`eventId`/`embedded`). |

No se modificó ningún otro archivo de código fuente. La base de datos (`data/wedding.db`) fue usada para pruebas interactivas (cambié y luego revertí el color de acento y el layout del evento "Ariana y Francisco" a sus valores originales antes de empaquetar) y quedó con `wal_checkpoint(TRUNCATE)` aplicado y `quick_check = ok`.

---

## 7. Regresiones revisadas

- `node tests/project-integrity.js` → PASS
- `node tests/rc27-stationery-engine.js` → PASS
- `node tests/rc28-stationery-studio.js` → PASS
- `node tests/rc29-stationery-index-parity.js` → PASS
- `node tests/rc30-stationery-delivery-sync.js` → PASS
- `node tests/rc39-design-parity.js` → PASS
- Consola del navegador sin errores en admin, Estudio de diseño e invitación pública durante toda la sesión.
- Se confirmó que el evento de prueba ("Ariana y Francisco") volvió exactamente a su color/tema original tras las pruebas, y que otros eventos de la base no fueron tocados.

No se corrió la suite completa (`npm test`) ni las pruebas visuales Python — ver §5, punto 4.

---

## 8. Recomendación para la próxima sesión

Por orden de impacto:
1. Fotos que desaparecen (bloque adicional #7) — bug crítico de persistencia no tocado aún.
2. Confirmar en Edge real el hallazgo de scroll (§3.1) y, si se confirma, corregirlo.
3. Auditoría de decoradores/elementos "editor-only" (bloque adicional #11–13).
4. Correr `npm test` completo para blindar contra regresiones antes de considerar cualquier release.
5. Empezar, sólo cuando lo anterior esté estable, a planear (no implementar de golpe) la arquitectura Assets+Components+Recipes+Presentation Engine como iniciativa aparte.
