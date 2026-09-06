# ADR RC32 — Design Engine basado en Assets, Components y Recipes

## Estado

Aceptado para `6.15.0-rc.32`.

## Contexto

EventStudio llegó a RC30 con una capa de negocio y servicios estable, pero el crecimiento visual dependía de un catálogo cada vez mayor de temas y reglas CSS específicas. Ese modelo permitía ofrecer variedad, aunque aumentaba el riesgo de regresiones, duplicación y acoplamiento entre presentación y funcionalidad.

En paralelo se evaluaron dos laboratorios externos de diseño (Gemini y Claude). Ambos demostraron que era viable parametrizar paletas, fotografía, movimiento, QR, papelería y composición, pero sus entregas son HTML monolíticos de laboratorio y no deben convertirse en la arquitectura productiva.

El objetivo de RC32 es cambiar la fuente de autoridad visual sin reescribir los módulos operativos que ya funcionan.

## Decisión principal

La arquitectura separa cinco responsabilidades:

1. **Event Data**: nombres, fecha, lugar, historia, agenda, invitados, música, fotografías y demás datos reales.
2. **Design Recipe**: decisiones exclusivamente visuales y de composición.
3. **Entitlements / Services**: capacidades contratadas y límites de uso.
4. **Business / Commerce**: planes, bundles, compras individuales, promociones, cortesías y legado.
5. **Renderers**: proyección web, QR, papelería y futuras salidas.

Regla de arquitectura:

`Data != Design != Services != Business != Rendering`

La capa de presentación se estructura como:

`Assets + Components + Recipes + Presentation Engines`

## Design Recipe v2

Una Recipe almacena referencias y configuración visual, nunca datos reales del evento.

Incluye, entre otros:

- familia de layout;
- paleta semántica;
- teoría del color;
- textura;
- presentación fotográfica;
- motion preset y timeline;
- apertura;
- lista ordenada de secciones;
- estilo visual de cada sección;
- instancias de assets decorativos.

Una Recipe puede contener un componente cuyo servicio aún no esté contratado. El servidor genera una proyección pública filtrada por entitlements. El componente no autorizado no se renderiza, pero tampoco se destruye de la Recipe original.

Esto permite activar posteriormente un servicio sin rehacer el diseño.

## AssetManifest

Los recursos gráficos se registran mediante ID estable. La Recipe guarda `assetId` y transformaciones, no el SVG completo.

Cada instancia soporta:

- ancla de sección;
- X/Y relativos;
- escala;
- rotación;
- z-index;
- opacidad;
- tono semántico;
- motion preset.

El catálogo expone metadata y miniaturas con paginación, búsqueda y filtros. El renderer público recibe únicamente los assets utilizados por la Recipe.

Se descarta cargar la biblioteca completa en cada invitación.

## Componentes funcionales

Los componentes visuales no sustituyen los módulos productivos. RSVP, galería, ubicación, agenda, regalos, QR y música conservan su lógica real. La Recipe sólo controla su presentación.

Esta decisión evita maquetas desconectadas del backend y mantiene la compatibilidad con permisos y servicios existentes.

## Música

La funcionalidad de música permanece dentro del producto. Si el evento configura una pista subida o Spotify y el entitlement está activo, el reproductor debe funcionar.

La migración no exige preservar la pista concreta del evento de prueba actual, pero sí preservar el módulo y su comportamiento.

Los estilos visuales de música forman parte del Design Engine; la reproducción continúa perteneciendo a `public/app.js` y sus integraciones existentes.

## Color y teoría del color

Las Recipes usan una paleta semántica y metadata de teoría del color. El Design Lab puede generar armonías desde un color base y valida contraste.

La autoridad cromática preexistente de Stationery se preserva: cuando un sobre personalizado sincronizado es la fuente visual efectiva, su paleta coordinada sigue alimentando invitación, QR, papelería y lacre.

Se descarta permitir que una Recipe pise esa autoridad después del cálculo de `themeDescriptor`.

## Texturas, motion y aperturas

Texturas, motion timelines, presentaciones fotográficas y aperturas se convierten en decisiones de Recipe o catálogos de Presentation Engine.

Las mecánicas de apertura que ya estaban estabilizadas no se reimplementan. La Recipe selecciona el motor existente y su configuración.

Se descarta fusionar todas las aperturas dentro de un único tipo de sobre.

## Responsive

Las transformaciones visuales no pueden ampliar el ancho de documento en móvil. RC32 establece overrides específicos de Recipe para familias que usaban desplazamientos o rotaciones decorativas en desktop.

No se permite corregir overflow ocultándolo globalmente si eso recorta contenido funcional.

## Miniaturas

Las miniaturas se derivan de la Recipe y no de una plantilla HTML independiente. Cambios en paleta, layout o transformaciones disparan una nueva miniatura reactiva.

Esto mantiene el atractivo visual del catálogo sin volver a introducir implementaciones estáticas por plantilla.

## Seguridad y validación

El servidor normaliza IDs y límites numéricos de transformaciones. Una Recipe no puede introducir rutas arbitrarias como sustituto de un asset registrado.

La proyección pública filtra capacidades según entitlement antes del render.

## Compatibilidad legacy

RC32 mantiene `themeId`, `designKit`, Stationery y otros campos legacy como puente de transición. La autoridad visual nueva es Recipe-first cuando existe `designRecipe`.

La eliminación definitiva de estructuras legacy se hará únicamente cuando no queden consumidores productivos.

## Alternativas descartadas

### Mantener crecimiento por plantillas estáticas

Descartado por duplicación, costo de QA y riesgo de regresión.

### Integrar literalmente los HTML de Gemini o Claude

Descartado por su naturaleza monolítica y de laboratorio. Se extraen catálogos, primitivos, validadores y motores útiles.

### Guardar SVG completo dentro de cada Recipe

Descartado por duplicación, peso y dificultad de versionado.

### Conceder servicios desde la Recipe

Descartado. Diseño nunca otorga permisos comerciales.

### Reescribir Stationery, RSVP, galería o música dentro del constructor

Descartado. El constructor estiliza y compone; los módulos productivos siguen siendo la fuente funcional.

## Consecuencias

- nuevas plantillas se crean como Recipes, no como código nuevo;
- diseñadores pueden producir catálogo sin modificar renderers;
- una biblioteca grande no incrementa automáticamente el peso de la invitación;
- los paquetes pueden cambiar sin cambiar plantillas;
- una plantilla puede cambiar sin modificar reglas de negocio;
- se facilita la futura salida a memoria, historial, impresión y video sin mezclar esas responsabilidades en esta fase.
