# Auditoría integral — EventStudio 6.16.0-rc.41

## Hallazgos cerrados

1. **Preview de sobres parecía pegado al anterior**: iframe se reinicia y Stationery derivado de Recipe utiliza paleta + textura más distinguible.
2. **Color/textura del sobre podía no llegar a ACTIVE**: carrera entre iframe Stationery y Apply cerrada mediante flush explícito.
3. **Guardar ahora parecía requisito**: queda como botón de fuerza/manual; Apply espera autosave/flush por sí mismo.
4. **Constructor abría otro punto de partida**: entrada general prefiere ACTIVE sin DRAFT pendiente; Editar catálogo conserva DRAFT explícito.
5. **Portada del panel no aparecía**: reconciliación segura de upload restaurado y proyección a Settings/Public Config.
6. **Portada se perdía tras ocultar/mostrar**: la media pertenece al evento y `heroMedia.enabled` sólo controla presentación.
7. **Encuadre móvil/escritorio compartido**: ahora son independientes y con drag directo.
8. **Decorador visible en editor pero ausente en invitación**: máscaras colorizables públicas ahora reciben aspect ratio y altura calculable.
9. **Autosave ruidoso**: debounce mayor + PUT idempotente.
10. **Cache de superficies RC40**: actualizado a RC41.

## Seguridad

La recuperación de media no hace búsqueda global ni heurística ambigua: sólo mismo directorio + mismo nombre original + exactamente un candidato. No escribe la BD. Se mantienen controles de acceso, entitlements y override auditado de owner/developer. No se agregaron scripts remotos ni ejecución dinámica en Assets.

## Riesgos residuales

- E2E de servidor real pendiente por falta de instalación npm en este runtime.
- La reconciliación de media no intenta resolver dos candidatos ambiguos; en ese caso conserva el estado faltante y exige intervención humana.
- Antes de producción se exige recorrido físico Edge/Chrome + móvil real sobre Apply, Stationery, portada, Assets, QR/PDF, permisos y persistencia.
