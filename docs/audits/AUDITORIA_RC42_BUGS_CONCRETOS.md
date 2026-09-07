# Auditoría RC42 — Corrección de bugs concretos reportados

**Fecha:** 2026-09-06/07
**Base:** commit `d8e8409` (sincronización del working tree a 6.16.0-rc.41 QA_CON_DATOS, ver `INFORME_QA_CORRECCION_6.16.0-rc.41.md`).
**Alcance de esta sesión:** el usuario pidió inicialmente una auditoría de 90 secciones, pero tras un primer avance pidió explícitamente enfocarse **sólo en bugs funcionales concretos y reproducibles** que él mismo había reportado con pasos precisos, dejando fuera de esta pasada: QR/invitación física editables, traducciones completas, editor tipo Canva, y una auditoría de seguridad con Strix (herramienta externa que requiere Docker + credenciales propias, no instalada). Esta pasada respeta esa instrucción.

Cada hallazgo de esta lista fue: reproducido con evidencia real contra el servidor corriendo (no sólo lectura de código), diagnosticado hasta su causa raíz exacta en el código fuente, corregido de forma mínima, vuelto a verificar en vivo, y confirmado sin regresiones con los suites de prueba relacionados del propio proyecto. Los datos de prueba usados (fotos, invitados) se crearon marcados como prueba y se eliminaron al terminar; no se tocaron datos reales del evento.

---

## 1. Portada nunca se guardaba al activarla

**Commit:** `b29ef31`
**Archivo:** `src/design-engine.js`

**Reporte del usuario:** subía una foto de portada nueva, no aparecía en la vista previa ni en la invitación pública tras Aplicar; al volver al editor y desactivar/reactivar el checkbox "Mostrar fotografía de portada en este diseño" sí aparecía, pero mover la posición con los sliders (no arrastrando con mouse, eso sí funcionaba) la volvía a hacer desaparecer.

**Causa raíz:** en `normalizeRecipe()`, la fusión de `heroMedia.enabled` era:

```js
enabled: design.heroMedia?.enabled===false ? false : (fallbackDesign.heroMedia?.enabled===false ? false : true)
```

Si el cliente enviaba `enabled:true` pero el borrador anterior (`fallbackDesign`) tenía `enabled:false`, el resultado era `false` — el estado viejo pisaba el nuevo. Como el checkbox partía de `false` en el evento de prueba, **ningún intento de activarlo llegaba a persistir**: se veía activado un instante en el editor (estado local en memoria) y volvía a `false` en cuanto el autoguardado (debounce de 950 ms) mandaba el PUT, porque para entonces el objeto `recipe` local ya se había revertido. Cada movimiento del slider de posición reenvía el mismo objeto `heroMedia` completo, así que exhibía el mismo síntoma.

**Diagnóstico:** confirmado con un property-watcher (`Object.defineProperty`) sobre `recipe.design.heroMedia` y parcheando `save()` para loguear el valor antes/después del round-trip; el PUT llegaba a `alreadySaved:true` con `enabled:false` — el servidor ni siquiera veía un cambio real porque el hash del recipe recibido ya coincidía con el guardado.

**Corrección:** un valor explícito del cliente (true o false) ahora gana siempre; el fallback sólo se usa si el cliente no envía el campo:

```js
enabled: design.heroMedia?.enabled!==undefined ? design.heroMedia.enabled!==false : (fallbackDesign.heroMedia?.enabled!==false)
```

**Verificación:** checkbox → `draftRevision` avanza (ya no `alreadySaved`) → foto visible en el lienzo → mover sliders de posición sin que desaparezca → Aplicar → foto visible en `/e/ariana-y-francisco` tanto con "Abrir invitación" como con "Omitir animación".

**Regresión:** `project-integrity`, `rc31-design-engine`, `rc38-design-studio-hardening`, `rc39-design-parity`, `rc40-production-polish`, `rc41-production-readiness` — todos en verde.

---

## 2. Filtros del panel "Diseño" no se combinaban con otra plantilla

**Commit:** `c1fcfe9`
**Archivos:** `public/design-lab.js`, `src/server.js`

**Reporte del usuario:** el objetivo del panel "Diseño" es que sus filtros (Presentación fotográfica, textura, tipografías, secuencia de movimiento) se combinen con cualquier plantilla que se abra después — Recipe base + filtro actual = nueva combinación. Confirmó que "Estilo del álbum" sí se combinaba, pero el resto no.

