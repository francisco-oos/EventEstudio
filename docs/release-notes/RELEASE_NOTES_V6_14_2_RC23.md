# EventStudio 6.14.2-rc.23

## Objetivo

RC23 convierte los criterios de aceptación de perfiles, módulos operativos, multi-tenancy, animaciones y distribución pública en puertas reproducibles de QA.

## Cambios

- Nueva prueba E2E concurrente para Owner, Developer y clientes de diferentes planes.
- Constructor de Perfiles y Mi Negocio quedan cubiertos por un flujo dedicado de autorización y actualización.
- Planos/Layouts se validan con cliente Premium, aislamiento entre eventos y bloqueo de planes sin derecho.
- La URL pública se valida antes de cualquier alta de invitados y después de publicación sin token `?i=`.
- Nueva batería visual con Chromium para 64 plantillas y 21 aperturas, midiendo overflow, overlap, CLS, FPS y errores.
- Corrección móvil de `cinematic-fold` para nombres largos; se conserva la rotación visual y se elimina la colisión de geometría.
- ADR y validación RC23 documentan alternativas, riesgos y requisitos de promoción.

## Compatibilidad

No se modifica el esquema de datos ni se cambian las fronteras de autorización. Owner/Developer siguen siendo roles de plataforma; Client permanece aislado a sus eventos y derechos comerciales.

## Estado

Candidata de QA. No promover mientras `npm test`, `test:rc23`, `test:visual`, auditoría de proyecto y `npm audit` no estén ejecutados en verde en un runner con dependencias reales.
