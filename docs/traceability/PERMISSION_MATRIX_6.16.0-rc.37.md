# Matriz de permisos — 6.16.0-rc.37

La seguridad real se valida en backend. Ocultar controles sólo es presentación. El schema actual tiene roles `owner`, `developer`, `client`; perfil comercial y plan no son roles.

| Acción | Owner | Developer | Cliente con `templates` | Cliente sin `templates` | Público |
|---|---:|---:|---:|---:|---:|
| ver catálogo/preview autorizado | sí | sí | sí | sólo catálogo permitido por rutas autenticadas | no admin |
| editar DRAFT | sí | sí | sí | no | no |
| editar Stationery DRAFT | sí | sí | sí | no | no |
| previsualizar DRAFT | sí | sí | sí | no | no |
| aplicar DRAFT al evento | sí | sí | sí | no | no |
| descartar DRAFT | sí | sí | sí | no | no |
| guardar plantilla CATALOG | sí | sí | no | no | no |
| publicar CATALOG | sí | sí | no | no | no |
| administrar catálogo/comercio | sí | sí | no | no | no |
| ver ACTIVE publicado | sí | sí | sí | sí | sí, si publicado/token válido |

## Entitlements

El cliente puede conservar en DRAFT bloques/experiencias premium. Aplicar no crea grants: apertura y galería sin derecho quedan pendientes y ACTIVE conserva la alternativa permitida. Compra confirmada, cortesía, promoción o legacy válido son las únicas fuentes de derecho.

## Perfiles comerciales

Planner/Agency, Company, Couple DIY y Family Simple son perfiles comerciales/curación. No elevan permisos. Las matrices RC34 prueban 1,300 proyecciones rol/perfil; RC33 prueba 256 combinaciones de entitlement.

## Límite explícito

No existe aún un rol persistente `designer` separado ni un modelo Agency multiusuario. No se inventó una migración insegura dentro de Fase A; queda como Fase B y se marca NOT_RUN. Hoy un diseñador interno autorizado se representa por `developer`, con las mismas rutas auditadas que plataforma.