**Causa raíz:** `currentPresentationOverrides()` (cliente) y su contraparte `normalizeDesignRecipeIntent()` (servidor) sólo capturaban/aplicaban `openingStyle`, `galleryStyle`, `experienceMode` y `motionLevel`. `photoPresentationId`, `texture`, `motionTimelineId` y los 4 campos de tipografía (heading/body/scale/nameCase) eran editables en el mismo panel pero nunca viajaban en el payload de overrides al seleccionar una Recipe del catálogo, así que se reiniciaban en silencio a los valores por defecto de la nueva plantilla.

**Corrección:** se extendieron ambas funciones para incluir esos campos, validados contra los mismos catálogos que ya usa `designEngine.normalizeRecipe` (`photoPresentations`, `motionTimelines`, `typographyPresets`), de modo que un valor inválido o ausente cae de forma segura al valor por defecto de la Recipe nueva.

**Verificación:** fijé `photoPresentationId`, `texture` y `headingFont` en el borrador y abrí dos Recipes del catálogo (`black-tie`, `forest-candlelight`) cuyos valores nativos para esos campos son distintos a los que fijé — en ambos casos ganó mi valor, no el de la plantilla.

**Regresión:** `project-integrity`, `rc31-design-engine`, `rc34-design-coherence`, `rc34-control-wiring`, `rc38-design-studio-hardening`, `rc39-design-parity`, `rc40-production-polish`, `rc41-production-readiness` — todos en verde.

---

## 3. Elegir varias plantillas rápido dejaba las siguientes "sin cambiar nada"

**Commit:** `21637de`
**Archivos:** `public/design-lab.js`, `public/design-lab.css`

**Reporte del usuario:** las primeras ~5 plantillas de la biblioteca cambiaban correctamente al abrirlas; a partir de la 6ª (ejemplo: "Black Tie") abrir otra plantilla "no cambiaba nada". Sospecha del usuario: problema de memoria/renderizado; sugería paginar.

**Causa raíz — no era memoria ni paginación.** Cada tarjeta de plantilla disparaba su propio `PUT /api/admin/design/recipe` de inmediato, sin ningún candado contra un segundo clic mientras el primero seguía en vuelo. Reproducido disparando 4 selecciones de plantilla seguidas con el mismo `draftRevision` de partida: sólo la primera devolvió 200; las otras 3 devolvieron 409 ("El borrador cambió en otra sesión") — bloqueo optimista correcto del lado del servidor. Cada 409 se reintenta una sola vez en el cliente, pero esos reintentos **también compiten entre sí**, así que al navegar rápido por una grilla de 65 plantillas (comportamiento normal al explorar), la mayoría de los clics posteriores al primero terminaban fallando también ese reintento — reflejado sólo en una línea de estado fácil de pasar por alto, mientras el lienzo se quedaba visualmente pegado en lo último que sí cargó.

**Corrección:** candado `recipeSelectionInFlight` que ignora un clic de tarjeta mientras una selección anterior sigue en curso, más una clase `.is-loading` que atenúa visualmente la grilla mientras carga (para que el bloqueo sea perceptible, no silencioso). No se tocó la paginación de la biblioteca (`loadRecipes()`/`moreRecipesBtn`), que ya pagina de forma independiente y no tenía relación con este bug.

**Verificación:** disparé 6 clics rápidos seguidos (`midnight-gold`, `terracotta-sunset`, `minimal-pearl`, `mayan-elegance`, `rose-garden`, `ocean-silk`) exactamente como los competía el código viejo — con el fix, sólo el primero se aplica, el resto se ignora limpiamente (sin reintentos fallidos, sin estado inconsistente).

**Regresión:** `project-integrity`, `rc34-control-wiring`, `rc35-unified-design-studio`, `rc38-design-studio-hardening`, `rc39-design-parity` — todos en verde.

---

## 4. Abrir la invitación bajaba la página hasta casi la mitad

**Commit:** `fccfe0f`
**Archivo:** `public/app.js`

**Reporte del usuario:** al abrir la invitación de un invitado y pulsar "Omitir animación", la página quedaba desplazada casi hasta la mitad; había que subir manualmente para ver el inicio.

