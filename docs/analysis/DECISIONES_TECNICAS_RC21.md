# Decisiones técnicas — EventStudio 6.14.2-rc.21

## Base y precedencia

RC21 parte de `EventStudio-6.14.2-rc.20(1).zip`. RC13 se usó sólo como referencia histórica para la coreografía de sobres; no sustituyó módulos ni datos actuales. La base entregada se abrió y probó únicamente mediante copia temporal. RC21 prevalece donde modifica preview, geometría y catálogo floral; las decisiones anteriores continúan vigentes para lo demás.

## Decisiones y razonamiento

| Tema | Decisión RC21 | Motivo |
|---|---|---|
| “Probar efectos” no mostraba la apertura | Cada evento obtiene un enlace temporal autorizado y reutilizable; la URL del iframe conserva token, evento y parámetros. | Un iframe no hereda el encabezado Bearer del panel. El URL anterior llevaba `preview=1`, pero no una identidad autorizada. |
| Preview de tienda para cliente | Puede probar un producto público, aprobado y compatible sin adquirirlo; un producto interno sigue bloqueado. | Probar no equivale a conceder. La autorización se decide en servidor y se prueba antes/después del preview. |
| Owner/developer y productos internos | Un preview creado por rol de plataforma conserva ese actor incluso fuera del panel. | El token registra `created_by`; resolver ese creador evita que el iframe degrade al catálogo del cliente. |
| Corazón con objetos superpuestos | La escena mide en tiempo real el final del texto y el inicio del botón, y dibuja dentro del intervalo seguro. | Tamaños fijos no resisten nombres largos, zoom o distintos viewports. Se validó 1365×724 y 390×844. |
| Sobres RC13 | Se conserva el orden `back → card → flap → front → seal`, pero no la salida cercana a 1.05 s. | La coreografía era correcta; la cadencia era demasiado rápida para lectura. RC21 conserva 3.6–4.3 s según estilo. |
| Flor del ZIP | Se añadió `night-flower-original` como experiencia independiente: tres flores, cuatro pétalos por flor, pradera y luciérnagas; color configurable. | No reemplaza Jardín luminoso ni rompe derechos existentes. La implementación local reinterpreta la composición sin ejecutar HTML/CSS externo. |
| Movimiento reducido de Windows | Público respeta `prefers-reduced-motion`; sólo un preview explícito usa `forceMotion=1`. | Accesibilidad y revisión visual tienen propósitos distintos. |
| Compatibilidad de BD | No cambia `SCHEMA_VERSION`; el nuevo producto se inserta con `ON CONFLICT DO NOTHING`. | Planes, precios, perfiles, concesiones y ajustes administrados no se reescriben. |
| Estado entre eventos | Al cambiar workspace se limpian preview, Store y composición temporales. | Evita que una URL o producto del evento A aparezca al trabajar con el evento B. |

## Regla resultante de aperturas

| Actor | Producto interno | Producto público no adquirido | Producto adquirido/cortesía |
|---|---:|---:|---:|
| Owner/developer técnico | visible y configurable | visible y configurable | visible y configurable |
| Cliente | no visible | visible sólo para probar; no guardar | visible y configurable |
| Visitante | sólo si quedó autorizado en el evento | sólo si quedó autorizado | visible según configuración publicada |

## Límite de la candidata

Contratos de geometría, color, duración, responsive y reduced-motion pasan. El contenedor no dispone de Chromium local, por lo que la matriz ocular en Edge/Chrome/Firefox/Safari y dispositivos físicos continúa siendo requisito antes de promover RC21 a estable.
