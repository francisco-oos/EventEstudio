# Seguridad — EventStudio 6.14.2-rc.19

## Controles verificados

- Autenticación, sesión opcional explícita y cierre de sesión.
- Roles owner/developer/client separados de perfiles comerciales.
- Aislamiento por evento y rechazo de rutas administrativas sin permisos.
- Origen/CSRF: localhost/LAN autorizados en desarrollo y origen atacante rechazado; HTTPS reforzado en producción.
- Rate limiting de intentos de login.
- Consultas sensibles parametrizadas y allowlists para IDs de renderers.
- Archivos: contenido inválido/corrupto, exceso de elementos, cuotas, nombres y acceso directo no autorizado.
- Publicación: un evento privado o mensaje aprobado no se vuelve público por entrar en preview.
- Comercio: cortesía, compra simulada y perfil no reemplazan el rol de seguridad ni publican automáticamente.
- Respaldo/restauración: validación y reconciliación de operaciones interrumpidas.

## Cambios de seguridad RC19

La ruta `/api/auth/me` normal conserva 401. El comportamiento anónimo 200 sólo existe cuando el consumidor declara `optional=1`; no entrega identidad ni permisos.

`/api/public/photo-messages/:slug` usa la misma autorización de preview que la configuración del evento. Sin publicación, sesión autorizada o token vigente responde 404 para no revelar existencia ni contenido.

El ZIP Animated Flower no se ejecuta dentro de la aplicación. El renderer admitido está implementado en código local y sólo recibe colores hexadecimales y niveles de movimiento validados.

## Ataques simulados incluidos

- origen externo contra mutación autenticada;
- fuerza bruta hasta límite 429;
- credenciales incorrectas y sesiones cerradas;
- acceso cliente a recursos owner;
- acceso cruzado entre eventos;
- archivos con MIME engañoso/corruptos y lotes superiores al límite;
- intentos de usar productos/plantillas sin derecho;
- evento privado consultado de forma anónima;
- restauración y artefactos incompletos.

## No afirmaciones

Este resultado no equivale a inmunidad. Antes de producción pública deben mantenerse actualización de dependencias, TLS, secretos fuera del ZIP, copias externas, monitoreo y pentest independiente sobre la infraestructura real.
