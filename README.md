# EventStudio 6.16.0-rc.41

## RC41 — Fidelidad de preview, portada recuperable y Apply atómico

RC41 consolida la paridad entre Design Studio, Preview, apertura, Stationery e invitación pública; reutiliza la portada existente del evento, separa el encuadre móvil/escritorio y corrige Assets decorativos que desaparecían al aplicar. Ver `docs/release-notes/RELEASE_NOTES_6.16.0-rc.41.md`.

## RC37 — V5 Fluidez integral

Esta candidata separa DRAFT/ACTIVE/CATALOG y convierte Panel, Estudio de diseño y Sobre/Lacre en una sola sesión de edición. Añade autosave con estado, CTA explícito de Apply, memoria de contexto, inspector de elementos/bloques, Color Engine semántico compartido, permisos de catálogo granulares e ingest controlado de los dos SVG físicos recibidos de Gemini.

Estado: **candidata QA**. Las suites Node ejecutables pasan; la matriz Playwright, touch real, lector de pantalla, QR impreso y PDF físico permanece `NOT_RUN` y debe completarse antes de cualquier promoción.

Documentación vigente: `docs/indexes/INDEX_DOCUMENTACION_6.16.0-rc.41.md`.
Inicio de QA: `QA_START_HERE_V6_16_0_RC41.txt`.
Puerta automatizada disponible: `npm run test:v5`, `npm run test:security`, `npm run test:rc33:e2e` y auditoría con el perfil del paquete.

## RC33 — Design Ecosystem

Esta candidata convierte el crecimiento visual en `Assets + Components + Recipes + Presentation Engines`. Las 64 opciones del catálogo funcionan como Recipes editables; diseño, datos, servicios, comercio y renderizado permanecen desacoplados.

- Color Studio con teoría del color y override completo de tokens.
- Asset Library con carga bajo demanda y transformaciones X/Y/escala/rotación/z-index/opacidad/tono/motion.


## RC36 — Resiliencia SQLite local

- Detecta WAL/SHM/JOURNAL incompatibles dejados por una actualización por sobrescritura.
- Verifica primero una copia aislada de `wedding.db`.
- Conserva sidecars incompatibles en cuarentena; nunca los elimina ni ejecuta reseed para recuperarse.
- La protección se limita al launcher local y no relaja `quick_check` en producción.

## RC35 — Design Studio unificado y paridad cromática

- Design Lab y Stationery se presentan como un solo Design Studio.
- Stationery conserva su motor especializado pero se monta dentro del mismo workspace.
- Constructor y publicación comparten `design-color-engine.js` para contraste semántico.
- El servidor mantiene la validación cromática y sincroniza presentación con Recipe.
- QA RC35 cubre 64 Recipes en móvil/escritorio, nombres largos, paletas crudas y flujo integrado.

- tipografía, layout, texturas, fotografía, motion y aperturas bajo Recipe.
- sincronización con invitación, álbum, QR/QR de mesa, papelería y Stationery.
- música real preservada.
- entitlements filtran componentes públicos sin destruir la Recipe privada.
- landing Recipe-first y lacre interactivo.
- QA Chromium desde 320 px hasta 4K.

Documentación vigente: `docs/indexes/INDEX_DOCUMENTACION_RC36.md`.
Puerta final local: `npm ci && npm run test:preproduction`.

Candidata de QA construida sobre RC29. Conserva la ventana avanzada con paridad del generador maestro y corrige la integración pública de nombre, paleta y lacre.

## Cambios principales RC30

