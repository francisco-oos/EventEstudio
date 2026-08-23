# Validación de EventStudio RC11

## Automatizada

Ejecutar:

```bash
npm test
```

La suite valida sintaxis, referencias DOM, interfaz móvil, migración con copia
previa, políticas de origen, encabezados, catálogo, registro, permisos,
mensajería, respaldos y restauración.

`tests/commerce-journeys.js` añade tres recorridos:

1. Cliente nuevo: recibe prueba completa de siete días y 100 MB.
2. Cliente comprador: activa un plan, compra dos bloques de almacenamiento y una
   plantilla individual, recibe notificaciones, renueva y no puede bajar de
   paquete.
3. Propietario: clasifica una plantilla, verifica su miniatura, consulta compras
   y comprueba el total acumulado de almacenamiento.

## Revisión manual recomendada

- En 390 px, confirmar que **Agregar** conserva tamaño compacto y que las
  categorías se desplazan horizontalmente.
- Abrir un perfil comercial y comprobar que el contenido del fondo no se mueve.
- Probar Spotify con una canción: mover el punto y pulsar una sola vez
  **Escuchar desde aquí**.
- Abrir cada paquete y confirmar que la búsqueda no pierde selecciones.
- Cambiar el idioma del panel y revisar Plan y mejoras.
- Activar inglés o portugués, editar textos traducidos y abrir la invitación con
  `?lang=en` o `?lang=pt`.
- Revisar los cinco estilos de álbum con 3, 8 y 20 fotografías.

## Límites explícitos

- Un proveedor de pago real sigue pendiente.
- La traducción automática requiere `TRANSLATION_ENDPOINT`; sin él se conservan
  y publican traducciones editadas manualmente.
- La reproducción de Spotify continúa sujeta a las políticas del navegador y a
  la disponibilidad del reproductor oficial.
