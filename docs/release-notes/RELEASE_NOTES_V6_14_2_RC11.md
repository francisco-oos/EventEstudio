# EventStudio 6.14.2 RC11

RC11 reorganiza el modelo comercial sin mezclar el estado global de una función
con lo que incluye un paquete o lo que posee un cliente.

## Cambios principales

- **Productos y disponibilidad** usa tarjetas compactas con miniatura y abre un
  editor independiente para precio, visibilidad y estado global.
- **Constructor de paquetes** muestra resúmenes y abre un editor con nombre,
  precio, vigencia, conservación posterior, almacenamiento, eventos, invitados
  y selección completa de módulos, funciones y plantillas.
- La prueba gratuita usa el paquete interno `trial`: dura siete días, muestra la
  experiencia completa y limita el almacenamiento base a 100 MB.
- El almacenamiento es repetible y acumulable. Dos compras de 500 MB conceden
  1,000 MB y la activación de una orden es idempotente.
- Las compras pagadas, los paquetes de cortesía y las funciones de cortesía
  generan notificaciones para el cliente sin registrar una cortesía como
  ingreso.
- Un cliente sólo puede renovar su paquete actual o mejorar; el servidor rechaza
  descensos desde Plan y mejoras.
- La conservación después del vencimiento ahora procede de cada paquete y el
  ciclo de vida sólo considera la suscripción más reciente del propietario.
- Plan y mejoras se ordena como Suscripción, Espacio del evento, Mejoras,
  dominio e idioma.
- El modo desarrollador ocupa una franja compacta y la tipografía aprovecha todo
  el ancho.
- Nuevo evento usa un diálogo con tipo y nombre, sin `prompt()`.
- Usuarios y clientes incluyen búsqueda y filtros; clientes se pagina en grupos
  de 20.
- Se añadieron álbum clásico, coverflow, tarjetas apiladas, masonry y enfoque
  suave, implementados localmente sin depender de una biblioteca externa.
- Los textos personalizados pueden tener traducciones persistentes por idioma.
  La autogeneración usa un proveedor seguro del servidor; la edición manual
  permanece disponible.
- “Escuchar desde aquí” mueve y reproduce el controlador de Spotify ya cargado
  en el mismo gesto del usuario.

## Esquema

El esquema avanza a `614206`. Antes de migrar se conserva el respaldo previo
verificado. Se agregan `plans.retention_days` y `account_notifications`.

## Seguridad

No se integró ninguna clave compartida por chat ni se añadió una credencial al
cliente. Las claves de traducción se leen exclusivamente desde variables de
entorno del servidor.
