# Auditoría integral — EventStudio 6.16.0-rc.39

Estado: **candidata QA avanzada**.

## Baseline

Se trabajó sobre `EventEstudio_20260904_160812_656925.zip`, recibido con la BD y el estado exacto usado durante la QA manual posterior a RC38. No se ejecutó `seed` ni una migración destructiva sobre `data/wedding.db`.

Integridad de la BD incluida:

- SHA-256: `db17a6ea42cc7346b5b823e4c71e0bda80ff49129957a1cf88de0304e2a6c258`
- `PRAGMA quick_check=ok`
- 43 tablas
- 4 usuarios
- 2 eventos
- 26 invitados
- 5 suscripciones

## Hallazgos RC39 y tratamiento

| ID | Severidad | Hallazgo | Corrección RC39 |
|---|---:|---|---|
| RC39-01 | alta | miniaturas/preview de catálogo podían heredar la apariencia ACTIVE en vez de la Recipe elegida | preview de catálogo proyecta la Recipe solicitada con su paleta/apertura/Stationery |
| RC39-02 | alta | Recipes predefinidas podían terminar usando siempre el mismo sobre personalizado | sincronización Recipe ↔ Stationery y preset por Recipe; filtros son recomendación, no override destructivo |
| RC39-03 | media | cambiar sobre/color parecía requerir `Guardar borrador` antes de Apply | autosave silencioso del DRAFT; Apply espera/persiste el estado más reciente |
| RC39-04 | alta | volver de `mode=preview` podía dejar una pantalla vacía en el primer clic | retorno determinista por URL al panel de origen |
| RC39-05 | media | referencias a fotos eliminadas producían `404` repetidos | registro/filtrado de media faltante; el lienzo no vuelve a solicitar rutas conocidas como ausentes |
| RC39-06 | alta | Historia/Ubicación/Programa/Vestimenta usaban copy genérico en el lienzo | lectura de settings/evento y representación con datos reales disponibles |
| RC39-07 | media | portada ya cargada podía desaprovecharse | reutilización de `settings.media.heroImage` cuando la Recipe permite hero media |
| RC39-08 | alta | bloques ocultos/no contratados podían dejar espacios vacíos | renderer colapsa/desmonta la sección no visible en lugar de reservar altura |
| RC39-09 | media | sliders de tamaño/propiedades parecían no modificar títulos/textos | escalas del inspector conectadas a variables de tamaño/peso/line-height/letter-spacing y scroll al bloque activo |
| RC39-10 | alta | Color Studio podía generar una armonía que no se reflejaba por herencia de Stationery | paleta efectiva prioriza Recipe/DRAFT; sincronización cromática explícita |
| RC39-11 | alta | algunos hero cinematográficos del Design Lab podían invertir la lógica de contraste | fondo cinematográfico basado en `bg`; texto automático basado en `bgContrast` cuando no hay portada |
| RC39-12 | media | owner/desarrollador recibía el mismo bloqueo comercial que un cliente al probar aperturas | override técnico limitado a plataforma para preview/apply QA; no otorga entitlement al cliente |
| RC39-13 | media | texto del countdown/CTA podía perder contraste en combinaciones oscuras | contraste contextual y validación browser |
| RC39-14 | media | datos/paleta del preview grande y del canvas podían diferir | unificación de resolución de tokens y datos para Recipe seleccionada |

## Hallazgos que no son defectos de EventStudio

- `[Intervention] Images loaded lazily...` es una intervención de rendimiento de Edge; la carga diferida es intencional.
- `Permissions policy violation: unload is not allowed` emitido por `Grammarly.js`/`Grammarly-check.js` proviene de la extensión Grammarly.
- Los tres `404` de fotografías reportados correspondían a archivos que el usuario confirmó haber eliminado. RC39 evita reintentarlos cuando se conocen como faltantes; no se reconstruyen archivos borrados.

## Rendimiento

- autosave de Stationery usa debounce y no fuerza un guardado manual antes de Apply;
- media faltante no entra en bucles de request;
- galería/hero/música se materializan únicamente cuando Recipe + feature lo requieren;
- preview del catálogo utiliza la Recipe solicitada sin regenerar el catálogo completo;
- los selectores cromáticos mantienen actualización diferida para evitar renders por cada píxel del arrastre;
- secciones invisibles no conservan contenedores grandes vacíos.

## Cobertura ejecutada

- 65 Recipes × 2 viewports: 130 renders, 0 fallos, overflow 0.
- Readability: 130 casos, 0 fallos; contraste mínimo de papel ~11.34:1.
- Color parity: 130 casos, 0 fallos; contraste mínimo de nombre ~11.34:1.
- Design Lab catálogo RC39: 65 Recipes, 0 fallos, overflow 0; contraste mínimo heading ~11.34:1 y body ~4.74:1.
- RC39 visual focal: countdown/CTA ~15.46:1; tamaño de título responde 19.84→39.68 px; servicio oculto altura 0/gap 0; 320/390 sin overflow.
- 175,500 combinaciones lógicas de presentación: PASS.
- 1,300 proyecciones rol/perfil: PASS.
- 139 controles/botones con wiring verificable: PASS.
- 64 casos de contenido largo × dispositivos: PASS.
- 32 casos de visibilidad de features: PASS.
- Apertura/skip, música, links, idioma, galería/lightbox y RSVP: PASS en harness Chromium.
- Stationery, álbum y sobre público: PASS en harness visual heredado.
- BD: `quick_check=ok` y hash preservado.

## Límite del entorno

El runtime no dispone de un árbol npm funcional y no logró completar `npm ci`; por ello las pruebas que arrancan el servidor Express real o requieren dependencias nativas/externas (`better-sqlite3`, `bcryptjs`, `adm-zip`, etc.) permanecen **BLOCKED_ENV**. No se declara PASS para autenticación dinámica, uploads multipart reales, pagos, WhatsApp, migraciones productivas ni stress de servidor desde este entorno.

Antes de producción debe ejecutarse en el equipo QA con acceso a npm:

```text
npm ci
npm run test:preproduction
npm audit --audit-level=moderate
```

RC39 se entrega como candidata QA, no como `Production Ready` automática.
