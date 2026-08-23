# Análisis del producto temático · EventStudio 6.14.2 RC8

## Conclusión

El producto mínimo no debe ser un editor de video ni depender de una IA para
publicar. Debe ser un enlace vertical animado que recibe:

1. tipo de celebración;
2. protagonista y momento;
3. temática y tono;
4. fecha, hora y ubicación;
5. fotografías;
6. música cargada o enlace oficial.

EventStudio combina esos datos con una plantilla estructural. La misma
invitación funciona en teléfono y computadora, puede compartirse por WhatsApp y
puede crecer con RSVP u otros módulos sin reconstruirse.

## Qué muestran los tres videos aportados

Los tres ejemplos siguen la misma secuencia, aunque cambien personaje y estilo:

| Momento | Función | Adaptación propia |
|---|---|---|
| 0–5 s | Gancho temático | Motivo original, movimiento y nombre |
| 5–12 s | Presentar al protagonista | Fotografía real dentro de un marco seguro |
| 12–24 s | Nombre, edad u ocasión | Texto HTML editable y accesible |
| 24–34 s | Fecha, hora y lugar | Datos reales, mapa y calendario |
| 34–45 s | Cierre y llamada | Mensaje, música y enlace para compartir |

La complejidad percibida proviene sobre todo de la dirección visual, el ritmo y
la música; no de una edición diferente para cada cliente. Por ello RC8
implementa esa receta como página animada generada por datos.

## Qué no se adopta

- Personajes, logotipos, música o escenarios de franquicias sin licencia.
- Clonar videos o páginas de terceros.
- Generar imágenes con nombres, fechas o direcciones incrustados: esos datos
  deben seguir siendo texto editable.
- Prometer un MP4 inmediato sin disponer todavía de una cola de render,
  almacenamiento temporal, límites y seguimiento de errores.
- Enviar automáticamente fotografías o datos del evento a un proveedor de IA.
- Un editor libre de escenas: eleva el costo de soporte y hace menos predecible
  la calidad.

## Arquitectura implementada

### Núcleo sin IA

- 42 plantillas, 21 de ellas añadidas en RC8 con estructura propia.
- Metadatos por plantilla: composición, tratamiento fotográfico, movimiento,
  motivo y recorrido recomendado.
- Cuatro recorridos: clásico, escenas, cartel y galería.
- Cuatro niveles de movimiento, respetando `prefers-reduced-motion`.
- Muestra pública tipo reel en `/muestra.html`.
- Contexto creativo guardado por evento.
- Prompt local revisable para producir recursos originales; EventStudio no lo
  envía a ningún servicio.

### Comercial

- **Temática Express ($199 MXN):** enlace animado, temática, fotografías,
  datos, música y ubicación; no exige RSVP.
- **Esencial ($299 MXN):** añade invitados, RSVP y WhatsApp manual.
- **Plus ($499 MXN):** añade contenido y operación frecuente.
- **Premium ($999 MXN):** recibe todo módulo que el propietario conserve como
  disponible.
- Los complementos y promociones se conceden en el evento existente.

Los importes siguen siendo configurables y no representan cobros reales.

## Estrategia de IA

La IA puede aportar fondos o personajes originales, pero es una optimización,
no una dependencia. El flujo recomendado es:

1. generar el prompt local sin datos privados innecesarios;
2. revisar derechos y el texto;
3. usar, si se decide, un proveedor externo;
4. revisar manualmente el resultado;
5. cargar únicamente el recurso aprobado.

La API de Gemini tiene niveles y precios que pueden cambiar; algunas
capacidades disponen de cuota gratuita, mientras la generación de imágenes no
debe asumirse gratis ni ilimitada. La información enviada en ciertos niveles
gratuitos también puede estar sujeta a condiciones distintas. Antes de integrar
se debe revisar la [tabla oficial de precios](https://ai.google.dev/gemini-api/docs/pricing)
y la [guía oficial de generación de imágenes](https://ai.google.dev/gemini-api/docs/image-generation).

## Video exportable: fase posterior

Cuando exista demanda pagada, la misma estructura de escenas puede alimentar un
renderizador separado:

- HTML/React a MP4 con
  [Remotion renderMedia](https://www.remotion.dev/docs/renderer/render-media);
- composición y codificación con
  [FFmpeg](https://ffmpeg.org/ffmpeg-filters.html);
- cola asíncrona, límites por plan, archivos temporales y borrado automático.

No debe ejecutarse dentro de la petición HTTP normal ni bloquear la invitación.
El enlace animado sigue siendo el producto principal porque conserva mapas,
idiomas, accesibilidad y cambios en tiempo real.

## Criterios para una plantilla nueva

Una plantilla sólo cuenta como nueva si cambia al menos cuatro de estos puntos:

- estructura;
- jerarquía tipográfica;
- tratamiento de fotografías;
- motivo o escenario;
- ritmo;
- apertura;
- recorrido.

Cambiar únicamente colores no crea una plantilla diferente.
