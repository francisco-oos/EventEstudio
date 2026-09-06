# EventStudio 6.15.0-rc.33

## Objetivo

Consolidar el nuevo Design Engine como autoridad de presentación y preparar la sustitución de plantillas estáticas por Recipes editables sin alterar datos, servicios ni reglas comerciales.

## Nuevo

- Recipe v2 como fuente visual.
- AssetManifest con búsqueda, categorías, paginación y lazy loading.
- posicionamiento libre de Assets: X/Y, escala, rotación, z-index, opacidad, tono y motion.
- 64 Recipes prehechas editables.
- 103 skins funcionales, 34 presentaciones fotográficas y 16 timelines.
- Color Studio con 10 armonías y override completo de tokens.
- tipografía/layout/textura/motion/apertura controlados por Recipe.
- miniaturas reactivas generadas desde Recipe.
- recomendador de paquetes a partir de servicios presentes en el diseño.
- landing pública Recipe-first con preview y demo de lacre.
- álbum colaborativo sincronizado con paleta, tipografía, textura, layout y Assets.

## Preservado

- música subida y Spotify;
- RSVP, invitados y listas;
- agenda, ubicaciones y mapas;
- galería/lightbox;
- regalos;
- QR y QR por mesa;
- invitación física/PDF;
- Stationery y lacre centralizado;
- aperturas existentes;
- permisos, cortesías, comercio, planes y entitlements.

## QA destacado

- 128/128 renderizados de Recipes sin overflow.
- 22/22 aperturas, FPS mínimo 59.99, CLS 0.
- 64 casos de contenido largo desde 320 px hasta 4K sin overflow.
- 32 casos de combinaciones de features sin nodos residuales.
- Design Lab y controles públicos probados en Chromium real.

## Fuera de alcance

- VideoRenderer permanece en laboratorio/futuro.
- página conmemorativa/aniversarios permanece como evolución futura de producto.
- generador utilitario de ZIP no forma parte del código productivo de RC33.

## Puerta de producción

RC33 es candidato para prueba física. La promoción requiere `npm ci`, `npm run test:preproduction`, auditoría de dependencias y validación física del propietario.
