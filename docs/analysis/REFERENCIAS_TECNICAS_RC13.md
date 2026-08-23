# Referencias técnicas, comparables y decisiones · RC13

Fecha de revisión: 9 de agosto de 2026

## Diseño floral y suites coordinadas

| Fuente | Qué se estudió | Decisión EventStudio |
|---|---|---|
| Minted · https://www.minted.com/category/wedding/flower-botanical-wedding-invitations | Familias botánicas, RSVP/enclosures coordinados. | Adoptar el principio de suite, no diseños/activos. |
| Minted · https://www.minted.com/product/wedding-websites/MIN-S2R-DWW/vintage-botanical | Continuidad website + stationery/day-of. | Reforzar kit visual común web/QR/impresos. |
| Canva · https://www.canva.com/create/wedding-invitation-kits/ | Invitación + RSVP + itinerario + thank-you coordinados. | Formalizar `EventDesignKit`; no incorporar Canva. |
| Canva · https://www.canva.com/create/wedding-websites/ | Website, detalles, guest list y RSVP. | Confirmación de dirección de producto ya existente. |
| The Knot · https://www.theknot.com/paper | Papelería y website coordinados. | Mantener QR como puente a experiencia digital. |
| Greenvelope · https://www.greenvelope.com/designs/spring-wedding-invitations | Marcos florales y variantes de naturaleza. | Inspiración de composición, sin copiar catálogo. |
| Greenvelope · https://www.greenvelope.com/blog/baby-in-bloom-invitations/ | Área central limpia rodeada por flores. | Validó el uso de espacio negativo para legibilidad. |

## Repositorios/herramientas gratuitas evaluadas

### SVG.js
https://github.com/svgdotjs/svg.js

MIT, ligero, sin dependencias para manipulación/animación SVG. **No se incorpora RC13** porque las nuevas flores pueden expresarse como SVG nativo estático y CSS; agregar dependencia no aporta suficiente valor todavía.

### Umami
https://github.com/umami-software/umami

MIT, analítica privacy-first y self-hosted. **Diferido**: RC13 usa analítica first-party en SQLite para cero infraestructura adicional. Umami se conserva como candidato a `AnalyticsProvider`.

### Uppy
https://github.com/transloadit/uppy

Uploader modular con `tus`, recuperación/reanudación y soporte para conexiones deficientes. **Aprobado para laboratorio posterior**, no integrado en RC13. Objetivo: fotografías de invitados por QR sin reiniciar cargas interrumpidas.

### Konva
https://github.com/konvajs/konva

Canvas interactivo para editores 2D desktop/móvil. **PoC futuro** contra el editor de mesas existente; no reemplazar lo que funciona hasta superar pruebas de carga, móvil, guardado y exportación.

## Referencias previas que siguen vigentes

- Domain-OSS / DigitalPlat: https://github.com/DigitalPlatDev/Domain-OSS — laboratorio/arquitectura, no dependencia del producto.
- Dokploy: https://dokploy.com/ — candidato a `DeploymentProvider` self-hosted futuro.
- Coolify: https://coolify.io/ — alternativa futura de deployment.
- Uptime Kuma: https://github.com/louislam/uptime-kuma — monitor externo, no código dentro de EventStudio.
- tsParticles: https://github.com/tsparticles/tsparticles — referencia de partículas; RC13 usa Canvas 2D propio para evitar dependencia.
- Three.js: https://threejs.org/ — reservado para experiencias que justifiquen 3D; no necesario para el corazón actual.
- Motion: https://motion.dev/ — referencia para movimiento; no incorporado mientras CSS/Web APIs cubran el caso.

## Principio de adopción

1. identificar el problema de EventStudio;
2. estudiar productos/repositorios existentes;
3. extraer el patrón útil;
4. comprobar licencia/costo/operación;
5. preferir interfaz/adaptador sobre dependencia rígida;
6. conservar las capacidades ya validadas;
7. documentar qué se descartó y por qué.

No se adapta EventStudio al repositorio: el repositorio sólo se usa si satisface un contrato de EventStudio y aporta mejora neta comprobable.
