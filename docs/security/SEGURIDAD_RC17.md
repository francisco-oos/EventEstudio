# Seguridad — RC17

## Autoridad y permisos

- Perfil comercial no modifica rol de seguridad.
- Mutaciones de productos, planes, perfiles, cortesías, Showcase y controles comerciales permanecen detrás de autenticación y autorización owner/developer según la ruta.
- El frontend nunca constituye la fuente de autorización comercial; el servidor vuelve a resolver derechos.

## Entradas y SQL

Se realizó revisión estática de consultas dinámicas. Los valores de usuario continúan enviados mediante parámetros preparados en los puntos sensibles revisados; interpolaciones identificadas corresponden a listas de placeholders/campos internos o metadatos controlados. Esta revisión no se presenta como pentest formal.

La guía oficial de seguridad de Express recomienda validar entradas, usar TLS en producción y Helmet. EventStudio conserva Helmet y políticas diferenciadas para LAN HTTP frente a producción HTTPS.

## Uploads

- Clave idempotente no concede permisos; sólo correlaciona reintentos.
- El servidor valida evento/ruta y mantiene límites Multer.
- Archivos parciales de solicitudes abortadas se eliminan.
- Referencias rotas de una BD copiada no se convierten en rutas de archivos arbitrarias.

## Catálogo y experiencias

La BD no puede inyectar JavaScript arbitrario. Los productos seleccionan slots/renderers que deben estar autorizados en código. Esto es intencional y no se considera “dato comercial estático”: es una frontera de ejecución segura.

## Pendientes antes de producción masiva

- ejecutar `npm audit`/scanner de dependencias en un entorno con registry funcional;
- pruebas de autorización horizontal entre eventos/cuentas;
- fuzz de endpoints de upload/importación;
- rate limits/brute-force de autenticación bajo infraestructura final;
- revisar CSP al activar nuevos proveedores externos;
- TUS futuro con autorización y cuota por upload resource.
