# Cohesión UX — 6.16.0-rc.37

| Escenario | Resultado automatizado/estructural | Validación física pendiente |
|---|---|---|
| Cliente primer uso | PASS: Plantillas abre el Estudio, edita bloques/elementos/color/apertura, Preview DRAFT, Apply, vuelve a Plantillas | fluidez perceptual y touch |
| Cliente regresa | PASS: DRAFT se recupera y estado aplicado/pendiente es visible | comprensión sin asistencia |
| Usuario de plataforma | PASS: mismo shell; acciones Catálogo por capability | ergonomía del catálogo |
| Developer en vista cliente | PASS: permisos efectivos se proyectan como cliente | inspección visual completa |

## Métricas contractuales

- pestañas nuevas internas: 0;
- header duplicado visible al entrar a Stationery: 0 por estructura embebida;
- CTA ambiguo “Guardar diseño”: 0;
- Apply sin acción explícita: 0;
- pérdida programada de `eventId`/tab/panel: 0;
- endpoints de catálogo disponibles a cliente: 0;
- conflicto silencioso entre sesiones: 0.

El submodo Stationery conserva el topbar del Estudio y oculta su navegación propia. Back/Forward representa panel y submodo en URL; el retorno directo mantiene selección, dispositivo y scroll en sesión. La inspección visual física sigue `NOT_RUN` hasta disponer de navegador.
