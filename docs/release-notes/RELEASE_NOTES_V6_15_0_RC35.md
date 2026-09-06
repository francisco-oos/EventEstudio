# EventStudio 6.15.0-rc.35

## Cambios principales
- Design Lab y Stationery pasan a un único flujo visual denominado Design Studio.
- El editor avanzado de sobre/lacre se monta dentro del mismo workspace; no abre otra pestaña.
- Administración dirige `Sobre personalizable` a `design-lab.html?open=stationery`.
- Stationery conserva su motor estabilizado y comunica aplicar/cerrar al contenedor.
- Servidor sincroniza cambios de `presentation` hacia `designRecipe.design` para evitar dos autoridades persistidas.
- Nuevo `design-color-engine.js` compartido por constructor y renderer público.
- Contraste semántico calculado también en cliente aun si llega una paleta cruda o parcial.
- Hero sin imagen fuerza superficie legible; hero con media conserva overlay protegido.
- Se eliminan ejemplos de nombres reales del runtime de producción.
- Se preservan Recipe recommender, AssetManifest, componentes, música, QR, físico/PDF, álbum, entitlements, Color Studio y Stationery de RC34.

## Compatibilidad
- Las 64 Recipes continúan siendo editables.
- Los servicios siguen gobernados por entitlements y no por Recipe.
- La función de música permanece operativa.
- Las aperturas no-Stationery continúan editándose directamente en Recipe.
