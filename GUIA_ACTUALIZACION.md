# Actualización y reversión

1. Lee las notas de versión y ejecuta `npm test` en la versión nueva.
2. Crea y descarga un respaldo de la versión en servicio.
3. Duplica el volumen para staging; nunca pruebes una migración por primera vez contra la boda real.
4. Construye la imagen con `npm ci` y ejecuta las pruebas.
5. Detén el servicio, despliega una sola réplica y deja que las migraciones aditivas se ejecuten.
6. Comprueba salud, login, selección de evento, configuración pública, RSVP, fotos, reporte y QR.
7. Si falla, detén el nuevo proceso, restaura el volumen previo y vuelve a la imagen anterior.

Las migraciones RC1 son aditivas. Aun así, una imagen anterior no conoce las nuevas reglas de foto/mensajería, por lo que la reversión debe usar también la copia de volumen tomada antes de actualizar.
