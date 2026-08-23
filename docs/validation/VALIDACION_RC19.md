# Validación — EventStudio 6.14.2-rc.19

## Resultado

Todas las pruebas automatizadas incluidas en el paquete terminan en PASS. La prueba funcional extensa se ejecutó completa contra almacenamiento temporal y no modificó datos del paquete.

## Cobertura ejecutada

| Área | Evidencia | Resultado |
|---|---|---|
| Integridad, DOM y recursos | `tests/project-integrity.js`, `tests/source-references.js` | PASS |
| Responsive móvil y acceso LAN | `tests/mobile-ui.js`, `tests/local-network.js` | PASS |
| Migración y conservación de datos | `tests/data-safety.js`, `tests/commerce-migration.js` | PASS |
| CSRF/orígenes, HTTPS y cabeceras | `tests/origin-policy.js`, `tests/security-headers.js` | PASS |
| Cliente nuevo, comprador y propietario | `tests/commerce-journeys.js` | PASS |
| Usuarios, roles, eventos, cortesías, compras simuladas, invitados, RSVP, fotos, QR/PDF, respaldos y reinicio | `tests/smoke.js` | PASS |
| Restauración sin cuentas demo | `tests/restore.js` | PASS |
| Regresiones heredadas | RC14, RC15, RC15.1 y RC17 | PASS |
| Correcciones RC19 | `tests/rc19-regressions.js` | PASS |
| Animaciones y accesibilidad | `tests/animation-contracts.js` | PASS |
| Estructura, sintaxis, secretos y paquete | `scripts/audit-project.js` | PASS |

## Pruebas RC19 específicas

- `still`, `subtle`, `balanced` y `dynamic` usan el runtime real y duraciones esperadas.
- `prefers-reduced-motion` detiene movimiento público; `forceMotion` restaura únicamente la prueba explícita.
- Todas las aperturas del catálogo tienen implementación y las comerciales producto/grant.
- Margarita conserva 16 pétalos, centro circular de 88 px y solape mínimo calculado de 10 px.
- Jardín luminoso conserva tres flores/38 pétalos, 18 estrellas y 12 luces.
- Las escenas florales tienen tiempos de exposición mínimos para inspección humana.
- La UI dispone de botón para omitir y estilos responsive.
- `/api/auth/me` conserva 401 normal y devuelve 200 anónimo sólo con `optional=1`.
- Mensajes de evento privado: 404 anónimo y 200 en preview autorizado.
- Catálogo informa que la traducción automática no está disponible cuando no hay proveedor.

## Entorno de prueba

El ZIP original no distribuye `node_modules`. Para ejecutar en este contenedor se reutilizaron dependencias JavaScript compatibles de una copia anterior del proyecto y un adaptador **sólo de pruebas** basado en `node:sqlite`, porque el binario `better-sqlite3` disponible había sido compilado para Windows. La aplicación de producción conserva `better-sqlite3` y su lockfile; el adaptador está confinado a `tests/support/` y sólo se activa mediante `NODE_OPTIONS`.

## Límites honestos

- No se procesaron pagos reales ni se contactaron proveedores externos; se verificaron modos simulados, estados y rechazos seguros.
- La traducción automática requiere configurar `TRANSLATION_ENDPOINT`; sin él se validó la ruta manual y el no-envío desde UI.
- La compatibilidad móvil/escritorio está cubierta por contratos responsive, tamaños, accesibilidad y pruebas HTTP. No había un ejecutable gráfico de navegador para una matriz física de Chrome/Edge/Firefox/Safari; esa inspección sigue siendo la puerta visual previa a promover de RC a estable.
- Las pruebas de ataques cubren las regresiones incluidas; no sustituyen un pentest independiente ni una auditoría continua de dependencias.

## Comando normal de reproducción

```bash
npm ci
npm test
npm run audit
```
