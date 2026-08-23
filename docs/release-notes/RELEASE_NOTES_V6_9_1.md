# Event Studio 6.9.1

## QR listos para impresión

La causa de los elementos encimados era un layout único con coordenadas fijas para
cuatro proporciones distintas. Se sustituyó por geometrías específicas para 5×7,
5×5, 4×9 y carta plegable.

Se validaron las ocho plantillas con textos extensos. Cada PDF conserva zonas
independientes para encabezado, título, QR, mensaje, instrucción, mesa y pie. Los
QR se generan a 1200 px, corrección `H` y margen blanco de cuatro módulos.

## Inicio de Spotify

El selector vuelve con una implementación distinta a la que anteriormente causaba
peticiones repetidas. Se guarda un segundo entero y se aplica una sola vez mediante
`EmbedController.loadEntity(uri, false, startAt)`.

No requiere Spotify Developer para pegar una canción. La búsqueda integrada sigue
siendo opcional y utiliza las credenciales del servidor cuando están configuradas.

La carga del iFrame API ahora es diferida, tiene límite de espera y degradación a
reproductor básico/enlace directo cuando Spotify o la conexión no responden.

## Pruebas

`npm test` cubre las ocho plantillas, sus tamaños físicos, la generación PDF y la
persistencia pública del segundo inicial de Spotify, además de los flujos 6.9.
