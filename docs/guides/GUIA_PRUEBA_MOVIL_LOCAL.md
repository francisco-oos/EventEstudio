# Prueba local y móvil de EventStudio

Esta guía permite probar `6.14.2-rc.12` desde una computadora y uno o varios teléfonos antes de publicar en Railway. Los equipos deben estar conectados a la misma red Wi-Fi o LAN privada.

## Windows

1. Extrae el ZIP completo en una carpeta normal; no lo ejecutes dentro del visor del ZIP.
2. Haz doble clic en `INICIAR.bat`.
3. En el primer inicio, EventStudio verifica Node.js 20 o superior, instala las
   dependencias exactas e inspecciona la base. Si ya existe, muestra la ruta y
   la cantidad de usuarios/eventos que conservará.
4. La ventana muestra una dirección para la computadora y otra para el teléfono, además de un QR.
5. Antes de mostrar el QR, el lanzador comprueba que HTML, CSS y JavaScript
   respondan completos desde la dirección local.
6. Si Firewall de Windows pregunta, permite Node.js sólo en **redes privadas**.
7. Abre o escanea la dirección desde el teléfono conectado al mismo Wi-Fi.
8. Para detener el sistema, vuelve a la ventana y pulsa `Ctrl+C`.

### Si PowerShell bloquea `npm.ps1`

No es necesario cambiar la directiva de ejecución de Windows. `INICIAR.bat`
ejecuta npm sin pasar por `npm.ps1`. Si necesitas utilizar los comandos
manualmente desde PowerShell, escribe:

```powershell
npm.cmd ci
npm.cmd run seed
npm.cmd start
```

En una instalación nueva no necesitas ejecutar `seed` antes de `INICIAR.bat`.
El comando manual se niega a operar sobre cualquier base que ya contenga un
usuario o evento.

## Linux, NAS o servidor

```bash
chmod +x iniciar_linux.sh
./iniciar_linux.sh
```

El script realiza la misma preparación y muestra la dirección móvil. En un NAS, el firewall debe permitir el puerto local configurado únicamente dentro de la LAN.

## Acceso de demostración

- Propietario: `owner@eventstudio.local`
- Cliente: `client@eventstudio.local`
- Contraseña local de ambas cuentas: `Cambiar123!`

Estas cuentas existen sólo para pruebas y nunca deben restaurarse o utilizarse como acceso de producción.

## Qué hace el lanzador

- Comprueba Node.js y localiza el ejecutable JavaScript de npm.
- Ejecuta `npm ci` sólo cuando faltan dependencias o cambia `package-lock.json`.
- Ejecuta `quick_check` sobre una base existente y nunca mezcla datos demo con
  una base parcial o con información.
- Al detectar un esquema anterior, crea y verifica un respaldo SQLite
  consolidado dentro de `backups/` antes de migrarlo.
- Escucha explícitamente en `0.0.0.0` para aceptar conexiones de la red privada.
- Detecta la IP local y fija `SITE_URL` para que enlaces y QR de prueba no apunten a `localhost`.
- Mantiene `upgrade-insecure-requests` únicamente en producción HTTPS; el modo
  LAN por HTTP puede cargar estilos y botones sin debilitar el despliegue.
- Compara los recursos servidos contra los archivos instalados antes de mostrar
  el QR.
- Abre el panel en la computadora y presenta el enlace y QR para el teléfono.

## Si aparece texto sin diseño o los botones no responden

`6.14.2-rc.12` conserva la corrección que impide que el navegador intente cargar
CSS y JavaScript mediante HTTPS durante una prueba HTTP por IP local. El
lanzador actual debe impedir que el QR aparezca si esos recursos no están
completos.

Si todavía ves una página antigua:

1. Cierra todas las ventanas anteriores de EventStudio y confirma que el puerto
   `3000` quedó libre.
2. Extrae el ZIP completo en una carpeta nueva; no mezcles archivos nuevos y
   anteriores dentro de la misma carpeta.
