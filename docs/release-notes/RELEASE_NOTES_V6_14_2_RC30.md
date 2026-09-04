# EventStudio 6.14.2-rc.30

Fecha: 2 de septiembre de 2026

## Correcciones

- El CTA `Abrir invitación` ya no puede sustituir el nombre de la tarjeta del sobre.
- `Sobre personalizable` sincroniza automáticamente su paleta con invitación pública, portal de fotos, QR e impresión al aplicar.
- Cambiar a una apertura distinta corta la autoridad de la papelería y conserva la paleta propia de la plantilla.
- Las reglas visuales de los 64 temas consumen sus design tokens en lugar de repetir literales que bloqueaban la recoloración.
- El lacre central sustituye el cierre equivalente de `storybook-seal`; ya no se muestran dos sellos en la misma zona.
- El QR no puede optar por una paleta ajena cuando `unified-envelope` personalizado es la identidad activa.
- El Estudio Avanzado presenta la sincronización como comportamiento automático, no como checkbox opcional.

## Conservado

- ventana avanzada separada;
- herencia de nombre, fecha y tipografía del evento;
- navegación y apariencia del generador maestro;
- 16 presets, 15 materiales y bibliotecas vectoriales;
- apertura/cierre del sobre mediante clic directo;
- lacre avanzado centralizado;
- permisos por rol/feature;
- defaults originales de las 64 plantillas para cualquier otra apertura.

## QA

- contrato RC30: PASS;
- visual pública de nombre/paleta/lacre: 2/2 PASS;
- visual del estudio: 2 viewports + 5 perfiles, 0 fallos;
- regresiones RC27, RC28 y RC29: PASS;
- integridad, referencias, móvil y regresiones RC14: PASS.

La suite global dependiente de SQLite debe repetirse en un entorno con `npm ci` completado antes de producción.
