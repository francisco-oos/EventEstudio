# Validación RC26 — Aplicación del sello al evento

Criterios verificables:

1. El Studio no inicia con iniciales ficticias J/A.
2. Si se abre desde Administración, recibe el `eventId`, carga el sello existente, nombre y paleta del evento.
3. `Aplicar este sello a mi evento` envía todas las propiedades avanzadas a `PUT /api/admin/settings`.
4. El servidor normaliza el payload mediante `normalizeSeal`.
5. El diseño aplicado queda `enabled=true` y `customized=true`.
6. Las aperturas no sustituyen ornamentación/material de un sello personalizado.
7. El panel normal conserva propiedades avanzadas al guardar cambios rápidos mediante spread de `settings.seal`.
8. La configuración pública incluye `settings.seal`, por lo que el renderer de la invitación consume el diseño persistido.
