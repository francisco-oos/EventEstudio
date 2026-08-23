# Estado de módulos 6.14.2 RC6

La disponibilidad se guarda por evento en `settings_json`. El propietario puede cambiar tanto la activación del evento como el estado comercial. El servidor vuelve a comprobar rol, plan, evento y módulo en cada ruta protegida.

## Disponibles por defecto

| Módulo | Uso |
|---|---|
| Invitación | Sitio público, contenido y publicación |
| RSVP | Confirmar, rechazar, corregir, cupos y cierre |
| Invitados | Alta, edición, borrado, Excel/CSV y enlaces familiares |
| WhatsApp manual | Enlaces `wa.me` como respaldo operativo |
| Música | Archivo local o Spotify, eliminación y segundo inicial |
| Programa y ubicaciones | Momentos activos, orden, lugar y Maps |
| Vestimenta, regalos y galería | Secciones públicas configurables |
| Fotos y mensajes | Carga por QR, mensajes opcionales y moderación |
| QR e invitación física | Ocho formatos, set PDF, PNG e invitación 5×7 |
| Plano y mesas | Planeado/confirmado, pista, zonas, capacidad y asientos |
| Reportes | Libro Excel operativo de nueve hojas |
| Menús | Servicio fijo o selección por invitado, con opciones para adultos y niños |
| Plantillas y tipografías | Temas y fuentes locales con vista previa dinámica |
| Administración móvil | Menú lateral estable al volver o cambiar de escala, invitados en tarjetas resumidas, filtros, formularios de una columna y controles táctiles |
| Usuarios | Alta, edición, desactivación, reactivación, roles y eventos asignados |
| Respaldo y restauración | Snapshot íntegro, inspección, rollback y aplicación al reiniciar |

## Ocultos por defecto

| Módulo | Motivo para no ofrecerlo todavía |
|---|---|
| WhatsApp Business automático | Requiere credenciales Meta, plantilla aprobada, HTTPS y prueba real |
| Cobros | No hay proveedor de pago real; el demo está bloqueado en producción |
| Dominios personalizados de clientes | Falta automatizar verificación y operación de certificados por cliente |
| Herramientas de desarrollo | Uso exclusivo del propietario |

## No incluidos en esta versión

Recuperación pública por correo, marketplace, facturación, API pública, IA, reconocimiento facial, sitio conmemorativo, aplicaciones móviles, multiempresa avanzada, PostgreSQL y almacenamiento de objetos. Su ausencia no bloquea la boda; no se presentan como funciones terminadas.

## Estados disponibles

- `available`: visible si está activado y el plan lo permite.
- `experimental`: visible sólo para propietario/desarrollador.
- `hidden`: permanece en el código y no se ofrece al cliente.
- `disabled`: apagado comercialmente.
- `blocked_by_plan`: resultado calculado cuando el plan no da acceso.
- `disabled_for_event`: resultado calculado cuando el evento lo apagó.
