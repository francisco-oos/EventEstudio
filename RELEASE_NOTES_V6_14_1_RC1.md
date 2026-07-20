# EventStudio 6.14.1 RC1

## Privacidad comercial de módulos

- Un cliente sólo ve módulos que estén activos, disponibles y permitidos por su plan.
- Los estados internos `experimental`, `hidden` y `disabled` ya no se entregan en la configuración de la cuenta cliente.
- El catálogo comercial del desarrollador se reduce a decisiones técnicas sin nombres, grupos, estado ni motivo para cuentas cliente.
- WhatsApp Business desaparece por completo del panel cliente cuando no está disponible; tampoco se consulta su estado.
- Tipografías desaparece junto con el módulo Plantillas cuando éste está oculto o deshabilitado.

## Plano y mesas

- El salón dejó de imponer una proporción que desbordaba su columna.
- El inspector permanece en una columna lateral real y ya no cubre mesas, pistas ni pasillos.
- En pantallas medianas y móviles, el inspector se coloca antes del salón para editar cómodamente sin superposición.

## Despliegue

- Se conserva el flujo Railway del paquete 6.14.0.
- El plan Free puede usarse para la primera prueba; el salto a Hobby sólo es necesario si el crédito o los límites de volumen no alcanzan.
- La imagen Docker usa dos etapas y excluye compiladores del contenedor final para reducir disco y superficie de producción.
