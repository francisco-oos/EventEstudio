# Validación 6.14.2-rc.18

## Ejecutado

- `npm run audit`: PASS.
- `npm run test:rc17`: PASS.
- Cadena `npm test` hasta `tests/smoke.js`: PASS en integridad, referencias, UI móvil estática, red local, regresiones RC14, seguridad de datos, migración comercial, política de origen, cabeceras de seguridad y recorridos comerciales.
- `tests/smoke.js`: se corrigió una expectativa heredada que exigía `/FontFile2` aunque RC17 no distribuye TTF. Ahora exige una fuente utilizable: incrustada si existe o una fuente PDF estándar portable.

## Hallazgos corregidos durante RC18

1. El paquete RC17 contenía material de entorno que no debe formar parte de una distribución limpia.
2. Dependencias nativas empaquetadas desde Windows impedían ejecutar en Linux.
3. La prueba de esquema conservaba una versión anterior al esquema efectivo.
4. La concesión de cortesía podía insertar una cantidad incorrecta de valores y devolver 500.
5. El alta de cliente podía quedar sin estado comercial inicial coherente.
6. Un invitado nuevo podía conservar nombre de mesa sin quedar reflejado en el plano.
7. PDF y CSS podían depender de fuentes que el ZIP no incluía.

## Criterio de entrega

RC18 se empaqueta como **candidata corregida**. No se declara `stable` hasta completar en una ejecución continua la prueba funcional extensa, la simulación de al menos 200 usuarios y la inspección visual multi-dispositivo final.
