# Integración de 5 plantillas, aperturas reutilizables y sellos dinámicos

## Alcance
Se integraron cinco nuevas referencias visuales analizadas de los videos entregados:

1. `powder-blue-letter` + apertura `powder-blue-seal`
2. `gala-marquee` + apertura `gala-curtain`
3. `celestial-constellation` + apertura `constellation-veil`
4. `blush-heart-letter` + apertura `blush-heart-emblem`
5. `gran-reserva` + apertura `reserve-uncork`

## Criterios técnicos aplicados
- Se reutilizó la misma arquitectura de aperturas ya aprobada en RC13–RC21.
- No se introdujeron dependencias nuevas ni renderers experimentales adicionales.
- Las aperturas nuevas usan HTML/CSS sobre la geometría base existente del sobre/carta.
- Se conservaron `prefers-reduced-motion`, `force-motion-preview` y temporizaciones legibles.
- Se evitó hardcodear iniciales visuales: el sello se genera en cliente según el nombre visible del evento o la pareja.

## Generador de sellos
Se agregó lógica en `public/app.js` para derivar el monograma y aplicar presets visuales de sello de forma reutilizable.

## Ajustes de catálogo
- `config/themes.json`: catálogo ampliado a 64 plantillas.
- `config/experiences.json`: catálogo ampliado a 22 aperturas totales.
