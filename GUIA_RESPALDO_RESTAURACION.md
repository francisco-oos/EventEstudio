# Respaldo y restauración

## Qué contiene un respaldo

El ZIP generado por el propietario incluye:

- `data/wedding.db`: snapshot consistente de SQLite;
- `uploads/`: portada, música, galería y fotos de invitados;
- `manifest.json`: versión, fecha y resultado de integridad.

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

## Restaurar de forma segura

1. Pon el servicio en mantenimiento y detén todas las réplicas.
2. Copia el volumen actual completo a una ubicación de reversión.
3. Descomprime el respaldo en un volumen vacío.
4. Ejecuta `PRAGMA integrity_check` sobre la base restaurada.
5. Revisa permisos del usuario del contenedor y que `STORAGE_ROOT` apunte a ese volumen.
6. Inicia una sola réplica, abre `/api/health`, inicia sesión y verifica evento, invitados, dos fotos y un PDF.
7. Si algo falla, detén el servicio y vuelve al volumen previo; no mezcles carpetas archivo por archivo.

No existe restauración “en caliente” por diseño. Esta restricción evita escribir simultáneamente en una base que está siendo reemplazada.

## Frecuencia mínima para la boda

- antes de publicar;
- antes y después de una importación grande;
- diariamente mientras RSVP esté abierto;
- antes de cambios de mesas;
- al terminar el evento y antes de cualquier limpieza.
