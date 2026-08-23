# EventStudio 6.14.2-rc.15.1 — Hotfix de acceso

## Motivo
La RC15 podía bloquear el hilo principal antes de iniciar sesión. El traductor dinámico del panel observaba cambios de texto y, al mismo tiempo, reescribía los `<option>` aunque el contenido fuese idéntico. Esas mutaciones volvían a activar el `MutationObserver` de forma continua.

## Corrección
- El observer de i18n se desconecta mientras el traductor modifica el DOM y se vuelve a conectar al terminar.
- Los `<option>` sólo se reescriben cuando el texto realmente cambia.
- Se conserva traducción dinámica posterior sin mantener un ciclo de auto-observación.
- Se incrementa el identificador de versión a `6.14.2-rc.15.1` para invalidar caché de `admin.js` y CSS/HTML asociados.

## Alcance
Hotfix deliberadamente mínimo. No modifica comercio, RSVP, fotografías, mesas, plantillas, permisos ni base de datos.
