# Auditoría técnica y funcional · EventStudio 6.14.2 RC13

Fecha: 9 de agosto de 2026

## Resultado

**CANDIDATO PARA VALIDACIÓN INTEGRAL, NO PROMOVIDO AUTOMÁTICAMENTE A PRODUCCIÓN.**

RC13 conserva la base RC12 y añade infraestructura comercial, preview, analítica, publicación gobernada y una familia visual floral. La revisión estática y las pruebas que no requieren dependencias externas pasan. La suite completa queda condicionada a repetir `npm ci && npm test` en un entorno con el registro npm normal.

## Hallazgos de RC12 corregidos

| Hallazgo | Corrección RC13 |
|---|---|
| Categorías de Store derivadas con lógica JS estática. | Categorías y enlaces pasan a SQLite; Product Studio permite administrarlas. |
| Producto visual nuevo requería excepciones repetidas. | `presentation_slot`, `preview_strategy`, manifest y renderer autorizado. |
| No existía lifecycle técnico explícito. | `draft/lab/qa/approved/retired` separado del estado comercial. |
| Preview individual limitado. | Preview flotante + Composer + enlace temporal multidispositivo. |
| `SITE_URL` seguía siendo base fija de URLs. | `publicBaseUrl(event)` prioriza dominio verificado. |
| Publicación cliente sólo podía pensarse como manual/admin. | Política global + plan/cuenta, manteniendo manual como default. |
| No existía medición de embudo. | `conversion_events` first-party y panel owner. |
| Perfiles comerciales no estaban modelados. | `customer_profiles` separado de roles de seguridad. |
| No había sandbox editable sin cuenta. | `sandbox.html` + traslado de datos básicos al registro. |
| RSVP y seating no tenían tolerancia explícita para liberar recursos. | `seatReleaseAt`, candidato visual y liberación manual sin reemplazo automático. |
| Coherencia visual dependía implícitamente del tema. | `designKit` opcional + tipografía existente + propagación a QR/print. |

## Riesgos controlados

1. **Autopublicación**: existe infraestructura, pero la plataforma inicia en `manual_owner`. Debe probarse en staging antes de cambiar a `plan_policy`.
2. **Productos nuevos**: el panel no ejecuta código arbitrario; sólo compone capacidades autorizadas. Renderers nuevos requieren release de código.
3. **Analytics**: se limita metadata y nombres de evento; no sustituye todavía una política formal de retención/privacidad para gran escala.
4. **Preview links**: son temporales y su token se almacena hasheado. Deben probarse expiración y revocación con servidor real.
5. **Daisy Atelier**: los activos son originales; las fotografías de inspiración no se incluyen en el producto.
6. **Dependencias**: la suite completa no pudo instalarse en este entorno por un 404 del mirror interno para `zip-stream@7.0.5`.

## Decisiones rechazadas

- copiar las fotografías o diseños de inspiración;
- meter SVG.js sólo para cuatro SVG estáticos;
- desplegar Umami sólo para la analítica inicial;
- sustituir ahora el editor de mesas por Konva;
- sustituir uploads actuales por Uppy/Tus sin PoC;
- introducir Three.js/tsParticles/Motion para el efecto actual de partículas;
- permitir publicación automática por defecto;
- permitir que un perfil comercial eleve permisos;
- permitir que RSVP sustituya automáticamente a un invitado.

## Siguiente puerta de promoción

1. `npm ci` desde registro npm funcional;
2. `npm test` completo;
3. migración RC12 -> RC13 sobre copia;
4. validación móvil real;
5. PDFs/QR/impresos Daisy + DesignKit;
6. flujo manual de publicación;
7. preview token cross-device;
8. restore/backup.

Sólo después de esas puertas debe considerarse una promoción a producción.
