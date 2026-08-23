# Guía de ajuste manual de diseños QR

## 1. Tamaño físico y nombre de cada plantilla

Archivo:

```text
config/qr-templates.json
```

Campos importantes:

- `id`: identificador utilizado por el sistema.
- `name`: nombre visible.
- `format`: tamaño del PDF.
  - `5x7`: 5 × 7 pulgadas (360 × 504 puntos).
  - `square`: 5 × 5 pulgadas (360 × 360 puntos).
  - `4x9`: 4 × 9 pulgadas (288 × 648 puntos).
  - `letter-fold`: carta 8.5 × 11 pulgadas con dos paneles y guía de doblez.
- `mockup`: clase visual utilizada en la vista previa.
- `printNote`: recomendación mostrada al usuario.

## 2. Posiciones del PDF descargable

Archivo:

```text
src/server.js
```

Busca estas funciones:

```javascript
function drawQrCard(...)
function drawStandardQrCard(...)
function drawFoldPanel(...)
```

Los formatos verticales utilizan zonas independientes para evitar cruces:

```javascript
layout.kicker      // texto superior
layout.title       // título
layout.qr          // código y zona blanca
layout.message     // mensaje principal
layout.instruction // instrucción breve
layout.pill        // nombre de mesa
layout.couple      // nombre del evento
layout.date        // fecha
```

Cambios típicos:

- Cada zona tiene `y` y `h`; no permitas que `y + h` alcance la siguiente zona.
- Conserva el QR en al menos 128 puntos dentro de los formatos actuales.
- No reduzcas el margen interno del QR: se genera con cuatro módulos blancos.
- Las tarjetas carta se ajustan en `drawFoldPanel()`; el panel superior debe
  permanecer girado 180° para quedar derecho después del doblez.

Los tamaños de página se definen en los endpoints:

```javascript
/api/admin/qr-card.pdf
/api/admin/qr-set.pdf
```

Busca:

```javascript
const size = ...
```

## 3. Adornos del PDF

En el mismo archivo:

```text
src/server.js
```

Busca:

```javascript
function drawDecorativeCorners(...)
```

Ahí se ajustan líneas, círculos, esquinas y adornos según `templateId`.

## 4. Vista previa sobre la mesa

Archivo:

```text
public/styles.css
```

Busca estas clases:

```css
.qr-physical-mockup
.mockup-card
.mockup-qr
.mockup-base
.qr-mockup-tent
.qr-mockup-arch
.qr-mockup-square
.qr-mockup-number
.qr-mockup-photo
.qr-mockup-strip
.qr-mockup-double
```

Propiedades más útiles:

- `width` y `min-height`: tamaño de la tarjeta.
- `padding`: espacio interno.
- `transform`: posición y escala.
- `.mockup-qr width/height`: tamaño visual del QR.
- `.mockup-base`: tamaño de la base.

## 5. Miniaturas del catálogo

Archivo:

```text
public/styles.css
```

Busca:

```css
.mini-holder
.mini-tent
.mini-arch
.mini-square
.mini-number
.mini-photo
.mini-strip
.mini-double
```

Estas clases sólo afectan las pequeñas tarjetas de selección, no el PDF.

## 6. Lógica de selección y vista previa

Archivo:

```text
public/admin.js
```

Busca:

```javascript
renderQrTemplates()
updateQrMockup()
```

- `renderQrTemplates()` crea el catálogo.
- `updateQrMockup()` aplica la clase correspondiente y actualiza nombre, mesa y texto.

## Recomendación

Ajusta primero una sola plantilla, por ejemplo:

```text
classic-holder
```

Descarga una tarjeta PDF e imprime al **100 % o tamaño real**, sin “Ajustar a página”.
Escanea una muestra desde 50–100 cm antes de mandar el set completo a imprenta.
