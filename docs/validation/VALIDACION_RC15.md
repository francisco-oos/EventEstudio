# Validación EventStudio 6.14.2-rc.15

## Puertas ejecutadas en este entorno

- `node --check` para JavaScript de `src/`, `public/`, `tests/` y `scripts/`.
- `tests/project-integrity.js`.
- `tests/source-references.js`.
- `tests/mobile-ui.js`.
- `tests/local-network.js`.
- `tests/rc14-regressions.js`.
- `tests/rc15-regressions.js`.
- Integridad del ZIP final mediante `unzip -t`.

## Casos RC15 cubiertos por prueba estática

- login oculto en móvil;
- carrito responsive y vaciado explícito;
- propiedad/compras/cortesías no recobrables;
- curación de catálogo por perfil;
- Showcase publicado/no-cache;
- renderer Rosa Eterna y duración de preview;
- galería gestual;
- encabezado fijo de preview;
- QR de mesa firmado;
- moderación/exportación de fotos;
- fallback de ubicación para invitación física;
- analítica humanizada/campañas;
- límite de acordeones;
- traducción bidireccional.

## Pruebas manuales obligatorias antes de promoción

1. Cliente en Android: login/logout sin consola fantasma.
2. Plan y extras: `Probar` no altera carrito; `Agregar` sí lo hace; producto adquirido no se cobra de nuevo.
3. Modal preview: teléfono/escritorio/cerrar siempre visibles en portrait y landscape.
4. Rosa Eterna: tallo → hojas → pétalos → caída de pétalos y entrada posterior a la invitación.
5. Galería: swipe izquierda/derecha con 3+ fotos; lightbox independiente.
6. QR de dos mesas diferentes: cada foto debe conservar la mesa origen correcta.
7. Moderación: pendiente → aprobada → no aprobada → pendiente; exportar sólo aprobadas.
8. Invitación física: evento con `venues.ceremony` y sin `settings.venue` debe imprimir el lugar real.
9. Perfil `curated` sin productos: no debe ofrecer productos nuevos; derechos previamente adquiridos deben conservarse.
10. Showcase: cambiar publicado→oculto y verificar otra pestaña/dispositivo sin caché.
11. ES→EN→PT→ES y navegación por módulos.

## Limitación del entorno

Se intentó `npm ci --ignore-scripts` y el mirror npm disponible en este entorno respondió **404** para `zip-stream@7.0.5` (`packages.applied-caas-gateway1.internal.api.openai.org`). La instalación se detuvo antes de ejecutar EventStudio. Por tanto, las pruebas que cargan `better-sqlite3`/Express no pudieron ejecutarse aquí y deben repetirse en un entorno con registro npm normal. Este bloqueo de infraestructura no se registra como prueba funcional aprobada ni como regresión de EventStudio.
