# Auditoría EventStudio 6.14.2-rc.14

## Origen
Auditoría correctiva de 6.14.2-rc.13 basada en evidencia manual del propietario/desarrollador en navegador de escritorio y dispositivo móvil. Las capturas de prueba se usaron como evidencia externa y no se redistribuyen en el paquete.

## Hallazgos y causa raíz
### RSVP
La API ya aplicaba límites, pero la interfaz no advertía suficientemente antes del envío y el estado visual permanecía obsoleto hasta recargar. Se añadió validación cliente equivalente y actualización del bloque confirmado al recibir respuesta del servidor. El servidor sigue siendo la autoridad.

### Álbum LAN
`crypto.randomUUID()` no está garantizado en contextos HTTP LAN. El identificador sólo se usa para idempotencia del lote, no para autorización. Se añadió `getRandomValues` y fallback final compatible. En desarrollo LAN se omiten COOP/OAC que el navegador no puede aplicar de forma fiable en origen no seguro; producción HTTPS los conserva.

### Mesas
`initializeLegacySeating()` se ejecutaba durante snapshots sucesivos y podía volver a traducir el antiguo `guests.table_name` a asientos, interfiriendo con cambios manuales. Se añadió una migración única por evento y desde entonces `seating_assignments` es la fuente de verdad.

### Preview de apertura
El administrador generaba `previewTheme`, `previewOpening` y `previewGallery`, pero el cliente público sólo reenviaba `preview`/`previewToken` a `/api/config`. Se corrigió el puente de parámetros.

### Store / derechos
La pantalla Plantillas evaluaba `themeAllowed()` —incluidos tiers del plan— mientras Store comprobaba principalmente grants exactos. Un tema incluido por tier podía seguir apareciendo como comprable. Se centralizó `productOwnedForEvent()` y se revalida también al checkout.

### Saturación visual
Preview persistente, botones separados y paneles siempre abiertos hacían Plan y extras/Mi negocio demasiado grandes, especialmente en móvil. Se pasó a modales y bloques `<details>` colapsables.

## Seguridad revisada
Las operaciones de productos, planes, perfiles comerciales, cortesías y controles comerciales continúan detrás de `authRequired + ownerOnly`. Los identificadores de eventos recibidos se normalizan y validan; las consultas sensibles mantienen parámetros preparados. Esta auditoría no afirma inmunidad absoluta: requiere mantener pruebas de autorización, validación, CSRF/origen, rate limiting y actualizaciones de dependencias en cada release.

## Accesibilidad visual
Se utiliza 4.5:1 como umbral programático para texto normal en `ink`, `muted` y `accentText` sobre `paper`. El color decorativo original puede conservarse, mientras el texto recibe una variante legible.

## Resultado
La RC14 corrige las causas localizadas y agrega pruebas estáticas/regresión específicas. Queda condicionada a validación funcional completa antes de producción.
