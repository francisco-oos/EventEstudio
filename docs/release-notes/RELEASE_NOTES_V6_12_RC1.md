# EventStudio 6.12.0 RC1

## Cambios funcionales

- El código de invitado es opcional en alta manual y Excel. Se generan códigos locales `FAM-0001`, `FAM-0002`, etc.
- Una mesa escrita al crear, editar o importar una invitación se crea en el plano si todavía no existe, aumenta su capacidad cuando hace falta y asigna los lugares disponibles sin sobrescribir movimientos manuales.
- El plano muestra familias planeadas, ocupación y lugares libres tanto en vista planeada como confirmada.
- La pista de baile se puede eliminar sin que reaparezca. Las áreas aceptan pista, pasillo, escenario, entrada, bar, sanitarios u otra zona, con trazo recto, redondeado o curvo.
- Se puede aplicar una medida uniforme a todas las mesas sin obligar a cambiar su capacidad.
- El RSVP ofrece una regla opcional de lugares totales: por ejemplo, una invitación 2 adultos + 2 niños puede confirmar 3 adultos + 1 niño, pero nunca más de cuatro personas.
- Alergias y necesidades especiales sólo abren campos cuando el invitado marca que aplican.
- El cliente elige entre menú fijo adulto/infantil o distribución de opciones. Frontend y backend exigen que la suma de platillos coincida exactamente con los asistentes.
- El QR impreso puede incluir las familias planeadas para la mesa y mantiene una página independiente por tarjeta para evitar sobreposición en impresión.
- La invitación física 5 × 7 ofrece Arco coordinado, Editorial seda y Marco clásico; todas reutilizan datos, colores, fotografía y enlace del evento activo.
- El propietario puede transferir un evento a un cliente conservando acceso de soporte y asignar planes de cortesía sin crear pagos ficticios.

## Decisiones y límites conscientes

- Los pasillos curvos usan un arco editable dentro de una caja proporcional. Es estable para arrastrar, imprimir y detectar cruces, aunque no sustituye un editor CAD de curvas libres.
- La capacidad por mesa continúa limitada a 30 lugares para prevenir errores accidentales. Grupos mayores deben dividirse en varias mesas.
- La sincronización automática sólo asigna personas todavía sin mesa; no mueve a quienes ya fueron acomodados manualmente.
- Los planes de cortesía quedan en suscripción y auditoría, pero no en la tabla de pagos porque no representan ingresos.

## Verificación

Ejecutar:

```bash
npm ci
npm test
```

Resultado esperado: `✓ Pruebas funcionales 6.12.0-rc.1 completadas`.
