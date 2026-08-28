# EventStudio 6.14.2-rc.21

Candidata correctiva construida sobre la RC20 entregada por el propietario. RC13 se consultó únicamente como referencia del orden visual de los sobres. RC21 corrige la autorización de “Probar efectos”, evita la superposición del corazón, añade Flor nocturna original y amplía la matriz de invitaciones sin reescribir módulos aprobados.

## Cambios principales RC21

- “Probar efectos”, preview de tema/Store/carrito y replay usan enlaces temporales autorizados por evento.
- Owner/developer conservan acceso técnico; un cliente puede probar un producto público sin adquirirlo ni guardarlo.
- Corazón de partículas mide el espacio entre texto y acción en lugar de usar coordenadas rígidas.
- Flor nocturna original se integra como experiencia separada, con tres flores de cuatro pétalos y colores configurables.
- Se conserva el orden de capas de RC13 con las cadencias legibles de RC20 (3.6–4.3 s para sobres).
- Matriz efectiva de 59 plantillas, 16 aperturas, registro, publicación, invitación, RSVP, cortesías y base importada.
- Índice vigente: `docs/indexes/INDEX_DOCUMENTACION_RC21.md`.

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

## Validación RC21

Pruebas automatizadas pasadas en esta entrega:

```text
npm test
npm run audit
```

La suite incluye contratos de todas las aperturas, preferencias de movimiento, responsive, autenticación, aislamiento, 1,200 usuarios, perfiles, cortesías, pagos, traducción, WhatsApp, datos, migración, fotos, RSVP, QR/PDF y respaldo/restauración. Consulta `docs/validation/VALIDACION_RC21.md` para evidencia y límites. La inspección visual física en la matriz final de navegadores/dispositivos continúa siendo necesaria antes de promover esta candidata a estable.

## Documentación

Índice vigente: [`docs/indexes/INDEX_DOCUMENTACION_RC21.md`](docs/indexes/INDEX_DOCUMENTACION_RC21.md)

Documentos clave:

- `docs/audits/AUDITORIA_RC21.md`
- `docs/validation/VALIDACION_RC21.md`
- `docs/release-notes/RELEASE_NOTES_V6_14_2_RC21.md`
- `docs/traceability/MATRIZ_TRAZABILIDAD_RC21.md`
- `docs/analysis/DECISIONES_TECNICAS_RC21.md`
- `docs/analysis/INVESTIGACION_ANIMACIONES_TIENDA_RC20.md`
- `docs/security/SEGURIDAD_RC21.md`

## Nota sobre tipografías en el paquete de intercambio

La aplicación conserva sus referencias CSS a las tipografías existentes. Este paquete de intercambio RC21 omite binarios de fuentes; reutiliza `public/fonts/` de una instalación autorizada si deseas conservar exactamente las mismas tipografías locales. Sin ellas se utilizan las familias de respaldo definidas en CSS.
