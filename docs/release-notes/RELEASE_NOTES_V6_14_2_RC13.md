# EventStudio 6.14.2 RC13

Fecha: 9 de agosto de 2026

RC13 convierte varias ideas comerciales y visuales de RC12 en infraestructura gobernada. El objetivo no es sumar controles aislados, sino permitir que el propietario/desarrollador decida qué producto existe, a quién se ofrece, cuánto cuesta, qué plan lo incluye, cuándo puede publicarse y cómo se presenta, sin conceder autoridad de plataforma a los clientes.

## Cambios principales

- **Daisy Atelier**: cuatro plantillas originales inspiradas en las cinco referencias florales aportadas. Ninguna fotografía del usuario se redistribuye ni se usa como activo de producción.
- **Kit de diseño global**: una paleta opcional por evento puede coordinar invitación web, QR e impresos; la tipografía común ya existente se conserva.
- **Store 2.0**: búsqueda contextual, categorías en base de datos, vista previa flotante, emulador de teléfono y simulación del carrito sin conceder derechos.
- **Product Studio gobernado**: estados técnico/comercial separados, categorías y perfiles comerciales editables y alta de productos desde el panel sólo sobre capacidades ya autorizadas. Un renderer ejecutable nuevo sigue requiriendo código, QA y promoción técnica.
- **Publicación**: modo global manual por propietario de forma predeterminada. Premium/Studio quedan preparados para publicación automática por derecho vigente cuando el propietario cambie el modo global a política de plan.
- **Límites configurables**: eventos y sitios publicados pueden limitarse por plan y sobrescribirse por cuenta desde propietario/desarrollador.
- **Analytics de conversión first-party**: eventos de embudo almacenados en SQLite sin depender de un servicio de pago.
- **Showcase Gallery**: demos editoriales públicas, identificadas como demos, con control de publicación del propietario.
- **Sandbox**: el visitante puede empezar a diseñar sin cuenta y conservar nombre, fecha, tipo de evento y plantilla al registrarse.
- **Preview multidispositivo**: enlaces temporales con token para probar una invitación desde teléfono/tablet sin publicar el evento.
- **RSVP + seating**: fecha de tolerancia para marcar lugares candidatos a liberación. EventStudio no sustituye ni mueve invitados automáticamente.
- **Atribución discreta**: referencia configurable a EventStudio en web, QR e impresos. No se introduce una marca invasiva en productos pagados.
- **PublicEndpointManager base**: invitación, álbum y QR resuelven primero el hostname verificado del evento y sólo usan `SITE_URL` como fallback.
- **ParticleTraceScene**: renderer Canvas propio para `Corazón de partículas`, con reducción de movimiento y degradación segura.

## Compatibilidad y seguridad

- La autoridad de seguridad `owner/developer/client` permanece separada del **perfil comercial** del cliente.
- Un perfil comercial nunca eleva privilegios.
- Un producto no puede hacerse público si su estado técnico no es `approved`.
- La interfaz sólo permite crear productos sobre capacidades ya conocidas/autorizadas; no admite JavaScript arbitrario desde SQLite.
- Las vistas previas no otorgan compras, cortesías ni derechos permanentes.
- La publicación automática requiere simultáneamente: modo global autorizado, política compatible, vigencia válida, capacidad de invitación y cupo de sitios publicados.

## Migración

La versión de esquema pasa a `614207`. La apertura de una base anterior conserva el flujo de respaldo previo a migración ya existente.

## Validación

Consultar `VALIDACION_RC13.md` y `docs/MATRIZ_TRAZABILIDAD_RC13.md` para el estado exacto de las pruebas. En este entorno la instalación completa de dependencias quedó bloqueada por el mirror npm interno al no disponer de `zip-stream@7.0.5`; las pruebas estáticas ejecutables sin dependencias sí fueron realizadas.
