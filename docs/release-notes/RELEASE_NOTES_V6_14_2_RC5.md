# EventStudio 6.14.2 RC5

Versión candidata enfocada en la operación móvil de la boda y en cerrar la
preparación técnica para producción. Conserva el esquema SQLite `614204`; no
agrega una migración ni modifica datos existentes.

## Correcciones visibles

- El panel administrativo ocupa todo el ancho disponible en teléfonos y ya no
  queda reducido a una columna al alejar la vista.
- El botón de menú mantiene un área táctil mínima de 44 px, respeta las zonas
  seguras del teléfono y recupera su posición al volver desde la invitación,
  rotar o restaurar una página desde la caché.
- La lista de invitados se presenta como tarjetas resumidas en móvil. La
  información secundaria se abre bajo demanda y las acciones conservan un
  tamaño táctil cómodo.
- Se añadieron accesos rápidos para ver, agregar o importar invitados, búsqueda
  y filtro por estado RSVP.
- La tipografía puede conservar el texto, normalizar mayúsculas/minúsculas,
  mostrar todo en mayúsculas o usar versalitas. El servidor rechaza valores no
  contemplados antes de guardarlos.
- La apertura animada puede previsualizarse desde Configuración y volver a
  reproducirse al regresar a la invitación. En equipos con reducción de
  movimiento sigue mostrando una transición breve y comprensible.

## Robustez y seguridad

- Los valores de tipografía y presentación usan listas permitidas y textos
  normalizados; no se aceptan estilos arbitrarios.
- Se mantienen las protecciones de RC4: orígenes estrictos en producción,
  sesiones seguras, respaldo previo a migración, restauración con límites y
  rechazo de cuentas de demostración en producción.
- `.gitignore` y `.dockerignore` excluyen secretos, bases SQLite, WAL/SHM,
  fotografías, respaldos, dependencias, llaves y archivos locales.
- La automatización de GitHub ejecuta instalación exacta, pruebas, auditoría y
  construcción de la imagen Docker.

## Compatibilidad

- Actualización desde RC4 sin cambio de esquema.
- Los datos persistentes siguen en `.env`, `data`, `uploads` y `backups`; no
  deben mezclarse con `public`, `src`, `scripts` ni `node_modules` anteriores.
- Node.js 20 o superior.
- Navegadores modernos con JavaScript habilitado.

## Límite deliberado

No se habilitaron pagos, Google OAuth ni WhatsApp Business automático. Son
funciones que requieren proveedores y pruebas reales; permanecen ocultas para
no aumentar el riesgo antes de la boda.
