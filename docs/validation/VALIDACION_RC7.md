# Validación de EventStudio 6.14.2 RC7

RC7 debe aprobar estos controles antes de empaquetarse.

## Resultado final

- `npm test`: aprobado.
- Sintaxis de servidor y los cuatro clientes JavaScript: aprobada.
- Registro Esencial, bloqueo Premium y asignación posterior de complemento:
  aprobados.
- Catálogo público sin planes internos ni datos personales: aprobado.
- Español, inglés y portugués: aprobados.
- Respaldo, restauración y compatibilidad con el esquema `614204`: aprobados.
- `npm audit --omit=dev --audit-level=low`: 0 vulnerabilidades.
- La prueba final se repite sobre una extracción limpia del ZIP antes de
  publicarlo.

## Controles automatizados

- Sintaxis de servidor, administración, invitación, álbum y catálogo.
- Registro privado con tipo de evento, plan y plantilla.
- Bloqueo de plantilla Premium para un plan Esencial.
- Activación posterior mediante complemento asignado por el propietario.
- Premium limitado a módulos disponibles, sin exponer funciones ocultas.
- Catálogo sin planes internos y panel propietario con catálogo completo.
- Español, inglés y portugués normalizados en servidor y vista pública.
- Baby shower y revelación de género presentes en API, configuración y filtros.
- Referencias DOM, recursos estáticos, funciones sin llamadas e IDs duplicados.
- Regresión de sesiones, orígenes, aislamiento, invitados, RSVP, Excel, PDF,
  QR, música, fotografías, respaldos y restauración.
- Auditoría de dependencias y revisión del contenido exacto del ZIP.

## Comprobación visual

| Superficie | Criterio |
|---|---|
| Catálogo en móvil | Sin desbordamiento; filtros y tarjetas en una columna |
| Catálogo en escritorio | Tres planes comparables y biblioteca visual legible |
| Alta | Tres niveles visibles; tipo, plantilla y plan llegan a la cuenta nueva |
| Panel cliente | Sólo muestra herramientas autorizadas para el evento |
| Plantillas | Búsqueda y filtros no cambian datos del evento |
| Invitación | Selector de idioma, Waze, calendario y mesa no interfieren con RSVP |

## Producción

El esquema continúa en `614204`. Antes de desplegar se debe respaldar el volumen
real, probar la versión contra una copia, mantener una sola réplica SQLite y
decidir si `ALLOW_PUBLIC_REGISTRATION` permanecerá habilitado.
