# EventStudio 6.16.0-rc.40 — Experiencia dominante, portada reutilizable y Assets ampliados

Estado: **candidata QA avanzada; no promover sin gate local de servidor**.

## Cambios principales

- Apertura/Recorrido/Movimiento/Álbum del panel gobiernan todas las Recipes predefinidas al previsualizar, editar y aplicar; cambiar de Recipe dentro del Estudio también preserva esa experiencia.
- Si `Sobre personalizable` está seleccionado, todas las Recipes usan sobre, conservando paleta/textura/composición propia.
- El sobre forzado desde una Recipe sincroniza Stationery/lacre con esa Recipe y no reutiliza ciegamente un sobre histórico.
- La portada del evento puede mostrarse como fondo, foto izquierda o foto derecha; se reutiliza la misma `media.heroImage`.
- Portada diferida mientras la apertura está visible para evitar doble render/flash.
- `app.js` deja de duplicar el trabajo del Design Engine sobre la portada.
- Biblioteca, lienzo e inspector tienen scroll independiente en escritorio; seguimiento de bloque mueve sólo el lienzo.
- 12 nuevos Assets estáticos auditados de Gemini; catálogo total: 31 Assets. Tres SVG SMIL quedan en cuarentena.
- Miniaturas de Assets colorizables usan la misma representación de máscara que el elemento insertado.
- Se preservan datos reales de programa, ubicación, vestimenta, galería y música; medios locales ausentes no se vuelven a solicitar una vez marcados por `_mediaHealth`.
- Cache-busting actualizado a `6.16.0-rc.40`.

## Hallazgo de la BD entregada

El evento 2 conserva una referencia de portada a:

`/uploads/site-media/1788559447969-4e6cf0d9-photo_4945297427510529162_y.jpg`

pero ese archivo no está presente en el ZIP recibido. No se inventó ni sustituyó por una foto de galería. El sistema lo trata como media ausente sin generar una tormenta de 404; al volver a cargar una portada real desde el panel/Estudio, el renderer RC40 la reutiliza.

## QA ejecutada

- 65 Recipes y 31 Assets: catálogo válido.
- 175,500 combinaciones lógicas de presentación y 1,300 proyecciones rol/perfil: PASS.
- 139 controles/botones: wiring PASS.
- 130 renders de Recipes móvil/escritorio: 0 fallos/overflow.
- 130 casos de legibilidad: 0 fallos.
- 65 previews del catálogo sin foto: 0 fallos; heading mínimo ~11.34:1, body mínimo ~4.74:1.
- RC40 portada split izquierda/derecha, móvil, defer y scroll independiente: 5/5 PASS.
- Responsive focal 320/390/1366: 9/9 PASS.
- Feature visibility: 32 casos PASS; contenido largo: 64 casos PASS; álbum: 2 casos PASS.
- Aperturas/skip, música, links, idioma, galería/lightbox, RSVP: PASS en harness Chromium.
- Stationery público/Estudio: PASS; FPS ~60 en harness disponible.
- DB: `quick_check=ok`; 4 usuarios, 2 eventos; 5 refs locales presentes y 1 portada ausente identificada.

## Limitación de entorno

`npm ci --offline` falla por paquetes no presentes en caché (`zip-stream`), por lo que el E2E que necesita Express/better-sqlite3/bcryptjs continúa `BLOCKED_ENV`. `test:v5` se bloquea al requerir `bcryptjs`; no se marca PASS.
