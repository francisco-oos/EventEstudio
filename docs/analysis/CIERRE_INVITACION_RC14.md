# Experiencia de cierre de invitación — decisión futura

## Idea aprobada
EventStudio podrá ofrecer `opening experience` y `closing experience` como slots independientes. Ejemplo: una apertura de sobre que extrae la tarjeta y un cierre que vuelve a guardarla.

## Motivo de no activarlo todavía al guardar RSVP
Confirmar asistencia no implica necesariamente que el invitado haya terminado: puede querer revisar mapa, programa, regalos, fotografías o compartir la invitación. Un cierre automático inmediato puede convertir un plus visual en fricción.

## Modelo propuesto
- `closing:none`
- `closing:explicit` — botón “Cerrar invitación”.
- `closing:after-rsvp` — opcional, con demora/configuración del propietario/plantilla.
- `closing:on-exit-intent` sólo si puede implementarse sin comportamientos invasivos.

Un renderer podrá declarar una variante inversa de una apertura (`reverseOf`) o una escena propia. Debe respetar `prefers-reduced-motion`, permitir omitir y no bloquear funciones de negocio.
