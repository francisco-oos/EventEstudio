# Auditoría técnica RC33 — Design Ecosystem

## Alcance

Revisión del candidato `6.15.0-rc.33` contra el objetivo acordado: sustituir el crecimiento por plantillas estáticas mediante Assets + Components + Recipes, conservar servicios reales, sincronizar color/tipografía/presentación entre canales y validar interacción/responsive antes de prueba física.

## Inventario

- 64 Design Recipes v2.
- 17 Assets iniciales aprobados.
- 12 componentes funcionales.
- 103 skins/variantes de sección.
- 34 presentaciones fotográficas.
- 16 motion timelines.
- 12 frames QR.
- 8 layouts físicos catalogados.
- 10 armonías de Color Studio.

## Cambios RC33

### Zero-hardcode y tokens

- Recipe conserva defaults de catálogo y admite override persistente.
- Color Studio edita fondo, papel, tinta, secundario, acento principal, acento secundario, dorado y línea.
- tipografía, escala, casing, layout, textura, motion y foto son decisiones de Recipe.

### Multicanal

- QR raster toma la paleta efectiva y selecciona tinta con contraste suficiente.
- tarjetas QR y QR por mesa usan la misma paleta efectiva.
- PDF físico usa paleta, tipografía y Assets de Recipe.
- álbum colaborativo hereda paleta, tipografía, textura, layout y Assets públicos.
- Stationery personalizado conserva autoridad global cuando corresponde.

### Feature lifecycle

La proyección pública elimina componentes no autorizados antes del render. La Recipe privada permanece intacta.

### Música

Se preservó archivo/Spotify y el control real de reproducción. Recipe sólo aplica skin/visibilidad permitida.

### Responsive

Se validaron layouts representativos con textos deliberadamente largos desde 320×568 hasta 3840×2160. No se detectó overflow ni colisión entre controles de música/idioma.

### Lacre y física

- la solapa usa curva de desaceleración revisada;
- tarjeta conserva una curva independiente de salida;
- lacre incorpora gradiente de brillo, highlight, relieve difuso/especular y textura procedural;
- QA visual mantiene aproximadamente 60 FPS.

### Landing

Landing Recipe-first con preview interactivo, lacre configurable, búsqueda/filtros y CTA above-the-fold.

## Regresiones corregidas durante RC32/RC33

- `currentTarget` inválido durante drag prolongado;
- overflow móvil en botanical/split/scrapbook;
- superposición música/idioma;
- pointer capture de galería bloqueando clic de mouse;
- harnesses visuales legacy sin `design-engine.js`;
- control de `accent-dark` ausente en override manual;
- álbum colaborativo sin Assets decorativos de Recipe.

## Limitación de infraestructura

El entorno de ejecución no tiene conectividad funcional con `registry.npmjs.org`; `npm ping` expira y no fue posible reconstruir `node_modules`. Por ello, en esta sesión no se ejecutaron los tests que requieren Express, `better-sqlite3`, PDFKit, QRCode y demás dependencias de servidor.

No se declara PASS sobre esos tests mediante mocks. El proyecto conserva `package-lock.json`, CI y `npm run test:preproduction` para ejecutarlos en un entorno con dependencias instalables antes de producción.
