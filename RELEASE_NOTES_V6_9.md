# Event Studio 6.9 — auditoría y cierre del prototipo

## Resultado

El prototipo queda funcional para una demostración completa: un administrador
configura el evento e invitados, la familia abre su enlace y confirma, y el
recinto recibe un reporte consolidado.

## Problemas corregidos

| Área | Problema encontrado | Solución 6.9 |
| --- | --- | --- |
| Música local | El segundo inicial se guardaba, pero la invitación no lo usaba. | El audio salta al segundo guardado al cargar/reproducir y repite desde ese punto. |
| Spotify | La interfaz prometía un inicio exacto que el reproductor oficial no garantiza. | Se usa el embed oficial y se retiró ese control únicamente para Spotify. |
| Música | No existía una acción clara para retirar una fuente cargada. | Se añadieron botones y una ruta protegida para eliminar archivo o enlace. |
| RSVP | Accesibilidad se enviaba desde la pantalla pero no se persistía. | Se valida, almacena, vuelve a mostrar y exporta al reporte. |
| RSVP | Cantidades y menús aceptaban combinaciones inconsistentes. | Se validan cupos, enteros, totales de menús y al menos una persona. |
| Privacidad | La consulta pública exponía campos administrativos del invitado. | La respuesta pública usa una lista explícita de campos seguros. |
| WhatsApp | La cola por lote llamaba el generador de URL sin el evento. | La ruta ahora produce enlaces correctos para todos los invitados seleccionados. |
| Administración | Un cliente podía intentar escribir controles internos ocultos. | El servidor conserva funciones y modo de desarrollador sólo para roles de plataforma. |
| Invitados | Altas e importaciones no protegían de forma uniforme el límite del plan. | Ambos recorridos validan filas, cupos familiares y capacidad contratada. |
| UX | La fecha escrita y varios estados de guardado eran ambiguos. | La fecha se genera automáticamente, sigue editable y puede restaurarse. |
| Compatibilidad | La dependencia SQLite anterior no instalaba en Node.js moderno. | Se actualizó `better-sqlite3` y se declaró Node.js 20 o posterior. |

## Archivos principales modificados

- `src/server.js`: validación, seguridad, medios, RSVP, usuarios, WhatsApp y reportes.
- `src/db.js`: migración de accesibilidad y catálogo vigente de planes.
- `public/app.js` y `public/index.html`: experiencia pública, audio y confirmación.
- `public/admin.js` y `public/admin.html`: administración, fecha y controles de música.
- `public/styles.css`: estados, adaptabilidad móvil y navegación.
- `tests/smoke.js`: prueba de regresión de los recorridos críticos.

## Criterio para una demostración exitosa

1. Ejecutar `npm ci`, `npm run seed` y `npm start`.
2. Entrar al panel con la cuenta cliente indicada en `README.md`.
3. Configurar música local o Spotify y abrir la invitación.
4. Crear una invitación familiar y confirmar adultos, niños y accesibilidad.
5. Ver la confirmación en el panel, preparar WhatsApp y descargar el Excel.
6. Ejecutar `npm test`; debe terminar con “Pruebas funcionales 6.9 completadas”.

## Pendiente para producción real

Estos puntos requieren proveedores o infraestructura externa y no bloquean el
prototipo: cobros reales, WhatsApp Business Platform, recuperación por correo,
dominios verificados, almacenamiento de objetos, copias de seguridad y migración
de SQLite a PostgreSQL al crecer la concurrencia.