**Nota de proceso:** este bug no se reprodujo en las primeras pruebas (tema "Sobre y sello", `experienceMode:"classic"`, escritorio y móvil, clic inmediato y a mitad de animación — `scrollY` siempre quedaba en 0). Se reprodujo al cambiar el evento de prueba a `experienceMode:"gallery"` — una combinación que este mismo evento tenía activa al principio de toda la sesión de auditoría.

**Causa raíz:** hay dos caminos de código independientes para "abrir la invitación". El que usa el overlay de sobre (`#invitationOpening`) hace `$('invitation').focus({preventScroll:true})` — no mueve el scroll; el invitado simplemente ve `#hero` (la portada a pantalla completa, que antecede a `#invitation` en el HTML). El botón usado cuando NO hay overlay de sobre (`openInvitationBtn`, usado por ejemplo con `experienceMode:"gallery"`) en cambio hacía `$('invitation').scrollIntoView({behavior:'smooth'})`, que alinea el borde superior de `#invitation` con el viewport — saltándose por completo la sección `#hero` que está antes. Confirmado: con este Recipe, `#invitation.offsetTop` era 720px (la altura de `#hero`, una pantalla completa), y tras el clic `window.scrollY` quedaba en ese mismo valor en vez de 0.

**Corrección:** se reemplazó el `scrollIntoView()` por el mismo patrón `focus({preventScroll:true})` que ya usa el camino con sobre, para que ambos flujos de apertura se comporten igual y el invitado siempre empiece viendo la portada.

**Verificación:** reproduje `scrollY≈720` antes del fix bajo `experienceMode:"gallery"`; confirmé `scrollY=0` después, con la portada (nombres y fecha) visible de inmediato al abrir, sin necesidad de subir manualmente.

**Regresión:** `project-integrity`, `rc19-regressions`, `rc20-regressions`, `rc21-visual-contracts`, `rc38-design-studio-hardening`, `rc39-design-parity` — todos en verde. `rc23-acceptance-contracts` falla, pero se confirmó con `git stash` que **ya fallaba antes de este cambio** (una aserción de regex sobre texto fuente exacto para la visibilidad de RSVP, desactualizada tras un refactor anterior no relacionado) — no se tocó por no estar en el alcance de este bug.

---

## 5. Áreas probadas a fondo sin encontrar un bug real

No se declara nada "PASS" sin haberlo ejecutado de extremo a extremo contra el servidor real. Para cada una se usó un evento/invitado/foto **marcado explícitamente como dato de prueba** (`is_test=1` en invitados, nombres `qa-test-*`/`qa-guest-*` en archivos) y se eliminó al terminar.

