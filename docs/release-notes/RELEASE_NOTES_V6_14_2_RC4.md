# EventStudio 6.14.2 RC4

## Objetivo

Cerrar la estabilización local y preparar una actualización de producción sin
perder datos. Esta versión corrige el rechazo de acceso observado al abrir el
panel en `localhost`, aunque el lanzador hubiera configurado la IP LAN para el
teléfono.

## Causa del acceso rechazado

La protección CSRF comparaba el encabezado `Origin` únicamente contra
`SITE_URL`. El lanzador configuraba `SITE_URL=http://IP-LAN:PUERTO`, pero abría
`http://localhost:PUERTO/admin.html` en la computadora. Si el navegador ya
conservaba una cookie, el servidor rechazaba el `POST /api/auth/login` antes de
validar correo y contraseña.

RC4 admite en desarrollo el origen real del host solicitado y `SITE_URL`. En
producción sigue admitiendo exclusivamente el origen HTTPS de `SITE_URL`. Las
peticiones con cookie, sin origen o desde un origen externo son rechazadas.

## Continuidad de datos

- `seed` queda bloqueado en producción y también se niega a ejecutarse sobre
  cualquier base que ya contenga usuarios o eventos.
- El lanzador ejecuta `quick_check` y muestra la base, usuarios y eventos que
  conservará.
- Una base parcial, desconocida o dañada no se resembrará.
- Antes de migrar un esquema anterior se genera una copia SQLite consolidada,
  se verifica con `integrity_check`, se calcula SHA-256 y se escribe un
  manifiesto junto a la copia.
- Se rechaza abrir una base creada por una versión de esquema posterior para
  evitar un downgrade destructivo.
- Las normalizaciones de ajustes sólo escriben cuando el JSON realmente cambia.

La base aportada para el diagnóstico se abrió en modo de sólo lectura y después
se probó sobre una copia aislada. Resultado: integridad correcta, mismas
cantidades de usuarios, eventos, invitados, RSVP y fotos antes/después,
respaldo previo verificado e inicio desde `localhost` aprobado. El archivo
original no se modificó.

## Seguridad

- Política de origen probada para computadora, teléfono, producción, atacante y
  ausencia del encabezado `Origin`.
- Cookies de producción `HttpOnly`, `Secure` y `SameSite=Lax`; sesiones
  almacenadas como HMAC.
- Producción exige HTTPS, `TRUST_PROXY=true`, almacenamiento persistente y
  secreto de sesión suficiente.
- Producción se niega a iniciar con cuentas demo activas.
- Las rutas de portada, música, galería y vestimenta sólo cambian mediante los
  endpoints de carga; los valores públicos se normalizan.
- Los enlaces externos de regalos y ubicaciones se limitan a HTTP(S).
- El restaurador limita tamaño, contenido descomprimido y número de entradas;
  rechaza rutas inesperadas o duplicadas, valida esquema, integridad y SHA-256.
- Los respaldos se crean con permisos restrictivos cuando el sistema operativo
  los soporta.
- Los mapas de límites de acceso y registro tienen tamaño acotado.
- Valores numéricos del entorno se validan y no pueden convertirse
  silenciosamente en límites inválidos.

## Funcionalidad y datos dinámicos

- La plantilla Excel anunciada como vacía ya no incluye una familia, teléfono,
  mesa ni mensaje de ejemplo.
- No hay nombres, correos, boda real, ubicación ni fecha personal escritos en
  el código de ejecución.
- Los únicos datos de personas ficticias permanecen aislados en `src/seed.js` y
  pruebas; no se incluyen en producción.
- Google permanece oculto porque el flujo OAuth todavía no está terminado.
- WhatsApp automático, pagos, dominios y herramientas de desarrollador
  continúan gobernados por estados ocultos o configuración; no se presentan
  como funciones listas cuando no lo están.
- La marca visible continúa unificada como `EventStudio`.

## Evidencia automatizada

`npm test` cubre:

- orígenes y CSRF local/LAN/producción;
- base existente, seed y respaldo previo a migración;
- sesiones, contraseñas, roles y aislamiento entre eventos;
- alta, edición, desactivación y reactivación de usuarios;
- boda, XV años y eventos personalizados;
- invitación, RSVP, menús, accesibilidad y programa;
- Excel, PDF, QR, invitación física y plano;
- carga y persistencia de música, Spotify y fotografías;
- mensajería, auditoría, respaldo, restauración y reinicio;
- ZIP de restauración con entrada no permitida;
- encabezados CSP, caché y recursos HTML/CSS/JavaScript.

Resultados del cierre:

- `npm test`: aprobado.
- `npm audit --audit-level=moderate`: 0 vulnerabilidades.
- `npm ls --all --omit=optional`: árbol coherente.
- Rutas administrativas sin `authRequired`: 0.
- Rutas duplicadas: 0.
- Secretos o datos personales en código de ejecución: 0 hallazgos.

## Condición para desplegar

RC4 todavía debe superar la prueba física del propietario en Windows y teléfono.
Después:

1. descargar el respaldo ZIP actual de producción;
2. respaldar el volumen de Railway;
3. confirmar una sola réplica y las variables de producción;
4. desplegar RC4;
5. comprobar `/api/health`, acceso, evento activo, invitación, RSVP, foto, Excel,
   PDF y QR;
6. conservar la imagen y volumen anteriores hasta cerrar la validación.

No ejecutar `seed`, no copiar `node_modules` y no mezclar `public/`, `src/` o
scripts de versiones anteriores.
