# EventStudio 6.12.1 RC1

## Corrección del plano de mesas

- Las mesas ahora aceptan entre 6% y 70% de ancho o alto tanto en el editor como en el servidor. Antes, el editor permitía 70% pero el servidor rechazaba más de 45%, provocando un error 400 y la pérdida aparente del cambio.
- El control de medida uniforme también admite hasta 70%.
- El guardado redondea posiciones y medidas a dos decimales y tolera diferencias visuales menores a 0.25 puntos porcentuales, sin permitir cruces reales.
- El módulo muestra “Guardando”, confirmación de éxito o el motivo exacto del rechazo junto al plano; un error conserva la edición para poder corregirla.
- La advertencia de cruces identifica por nombre los dos elementos involucrados.

## Verificación

La prueba funcional guarda una mesa rectangular de 8% × 70%, vuelve a consultarla y comprueba que el alto 70% permaneció en la base de datos.

Resultado esperado: `✓ Pruebas funcionales 6.12.1-rc.1 completadas`.
