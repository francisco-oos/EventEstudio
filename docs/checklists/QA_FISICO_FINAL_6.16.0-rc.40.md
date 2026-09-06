# Checklist físico final — EventStudio 6.16.0-rc.40

No marcar producción hasta completar en entorno con dependencias.

- [ ] `npm ci`
- [ ] `npm run test:preproduction`
- [ ] `npm audit --audit-level=moderate`
- [ ] Login owner/developer/client y permisos esperados.
- [ ] En Plantillas seleccionar Sobre: probar al menos 10 Recipes y confirmar que todas usan sobre con paleta propia.
- [ ] Repetir con al menos 3 aperturas no-sobre.
- [ ] Aplicar Recipe y recargar invitación pública; comprobar ACTIVE.
- [ ] Cargar una portada real; probar Fondo, Izquierda, Derecha, Cover/Contain y X/Y.
- [ ] Confirmar que volver de Vista previa funciona al primer clic.
- [ ] Editar bloque bajo/alto y comprobar que sólo se mueve el lienzo.
- [ ] Probar Color Studio, color por bloque y contraste.
- [ ] Probar álbum con fotos reales, música, vestimenta, programa, ubicación y RSVP.
- [ ] Generar QR, QR de mesa e invitación física con “usar colores de invitación”.
- [ ] Verificar PDFs físicamente y escanear QR impreso.
- [ ] Edge/Chrome escritorio; 320/390/412 px; un Android/iOS real.
- [ ] Consola sin 401/409/404 de recursos que deban existir.
- [ ] Subir de nuevo la portada del evento 2 si se desea conservar la foto que falta en este ZIP.
