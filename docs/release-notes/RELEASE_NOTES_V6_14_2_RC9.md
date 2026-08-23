# EventStudio 6.14.2 RC9

## Objetivo

RC9 audita y estabiliza la combinación entre las 42 plantillas digitales, las
invitaciones físicas y los ocho formatos QR. Mantiene el esquema SQLite
`614204`; no requiere una migración destructiva ni modifica los datos de un
evento existente.

## Correcciones

- Las 42 plantillas usan en impresión la misma paleta que su presentación web.
  Se eliminó el mapa cromático duplicado que sólo reconocía 21 temas.
- El control `Usar colores de la invitación` ahora se respeta en el PDF QR y ya
  no cambia por accidente la invitación física.
- La vista previa de mesa acepta cualquier tema del catálogo, no sólo cinco
  diseños antiguos.
- `Marco con fotografía`, `Mesa + álbum` y `Doble cara premium` tienen
  composiciones impresas propias.
- Las familias de impresión se calculan desde los metadatos vigentes del tema.
  Se eliminaron referencias a temas inexistentes.
- Los IDs y textos de impresión se normalizan y limitan antes de guardarse.
- Los nombres de mesa recibidos por las rutas QR se limitan a 120 caracteres.
- Los PNG y JPEG se inspeccionan estructuralmente. Una imagen truncada o con
  datos comprimidos dañados se rechaza antes de persistirse.
- Los PDF se completan antes de responder, evitando descargas parciales.
- Se retiraron estilos de búsqueda Spotify y la autorización de red hacia
  `api.spotify.com`; pegar un enlace oficial, usar el iFrame y subir audio
  continúan disponibles.

## Estructura y mantenibilidad

- `src/theme-design.js` concentra validación cromática, selección de temas y
  familias de impresión.
- `src/media-validation.js` aísla la validación segura de PNG/JPEG.
- Una plantilla sin variables CSS completas bloquea el arranque y las pruebas,
  en lugar de heredar silenciosamente el diseño de otra.
- Se conservan la arquitectura Node.js/Express/SQLite y los módulos ya
  validados de invitados, RSVP, álbum, mensajería, respaldo y restauración.

## Cobertura nueva

- 42 paletas web/impresión validadas.
- 42 invitaciones físicas automáticas generadas.
- 336 combinaciones de tema y formato QR generadas.
- 49 PDF representativos decodificados desde su render PNG, incluida cada cara
  de la tarjeta plegable.
- Portada PNG real usada en impresión.
- PNG con cabecera válida y contenido corrupto rechazado.
- Configuración de impresión inexistente normalizada a valores seguros.

## Compatibilidad

- Esquema SQLite: `614204`.
- Datos persistentes: `.env`, `data`, `uploads` y `backups`.
- No ejecutar `seed` durante una actualización.
- Mantener una sola réplica mientras la instalación utilice SQLite.
