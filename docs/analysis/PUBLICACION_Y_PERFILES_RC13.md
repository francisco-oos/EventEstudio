# Publicación, perfiles y límites · RC13

## Estado actual

La configuración global inicia en:

`manual_owner`

Por tanto, aunque Premium/Studio tengan una política preparada para autopublicación, **ningún cliente se autopublica hasta que el propietario cambie el modo global**.

## Políticas disponibles

Por plan/cuenta:

- `manual_owner`
- `auto_after_entitlement`
- `disabled`

Globalmente:

- `manual_owner`
- `plan_policy`

La autopublicación sólo ocurre si concurren todos los requisitos:

- modo global `plan_policy`;
- política efectiva `auto_after_entitlement`;
- suscripción/vigencia utilizable;
- capacidad `invitation` activa;
- evento no archivado;
- cupo de sitios publicados disponible.

## Límites configurables

Cada plan posee:

- `max_events`
- `max_published_events`
- vigencia;
- invitados;
- almacenamiento;
- política de publicación.

Cada cuenta puede recibir sobrescrituras del propietario:

- `max_events_override`
- `max_published_events_override`
- `publication_policy_override`
- perfil comercial y nota interna.

## Control del propietario/desarrollador

La vista de propietario muestra usuarios/clientes, cantidad de eventos, cantidad publicada, plan, estado y accesos a perfil comercial. También conserva publicación/despublicación directa de eventos y atención manual de solicitudes.

## Publicación futura automática

La arquitectura ya permite pasar a automatización sin reescribir los clientes. El cambio consiste en activar `plan_policy` cuando la operación y los pagos estén suficientemente validados. La decisión permanece reversible.
