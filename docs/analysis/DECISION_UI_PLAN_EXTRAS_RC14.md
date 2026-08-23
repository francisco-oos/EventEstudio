# Decisión UI — Plan y extras (RC14)

## Problema
“Plan y mejoras” mezclaba el estado del plan activo, productos adicionales, almacenamiento, publicación y una simulación persistente. En móvil generaba overflow y en escritorio ocupaba demasiado espacio.

## Decisión
La navegación pasa a “Plan y extras”. Dentro de ella:
- Tu plan activo.
- Extras para tu evento.
- Publicación y dirección.
- Almacenamiento.

Los bloques son colapsables. La Store no mantiene un teléfono gigante en pantalla: `Probar` abre un modal. En escritorio la simulación inicia en teléfono; en móvil inicia en escritorio escalado. Ambos modos pueden alternarse desde el mismo modal.

## Referencias estudiadas
- Canva Pricing: https://www.canva.com/pricing/
- Wix Plans: https://www.wix.com/plans
- Squarespace Pricing: https://www.squarespace.com/pricing
- WedSites Pricing: https://wedsites.com/pricing

## Qué se adopta
Tarjetas de plan resumidas, límites visibles, un plan destacado, CTA/configuración clara y detalles bajo demanda.

## Qué se descarta
- Duplicar cada comparación en tablas gigantes permanentes.
- Preview persistente que reduzca el espacio del catálogo.
- Ocultar el plan actual dentro de la Store.
