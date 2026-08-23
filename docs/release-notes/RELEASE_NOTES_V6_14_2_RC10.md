# EventStudio 6.14.2 RC10

RC10 reemplaza la configuración comercial duplicada de RC9 por un catálogo
único de productos, planes y derechos calculados por evento. La migración
avanza el esquema SQLite a `614205`; conserva los datos existentes y convierte
los complementos históricos en concesiones de origen `legacy` con valor cero.

## Cambios principales

- Catálogo de módulos, funciones, colecciones, plantillas y almacenamiento con
  precio y estado `available`, `experimental`, `hidden` o `disabled`.
- Constructor de planes por arrastre con precio, vigencia y límites editables.
- Los planes inferiores no pueden ofrecer más productos que Experiencia
  Premium.
- Derechos por evento con origen auditable: plan, compra, promoción, cortesía o
  migración.
- Una cortesía o promoción no crea pagos ni alimenta ingresos.
- Perfil comercial por cliente con plan, eventos, derechos, vigencia, usos,
  almacenamiento adicional, revocación y vista previa de su menú real.
- Tienda del cliente organizada por categorías y carrito preparado para un
  proveedor de pagos. Un pedido pendiente no concede acceso.
- Plantillas compatibles visibles por evento; las no incluidas pueden
  previsualizarse y agregarse individualmente al carrito.
- Búsqueda de plantillas sin acentos y sin volver a preguntar tipo de evento o
  nivel del plan.
- Menú de soporte que alterna entre vista contextual del cliente y vista
  técnica del propietario.
- Temática Express sólo aparece en celebraciones sencillas compatibles; una
  boda no recibe controles de baby shower o fiesta infantil.
- Idioma de panel persistente por cuenta, independiente del idioma del
  propietario que la administra.
- Botón para retirar una persona de la cola automática de WhatsApp cuando esa
  integración esté habilitada.
- Tarjeta de modo desarrollador reducida a un control compacto.

## Compatibilidad y seguridad

- RSVP, invitados, fotografías, música, QR, invitaciones físicas, impresión,
  respaldos y restauración conservan sus rutas y datos.
- El QR fotográfico incorpora su dependencia del álbum; las invitaciones
  físicas continúan siendo independientes.
- La configuración histórica `purchasedFeatures` se conserva para migración,
  pero ya no es una fuente editable ni registra ingresos.
- Los pagos continúan deshabilitados hasta configurar un proveedor real y
  confirmar sus webhooks.

