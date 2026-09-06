# Matriz de cobertura — 6.16.0-rc.37

| Requisito | Unit/contract | E2E servidor | Visual/browser RC37 | Resultado |
|---|---|---|---|---|
| DRAFT no publica | V5 | V5 | NOT_RUN | PASS funcional |
| Preview usa DRAFT | V5 | V5 | NOT_RUN | PASS de payload |
| Apply DRAFT→ACTIVE | V5 | V5 | NOT_RUN | PASS |
| conflicto/retry/doble Apply | V5 | V5 | NOT_RUN | PASS |
| descarte conserva ACTIVE | V5 | V5 | NOT_RUN | PASS |
| retorno eventId/tab/panel/modo | rc34/35/V5 static | — | NOT_RUN | PASS estructural |
| assets transform/duplicar/teclado | rc31/V5 | V5 sanitiza | NOT_RUN | PASS funcional |
| bloques/estilos/visibilidad/orden | rc31–35 | rc33 E2E | NOT_RUN | PASS funcional |
| tipografía/color semántico | rc34/35/V5 | V5 | NOT_RUN | PASS lógico |
| 65 Recipes | rc31–35 | catálogo | NOT_RUN | PASS catálogo |
| Stationery/lacre | rc27–30/35 | V5 | NOT_RUN | PASS funcional |
| permisos/tenancy | rc20/33/34/V5 | security adversarial | n/a | PASS |
| comercio/checkout/grants | commerce suites | rc33 E2E | n/a | PASS test/mocks |
| invitados/RSVP | smoke/rc21/22 | smoke | NOT_RUN | PASS funcional |
| mesas/fotos/QR/PDF | matrices históricas | functional parity | NOT_RUN físico | PASS funcional |
| música | rc20/32/33 | smoke | NOT_RUN interacción real | PASS funcional |
| migración/BD/restore/sidecars | data/security/rc36 | sí | n/a | PASS |
| responsive 320→4K | contratos CSS históricos | — | NOT_RUN RC37 | NOT_RUN visual |
| Chromium/WebKit/Firefox/touch | — | — | no disponible | NOT_RUN |

## Suites ejecutadas

`npm test` hasta el import visual RC32; `npm run test:security`; RC32 Node; RC33, RC34, RC35, RC36, V5; `npm run test:rc33:e2e`; auditoría QA; validación de catálogo. El único corte de `npm test` es dependencia Playwright ausente.

## Datos ficticios

Las Recipes declaran compatibilidad y las suites recorren wedding, birthday, quinceanera, baptism, baby-shower, graduation, corporate, anniversary, themed-party y family-event mediante catálogos/fixtures. La matriz visual de esos diez tipos en RC37 queda NOT_RUN.
