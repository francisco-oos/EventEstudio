# Validación de EventStudio 6.14.2 RC5

Este documento registra qué se comprobó automáticamente y qué debe verificarse
con el equipo y el volumen reales antes de publicar.

## Automatizado

- Instalación exacta mediante `npm ci`.
- Suite funcional completa mediante `npm test`.
- Sesiones, protección de orígenes, roles y las rutas administrativas.
- Aislamiento por evento y conservación del esquema SQLite `614204`.
- Invitados, RSVP, cupos, menús, mesas, plantillas y tipografía.
- Excel/CSV, QR, PDF, fotografías, música, Spotify y apertura animada.
- Respaldo, validación de ZIP, restauración, rollback y migración con copia
  previa.
- Contrato móvil: viewport ampliable, panel de ancho completo, menú táctil y
  tarjetas de invitados.
- Auditoría de dependencias.
- Validación de la configuración de construcción; el flujo de GitHub ejecuta
  la construcción Docker en un entorno que disponga del motor.
- Inspección del paquete para excluir `.env`, bases, WAL/SHM, fotografías,
  respaldos, llaves, `node_modules` e historial Git.

## Inspección visual realizada

| Superficie | Tamaño | Resultado esperado |
|---|---:|---|
| Administración móvil | 390 × 844 | Ancho completo, sin desplazamiento horizontal |
| Menú móvil | 390 × 844 | Botón de al menos 44 px, cajón alineado y cerrable |
| Invitados móvil | 390 × 844 | Tarjetas legibles, detalles plegables y acciones táctiles |
| Modo táctil ancho | 980 px | No regresa al panel estrecho de escritorio |
| Invitación escritorio | 1440 × 900 | Apertura animada visible y controlable |

## Pendiente antes de producción

1. Descargar un respaldo completo desde el panel de producción y comprobar que
   figure como `ready`.
2. Ejecutar o confirmar el respaldo del volumen en Railway.
3. Probar la actualización contra una copia del volumen, nunca por primera vez
   contra la boda real.
4. Recorrer físicamente Android y, si está disponible, iPhone: menú, invitados,
   edición, regreso desde invitación, rotación y escala.
5. Verificar la invitación en una computadora real, con y sin preferencia de
   reducción de movimiento.
6. Confirmar dominio HTTPS, una sola réplica, variables secretas y volumen
   montado en `STORAGE_ROOT`.
7. Confirmar que la construcción Docker de GitHub finalice correctamente.
8. Cambiar la contraseña inicial, retirar `INITIAL_OWNER_PASSWORD` y comprobar
   un RSVP público real después del despliegue.

La versión sólo debe promoverse cuando todos los puntos anteriores queden
marcados en `CHECKLIST_PUBLICACION_BODA.md`.

## Mantenimiento no bloqueante

`npm ci` muestra tres avisos de paquetes transitivos (`prebuild-install`,
`lodash.isequal` y `jpeg-exif`) que llegan mediante `better-sqlite3`, `exceljs`
y `pdfkit`. `npm audit` no reporta vulnerabilidades. Sustituirlos implica
actualizar dependencias principales con cambios incompatibles, por lo que se
deja para una rama posterior a la boda y no se mezcla con esta estabilización.
