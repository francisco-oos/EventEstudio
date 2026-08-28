# EventStudio 6.14.2 RC21 — production reset r4

Añade una herramienta administrativa de una sola ejecución para limpiar datos de prueba/legacy en producción conservando usuarios y accesos.

No modifica rutas HTTP, frontend, plantillas, aperturas, Store ni esquema de BD.

Nuevo comando de prueba:

`npm run test:production-reset`

Ejecución destructiva protegida:

`node scripts/reset-production-keep-users.js --confirm RESET_KEEP_USERS`
