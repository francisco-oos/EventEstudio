# EventStudio 6.16.0-rc.41 — Fidelidad de preview, portada recuperable y Apply atómico

Estado: **candidata QA avanzada; requiere gate E2E de servidor en entorno con dependencias antes de producción**.

## Correcciones de esta ronda

- Las 65 Recipes, cuando el filtro superior usa `Sobre personalizable`, conservan la geometría de sobre pero derivan **color, liner, material y fuerza de textura** de la Recipe. La simulación RC41 produce 65 identidades cromático/texturales para 65 Recipes (59 colores exteriores únicos).
- El preview de catálogo fuerza una carga nueva del iframe y deja de reutilizar visualmente un documento anterior.
- Stationery expone un `flush()` local; `Vista previa`, `Probar apertura` y `Aplicar cambios` lo esperan si el estudio de sobre está abierto. Ya no hace falta esperar al debounce ni pulsar manualmente `Guardar ahora`.
- Los PUT de Recipe y Stationery son idempotentes cuando el estado no cambió, reduciendo revisiones/auditorías redundantes y trabajo de render/BD.
- `Abrir constructor avanzado` parte del diseño ACTIVE cuando no hay DRAFT pendiente. `Editar` desde una plantilla conserva el DRAFT que acaba de preparar esa plantilla.
- La portada guardada por el panel se reutiliza automáticamente. Si una restauración conserva en BD un nombre de upload antiguo y existe exactamente un archivo con el mismo nombre original, RC41 lo recupera como alias de lectura sin alterar la BD.
- El evento 2 de esta copia demuestra ese caso: la BD apunta a un JPG ausente y el ZIP contiene exactamente otro JPG `IMG_20250823_101925.jpg`; RC41 lo recupera automáticamente.
- La portada admite encuadre separado para móvil/escritorio (`fit`, X, Y) y reposicionamiento arrastrando directamente en el lienzo.
- Desmarcar/re-marcar `Mostrar fotografía de portada` vuelve a utilizar la misma media del evento; cargar archivo desde el Estudio queda como acción opcional de reemplazo, no requisito.
- Assets colorizables ya no colapsan a altura 0 en la invitación pública. Los 31 Assets tienen `aspectRatio` explícito y el renderer público lo aplica.
- Assets continúan moviéndose con pointer y ahora pueden escalarse con Ctrl/Alt + rueda del mouse.
- Cache busting actualizado a `6.16.0-rc.41` en la superficie pública.

## Rendimiento/fluidez

- Debounce principal: 700 → 950 ms.
- Debounce Stationery: 650 → 900 ms.
- Escrituras idénticas no incrementan `draftRevision`.
- Apply hace flush antes de promover el diseño.
- El contrato de tres scrolls independientes de RC40 se conserva.

## QA relevante reejecutada

- 65 Recipes / 31 Assets / 103 skins: PASS.
- 175,500 combinaciones de presentación: PASS.
- 1,300 proyecciones rol/perfil: PASS.
- 139 controles: wiring PASS.
- 130 renders Recipe móvil/escritorio: 0 fallos, 0 overflow.
- 130 casos de paridad cromática: 0 fallos.
- 65 previews Design Lab: 0 fallos; contraste mínimo heading ~11.34:1, body ~4.74:1.
- Stationery RC27–RC30: PASS; matriz histórica 64×15 y entrega pública preservadas.
- Stationery visual: 2 casos + 5 perfiles, 0 fallos; ~60 FPS en harness.
- Responsive 320/390/1366: 9/9 PASS.
- Features: 32 casos PASS; contenido largo: 64 casos PASS; álbum: 2 casos PASS.
- RC41 visual: portada recuperada de dataset, Asset público visible, encuadre móvil y escritorio: 4/4 PASS.
- DB: `PRAGMA quick_check=ok`, 43 tablas, 4 usuarios, 2 eventos.

## Limitación de entorno

Se intentó `npm ci`, pero el proceso no pudo completar en este runtime y terminó por timeout de transporte. Como `node_modules` no forma parte del paquete, las pruebas que necesitan levantar Express con `better-sqlite3`/`bcryptjs` permanecen **BLOCKED_ENV**, no PASS. El gate local sigue siendo obligatorio antes de promover a producción.
