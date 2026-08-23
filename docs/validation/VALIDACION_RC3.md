# Validación técnica 6.14.2 RC3

## Comparación de versiones

`EventEstudio-main.zip` corresponde a la base anterior de GitHub.
`EventEstudio_20260727_232803.zip` incorpora la estabilización RC1/RC2. RC3 se
construyó sobre esta última para no perder sincronización de eventos, panel
móvil, usuarios, Excel, restauración, tipografía, Spotify y arranque portable.

## Resultado automatizado

| Comprobación | Resultado |
|---|---|
| Integridad de configuración y archivos | Aprobada |
| Selección de red local y generación de URL móvil | Aprobada |
| Resolución segura de npm en Windows y Linux | Aprobada |
| HTML, CSS y JavaScript completos desde HTTP local | Aprobada |
| CSP local sin actualización forzada a HTTPS | Aprobada |
| CSP de producción con `upgrade-insecure-requests` | Aprobada |
| HTML sin caché obsoleta y recursos versionados | Aprobada |
| Regresión funcional multi-evento | Aprobada |
| Invitación, RSVP, música, fotos, Excel, PDF, QR y mesas | Aprobada |
| Respaldo y restauración en almacenamiento aislado | Aprobada |
| Auditoría de dependencias de producción | 0 vulnerabilidades |

## Alcance de la comprobación

La suite inicia servidores aislados y bases temporales; no usa ni modifica la
base real. También compara byte por byte los recursos servidos por el lanzador
con los archivos instalados.

## Prueba física previa al despliegue

1. Ejecutar `INICIAR.bat` en Windows.
2. Confirmar el mensaje de verificación de HTML, estilos y botones.
3. Abrir panel e invitación desde la IP LAN en el teléfono.
4. Recorrer menú, cambiar de evento, abrir sobre y realizar un RSVP de prueba.
5. Confirmar la conservación de invitados, configuración, QR y fotografías.

La prueba física sigue siendo necesaria para validar gestos táctiles,
restricciones del navegador y la red Wi-Fi concreta antes de desplegar.
