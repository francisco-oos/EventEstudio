# Checklist físico final — EventStudio 6.16.0-rc.41

No marcar producción hasta completar en un entorno con dependencias.

- [ ] `npm ci`
- [ ] `npm run test:preproduction`
- [ ] `npm audit --audit-level=moderate`
- [ ] Propietario: abrir 5+ Recipes con Sobre personalizable y confirmar paleta/textura distinta en preview y ACTIVE.
- [ ] Cambiar color/material/lacre y pulsar Aplicar inmediatamente sin Guardar ahora; confirmar persistencia.
- [ ] Reabrir Design Studio y confirmar que parte de la Recipe ACTIVE.
- [ ] Confirmar portada ya cargada sin volver a subir archivo.
- [ ] Desactivar/reactivar portada; probar fondo, izquierda y derecha.
- [ ] Ajustar portada por separado en Móvil/Escritorio y arrastrarla con mouse/touch.
- [ ] Agregar Asset a hero/countdown/story; mover/escalar; Aplicar; confirmar en invitación pública.
- [ ] Probar Undo/Redo, Preview, Apply, descartar, guardar plantilla y publicar catálogo según rol.
- [ ] Probar owner, developer y cada client asignado; validar que no aparezcan permisos superiores.
- [ ] Probar fotos, música, galería, RSVP, ubicación, programa, vestimenta y regalos según entitlement.
- [ ] Generar QR/set de mesa/invitación física/PDF y comprobar paleta/Recipe.
- [ ] Edge/Chrome escritorio 1366+; móvil real 360–430 px; tablet.
- [ ] Consola sin 401/409/404 funcionales inesperados.
- [ ] Revisar rendimiento de entrada, apertura, scroll, galería y audio.
- [ ] Backup y restauración de BD antes de despliegue.
