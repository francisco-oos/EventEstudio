# Validación RC28

Fecha: 2 de septiembre de 2026

## Objetivo

Validar que el estudio avanzado se desacopla del panel sin perder capacidades del motor RC27, que hereda metadatos del evento, que la persistencia sigue siendo atómica y que la coordinación de color no contamina plantillas al cambiar de entrada.

## Contratos RC28

`tests/rc28-stationery-studio.js` valida:

- existencia y carga diferida del estudio;
- editor declarado desde catálogo y sólo para el sobre unificado;
- ausencia del motor de papelería en `admin.html`;
- botón independiente `Guardar entrada`;
- herencia de nombres, fecha y tipografía sin campos redundantes;
- `PUT` atómico de `presentation + stationery + seal` desde el estudio;
- relectura de servidor después de señal entre ventanas;
- permisos owner/developer/templates;
- referencias válidas de presets y tokens de cada política de apertura;
- corte de autoridad de una paleta de sobre al cambiar a otra entrada;
- fallback de `Sin apertura`;
- contraste WCAG tras coordinación;
- límites y opciones de lacre provenientes de catálogos;
- comentarios técnicos sin emojis.

## Matriz cromática automatizada

La suite cruza las 64 plantillas registradas con las 15 aperturas visibles actuales: 960 combinaciones de plantilla/entrada. Para cada combinación se genera la paleta coordinada y se verifica contraste mínimo 4.5:1 para tinta, texto secundario y variante de acento sobre papel. También se verifica la paleta completa de papelería sincronizada para las 64 plantillas.

## Resultado

La evidencia final de comandos ejecutados se registra antes de empaquetar esta candidata. Ningún PASS se declara en este documento antes de ejecutar el comando correspondiente sobre RC28.

## Criterios visuales

Además de los contratos estáticos, la aceptación visual debe revisar:

- panel sin editor avanzado incrustado;
- lanzador visible sólo para `Sobre personalizable`;
- estudio utilizable en escritorio y móvil;
- sobre cerrado/abierto sin recorte;
- lacre visible y reactivo a material/color/relieve;
- campos heredados correctos;
- cambio a entradas independientes sin arrastre de la paleta anterior;
- invitación, álbum, QR e impreso usando la misma paleta efectiva del servidor.

## Perfiles

- Owner / developer: lectura y escritura del estudio.
- Anfitrión con `templates`: lectura y escritura según derechos comerciales de la apertura/preset.
- Cortesía o plan sin `templates`: consulta permitida; persistencia de papelería/lacre rechazada por `TEMPLATES_REQUIRED`.
