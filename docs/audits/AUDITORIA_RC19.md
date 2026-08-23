# Auditoría — EventStudio 6.14.2-rc.19

## Alcance

Se auditó la candidata RC18 entregada, sus 200 archivos de proyecto, 44 fuentes JavaScript, configuración JSON, rutas públicas/administrativas, migración comercial, autenticación, perfiles, concesiones, eventos, RSVP, fotos, exportaciones, respaldo/restauración, traducción y motores visuales.

## Hallazgos corregidos

1. `forceMotion=1` no anulaba las reglas `prefers-reduced-motion` de Margarita.
2. El centro de Margarita no cubría suficientemente la raíz de los pétalos, especialmente con escala móvil.
3. Algunas intensidades terminaban demasiado rápido para una inspección humana confiable.
4. Faltaba una salida visible y accesible para omitir la apertura.
5. El panel sondeaba `/api/auth/me` como ruta obligatoria y generaba un 401 esperado en consola.
6. La vista previa privada cargaba configuración autorizada, pero su petición secundaria de mensajes no propagaba la autorización y repetía 404.
7. El botón de traducción automática se mostraba operativo aunque el servidor no tuviera proveedor, produciendo 503 repetidos.
8. La vista previa comercial mantenía una lista manual de algunas aperturas y podía divergir del catálogo.
9. `Animated Flower.zip` era una página autónoma sin licencia declarada; no era seguro incrustarla literalmente.

## Resultado estructural

- Sintaxis JavaScript: PASS (44 archivos).
- JSON: PASS.
- HTML: sin IDs duplicados detectados.
- CSS: llaves balanceadas y referencias de caché RC19.
- Documentación: clasificada bajo `docs/`.
- Empaquetado: sin `.env`, BD runtime, logs, uploads de usuarios ni `node_modules`.
- Configuración estática de Settings: 161/161 cadenas con mapa EN/PT.

## Clasificación de los mensajes de consola reportados

| Mensaje | Origen | Acción RC19 |
|---|---|---|
| `/api/auth/me` 401 | Aplicación | Sondeo opcional sin ruido; contrato protegido preservado. |
| `/api/public/photo-messages/...` 404 repetido | Aplicación | Preview autorizado propagado y validado también en esa API. |
| `/api/admin/localization/translate` 503 | Configuración sin proveedor | Capacidad publicada por servidor; UI deshabilitada y edición manual disponible. |
| `Permissions policy violation: unload` | Navegador, contenedor o extensión | Confirmado que EventStudio no usa `unload`; no se introdujo workaround inseguro. |
| `content.js`, `chrome-extension://`, `Extension context invalidated` | Extensión instalada en navegador | Fuera del runtime de EventStudio. Validar en perfil limpio/incógnito si se desea una consola sin extensiones. |

## Estado

RC19 supera la auditoría automatizada y la suite funcional disponible. Se mantiene como release candidate porque una inspección visual física en el conjunto final de navegadores/teléfonos del despliegue y un pentest independiente siguen siendo puertas operativas distintas de las simulaciones automatizadas.
