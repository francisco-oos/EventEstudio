# Reset de producción conservando usuarios y accesos — RC21 r4

## Objetivo
Limpiar datos operativos/comerciales heredados o de prueba sin perder las cuentas existentes ni su capacidad de acceso.

## Se conserva deliberadamente
- `users`: identidad, email/login, `password_hash`, nombre, rol, estado y metadatos de cuenta.
- `subscriptions`: acceso/plan vigente de cada cuenta.
- `account_commercial_controls`: perfil, límites y política específica por cliente.
- Catálogos y configuración necesarios para interpretar permisos: `plans`, productos, perfiles comerciales y relaciones de catálogo.
- `backup_records` y `audit_logs`: evidencia operativa y posibilidad de recuperación.

## Se reinicia
- Eventos y sus asignaciones (`user_events`).
- Invitados, RSVP, fotografías, mesas, plano, mensajes y colas.
- Dominios, previews, grants y solicitudes de publicación vinculadas a eventos.
- Pagos y pedidos: el ingreso del dashboard queda en cero.
- Carritos, conversiones, promociones, notificaciones y muestras Showcase creadas desde eventos (las demos base permanecen).
- Sesiones: todos los usuarios deben autenticarse de nuevo.

## Multimedia
`uploads/guest-photos` y `uploads/site-media` no se destruyen inmediatamente. Si contienen archivos, se mueven a:

`$STORAGE_ROOT/reset-archives/<timestamp>/`

Después se recrean vacías las carpetas activas.

## Salvaguardas
1. Requiere `NODE_ENV=production`.
2. Requiere confirmación literal `RESET_KEEP_USERS`.
3. Rechaza el reset si no existen usuarios o no hay Owner activo.
4. Crea snapshot SQLite verificado previo al reset.
5. Ejecuta limpieza en transacción.
6. Verifica integridad y claves foráneas.
7. Compara huellas de usuarios, suscripciones y controles antes/después.
8. Exige ingresos/eventos/pagos/pedidos en cero.
9. Crea snapshot SQLite verificado posterior al reset.

## Ejecución en Railway
Después de desplegar la versión que contiene el script:

```bash
railway ssh -- node scripts/reset-production-keep-users.js --confirm RESET_KEEP_USERS
```

La salida JSON debe mostrar todas las invariantes en `true`.
