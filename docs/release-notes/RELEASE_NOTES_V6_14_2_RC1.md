# EventStudio 6.14.2 RC1

## Objetivo

Estabilizar la operación multi-evento y permitir que propietario y cliente administren el sistema desde celular antes de ampliar las Colecciones Coordinadas en `6.15.0`.

## Correcciones principales

- El evento activo se carga mediante una única transición controlada.
- Las solicitudes del evento anterior se cancelan con `AbortController`; una respuesta tardía ya no puede volver a pintar datos antiguos.
- Crear, cambiar, archivar o eliminar un evento actualiza configuración, invitados, mesas, fotos, QR y resumen sin recargar el navegador.
- El menú móvil ahora es lateral, superpuesto, vertical, táctil y conserva etiquetas completas y permisos.
- Las tablas administrativas se convierten en tarjetas con rótulos en pantallas pequeñas.
- Las cuentas inactivas muestran **Reactivar**; editar nombre, correo, rol y eventos no altera el plan.
- Se agregó **Exportar datos del evento** en Excel, compatible con la reimportación mediante `CODIGO`.
- Los eventos nuevos parten de datos neutrales y aplican narrativa de boda, XV años, cumpleaños, graduación, empresarial o personalizado.
- Los eventos XV anteriores que heredaron “Nuestra boda” o “Nuestra historia” se corrigen de forma conservadora al migrar.
- La presentación de nombres admite captura original, tipo título, mayúsculas y versalitas, con advertencias para caligrafía y ajuste de nombres largos.
- Spotify se inicializa una sola vez, intenta reproducirse al abrir el sobre, informa su estado y mantiene un botón manual visible si el navegador bloquea el inicio.
- La música subida conserva el comportamiento confirmado en producción.
- El nombre visible de la plataforma se unificó como **EventStudio**.
- El álbum, el RSVP, la galería y las descripciones de temas ya no contienen textos fijos que supongan una boda.

## Prueba local y móvil

- `INICIAR.bat` prepara y abre EventStudio en Windows.
- `iniciar_linux.sh` ofrece el mismo flujo en Linux, NAS o servidor.
- Un único lanzador Node evita duplicar la detección de red y la preparación entre sistemas.
- El servidor escucha explícitamente en `0.0.0.0`; `SITE_URL` usa la IP LAN durante la prueba para que enlaces y QR no apunten a `localhost`.
- El inicio instala dependencias sólo si faltan o cambió `package-lock.json`.
- La base existente se conserva; la demostración se crea sólo cuando no hay usuarios o eventos.
- La terminal muestra el enlace y un QR para el teléfono, con una advertencia de uso exclusivo en redes privadas.
- La suite fija su propio entorno de prueba y ya no cambia de resultado por la presencia de un `.env` local.

## Continuidad y seguridad

- El panel inspecciona manifiesto, estructura, tamaño, huella e integridad SQLite antes de restaurar.
- Se crea un rollback automático antes de preparar la restauración.
- Base y archivos se sustituyen durante un reinicio controlado, nunca mientras SQLite está escribiendo.
- Los respaldos interrumpidos dejan de permanecer en `creating`.
- El snapshot ya no incluye el registro incompleto del respaldo que se está creando.
- Las cuentas demo restauradas en producción quedan desactivadas y sin sesiones.
- Git ignora bases, WAL/SHM, volúmenes, respaldos y archivos persistentes.
- Se actualizó la cadena de compresión a `archiver 8`, `unzipper 0.12.5` y `brace-expansion 5.0.8` para corregir `CVE-2026-14257`.

## Verificación

`npm test` cubre integridad del proyecto, detección de red local, regresión funcional y una restauración completa en almacenamiento aislado. GitHub Actions ejecuta `npm ci` y `npm test` en cada push y pull request.

## Pendiente para validación real

- Probar el menú y formularios en Android Chrome, iPhone Safari y tableta.
- Probar Spotify con una cuenta y canción reales en esos navegadores.
- Restaurar una copia descargada de Railway en un entorno de prueba, nunca directamente sobre la boda sin conservar el rollback.
- Confirmar impresión física, QR y nombres familiares largos.
