# Respaldo y restauración

## Qué contiene un respaldo

El ZIP generado por el propietario incluye:

- `data/wedding.db`: snapshot consistente de SQLite;
- `uploads/`: portada, música, galería y fotos de invitados;
- `manifest.json`: versión, fecha, resultado de integridad y SHA-256 independiente de la base.

El sistema registra tamaño y SHA-256. La retención predeterminada es de 14 copias y se controla con `BACKUP_RETENTION`.

## Crear y validar

1. Entra como propietario y crea un respaldo desde la API/panel administrativo.
2. Descarga el ZIP fuera del servidor.
3. Compara el SHA-256 descargado con el registrado.
4. Descomprime en una carpeta nueva y ejecuta:

```bash
sqlite3 data/wedding.db "PRAGMA integrity_check;"
```

Debe responder `ok`. Abre además el manifiesto y verifica que existan archivos de `uploads/`.

## Restaurar desde el panel

1. Entra como propietario en **Mi negocio → Respaldos completos**.
2. Selecciona el ZIP y pulsa **Validar contenido**.
3. Revisa versión, fecha, cantidad de archivos, tamaño y huella de la base.
4. Escribe `RESTAURAR` y confirma.
5. EventStudio crea primero un respaldo automático `pre-restore`, prepara los archivos y reinicia el proceso.
6. Durante el arranque sustituye atómicamente la base y `uploads/`, conserva la base anterior como emergencia y registra el rollback en el historial.
7. El navegador espera a `/api/health` y recarga el panel cuando el servicio vuelve a estar disponible.

En producción, las cuentas reconocidas como demostración quedan inactivas y sus sesiones se eliminan. Se pueden ampliar los correos detectados mediante `DEMO_ACCOUNT_EMAILS`.

No existe sustitución “en caliente” por diseño. El panel coordina la operación, pero la base sólo se reemplaza antes de abrir SQLite durante el reinicio.

## Frecuencia mínima para la boda

- antes de publicar;
- antes y después de una importación grande;
- diariamente mientras RSVP esté abierto;
- antes de cambios de mesas;
- al terminar el evento y antes de cualquier limpieza.
