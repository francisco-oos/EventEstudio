# Validación de EventStudio 6.14.2 RC8

Este documento registra los controles exigidos antes de empaquetar la entrega.
Los resultados finales se completan sobre el ZIP exacto.

## Controles

- Sintaxis JavaScript y JSON.
- Integridad de referencias DOM y archivos públicos.
- 42 plantillas con identificadores únicos y metadatos estructurales.
- Ausencia de marcas y personajes protegidos en el catálogo.
- Plan Express sin RSVP y Esencial con RSVP.
- Catálogo, muestra pública, registro y permisos por plan.
- Administración, invitación, sincronización y vista móvil.
- Música cargada y enlace Spotify sin API de búsqueda.
- Seguridad, orígenes, sesiones y rutas administrativas.
- Respaldo, restauración y migración con copia previa.
- Auditoría de dependencias.
- Inspección de que el ZIP no incluya datos, secretos o dependencias.

## Resultado

- Sintaxis JavaScript y JSON: aprobada.
- Suite `npm test`: aprobada.
- Catálogo público: 4 planes, 12 celebraciones y 42 plantillas.
- Plan Express: música, galería y experiencia temática aprobadas; RSVP
  correctamente bloqueado.
- Contexto creativo: persistencia administrativa aprobada y exposición pública
  bloqueada.
- Rutas de catálogo y muestra: aprobadas.
- Referencias y funciones sin llamadas: ninguna encontrada.
- Restauración hostil y real: aprobada.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- Navegador físico: pendiente únicamente como comprobación manual de apariencia;
  este entorno no incluye el ejecutable de Chromium.
- Instalación limpia del ZIP con `npm ci`: 291 paquetes instalados.
- Suite completa y auditoría ejecutadas dentro de la extracción del ZIP:
  aprobadas.
- El paquete definitivo excluye `.env`, bases SQLite, fotografías, respaldos,
  secretos, `node_modules` e historial Git.
