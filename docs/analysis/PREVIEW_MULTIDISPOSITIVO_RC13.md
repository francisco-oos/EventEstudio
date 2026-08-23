# Preview multidispositivo y Store Composer · RC13

## Vista previa contextual

La Store muestra productos compatibles con el evento actual y puede simular temporalmente:

- tema;
- apertura;
- galería.

La simulación no persiste la selección ni crea derechos comerciales.

## Composer del carrito

Los productos del carrito pueden activarse/desactivarse para una simulación sin eliminarlos del carrito. Los slots exclusivos (`theme`, `opening`, `gallery`) evitan combinaciones imposibles: sólo una alternativa del mismo slot queda activa en la simulación.

## Teléfono real

El administrador puede crear un enlace temporal. El servidor guarda sólo el hash del token, su evento, creador y expiración. El enlace puede abrirse en otro dispositivo y deja de funcionar al vencer/revocarse.

El preview no equivale a publicación.

## Hostname público

`publicBaseUrl(event)` prioriza un `event_domains.hostname` verificado y principal. Si no existe, utiliza `SITE_URL`. Invitación y álbum consumen esta única resolución para evitar fijar Railway u otro proveedor dentro de QR/mensajes.
