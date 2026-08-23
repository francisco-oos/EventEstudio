# Decisiones técnicas — EventStudio 6.14.2-rc.20

## Base y precedencia

RC20 parte exclusivamente de `EventStudio-6.14.2-rc.19(1).zip`, SHA-256 `38cfdbc90f1f8907fa62b3ef092fb9ce510d6d22e16c30639c3c0bf8dab57426`. Se revisaron primero README, índice RC19, decisiones, auditoría, seguridad, trazabilidad y validación. RC20 prevalece sólo donde modifica el comportamiento; el historial continúa vigente para lo demás.

## Decisiones y razonamiento

| Tema | Decisión RC20 | Razón y protección |
|---|---|---|
| Owner/desarrollador no veía Jardín luminoso | La vista técnica completa vuelve a ser el estado inicial. “Simular vista cliente” queda desmarcado y explícito. | `supportClientView=true` ocultaba productos no concedidos al evento aunque el rol de plataforma sí tuviera acceso. La simulación continúa disponible y refleja derechos reales sin cambiarlos. |
| Preview forzado de un evento `still` | Durante `forceMotion`, el runtime usa la cadencia `balanced`; fuera del preview conserva `still`. | El runtime anterior declaraba animación activa pero multiplicaba todas las duraciones por cero, produciendo 1 ms. Se prueba en `tests/animation-contracts.js`. |
| Sobre minimalista y Sello marfil imperceptibles | Se separan apertura de solapa, salida de tarjeta, desvanecimiento y cierre. Minimalista dura 4.0 s y Marfil 4.3 s en reproducción normal. | El cierre anterior ocurría a 1.05 s, antes de que la tarjeta terminara su transición a 1.10 s. Ahora el temporizador JS supera el final CSS. |
| Windows con animaciones desactivadas | Público respeta `prefers-reduced-motion`; un preview explícito puede forzar el recorrido completo. | Accesibilidad y QA son contextos distintos. La clase de preview no se aplica a visitantes normales. |
| Jardín luminoso y cortesías | Owner/desarrollador siempre lo ven en vista técnica; cliente sólo por plan/producto/concesión activa. | La frontera se valida en backend, no sólo ocultando un control. La revocación degrada la salida pública a `wax-envelope`. |
| Cortesía e ingresos | Una concesión conserva `source='courtesy'`, responde `revenue_cents=0` y nunca crea pago/orden pagada. | La utilidad de propietario suma únicamente `payments.status='paid'` y `orders.status='paid'`. |
| Más de 1,000 usuarios | Se añadió una matriz reproducible de 1,200 cuentas, 1,200 eventos, cuatro perfiles y 150 cortesías. | Prueba alta, integridad, aislamiento, perfiles y resolución de derechos sin incorporar datos personales reales. |
| Cobro real | Se integra Mercado Pago Checkout Pro mediante servidor, preferencia por orden/pago, `external_reference`, webhook firmado y consulta canónica del pago. | Ni el retorno del navegador ni el cuerpo del webhook acreditan por sí solos. Se verifica firma, estado, referencia, importe y moneda antes de activar. |
| WhatsApp | Se conserva el adaptador Cloud existente y se prueba que las siete variables requeridas bastan para dejarlo listo. | Credenciales incompletas mantienen el envío automático bloqueado; ningún secreto llega al panel. |
| Traducción | Se prueba proveedor configurado ES→EN/PT en 20 campos y persistencia. Sin endpoint, UI deshabilita la acción y la escritura manual sigue disponible. | Evita los 503 repetidos observados, sin inventar traducciones locales. |
| QR y fotos | Se prueba QR general y de tres mesas, firma ligada a mesa/evento, PNG, tarjeta PDF, set PDF, carga, moderación y contenido autenticado. | Una firma cruzada o mesa ajena falla; `/uploads/guest-photos` no publica archivos directamente. |
| Más animaciones para Store | Se documentan candidatos de licencia permisiva, pero no se instalan ni publican automáticamente. | Cada nueva experiencia debe tener concepto propio, licencia revisada, fallback estático, gobierno comercial, presupuesto de rendimiento y QA visual antes de Store. |
| Compatibilidad de BD | No cambia el esquema. Sólo se actualiza `release_version` de las tres experiencias florales aprobadas cuando aún marca RC19. | Bases existentes conservan productos, perfiles, planes, precios, concesiones y decisiones del propietario. |

## Regla de autorización resultante

| Actor/vista | Jardín luminoso |
|---|---|
| Owner — técnica | Visible y configurable |
| Developer — técnica | Visible y configurable |
| Owner/developer — simulación cliente | Lo que tenga el evento seleccionado |
| Cliente sin derecho | Oculto y `PUT settings` responde 403 |
| Cliente con plan/producto/cortesía activa | Visible y configurable |
| Otro cliente | Nunca hereda la concesión |
| Público tras revocación | Fallback seguro a Sobre con lacre |

## Límite honesto de validación

Los contratos de viewport, touch, reducción de movimiento, geometría y duración pasan. El entorno de construcción no contiene un ejecutable Chromium/Firefox/Safari, por lo que `tests/browser-animations.js` queda como puerta física opcional y se omite explícitamente. RC20 no se declara estable hasta completar esa matriz en navegadores/dispositivos reales.
