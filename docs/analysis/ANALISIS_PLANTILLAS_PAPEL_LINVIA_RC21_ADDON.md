# Análisis — Add-on de plantillas papel + colección Linvia para RC21

## Alcance

Esta intervención parte **exclusivamente** del ZIP funcional `EventEstudio(2).zip`. No se reescribe el motor de aperturas, no se cambia el DOM de `public/index.html` y no se sustituyen las 52 plantillas ni las 10 aperturas originales.

Se agregan:

- 3 plantillas ya preparadas en el add-on anterior: `wedding-gazette`, `vintage-parchment`, `sage-photo-editorial`.
- 2 aperturas asociadas a la colección de papel: `newspaper-fold`, `vintage-parchment`.
- 4 plantillas nuevas inspiradas en las referencias indicadas: `olive-universe`, `olive-nectar`, `blue-breeze-aurora`, `botanical-cosmos`.
- 4 aperturas nuevas: `olive-universe-orbit`, `olive-nectar-seal`, `blue-aurora-reveal`, `botanical-cosmos-orbit`.

Resultado de catálogo: **59 plantillas y 16 aperturas activas**.

## Referencias de estudio

- https://linvia.net/ejemplo-oliva-boda-universo
- https://linvia.net/ejemplo-oliva-boda-nectar
- https://linvia.net/ejemplo-brisaazul-boda-aurora
- https://linvia.net/ejemplo-botanico-boda-cosmos
- https://linvia.net/
- Referencias de papel ya analizadas en el add-on previo: plegado 3D, textura de papel y composición editorial.

Las demos concretas de Linvia son páginas dinámicas y el rastreador de documentación no expone su DOM interno de forma utilizable. Por esa razón **no se copia HTML, CSS, JavaScript, fotografías, fuentes ni assets del proveedor**. Se estudian el nombre/tema de cada demo, su lenguaje visual público y los patrones habituales del propio producto (portada, contador, ubicaciones, galería, RSVP, música y bloques verticales), y se reconstruye una interpretación propia compatible con EventStudio.

## Por qué esta base reproduce bien las animaciones

La revisión comparativa del ZIP funcional muestra cuatro decisiones que deben conservarse:

1. `setupInvitationOpening()` usa una sola máquina de estados visual basada en `is-opening`.
2. La estructura del sobre permanece fija: `opening-envelope-back → opening-card → opening-flap → opening-envelope-front → opening-seal`.
3. La reproducción musical se lanza con `void playOpeningMusic()` y **no bloquea** la animación con `await`.
4. RC21 contiene un hotfix que mantiene el botón/sobre visible aunque la acción se haya consumido, adelanta la tarjeta para evitar el hueco visual y ajusta nombres largos sin tocar el hero.

El paquete `paper-editorial-r1` anterior contenía además de las plantillas dos cambios `void → await` en `app.js`. Esos cambios **no se transfieren**. Del controlador sólo se amplía `envelopeTiming` con los tiempos de las seis aperturas nuevas.

## Criterio de implementación de aperturas nuevas

Todas usan `renderer: "css"` y reutilizan las cinco capas del DOM existente. Esto evita introducir canvas, listeners, timers o dependencias adicionales.

| Apertura | Lenguaje visual | Mecánica |
|---|---|---|
| `newspaper-fold` | gaceta/papel plegado | panel superior e inferior se abren; tarjeta se aplana |
| `vintage-parchment` | pergamino con rodillos | rodillos se separan; papel central se despliega |
| `olive-universe-orbit` | olivo + constelaciones | anillos giran y revelan medallón central |
| `olive-nectar-seal` | marfil, olivo y miel | sobre clásico con sello miel y tarjeta adelantada |
| `blue-aurora-reveal` | brisa/aurora azul | dos velos laterales se separan |
| `botanical-cosmos-orbit` | jardín nocturno/cosmos | dos órbitas botánicas rotan y liberan la tarjeta |

Todas definen:

- estado inicial;
- estado `.is-opening`;
- geometría móvil;
- `prefers-reduced-motion`;
- excepción `force-motion-preview` para que “Probar efectos” siga mostrando la animación;
- tiempos de salida suficientes para que el efecto sea perceptible en escritorio.

## Criterio de plantillas

Cada plantilla usa únicamente estilos namespaced `theme-*`, por lo que no cambia selectores genéricos del sistema. El contenido funcional sigue siendo el mismo DOM de EventStudio: hero, historia, sedes, agenda, galería, dress code, RSVP y regalos.

### `olive-universe`

- Paleta nocturna verde olivo + marfil + oro.
- Portada de fotografía protagonista con marco elíptico.
- Secciones claras con círculos/órbitas sutiles.
- Galería circular tipo halo.

### `olive-nectar`

- Marfil, olivo y miel.
- Portada orgánica clara.
- Secciones alternadas con esquinas suaves.
- Fotografías de tratamiento cálido y natural.

### `blue-breeze-aurora`

- Azul bruma, blanco y arena.
- Hero de gran formato con lectura desde la parte inferior.
- Secciones translúcidas/acuosas.
- Galería asimétrica con sensación de movimiento suave.

### `botanical-cosmos`

- Verde bosque + azul noche + oro.
- Portada circular/planetaria.
- Secciones claras sobre fondo oscuro.
- Galería circular y ornamentos botánicos/celestes discretos.

## Decisiones explícitamente rechazadas

- No importar páginas completas ni código externo.
- No descargar fotografías o gráficos de Linvia.
- No introducir React/WebGL/shaders para estas plantillas.
- No cambiar `public/index.html`.
- No cambiar `experience-renderers.js`.
- No cambiar autenticación, Store, RSVP, QR, pagos, usuarios, traducción, multimedia ni base de datos.
- No modificar el comportamiento de las 10 aperturas originales.
