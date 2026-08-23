# EventStudio 6.14.2 RC12

Fecha: 7 de agosto de 2026

RC12 audita la RC11, completa el contrato visual de todas sus plantillas y
convierte las ideas de los videos proporcionados en recursos originales que
pueden habilitarse desde la Store con derechos auditables.

## Cambios principales

- El catálogo pasa de 42 a 48 plantillas. Las nuevas son `destination-passport`,
  `eternal-rose`, `cinematic-journey`, `petal-letter`, `achievement-path` y
  `family-memories`.
- Las 12 plantillas históricas que dependían de valores implícitos ahora
  declaran layout, movimiento, estilo fotográfico, motivo y experiencia.
- Se corrigió el fallback silencioso de 19 estilos fotográficos: cada valor
  del catálogo ahora es reconocido por el cliente y tiene comportamiento CSS.
- Se añadieron dos productos contextuales: `experience:rose-bloom` y
  `experience:cinematic-depth`.
- El servidor rechaza seleccionar una experiencia no adquirida y degrada la
  publicación a un estilo base si el derecho vence o se revoca.
- Los planes Trial, Premium y Studio incluyen las nuevas experiencias como
  corresponde a su declaración de catálogo completo.
- La Store incorpora la categoría Animaciones en español, inglés y portugués.
- Muestra, catálogo, vista previa administrativa e impresión reciben los
  metadatos de las nuevas plantillas.
- Se amplió la regresión comercial para probar activación, compra, cortesía,
  revocación y degradación pública.

## Compatibilidad

- No cambia el formato de `settings_json` ni se elimina información existente.
- Se conservan las tablas y tipos de producto de RC11; las experiencias usan el
  tipo `bundle` para evitar una migración destructiva del `CHECK` de SQLite.
- Las configuraciones desconocidas siguen normalizándose a valores seguros.
- `prefers-reduced-motion` elimina animaciones y transiciones de las nuevas
  experiencias.

## Referencias

La justificación, procedencia y alcance de cada cambio están en
`docs/MATRIZ_TRAZABILIDAD_RC12.md`. El estudio de los videos y sistemas
comparables está en `docs/ANALISIS_REFERENCIAS_Y_COMPETENCIA_RC12.md`.
