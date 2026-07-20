# Event Studio V6.10.0

## Cambios entregados

- Vistas previas vinculadas al evento activo: nombre, mensaje, fecha, tipografía, plantilla, QR e impresión física.
- Fuentes locales Great Vibes, Cormorant Garamond, Playfair Display, Cinzel, Lora y Montserrat, con licencias OFL incluidas.
- Plano operativo con mesas redondas/rectangulares, pista y áreas, arrastre, orden, capacidad y detección de cruces.
- Simulación de lugares planeados y vista de asistentes confirmados.
- Asignación individual a asiento libre, bloqueo de sobrecupo y conservación de datos por evento.
- Migración de los nombres de mesa que ya existían en los invitados.
- Nueva plantilla original Arco editorial, basada en aprendizajes visuales del video de referencia.
- PDF 5 × 7 personalizado por invitado con cupo y QR de confirmación.
- Rutas persistentes configurables para SQLite y archivos.
- Dockerfile, Railway y guía comparativa de hospedaje económico.
- Suite funcional ampliada a mesas, impresión física, QR, confirmaciones y música.

## Verificación

- `node --check` para servidor y scripts de navegador.
- `npm test`: pruebas funcionales V6.10.0 completadas.
- PDF físico renderizado a PNG a 150 dpi y revisado visualmente.
- Todos los formatos QR continúan generando sus dimensiones de impresión esperadas.

El entorno de validación no tenía Docker instalado; el `Dockerfile` y `railway.json` fueron validados en estructura, pero la imagen debe construirse como parte del primer despliegue en Railway.