- **Pipeline completo de fotos del álbum del propietario**: subir foto nueva vía `/api/admin/media/gallery` → aparece en el editor y en `/e/ariana-y-francisco` de inmediato → cambiar sólo la apertura (`openingId`) y Aplicar → el resto del diseño (paleta, `photoPresentationId`, cantidad de assets/secciones) permanece idéntico y la foto sigue ahí → cambiar el estilo de galería (`galleryStyleId`) y Aplicar → todas las fotos (las 3 originales + la de prueba) siguen presentes → recargar el Estudio de diseño → la foto de prueba sigue en el lienzo. Sin pérdida en ningún punto.
- **Borrado de una foto específica de la galería**: `DELETE /api/admin/media/item` (el endpoint correcto — `PUT /api/admin/settings` deliberadamente **no** puede tocar `heroImage`/`music`/`gallery`, sólo sus endpoints de carga dedicados, por diseño explícito documentado en el propio código de `normalizeMediaUpdate`, como salvaguarda contra inyección arbitraria de rutas). Subí 2 fotos de prueba, borré una por URL, confirmé que sólo esa desapareció y las demás (incluidas las 3 originales) quedaron intactas.
- **Álbum colaborativo de invitados**: subida pública (`POST /api/photos`) → aparece en la cola de moderación del admin como `pending` → aprobar (`PATCH /api/admin/photo-batches/:id`) → el mensaje aparece en `/api/public/photo-messages/:slug`. Nota de diseño (no es un bug): la galería de invitados es de **sólo subida**; no existe un muro público donde los invitados vean las fotos de otros invitados — `album.js` únicamente sube, nunca lista. Si el usuario esperaba un muro compartido, es una decisión de producto a discutir, no un defecto.
- **RSVP de extremo a extremo**: creé un invitado de prueba (`is_test=1`), confirmé asistencia vía `POST /api/rsvp` con adultos/niños/nombres/mensaje, y verifiqué que el registro completo aparece correctamente en `GET /api/admin/guests`. Funciona correctamente — la prueba `rc23-acceptance-contracts` que falla es sobre el *texto fuente* de una condición de visibilidad, no sobre el comportamiento real.
- **Aislamiento entre eventos/roles** (revisión de código, no hay una segunda cuenta disponible para probarlo en vivo sin crear una — prohibido): `eventAllowed`/`userCanAccessEvent` en `src/server.js` verifican la tabla `user_events` para roles no-owner/developer antes de conceder acceso a un evento; las rutas de órdenes de pago (`/api/store/orders/:id/checkout`, `/confirm-demo`) verifican `order.user_id===req.user.id` para clientes. `designCapabilitiesFor()` calcula `saveTemplate`/`publishCatalog`/`manageCatalog` como `false` para cualquier rol que no sea owner/developer, y las rutas correspondientes (`PUT /api/admin/design/recipe`, guardar plantilla) verifican esa capacidad server-side, no sólo ocultando el botón en el cliente.
- **Estudio de Color**: el usuario reportó no ver con claridad dónde aplica cada color. Se verificó que los 10 controles editables (Fondo, Papel, Tinta, Texto secundario, Títulos, Texto principal, Acento principal, Acento secundario, Dorado, Línea) sí mapean a variables CSS reales (`setCanvasTokens()`) consumidas en `design-lab.css`/`styles.css`/`design-engine.css` — no hay controles "muertos" que no produzcan ningún cambio visual. La queja es de claridad de UX (p. ej., "Acento secundario"/"Línea" tienen usos sutiles, fáciles de no notar), no un bug técnico corregible con el mismo criterio que los 4 anteriores; no se tocó por decisión del usuario de enfocarse en bugs concretos.
- **Plano de mesas** (revisión de código, no probado interactivamente con drag-and-drop en el navegador): `PUT /api/admin/seating/layout` valida límites del salón, solapamiento entre mesas/áreas, unicidad de nombres, y capacidad contra asientos ya asignados antes de guardar — no se detectó ningún patrón de bug similar a los anteriores.
- **`usestrix/strix`** (a pedido del usuario): es un agente de IA de código abierto para pentesting (github.com/usestrix/strix), corre vía Docker con sus propias credenciales de IA. No se instaló ni se ejecutó — requeriría Docker + una configuración de IA separada, una inversión de tiempo que el usuario no priorizó frente a seguir corrigiendo bugs funcionales concretos.

---

## 6. Archivos modificados en esta sesión

| Archivo | Cambio | Commit |
|---|---|---|
| `src/design-engine.js` | Fusión correcta de `heroMedia.enabled` (cliente explícito gana sobre fallback) | `b29ef31` |
| `public/design-lab.js` | `currentPresentationOverrides()` incluye photoPresentationId/texture/motionTimelineId/typography; candado `recipeSelectionInFlight` | `c1fcfe9`, `21637de` |
| `src/server.js` | `normalizeDesignRecipeIntent()` aplica los mismos campos nuevos de overrides | `c1fcfe9` |
| `public/design-lab.css` | Estado visual `.is-loading` para la grilla de plantillas | `21637de` |
| `public/app.js` | `openInvitationBtn` usa `focus({preventScroll:true})` en vez de `scrollIntoView()` | `fccfe0f` |

## 7. Pendientes reales (fuera de esta pasada, por decisión del usuario)

- Estudio de QR / invitación física editables (como el de sobre y lacre) — feature nueva, no bug.
- Editor tipo Canva (arrastrar, capas, handles) — feature nueva de varias semanas, no bug (ver respuesta dada al usuario sobre por qué no requiere otro agente de IA, sólo tiempo/alcance).
- Auditoría completa de traducciones — deprioritizada.
- Pentesting con Strix — deprioritizado, requiere Docker + credenciales propias.
- `rc23-acceptance-contracts`: prueba pre-existente que falla por una aserción de texto fuente desactualizada sobre la visibilidad de RSVP; el comportamiento real de RSVP se verificó funcionando correctamente. Vale la pena actualizar la aserción en una sesión futura, pero no se tocó aquí por no estar relacionada con ninguno de los 4 bugs corregidos.
