# Conversion Analytics · RC13

## Objetivo

Medir en EventStudio qué atrae, qué se prueba y qué se compra para no decidir productos, plantillas o precios únicamente por intuición.

## Implementación actual

Se usa una tabla first-party SQLite `conversion_events`. No se almacena texto libre de invitados en este embudo. Los nombres de evento están en una whitelist y los metadatos aceptados están limitados.

Eventos iniciales:

- `landing_view`
- `catalog_view`
- `showcase_view`
- `template_previewed`
- `store_view`
- `store_search`
- `store_product_previewed`
- `cart_added`
- `cart_removed`
- `checkout_started`
- `payment_completed`
- `publication_requested`
- `published`
- `preview_link_created`
- `preview_link_opened`

La vista owner resume embudo, productos, temas y tipos de evento.

## Repositorio evaluado

Umami: https://github.com/umami-software/umami

Ventajas: analítica de producto, privacidad, self-hosting, licencia MIT.

Decisión RC13: **no incorporarlo al runtime**. Para la escala actual, SQLite evita otro servicio, otro PostgreSQL y otro ciclo de actualización. Se conserva como posible `AnalyticsProvider` futuro si el volumen o necesidades de cohortes justifican el costo operativo.

## Uso previsto

Las métricas deberán responder preguntas como:

- qué familia de diseño genera más pruebas;
- qué productos llegan más al carrito;
- qué tipos de evento compran más;
- qué CTA convierte mejor;
- qué módulos justifican nuevas variantes.

No se promete una mejora porcentual de ventas antes de medirla.
