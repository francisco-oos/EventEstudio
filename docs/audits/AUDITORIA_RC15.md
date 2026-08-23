# Auditoría EventStudio 6.14.2-rc.15

Fecha de trabajo: 2026-08-09.
Base auditada: EventStudio 6.14.2-rc.14 entregada por el propietario.

## Alcance

Esta candidata corrige regresiones detectadas en móvil, Store, previews, galería, apertura Rosa Eterna, fotografías por QR, moderación, visibilidad comercial, invitación física, Showcase, analítica e internacionalización. No incorpora todavía el futuro Visual Composer ni sustituye el motor de mesas por Konva.

## Hallazgos y correcciones

1. **Login móvil fantasma.** Una regla responsive `.admin-layout{display:block!important}` podía ganar a `.hidden`. RC15 añade una regla más específica para impedir que la consola aparezca antes de autenticar o después de cerrar sesión.
2. **Carrito móvil.** Las filas de cinco columnas podían desbordar. RC15 las reorganiza en áreas responsive y mantiene disponible `Vaciar selección`.
3. **Productos ya incluidos.** La Store conserva información de propiedad (`Incluido`, `Adquirido`, `Cortesía`, `Promoción`) y elimina del carrito artículos que dejaron de ser cobrables antes de mostrar/confirmar el pago.
4. **Preview no compra.** `Probar` sólo genera una URL temporal de simulación; no ejecuta el endpoint de carrito. La interfaz lo declara explícitamente.
5. **Preview móvil.** El encabezado queda fijo dentro del modal y conserva cerrar/cambiar dispositivo aunque el iframe sea alto.
6. **Galería.** Las experiencias stack/coverflow/cinematic-depth usan gesto horizontal con Pointer Events; móvil conserva tarjeta protagonista con tarjetas posteriores visibles y evita el antiguo grid estático.
7. **Rosa Eterna.** Se reemplaza la aproximación geométrica anterior por un renderer propio con tallo, hojas, sépalos, siete capas de pétalos y pétalos descendentes. El florecimiento se dispara al abrir y la preview automática le concede tiempo suficiente para apreciarse.
8. **Showcase.** La API pública devuelve exclusivamente `published`, con `Cache-Control: no-store`; `draft` y `hidden` no deben permanecer visibles por caché.
9. **Perfiles comerciales.** Se añadió `catalog_mode` (`all`/`curated`) y relación producto-perfil. Esto controla merchandising/visibilidad y nunca sustituye rol, entitlement ni autorización de backend.
10. **Temas ocultos ya adquiridos.** Un producto retirado/oculto puede seguir siendo usado por quien ya posee el derecho; no se ofrece a compradores nuevos.
11. **Fotografías.** QR nuevos incluyen firma HMAC de mesa; el backend verifica firma y pertenencia. El panel separa pendientes/aprobadas/no aprobadas y permite exportar ZIP por filtro.
12. **Invitación física.** El lugar usa el campo heredado o, si ya se trabaja con ubicaciones múltiples, ceremonia/recepción.
13. **Analítica.** Los identificadores técnicos se presentan con nombres humanos cuando existe catálogo/tema correspondiente. El catálogo público registra origen/campaña de enlaces sociales sin exigir login.
14. **Mi negocio.** Máximo dos bloques colapsables abiertos simultáneamente.
15. **Idioma.** Se amplió la traducción de interfaz y se corrigió el cambio bidireccional para que cambiar ES→EN→ES no tome el texto traducido como fuente permanente.

## Seguridad

- No se introdujo JavaScript arbitrario desde base de datos.
- Curación de perfil no otorga derechos.
- Rutas de propietario continúan `authRequired` + `ownerOnly`.
- La firma de mesa protege los QR nuevos contra sustitución simple del parámetro `mesa`; se mantiene compatibilidad con QR históricos no firmados para no romper impresos existentes.
- La limpieza de carrito se repite en servidor; no depende de ocultar botones en UI.

## Pendientes deliberados

- Uppy + Tus/tusd: aprobado para laboratorio, no integrado todavía.
- Konva: aprobado para PoC comparativo en Seating/Visual Composer, no agregado al runtime de RC15.
- Closing Experience: permanece como línea futura independiente de esta ronda correctiva.
