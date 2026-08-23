# Validación de EventStudio 6.14.2 RC9

Este documento registra la auditoría de código, datos, impresión, seguridad y
regresión exigida antes de promover RC9.

## Alcance

- Integridad del paquete y exclusión de datos reales.
- Sintaxis JavaScript y JSON.
- Autenticación, autorización e aislamiento entre eventos.
- Configuración dinámica y ausencia de datos personales en ejecución.
- Planes, complementos, permisos y módulos ocultos.
- Invitación, RSVP, álbum, música, informes, respaldo y restauración.
- 42 plantillas digitales, invitaciones físicas y ocho formatos QR.
- Carga de imágenes válidas y rechazo de contenido dañado.
- Dependencias y cabeceras de seguridad.
- Instalación, arranque y cierre controlado.

## Resultado de la auditoría

- Integridad del ZIP de origen RC8: aprobada.
- Sintaxis JavaScript/JSON: aprobada.
- Referencias DOM, recursos y funciones declaradas: aprobadas.
- Paletas web/impresión: 42 de 42 aprobadas.
- Invitaciones físicas automáticas: 42 de 42 generadas.
- Matriz tema × QR: 336 de 336 generadas.
- Formatos y tamaños PDF: aprobados.
- Lectura desde PNG renderizado: 49 de 49 PDFs de muestra decodificados.
- Fuentes incrustadas: aprobadas.
- Imagen corrupta con cabecera PNG: rechazada antes de persistirse.
- Suite funcional, seguridad y restauración: aprobadas.
- Extracción aislada e instalación con `npm ci`: 291 dependencias aprobadas.
- Lanzador local, estado saludable y recursos servidos: aprobados.
- Auditoría de dependencias: 0 vulnerabilidades.
- Esquema SQLite: `614204`, sin cambio.

## Límites de la evidencia

- La geometría y el contenido de los PDF se inspeccionaron con Poppler y
  revisión visual de cinco familias representativas, incluidos temas oscuros,
  infantiles, fotográficos y ceremoniales.
- El formato plegable se comprobó por cada cara, como se utiliza después del
  doblez; la hoja de producción completa contiene el mismo QR en dos
  orientaciones.
- La comprobación física en impresora y teléfono continúa siendo una prueba de
  aceptación final del dispositivo; no sustituye las verificaciones
  automatizadas.
- Docker debe confirmarse mediante el flujo de CI cuando el motor local no esté
  disponible. El flujo incluido usa Node.js 22, ejecuta `npm ci`, la suite, la
  auditoría y `docker build`.

## Puerta de publicación

Antes de desplegar la boda real:

1. Descargar y verificar un respaldo del volumen actual.
2. Probar restauración sobre una copia, nunca sobre el único volumen.
3. Copiar únicamente `.env`, `data`, `uploads` y `backups` a RC9.
4. No ejecutar `seed`.
5. Probar la plantilla definitiva, QR, RSVP y música en teléfono y computadora.
6. Congelar el diseño antes de enviar invitaciones reales.
