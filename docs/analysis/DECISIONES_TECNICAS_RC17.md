# Decisiones técnicas — RC17

## 1. Corrección antes que expansión

Se descartó introducir de golpe las nuevas animaciones y galerías recibidas. RC17 primero estabiliza carga, multimedia, permisos, persistencia comercial y renderers existentes. Una referencia visual sólo se promueve cuando mejora una capacidad concreta sin duplicar motor ni elevar de forma injustificada CPU, red o complejidad.

## 2. Configuración de bootstrap ≠ política runtime

`config/commercial-plans.json`, el catálogo técnico de features y los seeds siguen siendo útiles para crear una instalación nueva. No deben actuar como autoridad cada vez que arranca el servidor. La autoridad operativa es SQLite/Product Studio.

Se corrigieron cuatro puntos que podían revertir decisiones:

- política de publicación;
- composición de planes;
- recomendaciones vacías de perfiles;
- metadatos de producto y demos del Showcase.

Las allowlists de renderer/slot permanecen en código **por seguridad**: la BD puede seleccionar un renderer autorizado, pero no inyectar JavaScript arbitrario.

## 3. No refactor monolítico dentro de una RC correctiva

`public/admin.js`, `src/server.js` y `public/styles.css` son grandes. Dividirlos aportaría mantenibilidad, pero tocar simultáneamente navegación, API, commerce y estilos elevaría el riesgo de regresión. Se documenta como deuda técnica para una rama específica con pruebas comparativas, no se mezcla con RC17.

## 4. Dependencias externas

No se añadió framework de animación, Sass/Compass, galería o uploader nuevo a producción. CSS/Canvas nativo ya cubre las correcciones actuales. TUS/Uppy y Konva siguen siendo laboratorios con gate de beneficio.

## 5. Fuentes técnicas consultadas

- Express — Production best practices: performance and reliability: https://expressjs.com/en/advanced/best-practice-performance/
- Express — Production best practices: security: https://expressjs.com/en/advanced/best-practice-security/
- MDN — Lazy loading: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading
- MDN — `content-visibility`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility
- MDN — image decoding: https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding
- TUS protocol: https://tus.io/protocols/resumable-upload
- Uppy Tus: https://uppy.io/docs/tus/

## 6. Lo rechazado en RC17 y por qué

- **Sass/Compass para galería circular:** una dependencia/toolchain sólo para un efecto; se puede sintetizar nativamente si se aprueba.
- **Todas las fotos en una órbita 3D:** coste DOM/GPU alto; si se usa será sólo para recuerdos destacados.
- **Hover como interacción principal:** no funciona como modelo primario en móvil; cualquier adopción tendrá tap/swipe/focus.
- **Zoom con rotaciones/blur agresivos:** no corresponde al lenguaje elegante general; sólo podría existir en un preset juvenil específico.
- **Cargar todos los renderers al entrar:** contradictorio con la optimización; los efectos deben montar trabajo únicamente cuando están visibles.
