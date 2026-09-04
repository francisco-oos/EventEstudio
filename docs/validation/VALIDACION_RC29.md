# Validación RC29

Fecha: 2 de septiembre de 2026

## Alcance

Validar que la ventana avanzada conserva la integración segura de RC28 y recupera la apariencia/interacción del generador maestro: nueve bibliotecas, miniaturas vectoriales, clic sobre el sobre, lacre reactivo, herencia de metadatos y coordinación cromática reversible.

## Contrato estático RC29

`tests/rc29-stationery-index-parity.js` valida:

- versión `6.14.2-rc.29`;
- 4 geometrías, 15 materiales y 16 presets;
- 9 liners, 10 overlays, 7 estampillas, 8 marcos y 9 divisores;
- etiqueta/descripción de recursos de catálogo;
- estructura de 90 px + 360 px + escenario central;
- nueve pestañas del generador maestro;
- ausencia de botones separados de abrir/cerrar;
- clic sobre `stationeryStudioMount` como controlador de apertura;
- herencia de nombres, fecha y tipografía;
- `PUT` atómico `presentation + stationery + seal`;
- miniatura SVG de los 15 materiales;
- miniatura SVG real de todos los liners/overlays/estampillas/marcos/divisores distintos de `none`;
- aplicación de los 16 presets y transferencia de receta de lacre;
- autoridad de papelería sólo con `unified-envelope` activo y sincronizado;
- tokens completos de papelería;
- contraste WCAG de la matriz de plantillas/aperturas;
- ausencia de colores hexadecimales de seis dígitos en el renderer compartido;
- comentarios/lógica técnica sin emojis en los JS intervenidos.

Resultado ejecutado: **PASS**.

```text
✓ RC29: paridad visual del generador maestro, miniaturas, clic abrir/cerrar, lacre y sincronización 64x15
```

## Matriz cromática

Se cruzaron 64 plantillas con 15 aperturas visibles: **960 combinaciones**.

Para cada combinación se valida la paleta efectiva después de `applyOpeningCoordination()` y `ensureAccessiblePalette()`. La tinta sobre papel debe conservar contraste mínimo 4.5:1. También se valida la paleta completa de una papelería autoritativa.

Resultado: **PASS** en el contrato RC29.

## QA visual y funcional del estudio

Comando ejecutado:

```text
python3 tests/rc28-stationery-studio-visual.py
```

El nombre histórico del archivo se conserva para no romper el script `test:visual`; su contenido y evidencia corresponden a RC29.

Viewports:

- 390 x 844;
- 1440 x 900.

En ambos se verificó:

- herencia de `Andrea & Mateo`, fecha y tipografía;
- las 16 tarjetas de preset con preview SVG;
- aplicación/render de los 16 presets;
- las 15 miniaturas SVG de materiales y aplicación de los 15 materiales;
- navegación, preview y selección de todos los marcos, divisores, liners, overlays/encajes y estampillas, incluyendo `none`;
- cambio reactivo de color exterior;
- cambio de `sealColor` y transición automática del material a `theme`;
- preview SVG del lacre;
- clic 1 abre, clic 2 cierra y clic 3 vuelve a abrir;
- `Aplicar` genera exactamente `presentation`, `stationery` y `seal`;
- persistencia de los dos colores editados;
- `customized=true` y `syncDesignTokens=true`;
- ausencia de overflow horizontal;
- ausencia de errores de consola/página;
- rendimiento del tramo animado.

Resultado final:

```json
{"cases":2,"profileCases":5,"failures":0,"minFps":60.00,"avgFps":60.00,"maxP95IntervalMs":16.70}
```

Evidencia: `docs/validation/evidence/RC29_STATIONERY_INDEX_PARITY_VISUAL.json`.

## Perfiles

El QA visual usa los roles reales del esquema (`owner`, `developer`, `client`) y modela la condición comercial mediante la feature `templates`:

| Caso conceptual | Rol técnico | `templates` | Resultado |
| --- | --- | --- | --- |
| Superadmin/propietario | owner | false | puede aplicar |
| Desarrollador | developer | false | puede aplicar |
| Anfitrión de pago | client | true | puede aplicar |
| Gratuito sin derecho de plantillas | client | false | sólo consulta |
| Cortesía con concesión explícita | client | true | puede aplicar |

Resultado: **5/5 PASS** en cliente. La API conserva su propia verificación de permisos.

## Regresiones ejecutadas

Los siguientes comandos se ejecutaron correctamente sobre el árbol RC29 durante la intervención:

```text
node tests/project-integrity.js
node tests/source-references.js
node tests/mobile-ui.js
node tests/local-network.js
node tests/animation-contracts.js
node tests/rc20-regressions.js
node tests/rc21-visual-contracts.js
node tests/rc27-stationery-engine.js
node tests/rc28-stationery-studio.js
node tests/rc29-stationery-index-parity.js
node scripts/audit-project.js
python3 tests/rc28-stationery-studio-visual.py
```

Los contratos históricos `rc21-visual-contracts` y `rc27-stationery-engine` contenían aserciones sobre arquitectura ya sustituida deliberadamente por RC28. Se actualizaron sólo esas aserciones para apuntar al catálogo/launcher vigentes; no se silenció ninguna condición funcional del producto.

## Puerta dependiente de npm/SQLite

La suite global `npm test` **no se declara PASS** en este entorno. Se intentó preparar dependencias mediante `npm ci --no-audit --no-fund`, pero la instalación no pudo completarse; los módulos nativos/requeridos no quedaron disponibles. Se ejecutó después `npm test`: pasó `project-integrity`, `source-references`, `mobile-ui`, `local-network` y `rc14-regressions`, y se detuvo al iniciar `tests/data-safety.js` con `MODULE_NOT_FOUND: better-sqlite3`. Es un bloqueo de preparación del entorno, no un PASS ni un fallo funcional atribuido al cambio RC29.

Por la misma razón no se declara `npm audit` como ejecutado satisfactoriamente. Antes de promover a producción debe ejecutarse, en un entorno con dependencias instalables:

```text
npm ci
npm test
npm run test:visual
npm run audit
npm audit --audit-level=moderate
```

Esta limitación ambiental no se convierte en PASS documental. `node scripts/audit-project.js` sí terminó en PASS; además reportó como nota histórica 37 textos estáticos de la sección Configuración sin clave literal de i18n. Ese contador pertenece al panel administrativo general y no al renderer RC29; permanece como deuda visible y no se oculta en esta entrega.

## Criterio de aceptación

RC29 queda apta como **candidata QA de integración visual** porque los contratos específicos de papelería, coordinación, perfiles en cliente, paridad de catálogo, responsive y rendimiento pasan. La promoción a release/producción requiere completar la puerta global dependiente de npm/SQLite indicada arriba.
