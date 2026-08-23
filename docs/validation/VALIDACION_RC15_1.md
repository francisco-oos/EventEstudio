# Validación EventStudio 6.14.2-rc.15.1

## Incidente reproducido
La RC15 podía dejar la pantalla de acceso ocupando continuamente el hilo principal antes de iniciar sesión. La causa fue el traductor dinámico incorporado en `admin.js`: un `MutationObserver` vigilaba `characterData` y, durante cada pasada, reescribía el `textContent` de todos los `<option>` aunque el valor ya fuese correcto. Esa escritura producía nuevas mutaciones y el observer se volvía a programar indefinidamente.

La reproducción se hizo en Chromium mediante Playwright cargando el HTML real de `admin.html`, inyectando el `admin.js` real y sustituyendo únicamente las llamadas `fetch` por respuestas locales deterministas para aislar la interfaz del backend. Con RC15 el proceso no consiguió volver al control de Playwright dentro de 10 segundos (timeout), coherente con starvation del hilo principal.

## Corrección RC15.1
- `translateStaticInterface()` desconecta temporalmente su `MutationObserver` antes de modificar el DOM.
- El observer se vuelve a conectar en `finally`, incluso si una traducción falla.
- Los `<option>` sólo se modifican cuando el texto realmente cambia.
- Se conserva la traducción automática de contenido dinámico sin auto-observación recursiva.
- Se incrementa la versión/caché a `6.14.2-rc.15.1` para que el navegador no reutilice el `admin.js` defectuoso de RC15.

## Validaciones ejecutadas
- `node --check public/admin.js`: aprobado.
- `node tests/rc15-1-login-hotfix.js`: aprobado.
- `node tests/project-integrity.js`: aprobado.
- `node tests/source-references.js`: aprobado.
- `node tests/mobile-ui.js`: aprobado.
- `node tests/local-network.js`: aprobado.
- `node tests/rc14-regressions.js`: aprobado.
- `node tests/rc15-regressions.js`: aprobado.
- Playwright/Chromium sobre el mismo HTML y JavaScript de RC15.1: `#loginEmail` visible, editable y capaz de recibir `prueba@example.com` después de inicializar `admin.js`.

## Alcance
No se modificaron migraciones, base de datos, comercio, permisos, RSVP, fotografías, mesas ni renderers. Es un hotfix deliberadamente limitado al bloqueo previo al login y al identificador de caché/versión necesario para distribuirlo correctamente.
