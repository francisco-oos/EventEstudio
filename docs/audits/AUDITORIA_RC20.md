# Auditoría — EventStudio 6.14.2-rc.20

## Hallazgos corregidos

1. `supportClientView` iniciaba en `true`; ocultaba productos comerciales a owner/developer por simular cliente sin indicarlo suficientemente. Ahora inicia en vista técnica.
2. `forceMotion + still` activaba la animación con `durationScale=0`, reduciendo timers a 1 ms. Preview usa perfil equilibrado.
3. El cierre genérico de sobres ocurría antes de terminar tarjeta/solapa. Se establecieron cadencias por estilo y variables CSS reutilizables.
4. Una regla tardía de `data-motion="still"` anulaba Sello marfil incluso con preview forzado. La exclusión `:not(.force-motion-preview)` corrige la precedencia.
5. Los pagos reales no estaban preparados: sólo existía demo. Se añadió adaptador Mercado Pago y validación de webhook contra API.

## Consola informada por el propietario

| Mensaje | Clasificación RC20 |
|---|---|
| `/api/auth/me` 401 al abrir login | El panel conserva `?optional=1` → 200 anónimo. El 401 normal sigue protegiendo la ruta. |
| `/api/public/photo-messages/...` 404 en preview | Preview autorizado propaga token/sesión; público de evento no publicado conserva 404. |
| `/api/admin/localization/translate` 503 | UI no llama si capability está desactivada. Con proveedor, ES→EN/PT fue validado. |
| `Permissions policy violation: unload` | EventStudio no registra `unload`; proviene de contenedor/extensión. |
| `chrome-extension://... content.js` | Extensión del navegador invalidada; no pertenece al proyecto y no se oculta con un workaround. |
| `Receiving end does not exist` | Canal de extensión sin receptor; no se reproduce en el código fuente. |

## Reutilización y hardcodeo

- Cadencias de sobres usan variables CSS y una tabla única de tiempos JS.
- Integración de pago vive en `src/payments.js`; credenciales sólo por entorno.
- Roles/productos/grants/perfiles siguen resueltos por BD. La allowlist de renderers se mantiene deliberadamente estática como frontera de seguridad.
- Pruebas usan `example.test`, nombres genéricos y tokens falsos.

## Elementos no alterados

- No se publica Jardín luminoso ni candidatos nuevos automáticamente en Store.
- No se reinyectan productos en planes ya administrados.
- No se cambia el esquema ni se borran datos.
- No se relaja aislamiento de eventos, CSRF, autorización de archivos o reduced-motion público.
