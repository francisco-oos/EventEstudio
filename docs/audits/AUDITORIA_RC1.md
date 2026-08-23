# Auditoría técnica RC1

Fecha de corte: 27 de julio de 2026.

| Área | Hallazgo en 6.10 | Corrección RC1 | Estado |
|---|---|---|---|
| Sesiones | Token en `localStorage` y texto directo en SQLite | Cookie segura en producción, HMAC en base, expiración y logout real | Corregido |
| Acceso | El owner podía indicar un evento inexistente; algunas rutas no verificaban evento | `eventAllowed` valida existencia, acceso y fija el evento de la solicitud | Corregido |
| Módulos | Ocultamiento sólo visual | Catálogo, estados y autorización backend por evento/plan/rol | Corregido |
| Público | Configuración y tokens podían operar con evento no publicado | Publicación, archivo y módulo se comprueban en servidor | Corregido |
| Fotos | Carpeta completa expuesta y sin mensajes/moderación | Archivos protegidos, lote idempotente, mensaje opcional, aprobación/ocultamiento y validación por firma binaria | Corregido |
| RSVP | Sin cierre ni política de cambios | Fecha de cierre, bloqueo de cambios, responsable y validación de cupos/menús | Corregido |
| WhatsApp | Sólo enlaces manuales sin cola | Conserva `wa.me`; agrega proveedor manual/simulación/Cloud, cola, idempotencia, reintentos, cancelación y webhook firmado | Implementado; Cloud externo pendiente |
| Respaldo | Sin copia integral repetible | Snapshot SQLite consistente + archivos + manifiesto + SHA-256 + retención | Corregido |
| Borrado | Purga automática y eliminación definitiva fáciles de activar | Purga opt-in, eventos protegidos, confirmación por nombre y respaldo previo | Corregido |
| Pagos | Checkout demo acreditaba pagos | Demo bloqueado en producción y desactivado por defecto | Corregido |
| Seed | Podía contaminar producción | Bloqueado por `NODE_ENV=production`; producción inicia sin eventos demo | Corregido |
| Cabeceras | CSP deshabilitada | Helmet con CSP, compresión, request ID y errores JSON | Corregido |
| Reportes | Resumen limitado | Hojas de invitaciones, estados, mesas, restricciones, menús aplicables y mensajes de fotos | Corregido |
| Importación | Resumen ambiguo y rollback total por límite | Insertados/actualizados/omitidos/errores por fila; filas válidas se conservan | Corregido |
| Dependencias ZIP/Excel | El aviso `CVE-2026-14257`, publicado después de la entrega inicial, afectó transitivamente a `brace-expansion` | `archiver 8`, `unzipper 0.12.5` y `brace-expansion 5.0.8`; respaldo, restauración y Excel repetidos | Corregido |
| PDF/QR | La fuente PDF base presentaba espaciado visual irregular en render moderno | Fuentes Montserrat/Cormorant TTF embebidas y revisión visual de nueve PDFs | Corregido |
| Red local | El arranque manual usaba `localhost`, por lo que el teléfono y los QR de prueba no podían resolverlo | Lanzadores Windows/Linux, escucha explícita en LAN, detección de IP y QR local | Corregido |
| CSP en red local | `upgrade-insecure-requests` convertía CSS y JavaScript a HTTPS al entrar por una IP HTTP; se veía HTML sin diseño ni botones | La directiva se desactiva sólo en desarrollo local, se conserva en producción y el lanzador compara HTML/CSS/JS antes de mostrar el QR | Corregido en RC3 |
| Identidad y narrativa | Marca dividida entre “Event Studio” y “EventStudio”; quedaban frases de boda en vistas genéricas | Marca unificada y textos neutrales fuera del perfil `wedding` | Corregido |
| Hermeticidad de pruebas | La presencia de un `.env` local podía desactivar el registro esperado por la regresión | La suite fija modo, host, almacenamiento, registro y pagos en su proceso aislado | Corregido |

## Riesgos que no se deben ocultar

1. WhatsApp Cloud no fue probado contra una cuenta Meta real porque requiere credenciales, número, plantilla y dominio HTTPS externos.
2. La impresión física necesita una prueba de imprenta y escaneo con teléfonos reales; la validación automatizada sólo cubre dimensiones, estructura PDF y generación QR.
3. SQLite es adecuado para la boda y primeras pruebas con una réplica. Para múltiples réplicas o carga comercial concurrente se debe migrar a PostgreSQL y almacenamiento de objetos.
4. La restauración es deliberadamente controlada: se prepara en el panel y se aplica durante el reinicio; sustituir la base en un proceso activo podría mezclar escrituras.
5. No existe proveedor de pago real; la pantalla comercial no debe presentarse como checkout funcional.

## Criterio de salida

RC1 es apta para staging y para la boda real con operación supervisada. La etiqueta de “producción general” requiere cerrar los cinco puntos externos del checklist de publicación.
