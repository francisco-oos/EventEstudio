# Validación de EventStudio 6.14.2 RC6

Este documento registra los controles de la entrega que corrige las vistas de
clientes/eventos, el desplazamiento del menú y la sincronización pública.

## Controles automatizados

- Sintaxis de servidor, administración, invitación y álbum.
- Referencias DOM, identificadores duplicados, recursos locales y funciones
  declaradas sin llamadas.
- Panel móvil sin `min-width` de escritorio en tablas transformadas.
- Acciones táctiles y selectores contenidos dentro de cada tarjeta.
- Bloqueo del documento raíz y restauración del desplazamiento al cerrar el
  menú.
- Configuración pública sin caché, revisión de contenido y detección de cambios
  de apertura, sin interrumpir un RSVP en edición.
- Sesiones, roles, orígenes, aislamiento por evento, RSVP, Excel, PDF, QR,
  fotografías, música, respaldos y restauración.
- Auditoría de dependencias y exclusión de datos persistentes en el ZIP.

## Comprobación visual requerida

| Superficie | Ancho | Criterio |
|---|---:|---|
| Ver usuarios/clientes | 390 px | Etiquetas y valores completos; acciones dentro de la tarjeta |
| Eventos alojados | 390 px | Sin corte lateral; botones y transferencia en una columna |
| Menú abierto | 390 px | El cajón puede desplazarse y el contenido posterior permanece fijo |
| Invitación abierta | teléfono + PC | Un cambio de apertura se refleja al volver o en un máximo de 15 segundos |
| Escritorio | 1440 px | Las tablas conservan su presentación de escritorio |

## Producción

RC6 conserva el esquema `614204`. Antes del despliegue se debe descargar un
respaldo del volumen real, probar la versión contra una copia, mantener una sola
réplica SQLite y completar `CHECKLIST_PUBLICACION_BODA.md`.