- `Sobre personalizable` mantiene la ventana independiente y la apariencia/flujo del generador maestro.
- Nombres, fecha y tipografía continúan heredándose del evento.
- El CTA `Abrir invitación` tiene un nodo explícito y ya no puede sobrescribir el nombre renderizado dentro de la tarjeta.
- Al aplicar un `unified-envelope` personalizado, su paleta pasa automáticamente a invitación pública, portal de fotos, QR e impresión; ya no existe un segundo checkbox que permita una aplicación parcial.
- Las demás aperturas visibles conservan la paleta default/configurada de la plantilla y no heredan una papelería guardada anteriormente.
- Los 64 temas conservan sus colores por defecto en variables base; sus reglas visuales consumen esos tokens para que `_palette` pueda recolorear la plantilla sin duplicaciones bloqueantes.
- El lacre generado centralmente sustituye el cierre equivalente de plantillas como `storybook-seal` en lugar de mostrarse junto al sello histórico.
- El QR usa la misma paleta efectiva cuando el sobre personalizado es la identidad activa; impresión y fotos consumen la misma resolución de servidor.
- La animación de abrir/cerrar el sobre mediante clic directo permanece intacta.
- Regresión específica: `tests/rc30-stationery-delivery-sync.js`; QA visual pública: `tests/rc30-public-envelope-visual.py`; QA visual del estudio: `tests/rc28-stationery-studio-visual.py`.
- Referencia histórica RC30: `docs/indexes/INDEX_DOCUMENTACION_RC30.md`.
- Puertas finales de promoción: `npm ci`, `npm test`, `npm run test:visual`, `npm run audit` y `npm audit --audit-level=moderate`. En este entorno el árbol se recibió sin `node_modules`; `npm test` se detiene en `better-sqlite3`. Consultar `docs/validation/VALIDACION_RC30.md`.

### Cambios heredados RC25

- Lluvia de sobres, mesa de regalos y transferencia bancaria usan toggles independientes y pueden coexistir.
- Openpay permanece desacoplado y puede combinarse con cualquier método o funcionar como única alternativa.
- Lluvia de sobres tiene instrucciones propias del buzón físico.
- Transferencia incorpora Banco, Titular, CLABE, Número de cuenta, Concepto sugerido e indicaciones opcionales.
- El anfitrión puede seleccionar uno de cuatro mensajes motivadores desde catálogo o escribir uno personalizado.
- La dedicatoria que escribe el invitado durante un pago Openpay se conserva como flujo independiente.
- Compatibilidad con `gifts.mode` de eventos anteriores mediante normalización y modo legado derivado.
- Nueva regresión lógica y visual RC25 para métodos individuales, combinados y ninguno.
- Referencia histórica RC25: `docs/indexes/INDEX_DOCUMENTACION_RC25.md`.
- Las puertas finales de release incluyen `npm test`, `npm run test:rc27`, `npm run test:rc28`, `npm run test:rc29`, `npm run test:rc30`, `npm run test:visual`, `npm run audit` y `npm audit --audit-level=moderate`.

### Capacidades heredadas y preservadas

- “Probar efectos”, preview de tema/Store/carrito y replay usan enlaces temporales autorizados por evento.
- Owner/developer conservan acceso técnico; un cliente puede probar un producto público sin adquirirlo ni guardarlo.
- Corazón de partículas mide el espacio entre texto y acción en lugar de usar coordenadas rígidas.
- Flor nocturna original se integra como experiencia separada, con tres flores de cuatro pétalos y colores configurables.
- Se conserva el orden de capas de RC13 con las cadencias legibles de RC20 (3.6–4.3 s para sobres).
- Matriz efectiva actual de 64 plantillas, 13 mecánicas independientes y un motor de sobre unificado, además de registro, publicación, invitación, RSVP, cortesías y módulos RC22.
- El historial RC21 permanece disponible en `docs/indexes/INDEX_DOCUMENTACION_RC21.md`.

## Principios de esta candidata

- El propietario/desarrollador conserva la autoridad final sobre productos, perfiles, planes, límites, publicación, cortesías, Showcase y estados comerciales.
- Los archivos de configuración contienen valores de **bootstrap**; una vez creados los registros, las decisiones guardadas en SQLite no se sobrescriben en cada arranque.
- Las experiencias nuevas no entran automáticamente a Store. Deben pasar laboratorio → QA → aprobación → publicación.
- Un perfil comercial cambia recomendaciones/UX, nunca permisos de seguridad.
- Una referencia multimedia en SQLite no equivale a un archivo físico existente. RC17 detecta y presenta referencias faltantes sin inundar la interfaz con 404.
- Probar una apertura o producto no concede derechos ni modifica el carrito.
- Se preservan los flujos aprobados; un módulo estable no se reescribe sólo por introducir una idea nueva.

## Capacidades heredadas de RC17–RC18

### Rendimiento del panel

