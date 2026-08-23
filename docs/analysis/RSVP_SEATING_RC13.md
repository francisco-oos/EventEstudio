# RSVP y Seating · RC13

## Regla de negocio

EventStudio optimiza información y alertas, pero **no decide quién sustituye a quién**.

El organizador puede configurar una fecha `seatReleaseAt`. Una persona queda como candidata para liberar lugar cuando:

- rechazó RSVP; o
- sigue pendiente después de la fecha configurada.

Una confirmación positiva nunca queda como candidata.

## Acción manual

Si la persona tiene asiento asignado, aparece `Liberar lugar`. La acción:

- pide confirmación;
- elimina solamente la asignación de seating;
- preserva RSVP e historial;
- no crea ni asigna otro invitado automáticamente.

El organizador decide posteriormente si agrega/sustituye a otra persona y dónde la sienta.

## Recuperación

Mientras la persona siga existiendo en la lista, su historial permite saber que estuvo invitada. Si confirma dentro del periodo aceptado, el organizador puede volver a asignarla si aún existe capacidad. RC13 deliberadamente no reserva indefinidamente el asiento después de una liberación manual.
