# Validación RC30

Fecha: 2 de septiembre de 2026

## Objetivo

Validar las regresiones observadas después de RC29 y asegurar que `Sobre personalizable` actúa como fuente cromática de todos los entregables únicamente mientras esa apertura está seleccionada.

## Pruebas específicas

### Contrato RC30

Comando:

```text
npm run test:rc30
```

Cobertura:

- `unified-envelope + customized` fuerza `syncDesignTokens=true`;
- el sobre es autoritativo sólo mientras esa apertura está activa;
- las demás aperturas visibles usan política `template`;
- el CTA tiene un destino DOM explícito y no busca el primer `strong`;
- la ventana avanzada ya no presenta un interruptor opcional de sincronización;
- `storybook-seal` oculta su sello histórico cuando existe lacre central;
- las reglas visuales de los 64 temas no repiten sus propios hexadecimales de token fuera del bloque de defaults;
- las 64 plantillas aceptan los tokens de papelería y mantienen contraste mínimo WCAG para tinta/papel;
- el portal de fotos consume `_palette`;
- la impresión física usa `themeDescriptor(settings).palette`;
- el QR usa esa misma paleta cuando el sobre es autoritativo;
- la configuración pública expone `_palette` y `_surfaceTexture` resueltos por servidor.

Resultado: PASS.

```text
✓ RC30: nombre de tarjeta, lacre único y sincronización total del sobre en 64 plantillas; aperturas independientes conservan defaults.
```

### QA visual pública de la regresión reportada

Comando:

```text
python3 tests/rc30-public-envelope-visual.py
```

Se reproduce el caso `theme-storybook-seal` con `Ariana y Francisco` y `unified-envelope` personalizado.

Resultado:

- nombre dentro de tarjeta: `Ariana y Francisco`;
- CTA: `Abrir invitación`;
- los siete tokens del `body` coinciden con la papelería aplicada;
- después de la apertura existe exactamente un SVG en `#heroWaxSeal`;
- el pseudo-elemento histórico de la plantilla tiene `display:none`;
- la invitación entra en estado `invitation-open`;
- errores de página/consola: 0.

Se ejecutó además el mismo tema con `gala-curtain`: los siete tokens permanecen en la paleta default suministrada por la plantilla y no adoptan la papelería guardada.

Resultado: 2 casos, 0 fallos.

Evidencia: `docs/validation/evidence/RC30_PUBLIC_ENVELOPE_VISUAL.json`.

### QA visual del Estudio Avanzado

Comando:

```text
python3 tests/rc28-stationery-studio-visual.py
```

El nombre histórico del script se conserva por compatibilidad con la automatización existente; su contenido corresponde a RC30.

Se verificaron:

- 390 x 844 y 1440 x 900;
- herencia de nombre, fecha y tipografía;
- 16 presets y sus miniaturas;
- 15 materiales y sus miniaturas;
- marcos, divisores, liners, overlays y postales;
- cambio reactivo de color exterior y lacre;
- clic para abrir, cerrar y volver a abrir;
- `PUT` atómico `presentation + stationery + seal`;
- `customized=true` y `syncDesignTokens=true` al aplicar;
- ausencia de overflow y errores de página;
- rendimiento del tramo animado.

Resultado observado en RC30:

```json
{"cases":2,"profileCases":5,"failures":0,"minFps":59.99,"avgFps":59.99,"maxP95IntervalMs":16.70}
```

Evidencia: `docs/validation/evidence/RC30_STATIONERY_INDEX_PARITY_VISUAL.json`.

## Perfiles

La prueba visual del estudio cubre cinco escenarios con los roles reales y el entitlement `templates`:

| Escenario | Rol | templates | Aplicar |
| --- | --- | ---: | --- |
| Propietario/Superadmin conceptual | owner | false | permitido |
| Desarrollador | developer | false | permitido |
| Cliente de pago | client | true | permitido |
| Gratuito | client | false | denegado |
| Cortesía con concesión | client | true | permitido |

Resultado: 5/5 según contrato.

## Regresiones de bajo costo ejecutadas

```text
node tests/project-integrity.js
node tests/source-references.js
node tests/mobile-ui.js
node tests/rc14-regressions.js
npm run test:rc27
npm run test:rc28
npm run test:rc29
npm run test:rc30
python3 tests/rc28-stationery-studio-visual.py
python3 tests/rc30-public-envelope-visual.py
```

Todos los comandos anteriores terminaron en PASS en esta intervención.

## Suite global dependiente de SQLite

La suite completa sigue requiriendo las dependencias nativas del proyecto, incluida `better-sqlite3`. Si el entorno no contiene `node_modules` y no permite completar `npm ci`, no se debe convertir esa ausencia en un PASS documental. La promoción a producción exige ejecutar en el entorno normal del repositorio:

```text
npm ci
npm test
npm run test:visual
npm run audit
npm audit --audit-level=moderate
```

RC30 se entrega como candidata QA con los contratos específicos y visuales indicados arriba verificados.
