# ADR RC27: motor unificado de papelería y tokens de evento

Estado: aceptado  
Fecha: 3 de septiembre de 2026

## Contexto

RC26 tenía varias aperturas que repetían la misma estructura de sobre y una vista independiente para configurar el lacre. El prototipo RC28 aportó un generador combinable de formato, material, paleta, liner, overlay, estampilla, marco, divisor y sello. Integrarlo literalmente habría duplicado datos del evento, estilos del panel y persistencia.

## Decisión

1. `config/stationery.json` es el catálogo estable de opciones, recetas y alias históricos.
2. `src/stationery-config.js` valida y normaliza la configuración en servidor; `public/stationery-engine.js` aplica el mismo contrato en la vista previa y la invitación.
3. Los nombres, fecha, monograma y tipografía se reciben como contexto del evento. No se almacenan copias en `stationery`.
4. El panel integra los controles del lacre dentro del editor de papelería. `Aplicar a la invitación` envía `presentation`, `stationery` y `seal` en un único `PUT /api/admin/settings`.
5. El servidor guarda un único JSON de configuración en la réplica SQLite existente. No se crea tabla, base ni archivo de datos paralelo.
6. La prioridad cromática es:
   - papelería personalizada con sincronización activa;
   - kit de diseño manual;
   - valores de la plantilla.
7. La paleta resultante pasa por `ensureAccessiblePalette` antes de llegar a web, álbum de invitados, QR y PDF.
8. Desactivar la sincronización no borra la receta del sobre; únicamente permite que los módulos secundarios conserven la plantilla.
9. Los IDs históricos de sobre se migran de forma perezosa mediante alias. La lectura no modifica producción.
10. `vintage-parchment` conserva su mecánica y usa el SVG `varilla_onfalos_elegante.svg`; varillas y lienzo comparten duración, retardo y easing.

## Alternativas evaluadas

### Reemplazar todas las aperturas por sobres

Rechazada. Habría eliminado mecánicas diferenciadas y productos visuales ya aprobados: partículas, flores, pergamino, gaceta, órbitas, velos, telón y descorche.

### Mantener un editor de lacre separado

Rechazada. Creaba dos puntos de guardado, sincronización por `localStorage` y riesgo de que el sobre mostrara un estado distinto al panel.

### Copiar la paleta del sobre al `designKit`

Rechazada. Al desactivar la personalización se perdería la capacidad de volver intactamente a la plantilla. La configuración de papelería se conserva separada y `themeDescriptor` calcula la salida efectiva.

### Migración masiva de datos al desplegar

Rechazada. No aporta valor funcional y aumenta el riesgo sobre `settings_json`. La traducción por alias es determinista y sólo se persiste cuando el usuario confirma.

### Animar el pergamino mediante `top` y `height`

Rechazada. Produce relayout durante cada fotograma. Se eligió `translate3d` y `scaleY`, con `will-change: transform` limitado a las piezas animadas.

## Código descartado

- `public/seal-studio.html`
- `public/seal-studio.js`
- `public/seal-studio.css`
- evento `eventstudio:seal-applied` y su sincronización entre ventanas
- botón de guardado independiente del estilo de apertura
- mapa de materiales duplicado dentro del renderizador de lacre
- temporizaciones de las ocho aperturas de sobre retiradas

## Consecuencias

El editor tiene una sola confirmación y una fuente de verdad. Las plantillas existentes conservan el lacre porque `sealDefinitionForOpening` continúa alimentando los hosts compatibles; `particle-heart` sustituye sólo el contenido central por día, mes y año. Los selectores CSS históricos quedan inertes durante la ventana de compatibilidad de caché y podrán eliminarse en una versión posterior sin afectar datos persistidos.

