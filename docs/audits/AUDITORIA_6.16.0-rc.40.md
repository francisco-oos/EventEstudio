# Auditoría integral — EventStudio 6.16.0-rc.40

## Hallazgos cerrados

1. **Recipes ignoraban la apertura superior**: corregido con `presentationOverrides` en preview/edit/apply.
2. **Sobre podía conservar identidad anterior**: preview forzado sincroniza Stationery/lacre desde la Recipe actual.
3. **Portada desaprovechada**: la Recipe ahora puede presentarla de fondo, izquierda o derecha sin duplicar el dato.
4. **Flash/doble render de portada**: Design Engine es autoridad; App sólo usa fallback cuando Engine no existe.
5. **Saltos del editor**: seguimiento usa `lab-stage.scrollTo`, no `scrollIntoView` global.
6. **Scroll realmente independiente**: se añadió `min-height:0` a los hijos Grid, requisito que faltaba para que el overflow local funcionara.
7. **Assets Gemini**: 12 estáticos aprobados; 3 SMIL en cuarentena.
8. **Medios borrados**: el renderer consume `_mediaHealth`/filtros y no confunde referencia BD con archivo existente.

## Hallazgo no corregible sin el archivo fuente

La portada `1788559447969-4e6cf0d9-photo_4945297427510529162_y.jpg` no viene en la copia entregada. Sustituirla automáticamente por una foto diferente alteraría datos reales, por lo que se preservó la referencia y se muestra como ausente en el Estudio hasta volver a cargarla.

## Seguridad

No se habilitó shell, eval ni URLs externas en los Assets. Los SVG activos son locales, sin scripts y sin referencias HTTP(S). Los entitlements siguen separando preview/QA de derechos comerciales. El override de owner/developer no concede compras al cliente.

## Rendimiento

- portada no se decodifica dos veces cuando Design Engine está activo;
- portada puede diferirse hasta finalizar la apertura;
- miniaturas/medios ausentes se filtran;
- scroll local evita relayout de toda la página por seguimiento de bloque;
- se mantienen lazy-loading y desmontaje de features no visibles.
