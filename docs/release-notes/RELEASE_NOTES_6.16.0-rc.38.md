# EventStudio 6.16.0-rc.38 — Design Studio hardening

Estado: **candidata QA**.

## Qué corrige

- recuperación del conflicto de revisión `409` al guardar/aplicar;
- preview interno sin dependencia de `/api/admin/preview-links` y su `401` reportado;
- preview de catálogo renderizando la Recipe solicitada, no siempre la ACTIVE;
- Apply directo desde el modal de vista previa del catálogo;
- sugerencias de búsqueda desde la primera escritura y navegación por teclado;
- topbar del Estudio compacta con acciones secundarias agrupadas;
- color por bloque con selector visual/HEX, reset a tono y aviso de contraste;
- 14 familias de título y 9 de texto usando fallbacks locales;
- apertura/color de flor sincronizados al preview DRAFT;
- copy de apertura, fecha y countdown contenidos en viewports estrechos;
- panel “Apertura animada” con layout estable;
- scroll automático del lienzo al bloque que se está editando;
- canvas con portada, hasta 8 fotos reales y estado de música;
- portada diferida durante la apertura y posibilidad de desactivarla por Recipe;
- PDF/QR/invitación física respetan la visibilidad real de portada;
- `favicon.ico` local;
- botones de Stationery renombrados a “Volver al Estudio de diseño”.

## Rendimiento

El selector de color de apertura ya no regenera toda la biblioteca por cada pixel del arrastre. Búsquedas y refresh de preview usan debounce. La portada se descarga al abrir la invitación, no detrás de la animación, y galería/música/vestimenta no se montan si están ocultas.

## Validación ejecutada

- 65 Recipes auditadas;
- 130 renders Recipe, 0 overflow;
- 22 aperturas en Chromium, 0 fallos, CLS 0, FPS min ~57.7;
- 175,500 combinaciones de presentación;
- 1,300 proyecciones de rol/perfil;
- 139 botones/controles con wiring;
- 30 casos de matriz de dispositivos;
- 64 casos de contenido largo;
- 9 casos responsive focales RC38;
- Stationery y álbum visual PASS;
- `wedding.db` quick_check PASS.

## Límite de esta ejecución

El entorno no pudo descargar dependencias npm (`registry.npmjs.org` sin resolución DNS), por lo que el E2E real de servidor/SQLite/upload/seguridad se mantiene como gate obligatorio en el equipo QA. No se infiere PASS para lo no ejecutado.