La carga inicial del workspace pasó de solicitar simultáneamente resumen, ajustes, invitados, fotografías, mesas, plantillas, QR y tipos de evento a cargar sólo el núcleo visible: resumen, ajustes, plantillas, QR templates y tipos de evento. Invitados, fotografías, mesas, QR, negocio, usuarios y pagos se obtienen al abrir la vista correspondiente.

También se redujeron recargas globales después de mutaciones de invitados y se añadieron `loading="lazy"`, `decoding="async"` y contención de render en tarjetas extensas.

### Multimedia

- Subidas administrativas con clave idempotente (`x-upload-key`) y reintentos controlados.
- Watchdog de progreso: una transferencia que no avanza durante 45 s se cancela y reintenta con la misma clave.
- Imágenes grandes de portada/galería/vestimenta pueden reducirse en el navegador y convertirse a WebP cuando realmente disminuye el peso.
- Álbum de invitados conserva optimización cliente, reintentos idempotentes y watchdog.
- El servidor guarda recibos de subidas para que un reintento no duplique archivos/entradas.
- Los abortos del cliente se distinguen de un error interno y se limpian archivos parciales de Multer.
- El panel muestra salud de referencias multimedia y permite retirar explícitamente referencias locales que ya no existen en esta copia.

**La línea actual todavía no implementa TUS por offset.** La ruta existente mejora resiliencia, pero la reanudación real desde el byte interrumpido permanece en laboratorio para una integración cliente+servidor posterior.

### Aperturas y experiencias

- Rosa eterna fuerza un primer frame cerrado antes del crecimiento, evitando que escritorios rápidos salten al estado final.
- Preview de propietario puede forzar movimiento para validar la experiencia; la invitación pública sigue respetando `prefers-reduced-motion`.
- Rosa admite color de pétalo configurable mediante variables seguras, sin JS arbitrario desde la BD.
- Corazón de partículas ajusta el número de partículas al viewport y cachea paleta por resize.
- Al iniciar una apertura, el CTA normal de la invitación se oculta; al terminar no vuelve a pedir redundantemente “Abrir invitación”.
- Todas las aperturas presentes en la UI se contrastan contra la allowlist de `app.js`; los renderers especiales se validan por pruebas estáticas.

### Gobierno comercial

- El arranque ya no impone `auto_after_entitlement` ni vuelve a insertar experiencias en planes editados.
- Vaciar la composición de un plan (incluida prueba) permanece como decisión del propietario tras reiniciar.
- Las recomendaciones de perfiles se establecen al crear el perfil, no se regeneran si el propietario decide dejarlas vacías.
- Metadatos de productos se inicializan una sola vez mediante `release_version`; después quedan bajo control del Product Studio.
- Las demos del Showcase tienen un marcador de bootstrap para no reaparecer después de ser eliminadas deliberadamente.
- La resolución real de plantillas usa productos/derechos de la BD; se retiró un fallback runtime que todavía consultaba el plan estático.
- Catálogo público exige estado comercial/publicación y `readiness_status=approved`; `hidden`/`draft` no son publicables por tener un plan Premium.

### UX y responsividad

- Configuración se divide en bloques colapsables y limita la cantidad abierta simultáneamente.
- Mi negocio mantiene el límite de paneles desplegados.
- Perfiles comerciales usan dos columnas dentro del espacio real del panel y una columna en pantallas angostas.
- La traducción estática de **Configuración** tiene cobertura automatizada de 161/161 textos en inglés y portugués. Persisten textos dinámicos de otras áreas que deben seguir migrándose a claves semánticas antes de declarar i18n total.
- Invitación física usa una ubicación canónica tomada del programa/agenda moderna y se eliminó la frase promocional que no debía imprimirse.

## Arranque local

Windows:

```text
INICIAR.bat
```

Linux:

```bash
chmod +x iniciar_linux.sh
./iniciar_linux.sh
```

Arranque manual:

```bash
npm ci
cp .env.example .env
npm run seed   # sólo una instalación/demo vacía; nunca producción
npm start
```

En Windows PowerShell, usa `npm.cmd` si la política impide ejecutar `npm.ps1`.

## Producción

