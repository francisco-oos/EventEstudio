# EventStudio 6.14.2-rc.26

## Seal Studio
- Añade **Aplicar este sello a mi evento** como acción principal del editor avanzado.
- El Studio recibe el evento activo, carga `settings.seal`, nombre y paleta real.
- Persiste todas las propiedades avanzadas en `settings.seal` a través de `PUT /api/admin/settings`.
- El servidor conserva normalización y autorización; no se introduce una ruta paralela de escritura.
- Los sellos aplicados quedan `enabled=true` y `customized=true`.
- Las recomendaciones de una apertura sólo completan sellos no personalizados.
- El panel rápido mantiene las propiedades avanzadas no visibles al guardar cambios básicos.

## QA
- `tests/rc26-seal-studio.js`: PASS.
- Integridad, referencias, móvil, animaciones, RC21, RC22, RC24 y RC25: PASS en el runner disponible.
- Matriz visual general: 128 casos de plantillas sin fallos, 21 aperturas sin fallos, CLS máximo 0 y aproximadamente 60 FPS.
- Matriz de las cinco plantillas nuevas: 30/30 combinaciones sin overflow.

La suite dependiente de módulos nativos continúa sujeta a un runner con `node_modules` completos.
