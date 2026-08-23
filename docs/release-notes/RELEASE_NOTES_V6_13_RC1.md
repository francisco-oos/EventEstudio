# EventStudio 6.13.0 RC1

## Plano exportable

- El módulo `Plano y mesas` puede exportar la vista planeada o la vista confirmada desde el mismo selector de simulación.
- La primera página conserva las proporciones del salón, áreas, mesas, ocupación, capacidad y familias visibles.
- Las páginas siguientes incluyen la distribución de personas por mesa y una sección separada para quienes todavía no tienen mesa.
- Si el plano tiene cambios sin guardar, la interfaz solicita guardarlos antes de exportar para evitar que el PDF y la pantalla sean diferentes.

## Plantillas nuevas

- `Lavanda couture`: retrato protagonista, transparencias lilas y entrada suave.
- `Votos cinematográficos`: fotografía completa, contraste oscuro y detalles oro.
- `Sobre y sello`: composición de papel, marco clásico y sello de cera animado.
- `Recorrido botánico`: presentación vertical, hojas y tarjetas ligeras.

Las cuatro plantillas reutilizan nombres, fecha, fotografías, lugares, programa, galería, confirmación y demás datos del evento activo. Las animaciones respetan la preferencia del dispositivo para reducir movimiento.

## Verificación

`npm test` genera y valida los PDF planeado y confirmado, comprueba página Carta horizontal y fuentes incrustadas, y confirma la disponibilidad de las cuatro plantillas.

Resultado esperado: `✓ Pruebas funcionales 6.13.0-rc.1 completadas`.
