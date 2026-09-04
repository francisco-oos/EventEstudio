# Auditoría RC29: paridad del generador maestro, sincronización y perfiles

Fecha: 2 de septiembre de 2026

## Bases comparadas

- `EventStudio-6.14.2-rc.28-QA` como baseline funcional.
- `index_sobre_generador_general_rc28_auditado(3).html` como referencia visual y de interacción del generador maestro.
- Catálogos `config/stationery.json`, `config/seals.json` y `config/experiences.json`.
- Motor/persistencia RC28 (`stationery-config`, `opening-coordination`, `themeDescriptor`, `seal-renderer`).

## Hallazgo

La herencia y persistencia de RC28 eran correctas, pero la vista avanzada había quedado más simple que la referencia suministrada. La discrepancia principal estaba en cuatro puntos:

1. navegación reducida frente a las nueve bibliotecas del generador maestro;
2. miniaturas genéricas en lugar de previews vectoriales representativos;
3. apertura/cierre mediante controles auxiliares en lugar del clic sobre el sobre;
4. renderer del estudio menos rico que la composición final esperada.

## Correcciones realizadas

### Estructura visual

`public/stationery-studio.html/.css` vuelve al patrón de tres zonas del generador maestro:

- navegación: 90 px en escritorio;
- biblioteca: 360 px en escritorio;
- escenario central con perspectiva y área segura;
- adaptación móvil sin desbordamiento horizontal.

El dock de aplicación permanece separado del lienzo para conservar visible `Aplicar a la invitación` sin reducir las bibliotecas.

### Navegación y recursos

El estudio presenta nueve secciones y genera sus contenidos desde catálogo:

| Recurso | Cantidad RC29 | Preview |
| --- | ---: | --- |
| Geometrías | 4 | icono SVG |
| Presets | 16 | material/receta vectorial |
| Materiales | 15 | patrón SVG real |
| Liners | 9 | SVG real o `none` |
| Overlays/encajes | 10 | SVG real o `none` |
| Estampillas | 7 | SVG real o `none` |
| Marcos | 8 | SVG real o `none` |
| Divisores | 9 | SVG real o `none` |

No se usan índices de array como identificadores persistidos.

### Motor compartido

`public/stationery-engine.js` fue reestructurado para producir:

- geometrías V, cuadrada, rústica y tarjeta;
- patrones de los 15 materiales;
- marcos, divisores, liners, overlays y estampillas;
- slots compatibles con la vista avanzada y la invitación pública;
- tokens de diseño derivados del estado actual.

`public/stationery-engine.css` conserva animación declarativa: solapa a 0.75 s y extracción de tarjeta a 0.85 s, con adaptación `prefers-reduced-motion`.

### Interacción

- Se retiraron botones separados para abrir/cerrar.
- Un clic sobre el sobre alterna el estado.
- En formato tarjeta se conserva la respuesta de perspectiva al puntero.
- El cálculo de desplazamiento abierto usa geometría/viewport y no coordenadas de una resolución fija.

### Herencia

Se verificó que el estudio continúa heredando:

- `couple.displayName`;
- `event.dateLabel`;
- `typography.heading`.

Los tres se muestran como información de sólo lectura. El monograma automático y los recursos postales derivan de esos datos; no se solicita una segunda captura.

### Lacre

Se mantuvo el generador central y se verificó que:

- cambiar `sealColor` selecciona material `theme`;
- preview y sello principal se regeneran con la misma configuración;
- presets con receta de sello transfieren su configuración al estado del lacre;
- las aperturas compatibles siguen usando el renderer central y no una implementación aislada.

## Sincronización entre entregables

Se revisó el flujo `stationery -> opening-coordination -> themeDescriptor`.

- Sobre personalizable activo + personalizado + sincronización activa: autoridad completa del sobre.
- Otras entradas: sólo coordinación declarada (`accent-harmony`) o plantilla intacta (`template`).
- Sin apertura: plantilla intacta.
- QR: consume la paleta efectiva del servidor.
- Portal de fotos: consume descriptor temático efectivo.
- Impresión física: consume el mismo descriptor efectivo.

El cambio de apertura no borra la papelería guardada, pero corta su autoridad global hasta volver a activar el sobre personalizable.

## Roles y perfiles

La base de datos define roles técnicos `owner`, `developer` y `client`. “Cortesía”, “gratuito” y “pago” son estados comerciales/derechos, no valores adicionales de la columna `role`.

La puerta del estudio se validó con esa semántica:

- owner/superadmin: puede aplicar aunque `templates` no se presente como concesión;
- developer: puede aplicar;
- client con `templates.allowed=true`: puede aplicar (incluye un anfitrión de pago o una cortesía con concesión explícita);
- client con `templates.allowed=false`: consulta, sin aplicar.

El servidor mantiene además la defensa `TEMPLATES_REQUIRED`; deshabilitar el botón en cliente no sustituye esa verificación.

## Hardcode revisado

- No hay colores hexadecimales de seis dígitos dentro de `stationery-engine.js`.
- Los recursos visuales obtienen color de `stationeryState`/catálogo.
- Límites del lacre y papelería proceden de catálogos.
- Ruta/label del editor y políticas de apertura proceden de `experiences.json`.
- Los endpoints continúan como contrato configurable de la vista.
- Los IDs DOM se mantienen sólo como contratos estructurales.

## Elementos deliberadamente no modificados

- Mecánicas independientes de partículas, flores, pergamino, gaceta, gala, aurora, constelación y reserva.
- Integración Onfalós de pergamino aprobada en RC27.
- Compatibilidad histórica de alias de sobres retirados.
- Seguridad/comercio fuera del alcance del cambio visual.

## Riesgos residuales

La suite completa dependiente del servidor/SQLite requiere instalar dependencias npm nativas. En este entorno `npm ci` no pudo completarse y `bcryptjs`/`better-sqlite3` quedaron ausentes; por ello esos contratos no se declaran ejecutados en RC29. Los contratos estáticos, de coordinación, visuales y de rendimiento específicos de RC29 sí se ejecutaron y se documentan por separado.
