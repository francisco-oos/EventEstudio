# Validación comparativa funcional — RC21 Security r2

## Resultado ejecutivo

**PASS con una corrección heredada.**

| Área | Original funcional | Security r2 | Resultado |
|---|---:|---:|---|
| Plantillas | 59 | 59 | Igual |
| Aperturas | 16 | 16 | Igual |
| Archivos `public/` | 29 | 29 | 29/29 byte-idénticos |
| Owner / Developer / cliente | PASS | PASS | Igual |
| 1,200 usuarios/eventos | PASS | PASS | Igual |
| 150 cortesías aisladas | PASS | PASS | Igual |
| Store / comprador / propietario | PASS | PASS | Igual |
| RSVP / registro | PASS | PASS | Igual |
| QR / fotos | PASS | PASS | Igual |
| Mercado Pago | PASS | PASS | Igual |
| WhatsApp readiness | PASS | PASS | Igual |
| Traducción | PASS | PASS | Igual |
| XLSX legítimo | HTTP 200 | HTTP 200 | Igual |
| Hero / música / galería / dress | HTTP 200 | HTTP 200 | Igual |
| Backup create/download/inspect | PASS | PASS | Igual |
| BD real sobre copia | N/A comparación | PASS | Compatible |
| Exportar fotos ZIP | **HTTP 500** | **HTTP 200** | Corregido |

## Comandos permanentes

- `npm run test:functional-parity`
- `npm run test:security`
- `npm run test:animations`
- `npm run test:rc20`
- `npm run test:rc21`

## Pruebas finales ejecutadas después de la corrección Archiver

- `project-integrity.js`: PASS
- `source-references.js`: PASS
- `mobile-ui.js`: PASS
- `commerce-journeys.js`: PASS
- `rc20-regressions.js`: PASS
- `test:security`: PASS
- `test:functional-parity`: PASS, 46 controles
- `animation-contracts.js`: PASS
- `qr-photo-matrix.js`: PASS
- `localization-provider.js`: PASS
- `rc21-visual-contracts.js`: PASS, 59 paletas
- `rc21-invitation-journeys.js`: PASS, 59 plantillas / 16 aperturas
- `imported-db-compatibility.js`: PASS sobre copia de la BD incluida en el ZIP original
- `scale-1200-users.js`: PASS; 1,200 usuarios/eventos, 4 perfiles y 150 cortesías aisladas

## Restricción de entorno

El `smoke.js` agregado sigue siendo muy lento bajo el adaptador `node:sqlite` utilizado en este contenedor porque el `better-sqlite3` incluido en el ZIP original es el binario Windows. Las matrices específicas anteriores sí finalizaron y cubren los módulos modificados y los recorridos críticos. En un build Linux de despliegue debe instalarse `better-sqlite3` desde `npm ci` para esa plataforma; no debe trasladarse `node_modules` de Windows.

Chromium del contenedor está gobernado por una política administrativa que bloquea todas las URLs, incluido localhost. Por eso no se manipuló esa política para fabricar un PASS gráfico. La validación visual final de esta ronda usa equivalencia byte a byte del frontend/configuración más contratos geométricos, y conserva las capturas reales obtenidas antes del hardening.
