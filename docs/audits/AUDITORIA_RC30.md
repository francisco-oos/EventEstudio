# Auditoría RC30 — Sobre, paleta y lacre

Fecha: 2 de septiembre de 2026

## Hallazgos corregidos

### A-30-01 — El CTA sobrescribía el nombre de la tarjeta

Se identificó una selección DOM no semántica en `public/app.js`: `openingButton.querySelector('strong')`. El primer `strong` podía pertenecer al renderer del sobre. Se sustituyó por `#openingActionLabel`.

Estado: corregido y cubierto por prueba estática y visual pública.

### A-30-02 — El sobre podía aplicarse sin coordinar los entregables

La autoridad cromática dependía del booleano opcional `syncDesignTokens`. Para `unified-envelope` personalizado se eliminó la ambigüedad: la sincronización se fuerza en normalización, cliente y persistencia.

Estado: corregido.

### A-30-03 — Paleta pública bloqueada por colores literales

Se auditó `public/styles.css` contra las variables base de los 64 temas. Se sustituyeron 155 repeticiones exactas de colores de tema y 13 usos RGBA equivalentes por consumo de tokens CSS. Las declaraciones de defaults de cada tema permanecen intactas.

Contrato automatizado: fuera de los bloques base y de las reglas de animación `.opening-*`, una regla visual de tema no puede volver a fijar literalmente un color que ya es uno de sus tokens base.

Estado: corregido; fugas exactas detectadas por el contrato RC30: 0.

### A-30-04 — Doble sello en `storybook-seal`

La plantilla mantenía un pseudo-elemento de lacre y el motor central renderizaba `#heroWaxSeal`. Se añadió sustitución condicional mediante `.has-template-seal` y se posicionó el lacre central en la zona de cierre prevista por el tema.

Estado: corregido; prueba visual confirma un SVG central y pseudo-elemento oculto.

### A-30-05 — QR podía ignorar el sobre autoritativo

La preferencia histórica `qrDesign.useInvitationColors=false` podía separar el QR de la identidad seleccionada. En modo `unified-envelope` personalizado el QR usa la misma paleta efectiva. En otras aperturas conserva su comportamiento previo.

Estado: corregido.

### A-30-06 — Aperturas independientes podían armonizar entregables

Las aperturas visibles no unificadas se normalizaron a política `template`. La animación puede conservar internamente su color propio, pero no reescribe landing/fotos/QR/impresión.

Estado: corregido.

## Flujo de datos auditado

```text
Evento
  -> presentation.openingStyle
  -> stationery normalizada
  -> stationeryIsAuthoritative()
  -> themeDescriptor()
  -> ensureAccessiblePalette()
  -> _palette
       -> invitación pública
       -> portal de fotos
       -> QR
       -> impresión física
```

La bifurcación es intencional:

```text
unified-envelope + customized
  => tokens del sobre

cualquier otra apertura
  => paleta default/configurada de la plantilla
```

## Hardcode

No se eliminaron los colores por defecto de las plantillas: son datos de diseño necesarios. El objetivo de la auditoría fue eliminar duplicaciones que impidieran sobrescribir esos defaults mediante tokens. Las reglas de apertura mantienen sus colores propios porque pertenecen a la animación, no a la paleta del entregable.

## Compatibilidad

- la configuración de papelería sigue persistiendo aunque el usuario cambie temporalmente a otra apertura;
- al volver a `unified-envelope` se recupera la papelería personalizada;
- las aperturas no relacionadas con sobres no fueron convertidas ni eliminadas;
- la herencia de nombre, fecha y tipografía permanece sin segunda captura.
