# Matriz de trazabilidad — EventStudio 6.14.2-rc.20

| Requisito | Implementación | Prueba | Estado |
|---|---|---|---|
| Owner/developer ven Jardín luminoso | vista técnica predeterminada + acceso platform backend | `rc20-permissions` | PASS |
| Simulación cliente fiel | `?view=client`, sin cambiar privilegios | `rc20-permissions` | PASS |
| Cada cliente sólo ve lo otorgado | event grant + `DESIGN_PRODUCT_REQUIRED` | A/B con y sin cortesía | PASS |
| Cortesía no es ganancia | fuente courtesy; sin pago/orden pagada | owner summary antes/después | PASS |
| Sobres perceptibles | tabla `envelopeTiming` + variables CSS | `animation-contracts`, `rc20-regressions` | PASS |
| Windows reduce, preview visible | perfil balanced sólo con force | force still = 1,080 ms | PASS |
| Más de 1,000 usuarios | generador temporal de 1,200 | `scale-1200-users` | PASS |
| Cuatro perfiles | asignación circular de perfiles | 4 IDs distintos | PASS |
| QR por cuenta/mesa | HMAC y URL `e/mesa/mesaSig` | tres mesas + firma cruzada | PASS |
| Fotos por QR | carga pública gobernada, contenido privado | tres lotes + directo 404 | PASS |
| Generables | QR PNG, tarjeta PDF, set PDF, invitación física/reportes heredados | matrix + smoke | PASS |
| Traducciones | endpoint servidor y capability | 20 campos ES→EN/PT | PASS |
| WhatsApp listo con credenciales | providerStatus por perfil | readiness + smoke webhook | PASS |
| Cobro listo con credenciales | Checkout Pro + webhook canónico | preferencia/firma/monto/replay | PASS simulado |
| Ataques y estabilidad | roles, IDOR, CSRF, firmas, archivos, restore, headers | suites security/data/origin/restore | PASS |
| Dispositivos | contratos responsive y test Playwright preparado | mobile-ui PASS; browser SKIP sin binario | PENDIENTE físico |
| Nuevas animaciones Store | investigación con licencia y criterios | documento de investigación | BACKLOG |
