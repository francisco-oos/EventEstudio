# Matriz de trazabilidad RC14

| Hallazgo | Corrección | Evidencia/prueba |
|---|---|---|
| RSVP acepta UX confusa para negativos/exceso | validación inmediata + servidor conserva validación | `tests/rc14-regressions.js` + prueba manual |
| RSVP requiere recarga para reflejar resultado | `renderSavedRsvpSummary()` | prueba manual |
| `crypto.randomUUID` falla en LAN HTTP | `makeClientUploadKey()` | regresión RC14 + prueba LAN |
| warnings COOP/OAC en LAN | headers condicionales desarrollo/producción | `tests/local-network.js`, security headers en entorno completo |
| mover una persona altera otras | import legacy marcada una sola vez | tabla `seating_legacy_imports` + prueba manual |
| apertura no se previsualiza | forwarding `previewOpening` y modal | regresión RC14 |
| texto puede perderse en paleta | `accentText`, `ink`, `muted` >=4.5:1 | auditoría automática de todos los temas |
| nombres en mayúsculas se ven poco editoriales | capitalización de presentación | inspección pública/PDF/álbum |
| preview Plan y extras desborda | modal escalable teléfono/escritorio | `tests/mobile-ui.js` + prueba real |
| Store vende tema ya incluido | `productOwnedForEvent()` + revalidación checkout | regresión RC14 |
| Plan builder/modal ilegible | modal ampliado + grid responsive + preview visual | prueba manual |
| Mi negocio demasiado largo | secciones colapsables | prueba manual |
| cortesía no explica regalo | detalle + `NEW` + destino | regresión RC14 |
| visualizar menú cambia contexto | modal read-only | regresión RC14 |
| “superusuario” confuso | copy de propietario/desarrollador y vista cliente explicada | prueba manual |
| colores coordinados limitados | textura de superficie en Design Kit | prueba manual |
