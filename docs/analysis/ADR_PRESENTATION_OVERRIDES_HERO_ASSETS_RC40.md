# ADR — EventStudio 6.16.0-rc.40: autoridad de experiencia, portada y assets

## Decisión

La identidad de una invitación queda dividida en dos capas deliberadas:

1. **Recipe**: paleta, textura, tipografía, composición, bloques y Assets.
2. **Controles superiores del panel**: Apertura, Recorrido, Movimiento y estilo de Álbum.

Al abrir, editar o aplicar una Recipe del catálogo, los controles superiores se envían como `presentationOverrides`. Al cambiar de Recipe dentro del propio Estudio, se preserva igualmente la experiencia ya elegida para que una nueva composición no cambie silenciosamente la apertura. Si el usuario eligió `Sobre personalizable`, todas las Recipes se prueban/aplican con ese sobre, pero conservan su identidad cromática y compositiva.

## Sobre personalizable y Stationery

Cuando una Recipe cuya apertura nativa era distinta se proyecta con `unified-envelope`, el preview sincroniza el sobre/lacre con la Recipe seleccionada. Se evita arrastrar el último sobre usado por el evento y se evita que todas las miniaturas aparenten variedad pero terminen usando una identidad ajena.

## Portada

`media.heroImage` sigue siendo un dato del evento. La Recipe sólo guarda tratamiento visual:

- mostrar/ocultar;
- fondo completo;
- foto a la izquierda;
- foto a la derecha;
- `cover/contain`;
- posición X/Y;
- oscurecimiento.

El renderer público `design-engine.js` es la única autoridad de presentación de portada cuando está disponible. `app.js` no vuelve a escribir el mismo background, reduciendo decode duplicado y flashes.

Si existe una apertura, la portada puede diferirse hasta abrir la invitación. En móvil las composiciones divididas se apilan.

## Scroll del Estudio

En escritorio, biblioteca, lienzo e inspector son tres regiones con scroll independiente. Seleccionar/modificar un bloque mueve únicamente el lienzo; se eliminó `scrollIntoView()` para esta navegación porque podía desplazar toda la interfaz.

## Assets Gemini 050/051

Se admiten 12 SVG estáticos después de validación XML, ausencia de scripts/URLs externas y compatibilidad con el renderer actual. Tres SVG con SMIL quedan **en cuarentena**, no descartados: el renderer actual controla motion desde EventStudio y no debe incorporar una segunda autoridad de animación sin sandbox/QA específico.

## Consecuencia

El usuario obtiene más combinaciones sin duplicar datos ni hardcodear eventos; la experiencia comercial sigue siendo validada por entitlements y el propietario/desarrollador conserva su override de plataforma para QA.
