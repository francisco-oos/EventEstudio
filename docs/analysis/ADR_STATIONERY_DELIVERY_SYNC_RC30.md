# ADR RC30 — Autoridad visual del Sobre Personalizable

Fecha: 2 de septiembre de 2026
Estado: aceptado

## Contexto

RC29 separó correctamente el Estudio Avanzado del panel y recuperó la estructura del generador maestro. La validación manual posterior detectó tres regresiones de integración en la invitación pública:

1. el texto de acción `Abrir invitación` sustituía el nombre renderizado dentro de algunas tarjetas del sobre;
2. la paleta aplicada en el Estudio Avanzado podía quedar almacenada sin gobernar la plantilla pública y los demás entregables porque la sincronización seguía siendo opcional;
3. una plantilla con cierre visual propio podía mostrar simultáneamente su sello histórico y el lacre generado centralmente.

La expectativa funcional es diferente para dos familias de apertura:

- `unified-envelope`: la personalización es una decisión de identidad visual del evento y debe gobernar los entregables;
- cualquier otra apertura: su color pertenece a la mecánica de entrada y no debe reescribir la paleta propia de la plantilla.

## Causa raíz

### Nombre de la tarjeta

`public/app.js` actualizaba el CTA mediante `openingButton.querySelector('strong')`. Después de integrar el renderer unificado, el primer `strong` descendiente del botón ya no era necesariamente el CTA: podía ser `.names-display` dentro de la tarjeta. La actualización del botón terminaba escribiendo `Abrir invitación` sobre el nombre.

### Sincronización incompleta

La autoridad de papelería dependía de `stationery.syncDesignTokens === true`. Esto permitía guardar una papelería personalizada y, al mismo tiempo, mantener el diseño base de los entregables. El resultado era válido para el contrato anterior, pero contradice la semántica actual de `Aplicar a la invitación`.

### Doble lacre

`theme-storybook-seal` conserva un sello histórico implementado como pseudo-elemento `hero-content:after`. El motor central añadió `#heroWaxSeal` sin retirar ese pseudo-elemento, generando dos cierres visuales.

### Colores de plantilla

Varias reglas específicas de tema repetían colores literales ya definidos por sus variables `--bg`, `--paper`, `--ink`, `--muted`, `--accent`, `--gold` y `--line`. La API podía entregar una `_palette` correcta, pero algunas zonas de la plantilla seguían consumiendo el literal original.

## Decisión

### 1. CTA con destino explícito

El texto de acción tiene un nodo propio `#openingActionLabel`. El código público actualiza únicamente ese nodo. No se realizan búsquedas posicionales por tipo de elemento dentro de un componente complejo.

### 2. Autoridad automática del sobre

Cuando `presentation.openingStyle === "unified-envelope"` y `stationery.customized === true`, la papelería es autoritativa sin un segundo interruptor. `normalizeStationery()` fuerza `syncDesignTokens=true` en ese estado por compatibilidad de datos y trazabilidad.

Los tokens autoritativos son:

| Papelería | Token de entrega |
| --- | --- |
| `outerColor` | `--bg` |
| `cardColor` | `--paper` |
| `textColor` | `--ink` |
| `innerColor` | `--muted`, `--line` |
| `sealColor` | `--accent` |
| `ornamentColor` | `--gold` |

La paleta efectiva continúa pasando por el control de contraste del servidor antes de publicarse.

### 3. Otras aperturas conservan la plantilla

Las aperturas visibles distintas de `unified-envelope` usan política `coordination.mode = "template"`. No consumen una papelería guardada anteriormente y no cambian la paleta de landing, portal de fotos, QR o impresión. Sus colores de animación continúan siendo locales a la propia entrada.

### 4. Un solo lacre por ubicación semántica

Cuando el motor central inserta un lacre final, `heroContent` recibe `has-template-seal`. Las representaciones históricas del mismo cierre se desactivan en ese estado; el lacre central ocupa la ubicación visual de la plantilla en vez de añadirse como un elemento adicional.

### 5. Variables de tema como única capa cromática

Los colores por defecto siguen declarados en el bloque base de cada uno de los 64 temas. Las reglas visuales de ese mismo tema consumen las variables, no vuelven a fijar el hexadecimal. Esto mantiene exactamente la apariencia por defecto y permite que `_palette` reconfigure el tema de forma atómica.

### 6. QR e impresión

Si el sobre es autoritativo, el QR usa obligatoriamente la paleta efectiva de la invitación aunque una preferencia histórica de QR hubiera solicitado colores neutros. La impresión física utiliza `themeDescriptor(settings).palette`, la misma resolución que la landing. El portal de fotos consume `_palette` proporcionada por la configuración pública.

## Alternativas descartadas

### Mantener el interruptor de sincronización

Descartado porque permite un estado ambiguo: el usuario pulsa `Aplicar a la invitación`, pero la invitación no representa lo aplicado.

### Copiar colores del sobre directamente a cada plantilla

Descartado porque multiplicaría condiciones por tema y produciría hardcode. Se mantiene una capa de tokens compartida.

### Ocultar siempre el sello histórico

Descartado porque una plantilla puede necesitar su cierre propio si no existe un lacre central aplicable. La sustitución depende de `has-template-seal`.

### Armonizar todas las aperturas con la papelería

Descartado porque una apertura independiente no debe heredar una selección de sobre que ya no está activa. Esto también garantiza reversibilidad al cambiar de `Sobre personalizable` a otra entrada.

## Consecuencias

- `Aplicar a la invitación` en el Estudio Avanzado tiene una semántica inequívoca.
- Cambiar a otra apertura restaura la identidad cromática propia de la plantilla sin borrar la papelería guardada.
- Landing, fotos, QR e impresión comparten una resolución de paleta cuando el sobre está activo.
- Las 64 plantillas mantienen sus defaults porque las variables base no fueron modificadas.
- El CTA y el nombre dejan de depender del orden interno de etiquetas HTML.
- El lacre central sustituye representaciones equivalentes en lugar de duplicarlas.
