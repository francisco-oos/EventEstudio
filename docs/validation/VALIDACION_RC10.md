# Validación de EventStudio 6.14.2 RC10

Este documento registra el alcance que debe aprobar la entrega RC10 antes de
promoverla.

## Controles obligatorios

- Instalación limpia con el `package-lock.json` incluido.
- Migración aislada desde el esquema `614204` al `614205`, con respaldo previo,
  `quick_check` y conservación de usuarios, eventos, invitados y ajustes.
- Catálogo, planes, promociones, cortesías, carrito y pedidos pendientes.
- Separación entre compra, promoción y cortesía; sólo pagos con estado `paid`
  pueden contarse como ingresos.
- Dependencias comerciales, límites de uso y almacenamiento.
- Aislamiento entre propietario, cliente y evento.
- Menú contextual, búsqueda de plantillas, bloqueo de aplicación y vista previa.
- Idioma persistente de la cuenta.
- Cancelación individual de mensajes en cola.
- Suite completa de autenticación, CSRF, orígenes, cabeceras, RSVP, Excel,
  fotografías, QR/PDF, invitaciones físicas, respaldos y restauración.
- Matriz de 42 temas por 8 formatos QR y 42 invitaciones físicas.
- `npm audit` sin vulnerabilidades conocidas.

## Reglas de aceptación comercial

1. Dar una cortesía devuelve ingreso cero y no crea un pago.
2. Enviar un carrito crea únicamente un pedido `pending_payment`.
3. Un pedido pendiente no cambia el menú ni los derechos.
4. Los productos ocultos, experimentales o deshabilitados no aparecen al
   cliente.
5. Experiencia Premium contiene todo lo que ofrecen los planes inferiores.
6. El propietario puede abrir el perfil de un cliente y reproducir su menú sin
   cambiar propiedad ni mezclar datos.

## Resultado de la regresión

- Instalación desde cero: 291 dependencias instaladas desde el
  `package-lock.json`; `better-sqlite3` compilado y cargado correctamente.
- Árbol de dependencias: íntegro.
- `npm audit`: 0 vulnerabilidades conocidas.
- Sintaxis de servidor, comercio, migración, permisos y panel: aprobada.
- Migración RC9→RC10: aprobada con respaldo y sin pérdida de datos.
- Catálogo, creación y edición de planes, promociones y cortesías: aprobados.
- Tienda y carrito: un pedido pendiente no concede productos ni registra
  ingresos.
- Menú contextual, búsqueda sin acentos, plantillas bloqueadas y vista previa:
  aprobados.
- Autenticación, autorización, aislamiento, CSRF, red local y HTTPS: aprobados.
- RSVP, invitados, Excel, fotografías, música, respaldo y restauración:
  aprobados.
- 42 invitaciones físicas y 336 combinaciones de plantilla × formato QR:
  aprobadas.

El SHA-256 se calcula y comunica sobre el ZIP definitivo después de formar el
paquete; no se incluye dentro del propio archivo para evitar una referencia
circular.
