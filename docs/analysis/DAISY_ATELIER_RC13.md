# Daisy Atelier · familia floral RC13

## Objetivo

Traducir las cinco imágenes aportadas como inspiración a una familia original de EventStudio que conserve elegancia, aire editorial, margaritas blancas, amarillos cálidos, verdes naturales y superficies claras, sin copiar las fotografías ni convertirlas en fondos distribuidos.

## Lectura de las cinco referencias

1. **Marco botánico ilustrado**: margaritas/hojas rodean una zona central amplia. Se retiene la idea de marco y espacio de lectura, no la composición exacta.
2. **Prado inferior**: tallos finos que nacen desde la parte baja y dejan gran espacio negativo. Se retiene la verticalidad y respiración.
3. **Editorial asimétrica**: flores a la derecha y luz cálida. Se retiene la asimetría y el tratamiento de luz.
4. **Ramo en esquina sobre gris**: masa floral inferior/lateral y fondo texturizado. Se retiene el contraste suave.
5. **Ramo con sombra arquitectónica**: flores iluminadas y sombra geométrica. Se fusiona con la referencia 4 en una sola dirección editorial para evitar dos plantillas redundantes.

## Plantillas implementadas

| ID | Nombre | Dirección | Nivel inicial |
|---|---|---|---|
| `daisy-paper-orbit` | Margarita de papel | Marco botánico, papel marfil, centro limpio | Basic |
| `daisy-meadow-air` | Prado de margaritas | Prado inferior, mucho aire, minimalismo | Starter |
| `daisy-editorial-light` | Margarita editorial | Asimetría derecha, luz cálida | Premium |
| `daisy-shadow-studio` | Luz y margaritas | Ramo moderno + sombra arquitectónica | Premium |

Activos originales:

- `public/assets/daisy-paper-orbit.svg`
- `public/assets/daisy-meadow-air.svg`
- `public/assets/daisy-editorial-light.svg`
- `public/assets/daisy-shadow-studio.svg`

## Coherencia web / QR / impresión

Las cuatro plantillas usan los metadatos normales de EventStudio y el motivo `daisy`. El servidor incorporó el mismo motivo al renderer PDF/QR. La paleta puede heredarse del tema o sobrescribirse mediante el **Kit de diseño global** del evento.

La decisión evita tres implementaciones paralelas. El tema define una identidad y los renderers web, QR e impresión la consumen.

## Inspiración externa analizada

- Minted — floral/botanical suites y piezas coordinadas: https://www.minted.com/category/wedding/flower-botanical-wedding-invitations
- Minted — website y papelería coordinada: https://www.minted.com/product/wedding-websites/MIN-S2R-DWW/vintage-botanical
- Canva — wedding invitation kits: https://www.canva.com/create/wedding-invitation-kits/
- Canva — wedding websites: https://www.canva.com/create/wedding-websites/
- The Knot — papelería + website/QR: https://www.theknot.com/paper
- Greenvelope — invitaciones florales de primavera: https://www.greenvelope.com/designs/spring-wedding-invitations
- Greenvelope — “Baby in Bloom” y uso de un área central limpia: https://www.greenvelope.com/blog/baby-in-bloom-invitations/

## Qué se adoptó

- continuidad entre piezas digitales y físicas;
- uso deliberado de espacio negativo;
- familias visuales, no una sola plantilla aislada;
- marco/ramo/prado como composiciones reutilizables;
- personalización de color y tipografía sin perder legibilidad.

## Qué se descartó

- descargar o redistribuir fotografías de referencia;
- copiar plantillas/composiciones propietarias;
- introducir una dependencia gráfica para dibujar cuatro SVG simples;
- crear cinco plantillas casi iguales sólo para igualar el número de imágenes.

## Propiedad intelectual

Las imágenes entregadas se usaron como referencia visual durante el análisis. Los SVG de RC13 fueron construidos desde cero con formas propias. La documentación conserva la procedencia de la inspiración, pero el paquete no incluye ni redistribuye las fotografías de referencia.
