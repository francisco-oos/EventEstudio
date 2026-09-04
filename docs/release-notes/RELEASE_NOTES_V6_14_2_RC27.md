# EventStudio 6.14.2-rc.27

## Cambios principales

- Motor único de sobre, tarjeta y lacre basado en catálogos configurables.
- Ocho aperturas redundantes retiradas mediante alias retrocompatibles.
- Editor de lacre independiente eliminado; controles integrados al panel.
- Botón `Aplicar a la invitación` con persistencia atómica y refresco de preview.
- Nombres, fecha, monograma y tipografía heredados del evento.
- Paleta y textura coordinadas con invitación, álbum de invitados, QR y PDF.
- Fallback intacto a la plantilla cuando la papelería no sincroniza tokens.
- Varilla Onfalós en el pergamino, sincronizada con el desenrollado.
- Lacres históricos y fechador de `particle-heart` alimentados por la configuración central.
- Conector de monograma libre, con sugerencias únicamente como ayuda.
- Invalidación de caché actualizada a RC27.

## Compatibilidad y datos

No hay migración destructiva. Los IDs históricos se leen como presets del motor nuevo y se guardan en formato canónico sólo cuando el usuario confirma cambios. La entrega no contiene datos, multimedia, respaldos ni variables de entorno.

