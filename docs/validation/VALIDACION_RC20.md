# Validación — EventStudio 6.14.2-rc.20

## Resultado

**PASS automatizado / CANDIDATA, no estable.** Todas las suites ejecutables terminaron con código 0. La matriz gráfica física permanece como puerta externa porque el entorno no contiene navegador ejecutable.

## Comandos ejecutados

```text
npm test                         # recorridos históricos; smoke RC20 PASS
npm run test:rc20                # PASS, 28.96 s
node scripts/audit-project.js    # PASS
node tests/browser-animations.js # SKIP explícito: no existe Chromium local
```

En este contenedor se usó el shim de `node:sqlite` únicamente para ejecutar la suite; no forma parte de producción ni del ZIP.

## Evidencia RC20

| Área | Evidencia | Resultado |
|---|---|---|
| Animaciones | 9 aperturas registradas; contratos de duración, geometría, reduced-motion, force preview y salida manual | PASS |
| Owner/developer | Vista técnica con Jardín luminoso; simulación cliente separada | PASS |
| Clientes/cortesías | Sin derecho 403; cortesía sólo al evento; revocación y fallback | PASS |
| Capacidad | 1,200 usuarios + 1,200 eventos + cuatro perfiles + 150 cortesías | PASS |
| Rendimiento del test | alta 72 ms; resolución completa 12,880 ms bajo shim | PASS (<20 s) |
| QR | General, Mesa 1, Mesa 2, Mesa 3; data URL, PNG, tarjeta y set PDF | PASS |
| Fotos | Tres mesas, firma válida, firma cruzada, mesa inexistente, contenido autenticado | PASS |
| Pagos | Preferencia, URL, firma inválida, monto alterado, pago aprobado, replay idempotente | PASS |
| Ingresos | Pendiente y cortesía no suman; pago verificado sí suma una vez | PASS |
| WhatsApp | Configuración completa lista; variable ausente bloquea | PASS |
| Traducción | 20 campos ES→EN/PT; Authorization servidor; persistencia | PASS |
| Consola | Sin `chrome-extension://` ni listener `unload`; sondeo opcional y preview autorizado conservados | PASS estático/funcional |
| Históricos | integridad, DOM, móvil, LAN, RC14/15/15.1/17/19, datos, migración, CSRF, HTTPS, comercio, smoke, restore | PASS |

## Dispositivos y visual

Pasaron contratos responsive para viewport real, zoom permitido, touch mínimo 44 px, tablas móviles, navegación y ausencia de overflow prevista. La suite opcional `tests/browser-animations.js` está preparada para recorrer las nueve aperturas en 390×844 y 1440×900, con reduced-motion y force preview.

No se afirma una certificación ocular en Edge/Chrome/Firefox/Safari ni hardware físico: Playwright estaba instalado, pero no había binario Chromium local y la red del entorno no permite descargarlo. Ejecutar antes de estable:

```text
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/a/chrome node tests/browser-animations.js
```

Además se mantiene el checklist físico de QR en `docs/checklists/CHECKLIST_QR_IMPRENTA.md`.

## Datos y limpieza

Todas las cuentas, pagos, traducciones, eventos, fotos y archivos generados por las pruebas usan directorios temporales y datos ficticios. La base incluida no fue usada para las matrices de carga.
