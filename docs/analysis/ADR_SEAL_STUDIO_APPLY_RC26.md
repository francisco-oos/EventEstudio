# ADR — Seal Studio vinculado al evento (RC26)

## Estado
Aceptado para QA en `6.14.2-rc.26`.

## Problema
RC25 separó el renderer SVG y el Studio avanzado, pero el Studio sólo permitía diseñar/exportar. El objetivo funcional es que el sello diseñado se convierta en el sello oficial del evento y sea consumido por la invitación.

## Decisión
El Studio se abre con `eventId`, carga `GET /api/admin/settings` y el catálogo público, usa la paleta y nombre reales del evento y persiste el diseño completo mediante el endpoint existente `PUT /api/admin/settings`. No se crea una segunda API de escritura. La autorización y normalización permanecen centralizadas en el servidor.

El payload conserva todas las propiedades avanzadas: monograma automático/manual, conector, textos de arco, fuente, tamaño, kerning, desplazamiento, borde, ornamento, material/color, relieve, brillo y calidad. Al aplicar se establece `enabled=true` y `customized=true`.

## Fidelidad del diseño
`customized=true` indica que el usuario tomó una decisión explícita. Las recomendaciones temáticas de las aperturas sólo se aplican a sellos nunca personalizados. Esto evita que una apertura sustituya silenciosamente el ornamento o material elegido en el Studio. El material `theme` sigue siendo una elección explícita válida y se resuelve con la paleta del evento.

## Alternativas descartadas
- Guardar únicamente un SVG estático: descartado porque rompe editabilidad, tematización y reutilización.
- Crear un endpoint exclusivo del Studio: descartado porque duplicaría reglas de autorización y normalización existentes.
- Guardar el diseño sólo en `localStorage`: descartado porque no sería multiusuario ni llegaría a la invitación pública.

## Sincronización
Tras guardar, el Studio escribe una señal mínima en `localStorage`. El panel administrativo escucha el cambio y recarga el workspace del mismo evento. El dato persistente continúa siendo la configuración del servidor; `localStorage` no es fuente de verdad.

## Riesgos y mitigaciones
- Acceso directo sin sesión: el Studio conserva exportación local, pero deshabilita Aplicar.
- Evento incorrecto: todas las llamadas llevan `x-event-id` y pasan por `eventAllowed`.
- Campos fuera de rango o catálogo: `normalizeSeal()` continúa validando en servidor.
- Regresión visual por presets de apertura: `customized=true` evita overrides posteriores.