3. Lleva a la carpeta nueva solamente `.env` y los directorios persistentes
   `data`, `uploads` y `backups` de la instalación anterior.
4. Ejecuta `INICIAR.bat` y espera el mensaje
   `HTML, estilos y botones verificados desde la dirección local`.
5. Abre el QR nuevo. La versión de los recursos cambia automáticamente, por lo
   que no debería depender de la caché anterior.

No ejecutes `seed` ni sustituyas `data/wedding.db` por una base de demostración.

## Si aparece “Origen de solicitud no permitido”

RC10 admite de forma segura los dos orígenes del lanzador local:
`http://localhost:PUERTO` para la computadora y la dirección `http://IP:PUERTO`
mostrada en el QR. Producción continúa admitiendo exclusivamente `SITE_URL`
por HTTPS.

Si el mensaje todavía aparece:

1. Confirma que la consola indique `EventStudio 6.14.2-rc.12`.
2. Cierra otro proceso de EventStudio que aún use el mismo puerto.
3. No abras una URL guardada de una ejecución anterior; usa la recién mostrada.
4. Extrae RC10 en una carpeta nueva y lleva únicamente `.env`, `data`, `uploads`
   y `backups`.
5. No borres cookies ni cambies la contraseña como primer intento: RC10 incluye
   una prueba específica para sesiones existentes.

## Si el teléfono no abre

1. Confirma que computadora y teléfono estén en la misma red y que el teléfono no esté usando sólo datos móviles.
2. Desactiva temporalmente una VPN en cualquiera de los dos equipos.
3. Permite Node.js en redes privadas dentro del Firewall de Windows.
4. Comprueba que el Wi-Fi no tenga aislamiento de clientes o red de invitados.
5. Si aparecen varias IP, prueba las otras direcciones mostradas.
6. Para elegir una dirección concreta:

Windows CMD:

```bat
set EVENTSTUDIO_LAN_IP=192.168.1.25
INICIAR.bat
```

Linux:

```bash
EVENTSTUDIO_LAN_IP=192.168.1.25 ./iniciar_linux.sh
```

Para cambiar el puerto, usa `EVENTSTUDIO_PORT=3100` con el mismo formato.

## Matriz mínima de prueba

| Área | Prueba en teléfono | Resultado esperado |
|---|---|---|
| Acceso | Iniciar como propietario y cliente | Cada rol ve sólo sus funciones y eventos |
| Navegación | Abrir/cerrar menú y recorrer módulos | No hay desplazamiento horizontal ni controles cubiertos |
| Escala y regreso | Abrir invitación, volver y tratar de alejar la vista | El panel sigue a ancho completo y el menú conserva su tamaño |
| Invitados | Buscar, filtrar y desplegar una tarjeta | Resumen legible; detalles y acciones utilizables con una mano |
| Eventos | Crear, cambiar, archivar y eliminar uno de prueba | Los datos cambian sin recargar ni mezclarse |
| Invitación | Abrir sobre, recorrer secciones y volver | Animación fluida y texto legible |
| Plantillas | Cambiar tipografía y uso de mayúsculas, guardar y probar apertura | La vista pública, QR y pieza física mantienen la selección |
| Música | Probar archivo local y Spotify | Archivo inicia al abrir; Spotify muestra control alternativo si se bloquea |
| RSVP | Confirmar, rechazar y modificar | Cupos y menús se respetan |
| Fotos | Seleccionar fotos y dejar mensaje | Se conserva el lote y queda pendiente de moderación |
| Mesas | Mover elementos y asignar personas | Controles táctiles utilizables y capacidad coherente |
| Exportación | Descargar Excel, PDF y QR | Se generan con el evento activo |
| Continuidad | Cerrar y volver a iniciar | Datos persistentes y servidor recuperado |

La prueba por LAN es para validación previa. Los enlaces y QR definitivos deben regenerarse después de configurar el dominio HTTPS de producción.
