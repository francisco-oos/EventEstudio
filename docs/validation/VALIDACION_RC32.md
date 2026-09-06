# Validación RC32 — EventStudio Design Engine

## Resultado

Candidato preparado para validación física local del usuario antes de promoción a producción.

## Contratos validados

1. Recipe v2 separa diseño de datos reales.
2. Servicios se filtran por entitlements sin destruir la Recipe fuente.
3. AssetManifest entrega sólo assets utilizados.
4. Posicionamiento de assets soporta X/Y, escala, rotación, capa, opacidad, tono y movimiento.
5. Miniatura reactiva se regenera desde la Recipe.
6. Color Studio genera armonías y valida contraste.
7. Stationery conserva autoridad cromática coordinada.
8. Música conserva reproducción funcional si existe pista y permiso.
9. Texturas, foto, motion timeline y opening forman parte de la presentación controlada por Recipe.
10. Las 64 Recipes renderizan en móvil y escritorio sin overflow.

## Evidencia automática

- `docs/validation/evidence/RC32_RECIPE_VISUAL.json`
- evidencia legacy existente generada por `tests/visual-acceptance.py`
- evidencia RC30 generada por `tests/rc30-public-envelope-visual.py`

## Pruebas nuevas

- `node tests/rc31-design-engine.js`
- `node tests/rc32-design-system.js`
- `python3 tests/rc32-design-lab-visual.py`
- `python3 tests/rc32-recipe-visual.py`
- `python3 tests/rc32-public-interactions.py`

## Validación física recomendada antes de producción

1. instalar dependencias con `npm ci`;
2. ejecutar `npm test`;
3. ejecutar `npm run test:visual`;
4. ejecutar `npm run test:rc32`;
5. iniciar en local y abrir Design Lab;
6. seleccionar varias Recipes y modificar assets;
7. validar música con un archivo real y, si se usa, Spotify;
8. validar la invitación pública en teléfono físico;
9. probar RSVP con una lista real reimportada;
10. promover a producción sólo después de esa revisión.
