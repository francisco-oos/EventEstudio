# EventStudio 6.14.2-rc.18

## Alcance

RC18 parte exclusivamente de `EventStudio-6.14.2-rc.17` y consolida correcciones de portabilidad, alta de usuarios, gobierno comercial, sincronización de mesas y motor de experiencias/animaciones.

## Cambios principales

- Catálogo central de experiencias en `config/experiences.json` para evitar listas divergentes entre servidor, UI y comercio.
- Integración gobernada de Sello marfil, Margarita/manzanilla, Tira de enfoque, Mural editorial y Órbita de recuerdos. Las experiencias nuevas permanecen no publicadas por defecto.
- Ajustes de movimiento efectivos por nivel, `prefers-reduced-motion`, visibilidad de pestaña, ahorro de datos y densidad/DPR en escenas canvas.
- Flujo de alta de cliente reforzado para mantener coherencia comercial inicial.
- Corrección de concesión de experiencias de cortesía que podía provocar error SQL 500.
- Sincronización de mesa/cupos corregida para invitados creados después de migraciones históricas, sin reactivar asignaciones liberadas deliberadamente.
- Fallback PDF portable cuando el paquete no contiene las TTF históricas.
- Entrega preparada sin `.env`, bases runtime ni `node_modules`.
- Versionado y referencias estáticas actualizadas a `6.14.2-rc.18`.

## Seguridad y portabilidad

- No se redistribuyen secretos.
- No se empaquetan binarios nativos de otra plataforma.
- Se mantiene `.env.example` como contrato de configuración.
- Las experiencias comerciales no se publican automáticamente por existir técnicamente.

## Estado de validación

Las suites estructurales, comerciales, de seguridad, migración y regresiones RC17 pasan. La prueba funcional extensa fue corregida para aceptar fuentes PDF estándar cuando faltan TTF locales; por su duración total, RC18 se entrega como candidata de validación y no como versión estable final.
