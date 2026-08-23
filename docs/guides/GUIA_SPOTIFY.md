# Spotify en EventStudio 6.14.2 RC10

## Lo que funciona sin Spotify Developer

No necesitas crear una aplicación ni guardar credenciales para:

- pegar el enlace de una canción;
- mostrar el reproductor oficial;
- seleccionar y guardar el punto de inicio;
- comenzar desde ese segundo cuando el invitado pulsa reproducir.

EventStudio usa el iFrame API oficial y su parámetro `startAt`. El selector de
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

RC10 maneja este caso: deja visible el reproductor básico y el enlace
“Abrir en Spotify”, muestra el problema y ofrece reintentar. El punto exacto se
aplicará cuando el iFrame API logre cargar.

## Decisión conservada desde RC8

La búsqueda mediante Spotify Web API fue retirada porque no aporta valor al
producto mínimo y dejaba código y credenciales sin necesidad. El anfitrión pega
el enlace oficial o carga un archivo que tenga derecho a utilizar. Si en el
futuro se incorpora una API de Spotify, se diseñará como una integración
independiente y se revisarán antes sus condiciones y límites vigentes.

Referencia oficial:
[iFrame API y `startAt`](https://developer.spotify.com/documentation/embeds/references/iframe-api).
