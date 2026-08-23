# Actualización y reversión

## Actualización local conservando datos

1. Detén EventStudio con `Ctrl+C`; no copies SQLite mientras el proceso sigue
   escribiendo.
2. Conserva una copia completa de `.env`, `data`, `uploads` y `backups`.
3. Extrae la versión nueva en una carpeta distinta.
4. Copia a la carpeta nueva únicamente esos elementos persistentes. No copies
   `node_modules`, archivos JavaScript/CSS antiguos ni el historial Git.
5. Ejecuta `INICIAR.bat`. El lanzador inspecciona la base y no ejecuta `seed`
   ante ningún contenido existente o estructura desconocida.
6. Espera la comprobación de HTML, estilos y botones y prueba la URL mostrada
   tanto en la computadora como en el teléfono.

RC11 avanza la versión de esquema a `614206`. Antes de aplicar la
migración ejecuta `quick_check`, crea una copia consolidada en
`backups/pre-migration-*.db`, genera su manifiesto SHA-256 y verifica
`integrity_check`. Sólo entonces agrega la conservación configurable de planes,
notificaciones y las mejoras comerciales acumulables. También conserva la
conversión de complementos anteriores en derechos `legacy` con valor cero. La base,
usuarios, eventos, invitados, QR, fotografías y configuración existente se
conservan.

## Despliegue y reversión

1. Lee las notas de versión y ejecuta `npm test` en la versión nueva.
2. Crea y descarga desde el panel un respaldo ZIP de la versión en servicio.
   Verifica que el registro aparezca como `ready` y conserve su SHA-256.
3. Activa o ejecuta además el respaldo del volumen en el proveedor.
4. Duplica el volumen para staging; nunca pruebes una migración por primera vez contra la boda real.
5. Construye la imagen con `npm ci` y ejecuta las pruebas.
6. Confirma `TRUST_PROXY=true`, `STORAGE_ROOT` persistente, `SITE_URL` HTTPS y
   que no existan cuentas demo activas.
7. Detén el servicio, despliega una sola réplica y deja que la migración se ejecute.
8. Comprueba salud, login, selección de evento, configuración pública, RSVP,
   fotos, reporte y QR.
9. Si falla, detén el nuevo proceso, restaura el volumen previo y vuelve a la imagen anterior.

Las migraciones son aditivas. Aun así, una imagen anterior no conoce el
catálogo comercial ni las reglas nuevas de derechos, por lo que la reversión
debe usar también la copia de volumen tomada antes de actualizar.
