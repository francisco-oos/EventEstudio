# Animaciones: galería y Rosa Eterna — RC15

## Rosa Eterna

Fuente de inspiración entregada por el propietario: HTML/CSS/JS de una rosa 3D con secuencia tallo → hojas → sépalos/pétalos → caída de pétalos. También se revisó la demostración pública de Anurag Dhakal (https://anuragdhakal.com.np/source-codes/animated-rose-coded-for-you).

### Decisión

No incorporar el proyecto como dependencia. Se sintetizó un renderer EventStudio propio (`RoseBloomScene`) para conservar control de duración, accesibilidad, responsive, datos del evento y lifecycle `start/bloom/destroy`.

### Cambios frente a RC14

- RC14 mostraba una aproximación abstracta que no reproducía la floración.
- RC15 crea tallo, hojas, sépalos y siete capas de pétalos por DOM/CSS.
- En preview la floración empieza automáticamente tras un breve margen y permanece el tiempo suficiente para evaluarla.
- En invitación normal, la acción del usuario inicia la floración y permite volver a pulsar para entrar antes; también existe apertura automática tras la secuencia.
- `prefers-reduced-motion` muestra inmediatamente el estado florecido.

## Galería de tarjetas

### Problema

El modo móvil de `cinematic-depth` caía a un grid 2×N y perdía la sensación de tarjetas. Los controles de flecha no eran la interacción natural en pantalla táctil.

### Decisión

- Swipe horizontal mediante Pointer Events.
- Mantener flechas sólo como alternativa accesible/desktop.
- En móvil, tarjeta protagonista + dos tarjetas de profundidad.
- `object-fit: cover` dentro de un marco consistente para evitar deformación.
- Lightbox conserva `object-fit: contain` para ver la fotografía completa.
