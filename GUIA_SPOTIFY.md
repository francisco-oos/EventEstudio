# Spotify en EventStudio 6.11.0 RC1

## Lo que funciona sin Spotify Developer

No necesitas crear una aplicación ni guardar credenciales para:

- pegar el enlace de una canción;
- mostrar el reproductor oficial;
- seleccionar y guardar el punto de inicio;
- comenzar desde ese segundo cuando el invitado pulsa reproducir.

Event Studio usa el iFrame API oficial y su parámetro `startAt`. El selector de
inicio se muestra sólo para enlaces de tipo `track`; en álbumes y playlists el
inicio permanece en cero porque no existe una única canción inequívoca.

## Qué significa el error `ERR_CONNECTION_TIMED_OUT`

El navegador no logró descargar en ese momento:

```text
https://open.spotify.com/embed/iframe-api/v1
```

No indica que el archivo musical o la configuración del evento estén dañados.
Normalmente se relaciona con una conexión lenta, DNS, firewall, bloqueador de
contenido o una caída temporal de Spotify.

La versión RC1 maneja este caso: deja visible el reproductor básico y el enlace
“Abrir en Spotify”, muestra el problema y ofrece reintentar. El punto exacto se
aplicará cuando el iFrame API logre cargar.

## Búsqueda integrada opcional

Las credenciales se requieren únicamente para buscar una canción o artista dentro
del panel. El enlace pegado y el punto inicial no dependen de ellas.

En las reglas vigentes de Spotify desde 2026, una aplicación nueva en Development
Mode requiere que su propietario tenga Spotify Premium. Crear el Client ID no
tiene un cobro adicional, pero por esa exigencia no debe considerarse una solución
completamente gratuita. Además, Development Mode admite hasta cinco usuarios
autorizados y no conviene usar
la búsqueda Web API como dependencia central de un SaaS comercial.

Si ya tienes Premium y deseas habilitar la búsqueda para el prototipo:

1. Entra al Dashboard de Spotify for Developers.
2. Crea una aplicación y selecciona Web API.
3. Copia el Client ID y el Client Secret.
4. Agrégalos solamente al archivo `.env` del servidor:

```env
SPOTIFY_CLIENT_ID=tu_client_id
SPOTIFY_CLIENT_SECRET=tu_client_secret
```

5. Reinicia `npm start`.
6. En el panel, abre Música y usa “Buscar en Spotify”.

Nunca pongas el Client Secret en `admin.js`, `app.js`, GitHub ni en el navegador.

Para un lanzamiento comercial, mantén el reproductor Embed como opción principal
y revisa las condiciones y el acceso ampliado de Spotify antes de depender de su
Web API para todos los clientes.

Referencias oficiales: [iFrame API y `startAt`](https://developer.spotify.com/documentation/embeds/references/iframe-api), [modalidades y límites de cuota](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) y [cambios de Development Mode de febrero de 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide).
