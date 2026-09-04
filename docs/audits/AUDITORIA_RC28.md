# Auditoría RC28: estudio de sobres, aperturas y sincronización

Fecha: 2 de septiembre de 2026

## Archivos base revisados

- RC27 QA completo como baseline funcional.
- RC26 QA para recuperar el patrón seguro de editor en ventana independiente.
- `index_sobre_generador_general_rc28_auditado(2).html` como referencia de capacidades del estudio avanzado.
- Documentación RC27 de motor, persistencia, permisos, retrocompatibilidad y Onfalós.

## Hallazgo principal

RC27 integraba en `admin.html` controles de composición y lacre que debían pertenecer a una herramienta especializada. El motor compartido era correcto, pero la ubicación de la interfaz reducía la experiencia del generador avanzado y hacía que el panel cargara dependencias de papelería aun cuando el usuario eligiera una entrada totalmente distinta.

## Cambios auditados

### Panel administrativo

- Eliminado el DOM del editor avanzado incrustado.
- Eliminada la carga de `stationery-engine.css`, `stationery-engine.js` y `seal-renderer.js` desde `admin.html`.
- Restaurado `Guardar entrada` como persistencia independiente de `presentation`.
- Añadido lanzador contextual que sólo aparece cuando el catálogo de la entrada activa declara un editor de papelería.
- Nombres, fecha, tipografía y preset aplicado se presentan como resumen, no como campos duplicados.

### Estudio avanzado

El nuevo `stationery-studio` expone:

- 16 recetas/presets del catálogo;
- 4 geometrías;
- 15 materiales;
- intensidad de textura;
- seis tokens cromáticos;
- 9 liners;
- 10 overlays;
- 7 estampillas;
- 8 marcos;
- 9 divisores;
- lacre activable con monograma automático o manual;
- conector libre con sugerencias configurables;
- textos superior e inferior;
- tipografía, tamaño, kerning y desplazamiento;
- borde, ornamento y material;
- color personalizado;
- modo/profundidad de relieve, calidad y brillo;
- copiar y descargar SVG del lacre;
- apertura/cierre de la previsualización;
- restauración de cambios locales;
- sincronización opcional con entregables secundarios.

Los recuentos anteriores provienen de los catálogos entregados en esta candidata y no de listas duplicadas en JavaScript.

### Aperturas

Se verificó que continúan activas y separadas las mecánicas no redundantes: rosa, margarita, jardín luminoso, flor nocturna, partículas, gaceta, pergamino, órbita de olivo, aurora, cosmos botánico, gala, constelación y reserva. Las ocho variantes históricas de sobre continúan retiradas y migran al motor unificado.

### Coordinación de color

Cada apertura visible tiene una política explícita en `config/experiences.json`:

- `stationery`: sobre personalizable;
- `accent-harmony`: aperturas que aportan acentos compatibles;
- `template`: aperturas que deben conservar la paleta de la plantilla.

Los selectores de color de rosa y flores también se exponen mediante metadatos `colorControls`; el panel ya no decide qué campos mostrar mediante listas de IDs de apertura.

## Código legado retirado o dejado inerte

- controles avanzados de papelería embebidos en `admin.html`;
- handlers de preview/persistencia del estudio embebido en `admin.js`;
- CSS del estudio embebido en `styles.css`;
- dependencia de los renderers de papelería en la página administrativa;
- listas específicas de aperturas para mostrar controles de color;
- límites de sliders duplicados en servidor y UI nueva.

El antiguo `seal-studio.*` de RC26 permanece retirado. No se restauró como módulo aislado.

## Riesgos revisados

- Estado antiguo de sobre aplicado después de elegir otra entrada: corregido con `stationeryIsAuthoritative`.
- Cambios entre ventanas sin confirmar servidor: corregido; la señal sólo dispara recarga.
- Perfil sin permiso `templates`: protegido por API y reflejado como modo de consulta.
- Entrada comercial sin derecho: conserva las puertas existentes de `designAccess`.
- Caché de assets: versión de recursos actualizada a RC28.
- CSP: el estudio no depende de estilos o scripts de terceros.
- Accesibilidad cromática: matriz automatizada sobre todas las plantillas y aperturas visibles.
