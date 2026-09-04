# Validación EventStudio 6.14.2-rc.25

## Alcance

RC25 corrige el modelo de Regalos de RC24 para permitir métodos simultáneos y separa formalmente el mensaje motivador del anfitrión de la dedicatoria que escribe el invitado durante un pago Openpay.

## Contratos funcionales

1. Lluvia de sobres, mesa de regalos y transferencia bancaria se almacenan como estados independientes.
2. Openpay conserva un switch independiente y puede coexistir con cualquiera de los métodos anteriores o ser la única modalidad activa.
3. Desactivar un método no borra ni modifica los demás.
4. Lluvia de sobres posee instrucciones propias del buzón físico.
5. Transferencia añade concepto sugerido y mensaje motivador opcional.
6. Los cuatro presets persuasivos se cargan desde configuración, no desde `app.js` ni `admin.js`.
7. Un mensaje personalizado del anfitrión se persiste de manera independiente.
8. La dedicatoria del invitado `openpayGiftMessage` permanece disponible cuando `messageEnabled` está activo.
9. Si transferencia está desactivada, sus datos y mensaje motivador no se renderizan públicamente.
10. Si no existe ningún método activo, la sección pública completa queda oculta.
11. Eventos RC24 y anteriores mantienen fallback desde `gifts.mode`.

## Pruebas unitarias y de contrato

`tests/rc25-gifts-modular.js` valida:

- migración lógica desde modos históricos;
- combinaciones y persistencia de métodos;
- derivación del modo legado;
- normalización de CLABE, concepto y selección persuasiva;
- cuatro presets y resolución del mensaje personalizado;
- separación entre mensaje del anfitrión y dedicatoria del invitado;
- ausencia de frases persuasivas hardcodeadas en frontend;
- contratos del panel, servidor y vista pública.

## Prueba visual

`tests/rc25-gifts-visual.py` evalúa siete configuraciones en tres viewports:

- lluvia de sobres solamente;
- transferencia solamente;
- lluvia de sobres + transferencia;
- lluvia de sobres + transferencia + mesa de regalos;
- todos los métodos + Openpay;
- Openpay solamente;
- ningún método.

Criterios:

- overflow horizontal <= 2 px;
- CLS <= 0.02;
- cero intersecciones geométricas entre bloques de métodos;
- cero errores JavaScript;
- visibilidad exacta según estado;
- mensaje motivador y concepto renderizados cuando corresponden;
- dedicatoria Openpay conservada.

## Compatibilidad RC24

`tests/rc24-gifts.js` y `tests/rc24-gifts-visual.py` permanecen en la suite para comprobar que transferencia independiente, monto sugerido opcional y dedicatorias del invitado no regresionen.

## Puerta de promoción

RC25 conserva la Definition of Done acumulada. No promover a estable sin completar:

```bash
npm ci
npm test
npm run test:visual
npm run audit
npm audit --audit-level=moderate
```

Los bloqueos de red o dependencias se documentan como bloqueos de entorno y no como PASS.

## Evidencia ejecutada en esta candidata

Pruebas de contrato y regresión ejecutadas correctamente:

- project-integrity;
- source-references;
- mobile-ui;
- local-network;
- RC14, RC15, RC15.1, RC17, RC19, animaciones, RC20-regressions, RC21 visual contracts, RC22, RC23 acceptance contracts, RC24 y RC25;
- auditoría estructural.

QA visual ejecutado:

- 128/128 casos de plantillas sin overflow;
- 21/21 aperturas sin fallos visuales, CLS máximo 0 y overflow máximo 0;
- matriz de cinco plantillas nuevas: 30/30 casos en 320×568, 360×800, 390×844, 412×915, 768×1024 y 1440×900;
- regalos RC24: 10/10 escenarios;
- regalos RC25: 27/27 escenarios, incluidos mensaje personalizado del anfitrión, métodos combinados, Openpay únicamente, ningún método y transferencia activada sin datos.

El último pase del runner headless registró promedio aproximado de 59.78 FPS para aperturas. El mínimo puntual observado fue 55.40 FPS; p95 máximo de intervalo de frame 16.8 ms. No hubo CLS ni overflow en esos casos.

## Bloqueos de entorno

Se intentó ejecutar `npm test` completo. El pipeline pasa sus primeras validaciones y se detiene en `tests/data-safety.js` porque `better-sqlite3` no está instalado en este runtime. También se intentó `npm ci`, pero la descarga no completó dentro del tiempo disponible. `npm audit --audit-level=moderate` no pudo consultar `registry.npmjs.org` por `EAI_AGAIN`.

Por tanto RC25 permanece como candidata QA; esos bloqueos no se registran como PASS de la suite integral.
