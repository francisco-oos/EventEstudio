# EventStudio 6.14.2-rc.29

Fecha: 2 de septiembre de 2026

## Estudio avanzado

- Se conserva la ventana independiente introducida en RC28, cargada sólo para `Sobre personalizable`.
- La apariencia y organización vuelven al generador maestro suministrado como referencia: navegación lateral, biblioteca de 360 px y escenario central.
- Se restauran nueve secciones: Sobres, Texturas, Ajustes, Lacre 3D, Marcos, Divisores, Liners, Encajes y Postales.
- Los recursos muestran miniaturas SVG reales calculadas con la paleta actual.
- El sobre vuelve a abrir/cerrar directamente al hacer clic; se retiraron controles separados de apertura/cierre.
- El formato tarjeta conserva perspectiva interactiva.

## Motor compartido

- `stationery-engine.js` renderiza geometrías, texturas y recursos tanto en el estudio como en la invitación pública.
- Se conserva una única fuente de estado y no se introduce un renderer paralelo sólo para preview.
- El renderer no contiene colores hexadecimales de seis dígitos; obtiene los colores del estado/catálogo.

## Herencia y lacre

- Nombres, fecha y tipografía continúan heredándose del evento y se presentan como lectura.
- El monograma automático deriva de los nombres existentes.
- Cambiar Color Lacre activa material `theme` y actualiza preview/sello con el mismo valor.
- Se mantienen materiales, ornamentos, textos curvos, tamaño, kerning, posición, relieve, calidad, brillo y exportación SVG.

## Sincronización

- Aplicar el sobre personalizable sincronizado hace que su paleta efectiva gobierne invitación, portal de fotos, QR e impresión.
- Entradas independientes sólo coordinan los acentos permitidos por `config/experiences.json`.
- `Sin apertura` conserva los colores por defecto de la plantilla.
- Una papelería guardada no contamina otra apertura cuando deja de ser la entrada activa.

## QA

- Contrato de paridad de 16 presets y 15 materiales.
- Matriz de 64 plantillas x 15 aperturas visibles = 960 combinaciones cromáticas.
- QA visual 390x844 y 1440x900: 0 fallos, mínimo ~60 FPS y p95 máximo ~16.7 ms.
- Cinco escenarios de permisos usando roles reales `owner`, `developer`, `client` y entitlement `templates`.
- La suite global dependiente de npm/SQLite queda pendiente de ejecución en un entorno donde `npm ci` pueda instalar las dependencias; no se marca como PASS.
