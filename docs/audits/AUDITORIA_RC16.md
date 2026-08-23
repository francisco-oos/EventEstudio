# AUDITORÍA RC16 — limpieza estructural y rendimiento

## Objetivo
Entregar una base más limpia y fluida sin perder funciones aprobadas.

## Cambios principales
1. **Carga inicial menos bloqueante**
   - Se retiró de la ruta crítica del workspace la carga de QR, notificaciones, contexto de cuenta, estado de WhatsApp y paneles de propietario.
   - Estos módulos ahora se cargan en diferido una vez que la pantalla principal ya es utilizable.

2. **Menos duplicación de llamadas al cambiar de vista**
   - Se consolidó el manejo de pestañas en un único despachador.
   - Antes coexistían varios wrappers de `tab(...)`, lo que generaba cargas repetidas y daba sensación de lentitud.

3. **Animación floral más robusta**
   - La apertura `rose-bloom` ahora limpia su estado previo antes de reiniciarse.
   - En modo de simulación/replay se dispara con arranque directo y fallback para evitar el fallo intermitente observado en escritorio.

4. **Orden documental**
   - Se movieron auditorías, validaciones, guías y release notes a `docs/`.
   - Se reforzó `.gitignore` para no contaminar el repositorio con datos persistentes ni artefactos locales.

## Resultado esperado
- Menor tiempo percibido en “Actualizando evento…”.
- Menos esperas al abrir vistas de administración y negocio.
- Mayor confiabilidad al reproducir la apertura floral en escritorio y móvil.
