# ADR — Regalos multimétodo y mensaje motivador del anfitrión — EventStudio 6.14.2-rc.25

## Estado

Aceptado para la candidata QA RC25. La promoción a estable conserva las puertas de aceptación de RC23 y RC24.

## Contexto

RC24 separó transferencia bancaria de Openpay, estructuró los datos bancarios y añadió sugerencias para la dedicatoria que el invitado puede escribir al pagar. La revisión posterior identificó dos problemas de modelo:

1. `gifts.mode` seguía representando una selección excluyente y no permitía expresar con precisión combinaciones como lluvia de sobres más transferencia bancaria.
2. Las sugerencias existentes correspondían al mensaje del invitado hacia el anfitrión. Faltaba un mensaje independiente, configurado por el anfitrión y mostrado antes de los datos bancarios.

## Decisión 1 — Métodos de regalo no excluyentes

Se introduce `gifts.methods` como fuente de verdad para los métodos físicos y externos:

```json
{
  "cashEnvelopes": {"enabled": true, "instructions": "..."},
  "registry": {"enabled": false},
  "bankTransfer": {"enabled": true}
}
```

`gifts.openpay.enabled` permanece independiente porque representa un canal de cobro integrado y conserva configuración propia.

El panel utiliza toggles independientes. Activar o desactivar un método no modifica el estado de los demás.

### Compatibilidad

`gifts.mode` se conserva como campo derivado para eventos y código anteriores. `normalizeGiftMethods()` puede reconstruir los métodos desde los valores históricos `cash-envelopes`, `registry`, `bank-transfer`, `mixed` y `no-gifts`. Al guardar RC25, el servidor deriva nuevamente `mode` desde la combinación activa.

### Alternativas evaluadas

- Ampliar `mode` con más combinaciones enumeradas: descartado porque el número de combinaciones crece con cada método nuevo.
- Guardar un arreglo de strings: válido, pero insuficiente para configuración contextual por método, por ejemplo instrucciones de lluvia de sobres.
- Eliminar `mode` inmediatamente: descartado por riesgo de regresión sobre eventos y clientes anteriores.

## Decisión 2 — Configuración contextual

### Lluvia de sobres

`methods.cashEnvelopes.instructions` contiene las instrucciones del buzón físico. El bloque público sólo aparece cuando el método está activo.

### Mesa de regalos

`methods.registry.enabled` controla la publicación del enlace. Si está desactivado, el enlace no se renderiza aunque permanezca guardado para una activación posterior.

### Transferencia bancaria

`methods.bankTransfer.enabled` controla el bloque bancario. `gifts.bank` contiene:

- `bankName`
- `accountHolder`
- `clabe`
- `accountNumber`
- `referenceConcept`
- `instructions`
- `persuasionPresetId`
- `persuasionCustomText`

El bloque público requiere el método activo y al menos un dato bancario utilizable. Los campos vacíos no se renderizan.

## Decisión 3 — Separar dos direcciones de mensaje

RC25 mantiene dos flujos distintos:

### Mensaje del anfitrión al invitado

Se configura dentro de Transferencia bancaria. Puede provenir de un preset o ser totalmente personalizado. Se muestra antes de banco, titular, CLABE, cuenta y concepto.

El catálogo vive en `config/gift-persuasion-presets.json` y el servidor resuelve el texto mediante `src/gift-persuasion-presets.js`. `public/app.js` no contiene las frases del catálogo.

### Dedicatoria del invitado al anfitrión

Se conserva el textarea `openpayGiftMessage` y el catálogo `config/gift-message-presets.json`. El invitado puede escoger una sugerencia, editarla o escribir su propio texto. Este flujo no se reutiliza como mensaje motivador del anfitrión.

## Decisión 4 — Catálogo persuasivo

La primera versión incluye cuatro enfoques configurables:

1. Fondo de recuerdos / luna de miel: anclaje a experiencias.
2. Comodidad y normalización: reducción de fricción y prueba social percibida.
3. Elegancia y reciprocidad: reciprocidad no exigente.
4. Construcción de futuro: compromiso emocional y participación.

El catálogo conserva `label`, `strategy` y `text`. La invitación pública recibe únicamente el texto resuelto; los campos internos de selección se eliminan de la configuración pública.

El preset de comodidad menciona a personas que preguntaron por una vía práctica. Debe seleccionarse únicamente cuando esa formulación sea coherente con la situación real del evento. El anfitrión siempre puede elegir otro enfoque o escribir un mensaje personalizado.

## Decisión 5 — Render público y estabilidad visual

Los métodos se renderizan como bloques hermanos dentro de la sección de regalos. No se posicionan de forma absoluta y no comparten capas de animación con la apertura de invitación. Esto reduce riesgo de `z-index` conflict y layout overlap al combinar varios métodos.

La prueba visual RC25 valida combinaciones individuales, múltiples y vacías en 320×568, 390×844 y 1440×900, incluyendo overflow, CLS y solapamiento geométrico entre bloques.

## Riesgos y mitigaciones

- Eventos históricos sin `methods`: fallback determinista desde `mode`.
- Estado perdido al alternar toggles: normalización parcial conserva métodos no modificados; existe regresión unitaria específica.
- Transferencia activada sin datos: el bloque público no aparece hasta existir contenido utilizable.
- Texto persuasivo desconocido o manipulado: IDs no reconocidos se normalizan a vacío; los textos personalizados tienen longitud limitada y se renderizan con `textContent`.
- Confusión entre mensaje del anfitrión y dedicatoria del invitado: controles, almacenamiento y renderers independientes.
- Openpay como única opción: permitido; no reactiva lluvia de sobres, mesa ni transferencia.

## Componentes

- `config/gift-persuasion-presets.json`
- `src/gift-persuasion-presets.js`
- `src/gift-settings.js`
- `src/server.js`
- `public/admin.html`
- `public/admin.js`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `tests/rc25-gifts-modular.js`
- `tests/rc25-gifts-visual.py`

## Decisión 6 — Proyección pública mínima

Los datos configurados para un método desactivado permanecen guardados en la configuración administrativa para que el anfitrión pueda reactivarlos sin volver a capturarlos, pero no deben viajar innecesariamente a la invitación pública.

`src/gift-settings.js::publicGiftProjection()` aplica una proyección pública determinista:

- lluvia de sobres desactivada: instrucciones públicas vacías;
- mesa de regalos desactivada: enlace público vacío;
- transferencia desactivada: banco, titular, CLABE, cuenta, concepto, indicaciones y mensaje motivador públicos vacíos;
- métodos activos: sólo se proyectan los datos necesarios para renderizarlos.

La alternativa de limitarse a ocultar el DOM fue descartada porque los datos seguirían siendo visibles mediante `/api/config/:slug` aunque el usuario no hubiera activado ese método.
