# V6.14.2 RC26 · Sello unificado y sincronización de aperturas

## Objetivo
Homogeneizar las aperturas que usan sello, reutilizar el mismo sello dinámico en la invitación final cuando aplique y reducir ruido visual en el panel administrativo.

## Cambios aplicados
- El sello de cera del administrador ahora sólo aparece cuando la apertura seleccionada es compatible.
- El panel muestra primero una miniatura viva del sello y deja los campos rápidos dentro de un bloque plegable.
- La invitación pública reutiliza el sello dinámico al finalizar cuando la apertura o la plantilla lo requieren.
- La apertura `particle-heart` ahora reutiliza el renderer de sello para mostrar la fecha dentro del sello.
- Se elevó el `z-index` de la tarjeta durante la apertura para evitar parpadeos o desapariciones breves en aperturas derivadas del sobre base.
- En `vintage-parchment` se acercaron los tiempos de bordes y papel para que el despliegue se perciba como una sola acción.

## Razonamiento
1. El sello ya cuenta con un renderer y catálogo más ricos que las variantes antiguas; por ello se reutiliza como fuente de verdad visual.
2. La desaparición momentánea de tarjeta en varias aperturas derivadas era consistente con conflictos de apilamiento durante la transición.
3. El panel administrativo tenía demasiados controles visibles incluso cuando la apertura activa nunca iba a usar sello.

## Descartes
- No se sustituyó todavía todo el sistema por un único editor de sobres porque eso requiere migrar más configuraciones existentes y rehacer pruebas de regresión más amplias.
- No se eliminaron aperturas existentes para mantener compatibilidad con eventos y enlaces ya generados.
