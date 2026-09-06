# EventStudio 6.15.0-rc.34

## Cambios principales
- `Apertura y experiencia` pasa de mini-editor independiente a recomendador/override de Recipes.
- Se elimina `Guardar entrada`; `Probar apertura` permanece.
- Recipes se ordenan por afinidad con la apertura seleccionada.
- Al aplicar una Recipe se persisten conjuntamente apertura, recorrido, movimiento, estilo de álbum y colores de experiencia.
- Stationery avanzado aparece únicamente para aperturas que declaran editor de sobre.
- Protección API contra aplicar Recipes comerciales sin derecho; preview continúa permitido.
- Contraste semántico derivado de cada paleta para fondos/papeles/acentos.
- Recipe palette pasa a ser base cromática real antes de overrides y Stationery.
- Ajuste de nombres por ancho real; no se parten apellidos o nombres dentro de una palabra.
- Se preservan AssetManifest, Components, Recipes, música, QR, físico/PDF, álbum y entitlement resolver de RC33.
