# Índice documental — EventStudio 6.14.2-rc.21

## Fuente de verdad

1. `../../README.md`
2. `../release-notes/RELEASE_NOTES_V6_14_2_RC21.md`
3. `../validation/VALIDACION_RC21.md`
4. `../audits/AUDITORIA_RC21.md`
5. `../analysis/DECISIONES_TECNICAS_RC21.md`
6. `../security/SEGURIDAD_RC21.md`
7. `../traceability/MATRIZ_TRAZABILIDAD_RC21.md`

## Precedencia

RC21 prevalece sobre RC20 y anteriores únicamente en preview autorizado, geometría del corazón, limpieza de estado entre eventos y Flor nocturna original. Las decisiones históricas continúan vigentes para los demás módulos.

## Estado resumido

- 59 plantillas, 16 aperturas, perfiles, invitación/RSVP y base compartida: PASS automatizado en el paquete suplementado.
- 1,200 usuarios/eventos, QR/fotos, pago, traducción, WhatsApp y seguridad histórica: PASS.
- QA ocular en navegadores/hardware y proveedores reales: pendiente antes de estable.

## Suplemento de plantillas — 25/08/2026

Sobre la base RC21 funcional se añadió una colección visual aislada. Documentos de referencia:

- `../analysis/ANALISIS_PLANTILLAS_PAPEL_LINVIA_RC21_ADDON.md`
- `../validation/VALIDACION_PLANTILLAS_PAPEL_LINVIA_RC21_ADDON.md`
- `../traceability/MATRIZ_TRAZABILIDAD_PLANTILLAS_RC21_ADDON.md`

Inventario efectivo del paquete suplementado: **59 plantillas y 16 aperturas activas** (52/10 originales + 7/6 nuevas). La precedencia funcional del RC21 original no cambia fuera del catálogo visual y del mapa de tiempos de esas seis aperturas.

## Hardening y regresión funcional preproducción — 27/08/2026

- `../security/SEGURIDAD_RC21_PREPRODUCCION_HARDENING.md`
- `../validation/VALIDACION_SEGURIDAD_RC21_PREPRODUCCION.md`
- `../audits/AUDITORIA_COMPARATIVA_FUNCIONAL_RC21_SECURITY_R2.md`
- `../validation/VALIDACION_COMPARATIVA_FUNCIONAL_RC21_SECURITY_R2.md`

La regresión comparativa mantiene 59/16, añade `test:security` y `test:functional-parity`, y corrige la exportación ZIP de fotografías para la API de Archiver 8 sin modificar el frontend ni el catálogo visual.
