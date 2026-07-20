# Checklist de publicación de la boda

## Infraestructura

- [ ] Dominio HTTPS definitivo y `SITE_URL` correcto.
- [ ] Volumen persistente montado en `STORAGE_ROOT`.
- [ ] Una sola réplica mientras se use SQLite.
- [ ] `SESSION_SECRET` aleatorio de 32 bytes o más.
- [ ] Registro público, pago demo y purga automática desactivados.
- [ ] Propietario real creado; contraseña temporal cambiada.
- [ ] Respaldo descargado, SHA-256 comparado y restauración ensayada.

## Evento

- [ ] Nombres, fecha, zona horaria, lugares, Maps y teléfonos reales.
- [ ] Evento correcto seleccionado antes de cada modificación.
- [ ] Invitados importados con conteos insertados/actualizados/errores revisados.
- [ ] Cupos, niños, restricciones, accesibilidad y política de cambios RSVP probados.
- [ ] Menú adulto predeterminado sin selector; menú infantil según lo contratado.
- [ ] Mesas sin sobreposición, pista y pasillos validados con el recinto.
- [ ] Spotify probado y alternativa visible si la red falla.
- [ ] Fotos pendientes no visibles públicamente; aprobar/ocultar funciona.

## Publicación

- [ ] `npm test` aprobado en la imagen exacta a desplegar.
- [ ] QR de imprenta aprobado con el checklist específico.
- [ ] Reporte Excel abierto sin tokens, notas privadas ni datos demo.
- [ ] Cinco familias piloto completaron invitación, RSVP y fotos.
- [ ] Respaldo “pre-publicación” creado.
- [ ] Sólo entonces cambiar el evento a publicado.
