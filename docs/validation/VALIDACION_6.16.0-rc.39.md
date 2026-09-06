# Validación — EventStudio 6.16.0-rc.39

Estado: **QA candidate avanzada**. Esta candidata cierra los hallazgos visuales y de sincronización observados durante la prueba manual de RC38.

## Resultado automatizado ejecutado

| Área | Resultado | Evidencia |
|---|---|---|
| Sintaxis JavaScript | PASS | `node --check` sobre JS de `public/`, `src/`, `tests/` y `scripts/` |
| Integridad/referencias/UI local | PASS | `project-integrity`, `source-references`, `mobile-ui`, `local-network`, RC14 |
| Design Engine/Recipes | PASS | 65 Recipes, 19 assets, 12 componentes, 103 skins |
| Coherencia lógica | PASS | 175,500 combinaciones + 1,300 proyecciones rol/perfil |
| Wiring UI | PASS | 139 controles/botones verificables |
| Recipe render | PASS | 65 × 2 viewports = 130, 0 fallos, overflow 0 |
| Readability | PASS | 130 casos; mínimo paper ~11.34:1 |
| Color parity | PASS | 130 casos; mínimo name ~11.34:1 |
| Design Lab catálogo RC39 | PASS | 65 Recipes; 0 fallos; heading min ~11.34:1; body min ~4.74:1 |
| RC39 controles visuales | PASS | title size 19.84→39.68 px; hidden service 0 px; countdown/CTA ~15.46:1 |
| Responsive focal | PASS | RC38: 9 casos 320/390/1366, 0 fallos |
| Contenido largo | PASS | 64 casos, 0 fallos |
| Feature visibility | PASS | 32 casos, módulos ocultos sin geometría residual |
| Public interactions | PASS | apertura/skip, música, links, idioma, galería/lightbox y RSVP |
| Stationery | PASS | RC28/29/30 visual; rerun individual sin fallos |
| Álbum/Recipe | PASS | 2 casos visuales |
| BD incluida | PASS | hash preservado + `quick_check=ok` |

## Incidencias concretas verificadas

- Recipe predefinida conserva su preview nativo: PASS.
- Catálogo no sustituye la apertura nativa por el filtro actual: PASS por contrato RC39.
- Recipe y Stationery se sincronizan: PASS por contrato RC39.
- Sobre/lacre se autosalva en DRAFT; Apply permanece explícito: PASS por contrato RC39.
- Volver del preview usa navegación determinista: PASS por contrato y harness del Design Lab.
- Data real de historia/ubicación/programa/vestimenta/galería en canvas: PASS en harness/contratos.
- Rutas de media borrada se filtran una vez identificadas como ausentes: PASS por contrato RC39.
- Hero ya cargado se reutiliza cuando está habilitado: PASS por contrato.
- Servicio oculto no deja hueco: PASS browser, altura 0 y gap 0.
- Controles tipográficos cambian la representación: PASS browser, ratio de tamaño medido 2.0.
- Color Studio opera sobre la paleta efectiva del DRAFT: PASS contrato RC39.
- Hero cinematográfico sin foto: 65 Recipes del catálogo legibles en Design Lab, 0 fallos.
- Owner/developer puede validar experiencias Store sin conceder entitlement al cliente: PASS lógico/contrato.
- Countdown oscuro mantiene números/CTA legibles: PASS browser (~15.46:1 en caso focal).

## BLOCKED_ENV, no PASS

No fue posible completar el E2E real de servidor porque el runtime no dispone de las dependencias npm necesarias y `npm ci` no pudo completarse. Quedan como gate externo:

- login/sesión/roles dinámicos contra Express real;
- persistencia SQLite vía `better-sqlite3` bajo servidor;
- upload multipart real de foto/audio;
- stress/concurrencia real del servidor;
- pagos/Openpay, WhatsApp y journeys comerciales;
- migraciones productivas completas;
- `npm audit` contra registro npm.

La BD incluida fue inspeccionada de forma no destructiva y no se ejecutó `seed`.

## Gate antes de producción

```text
npm ci
npm run test:preproduction
npm audit --audit-level=moderate
```

Después completar `docs/checklists/QA_FISICO_FINAL_6.16.0-rc.39.md` en navegadores/dispositivos reales y no promover si aparece un FAIL funcional, de datos, permisos, contraste, overflow o sincronización.
