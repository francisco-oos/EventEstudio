# EventStudio 6.14.2 RC7

RC7 amplía EventStudio a un catálogo comercial multi-evento sin cambiar el
esquema SQLite `614204`. Conserva las correcciones móviles, de acceso, respaldo
y sincronización de RC6.

## Catálogo y alta

- Nueva página pública `/catalogo.html` con búsqueda visual, filtros por tipo de
  evento y nivel, comparación de planes y constructor informativo de paquete.
- Alta privada guiada en tres decisiones: celebración, plan y cuenta.
- La plantilla elegida en el catálogo llega al alta y se valida nuevamente en
  el servidor.
- La prueba dura siete días, comienza sin publicar y no realiza cobros
  automáticos.

## Planes y complementos

- Planes públicos Esencial, Plus y Premium definidos en una sola configuración.
- Premium obtiene todo módulo marcado como disponible por el propietario.
- Música, programa, vestimenta, regalos, galería, álbum colaborativo, QR,
  mesas, menús y plantillas Premium pueden asignarse como complementos.
- El panel cliente genera un menú visual sólo con herramientas autorizadas.
- Los planes internos no se exponen en el catálogo ni en la cuenta cliente.

## Diseños, celebraciones e idiomas

- Buscador de plantillas con etiquetas, evento y nivel.
- Baby shower y revelación de género se incorporan como tipos completos.
- Cuatro diseños nuevos: Nubes de bienvenida, Sorpresa rosa y azul, Confeti
  festivo y Carta encantada.
- Invitación disponible en español, inglés y portugués para controles, fechas y
  textos automáticos.
- Enlaces de Waze y Google Calendar, además de mesa asignada visible para el
  invitado.

## Seguridad y compatibilidad

- Los límites de plan y de plantilla se aplican en el servidor.
- Sólo propietario/desarrollador puede asignar complementos.
- La configuración pública no expone complementos contratados ni estados
  internos.
- El plan Studio permanece interno.
- No hay cambio de tablas ni pérdida de datos; la actualización conserva
  `.env`, `data`, `uploads` y `backups`.
