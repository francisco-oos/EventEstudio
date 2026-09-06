# QA físico final — EventStudio 6.16.0-rc.39

Esta lista cierra lo que los harnesses aislados no pueden certificar antes de producción.

## Preparación

1. Extraer `EventStudio_6.16.0-rc.39_QA_CON_DATOS.zip` en carpeta nueva.
2. Verificar `SHA256_6.16.0-rc.39.txt`.
3. Respaldar `data/wedding.db`.
4. Ejecutar `npm ci`.
5. Ejecutar `npm run test:preproduction` y `npm audit --audit-level=moderate`.
6. No ejecutar `npm run seed` sobre la BD incluida.

## Catálogo

- Recorrer las 65 Recipes; tarjeta → modal → Editar/Aplicar/Abrir aparte/Cerrar.
- Comparar miniatura, modal, Design Lab y preview completo de una muestra clara, oscura, cinematográfica, botánica, editorial y minimalista.
- Confirmar que una Recipe recién seleccionada usa su apertura/Stationery previsto y no un sobre antiguo.
- Después personalizar el sobre y verificar que la invitación activa sólo cambia al pulsar `Aplicar cambios`.

## Datos reales

- Historia, ubicación, agenda/programa y vestimenta deben usar los datos capturados.
- Portada cargada desde panel debe reutilizarse en Recipes que permiten hero media.
- Fotos eliminadas no deben aparecer ni generar una cascada de `404`.
- Álbum/música deben conservar la media vigente tras reload.

## Inspector

En hero, countdown, historia, ubicación, programa, galería, vestimenta, RSVP y regalos probar:

- alineación;
- espaciado y ancho;
- tamaño/peso de título y texto;
- interlineado y tracking;
- mayúsculas;
- superficie;
- tono semántico;
- color directo de título/texto;
- visible/oculto;
- subir/bajar orden.

Cada modificación debe verse en el bloque correcto; el canvas debe acompañar la sección editada.

## Color Studio

Probar monocromática, análoga, complementaria, complementaria dividida, triádica, tetrádica, elegante, elegante oscura, pastel y alto contraste. Confirmar preview, Apply, QR e impresión con la misma paleta efectiva. Los presets oficiales no deben producir texto ilegible.

## Aperturas y Stationery

- Recorrer todas las aperturas visibles, incluida Sin apertura.
- Probar Sobre personalizable y geometrías/texturas/lacre/marcos/divisores.
- Cambiar color y pulsar directamente Apply sin Guardar borrador manual.
- Preview → Volver al Estudio debe regresar en un clic.
- Owner/developer debe poder validar Store; cliente sin derecho debe continuar bloqueado comercialmente.

## Servicios ocultos

Desactivar/no contratar uno a uno historia/ubicación/programa/galería/vestimenta/RSVP/regalos según corresponda. No debe quedar una tarjeta grande vacía ni un salto vertical artificial.

## Roles/perfiles

Probar propietario/desarrollador, diseñador autorizado, gestor y cliente/anfitrión con un evento con derechos y otro sin derechos. Confirmar visibilidad de editar/aplicar/publicar/catálogo y ausencia de escalación de privilegios.

## Multimedia

Subir JPG/PNG/WebP y audio permitido usando el servidor real. Verificar persistencia, reemplazo, eliminación, portada, galería/lightbox y música. Revisar Network: un asset no usado/oculto no debe descargarse innecesariamente.

## QR/PDF

Generar invitación física, QR de fotos y QR de mesa después de combinar color. Comparar paleta, tipografía, portada permitida y datos del evento. Abrir/ imprimir PDF y escanear al menos un QR con teléfono físico.

## Responsive y navegadores

Mínimo 320, 360, 390, 412, tablet y escritorio en Edge/Chrome; repetir flujo crítico en Firefox y Safari/WebKit cuando esté disponible. Revisar nombres largos, fecha, countdown, modal, menú, Stationery, touch y teclado.

## Gate

Un FAIL funcional, de permisos, datos, sincronización, contraste u overflow en un preset oficial bloquea producción. Personalizaciones deliberadas del usuario pueden mostrar advertencia de contraste sin ser corregidas automáticamente.
