# Arquitectura comercial y Product Studio · RC13

## Principio de autoridad

El rol de seguridad y el perfil comercial son conceptos diferentes.

- `owner`: control total de plataforma.
- `developer`: autoridad técnica autorizada.
- `client`: acceso limitado a sus eventos y derechos.

Un perfil `planner`, `company`, `couple-diy` o futuro sólo modifica recomendaciones/UX. Nunca convierte a un cliente en desarrollador.

Las recomendaciones tampoco quedan codificadas en la interfaz: `customer_profiles.recommendations_json` conserva las categorías prioritarias de cada perfil y el propietario puede modificarlas desde Product Studio. La Store usa esa configuración para ordenar «Sugerido para ti» sin cambiar permisos ni ocultar productos compatibles que el usuario pueda comprar.

## Catálogo gobernado

RC13 agrega o consolida:

- `store_categories`
- `product_category_links`
- `customer_profiles`
- `account_commercial_controls`
- metadatos `readiness_status`, `presentation_slot`, `preview_strategy`, `release_version` en producto.

El estado técnico y el comercial son independientes:

`draft -> lab -> qa -> approved -> retired`

versus

`available / experimental / hidden / disabled` + `public`.

Un producto no puede quedar público si no está técnicamente aprobado.

## Alta y edición desde el panel

El propietario/desarrollador puede:

- crear un producto en borrador;
- asignarle precio, categoría, compatibilidad y capacidades autorizadas;
- editar categorías de Store;
- crear/editar perfiles comerciales;
- incluir productos en planes;
- decidir disponibilidad/visibilidad;
- asignar perfiles y límites por usuario.

### Frontera de seguridad

El panel **no acepta JavaScript arbitrario**. Un producto nuevo sólo puede referenciar capacidades que EventStudio ya reconoce. Si se desarrolla un renderer nuevo, debe pasar por código, pruebas y promoción técnica; una vez autorizado, sus variantes comerciales sí pueden administrarse desde el Product Studio.

Esto evita que la flexibilidad comercial se convierta en ejecución remota de código.

## Mercado dual

RC13 conserva las dos rutas comerciales:

1. plan completo/Premium;
2. productos o complementos à-la-carte.

Un cliente con menor presupuesto puede comprar sólo determinadas capacidades; un planner puede usar planes/límites diferentes. La autoridad final de precio e inclusión sigue siendo del propietario.