- No ejecutar `npm run seed` sobre datos reales.
- Definir `NODE_ENV=production`, `SITE_URL=https://...`, `TRUST_PROXY=true`, `SESSION_SECRET`, propietario inicial y `STORAGE_ROOT` persistente.
- Mantener una sola réplica mientras SQLite sea el almacenamiento primario.
- HTTPS es obligatorio para la publicación real; el modo LAN HTTP se conserva únicamente para pruebas locales.
- Mantener respaldo externo antes de migrar una BD real.
- Publicación manual es el valor de bootstrap; las políticas automáticas se habilitan sólo por decisión del propietario.
- Para Mercado Pago: `PAYMENT_PROVIDER=mercadopago`, `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`; configurar el webhook HTTPS `/api/payments/mercadopago/webhook`.
- Para WhatsApp Cloud, completar las variables `WHATSAPP_*` descritas en `.env.example`; una configuración parcial permanece bloqueada.

## Validación 6.16.0-rc.41

RC41 consolida la fidelidad entre Design Studio, Preview, apertura, Stationery e invitación pública. La portada del evento se reutiliza sin exigir una nueva carga, el encuadre móvil/escritorio es independiente y los Assets decorativos conservan dimensiones públicas para no desaparecer al aplicar. Apply espera el flush/autosave del borrador y las escrituras idénticas no incrementan revisiones innecesariamente.

La evidencia automatizada disponible cubre 65 Recipes, 31 Assets, 103 skins, 175,500 combinaciones lógicas de presentación, 1,300 proyecciones rol/perfil, 139 controles y matrices visuales responsive. La promoción a producción sigue exigiendo el gate E2E en una PC con dependencias instalables y el checklist físico RC41. Ver `docs/validation/VALIDACION_6.16.0-rc.41.md`.

### Histórico: RC40 / RC39 / RC38

RC40, RC39 y RC38 se conservan como antecedentes de presentación, paridad y responsive. Cuando un documento histórico contradiga RC41, prevalecen el índice, ADR, auditoría y validación RC41.

### Histórico: Validación RC33

RC33 consolidó Recipes/Assets/Components, matrices de entitlement y la primera cobertura visual amplia del Design Lab.

## Histórico: Validación RC21

La línea RC21 conserva pruebas de autenticación, aislamiento, 1,200 usuarios, perfiles, cortesías, pagos, traducción, WhatsApp, datos, migración, fotos, RSVP, QR/PDF y respaldo/restauración como antecedente. Consulta `docs/validation/VALIDACION_RC21.md`.

## Documentación

Índice vigente: [`docs/indexes/INDEX_DOCUMENTACION_6.16.0-rc.41.md`](docs/indexes/INDEX_DOCUMENTACION_6.16.0-rc.41.md)

Documentos clave:

- `docs/analysis/ADR_PREVIEW_STATIONERY_MEDIA_ASSETS_RC41.md`
- `docs/audits/AUDITORIA_6.16.0-rc.41.md`
- `docs/validation/VALIDACION_6.16.0-rc.41.md`
- `docs/traceability/TEST_COVERAGE_MATRIX_6.16.0-rc.41.md`
- `docs/checklists/QA_FISICO_FINAL_6.16.0-rc.41.md`
- `docs/release-notes/RELEASE_NOTES_6.16.0-rc.41.md`
- `docs/guides/GUIA_ARRANQUE_LOCAL_WINDOWS_RC41.md`
- `docs/validation/evidence/RC41_PRODUCTION_READINESS_VISUAL.json`
- `docs/validation/evidence/RC41_AUTOMATED_QA_SUMMARY.json`
- `docs/validation/evidence/RC41_DB_MEDIA_INTEGRITY.json`

El historial anterior permanece bajo `docs/` y conserva su valor como antecedente.

## Nota sobre tipografías en el paquete de intercambio

La aplicación conserva sus referencias CSS a las tipografías existentes. Este paquete de intercambio RC21 omite binarios de fuentes; reutiliza `public/fonts/` de una instalación autorizada si deseas conservar exactamente las mismas tipografías locales. Sin ellas se utilizan las familias de respaldo definidas en CSS.

## RC21 production migration hotfix r3

El despliegue sobre bases legacy `user_version=0` está cubierto por `npm run test:production-migration`. El arranque garantiza `plans.retention_days`, `max_published_events` y `publication_policy` antes de preparar seeds comerciales y reutiliza snapshots pre-migración verificados en reintentos. Ver `docs/audits/AUDITORIA_PRODUCTION_MIGRATION_HOTFIX_RC21_R3.md`.
