# ADR RC29: paridad del estudio avanzado con el generador maestro de papelería

Estado: aceptado  
Fecha: 2 de septiembre de 2026

## Contexto

RC28 corrigió la arquitectura principal: el estudio de sobre, tarjeta y lacre dejó de vivir dentro del panel administrativo y pasó a una ventana especializada abierta sólo desde `Sobre personalizable`. La herencia de nombres, fecha y tipografía, la persistencia atómica y la coordinación cromática ya eran correctas.

La interfaz construida para RC28, sin embargo, simplificó la experiencia del generador maestro suministrado como referencia. Redujo la navegación y las miniaturas, cambió la forma de explorar materiales/recursos y sustituyó la interacción directa de abrir/cerrar el sobre por controles auxiliares. Esa simplificación hacía inaccesible o menos evidente parte del flujo visual que el generador original ya resolvía.

La referencia funcional para esta decisión es `index_sobre_generador_general_rc28_auditado(3).html`: navegación lateral de nueve secciones, panel de biblioteca, escenario central, miniaturas vectoriales reales y apertura/cierre del sobre mediante clic sobre el propio objeto.

## Decisión

1. Se conserva la arquitectura desacoplada de RC28. El estudio continúa en `stationery-studio.html` y sólo se abre cuando la entrada activa declara `editor.type = "stationery-studio"` en `config/experiences.json`.
2. La estructura visual del estudio vuelve a seguir el generador maestro:
   - barra lateral de 90 px;
   - panel de biblioteca de 360 px;
   - escenario central con perspectiva;
   - secciones `Sobres`, `Texturas`, `Ajustes`, `Lacre 3D`, `Marcos`, `Divisores`, `Liners`, `Encajes` y `Postales`;
   - miniaturas SVG de cada recurso en lugar de tarjetas de texto o muestras genéricas.
3. El sobre del escenario vuelve a ser el control de interacción: un clic alterna abierto/cerrado. No existen botones separados para abrir y cerrar.
4. `stationery-engine.js` se convierte en renderer compartido de la geometría, texturas, liners, overlays, estampillas, marcos y divisores. El mismo motor se utiliza en el estudio y en la invitación pública para evitar divergencia entre lo que el usuario diseña y lo que finalmente ve el invitado.
5. La animación permanece declarativa en CSS. JavaScript sólo cambia el estado (`is-preview-open`/`is-open`) y calcula el desplazamiento seguro del componente para evitar recortes según el viewport.
6. Los metadatos del evento continúan siendo de sólo lectura en el estudio. Nombres, fecha y tipografía se obtienen de `eventSettings`; no se crean campos de captura duplicados.
7. La edición de `sealColor` activa el material `theme` del lacre. Esto garantiza que el selector visible produzca una reacción inmediata y que la miniatura del sello y el sello aplicado utilicen el mismo color.
8. `Aplicar a la invitación` mantiene una sola escritura de `presentation + stationery + seal`. No se introduce almacenamiento paralelo en el navegador.

## Fuente de verdad y sincronización de color

La prioridad cromática permanece en servidor y no depende de la apariencia del estudio.

### Sobre personalizable

Cuando se cumplen simultáneamente:

- `presentation.openingStyle === stationeryCatalog.openingId`;
- `stationery.customized === true`;
- `stationery.syncDesignTokens === true`;

la papelería es autoritativa. Sus tokens completos (`outer`, `inner`, `card`, `text`, `ornament`, `seal`) se convierten en la paleta efectiva que consumen invitación pública, portal de fotografías, QR e impresión. Después se aplica `ensureAccessiblePalette` para preservar contraste.

### Otras entradas

Una apertura independiente nunca obtiene autoridad completa por existir una papelería guardada. `config/experiences.json` declara su política:

- `accent-harmony`: combina sólo los acentos explícitamente permitidos con la plantilla;
- `template`: conserva la paleta de la plantilla;
- `stationery`: reservado para el sobre personalizable.

Esto permite conservar partículas, flores, pergamino, gaceta, gala, aurora, constelación y otras mecánicas sin transformarlas en sobres ni arrastrar una selección antigua.

### Sin apertura

`none` utiliza política `template`. Si el usuario no selecciona una entrada, la plantilla conserva sus colores predeterminados salvo otras personalizaciones independientes que el propio usuario haya activado.

## Paridad de catálogo

El estudio no duplica arrays en JavaScript. Lee `config/stationery.json`, actualmente con:

- 4 geometrías;
- 15 materiales;
- 16 presets;
- 9 liners, contando `none`;
- 10 overlays, contando `none`;
- 7 estampillas, contando `none`;
- 8 marcos, contando `none`;
- 9 divisores, contando `none`.

Las etiquetas, descripciones, recetas y límites se resuelven por IDs estables. Agregar un recurso al catálogo no exige conservar posiciones numéricas históricas.

## Lacre

El lacre permanece dentro del estudio unificado. Se conserva:

- monograma automático a partir de los nombres del evento;
- modo manual cuando el usuario lo solicita;
- conector libre;
- textos superior e inferior;
- tipografía, tamaño, kerning y desplazamiento vertical;
- borde, ornamento y material;
- color personalizado;
- relieve, profundidad, calidad y brillo;
- exportación SVG.

Las plantillas/aperturas compatibles siguen consumiendo `seal-renderer.js`; no se reintroduce el antiguo módulo aislado de RC26.

## Hardcode y configuración

Se distingue entre estructura técnica estable y datos de producto configurables:

- IDs de recursos, recetas, etiquetas/descripciones y límites viven en catálogos.
- La ruta y etiqueta del editor viven en `config/experiences.json`.
- Los endpoints del estudio se reciben mediante atributos `data-*` de la página y tienen fallback únicamente como contrato de ruta existente.
- Los colores del renderer compartido proceden del estado/catálogo. `tests/rc29-stationery-index-parity.js` prohíbe colores hexadecimales de seis dígitos en `stationery-engine.js`.
- Los IDs DOM (`panel-container`, `stationeryStudioMount`, etc.) son contratos estructurales de la vista, no datos del evento.
- Los textos estáticos de interfaz permanecen como copy de producto; no sustituyen metadatos ni valores del evento.

## Alternativas evaluadas

### Incrustar literalmente el HTML original mediante iframe

Rechazada. Duplicaría estado, rutas y persistencia, y obligaría a sincronizar dos implementaciones del renderer. También dificultaría permisos y pruebas.

### Copiar el generador completo dentro de `stationery-studio.js`

Rechazada. Habría un renderer para el editor y otro para la invitación pública, reintroduciendo el problema de paridad que se está corrigiendo.

### Mantener la interfaz reducida de RC28

Rechazada. Técnicamente funcionaba, pero no exponía el flujo visual aprobado del generador maestro y hacía menos verificables las combinaciones disponibles.

### Copiar físicamente la paleta al tema de la plantilla

Rechazada. La coordinación debe ser derivada y reversible. Guardar los colores del sobre dentro del tema haría persistir colores obsoletos al cambiar de entrada.

### Abrir/cerrar con botones externos

Rechazada. La interacción aprobada es directa sobre el sobre y la animación CSS ya contiene el estado necesario.

## Consecuencias

El usuario recupera la apariencia y forma de trabajo del generador maestro sin perder la integración segura de RC28. El mismo motor vectorial alimenta editor e invitación, reduciendo regresiones de paridad. La interfaz avanzada sigue cargándose bajo demanda y las mecánicas independientes continúan intactas.
