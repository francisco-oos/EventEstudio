# Validación RC33 — EventStudio 6.15.0-rc.33

## Estado

**Candidato listo para prueba física local del propietario.** No debe promoverse a producción hasta completar `npm ci` + `npm run test:preproduction` en un entorno con acceso al registro y completar la revisión física indicada en este documento.

## QA ejecutado en esta sesión

### Contratos JS/arquitectura

PASS:

- `project-integrity.js`
- `source-references.js`
- `mobile-ui.js`
- `animation-contracts.js`
- RC27 Stationery Engine
- RC28 Stationery Studio
- RC29 paridad Stationery
- RC30 sincronización pública
- RC31 Design Engine
- RC32 Design System
- RC33 Design Ecosystem
- `node --check` sobre 91 archivos JavaScript
- parseo de 47 JSON
- compilación Python de tests/scripts

### QA visual Chromium real

- 64 Recipes × móvil/escritorio: 128 casos, 0 fallos, overflow 0.
- temas legacy × móvil/escritorio: 128 casos, 0 fallos, overflow 0.
- aperturas: 22 casos, 0 fallos, FPS mínimo 59.99, CLS máximo 0.
- matriz general de dispositivos: 30 casos, 0 fallos.
- Gifts RC24: 10 casos, 0 fallos.
- Gifts RC25: 27 casos, 0 fallos, CLS 0, overlaps 0.
- Stationery Studio: 2 casos + 5 perfiles, 0 fallos, FPS mínimo ~60.
- RC30 public envelope: 2 casos, 0 fallos.
- Design Lab: navegación, Recipes, Assets, drag, transforms, secciones, opening, presentación, Color Studio, undo/redo, guardar y preview PASS.
- interacciones públicas: opening/skip, música, links, idioma, galería/lightbox y RSVP PASS.
- landing RC33: 2 viewports, 0 fallos.
- matriz visual de features RC33: 16 patrones × 2 viewports = 32 casos, 0 fallos; módulos deshabilitados ausentes del DOM.
- contenido largo RC33: 8 layouts × 8 resoluciones = 64 casos, 0 fallos, desde 320×568 hasta 3840×2160.
- álbum Recipe-first: 2 viewports, 0 fallos; paleta, tipografía, textura, layout y Assets sincronizados.

## Preservación de datos

La BD fuente de QA se mantiene sin cambios en el paquete de datos.

- integridad SQLite: `ok`;
- `user_version`: 614210;
- SHA-256 fuente: `865174a02f7436980080db1765c8a4aa42d984619d13eeb7d74c06ad33fcf270`;
- usuarios: 4;
- eventos: 2;
- invitados: 26;
- fotos: 0.

El Design Engine no requiere migración destructiva de schema; la Recipe se persiste dentro de settings del evento.

## Pruebas no ejecutadas aquí

No fue posible ejecutar la suite de servidor/BD/checkout dependiente de `node_modules`, incluido `tests/rc33-commerce-design-e2e.js`, debido a que el entorno no puede acceder a `registry.npmjs.org`. La prueba RC33 E2E está implementada y valida Express → Basic → Premium, liberación inmediata de módulos y persistencia de la Recipe sin mutación.

Antes de producción ejecutar obligatoriamente:

```bash
npm ci
npm run test:preproduction
npm audit --audit-level=moderate
```

Esto cubre autenticación, permisos, cortesías, pago/checkout, Mercado Pago, migraciones, seguridad, aislamiento, RSVP, QR/PDF, restauración y demás suites históricas.

## Prueba física obligatoria del propietario

1. iniciar con una copia de la BD QA;
2. abrir Design Lab y probar varias Recipes;
3. editar todos los tokens de Color Studio y verificar sincronización con invitación/QR/Stationery;
4. mover/rotar/escalar varios Assets y recargar para confirmar persistencia;
5. asignar una pista real y confirmar reproducción/pausa en teléfono;
6. probar una apertura de sobre y al menos dos aperturas no-envelope;
7. probar RSVP con invitado real/reimportado;
8. generar QR general, QR de mesa y PDF de tarjeta QR;
9. generar invitación física PDF;
10. subir fotografías desde teléfono al álbum y comprobar identidad visual;
11. probar Cortesía/cliente de pago y verificar módulos bloqueados/desbloqueados;
12. ejecutar un checkout en sandbox/preproducción y verificar grant inmediato;
13. repetir invitación pública en Android/iOS real;
14. promover a producción sólo después de PASS físico y `npm run test:preproduction`.
