# QA físico final — EventStudio 6.16.0-rc.38

Esta lista cierra lo que no puede certificar un harness Chromium aislado.

## Preparación

1. Extraer `EventStudio_6.16.0-rc.38_QA_CON_DATOS.zip` en carpeta nueva.
2. Verificar `SHA256_6.16.0-rc.38.txt`.
3. Respaldar `data/wedding.db`.
4. Ejecutar `npm ci`.
5. Ejecutar `npm run test:preproduction` y `npm audit --audit-level=moderate`.
6. No ejecutar `npm run seed` sobre la BD incluida.

## Roles/perfiles

Probar propietario/desarrollador, diseñador/gestor permitido y cliente/anfitrión. Confirmar que cada uno ve únicamente sus acciones de catálogo, Apply, edición y administración autorizadas. Probar al menos un evento con derechos Store y otro sin ellos.

## Catálogo y Design Lab

- Abrir varias Recipes desde cualquier parte de la tarjeta.
- Confirmar que el modal muestra realmente la Recipe seleccionada con datos del evento.
- Probar `Editar`, `Aplicar`, `Abrir aparte`, `Cerrar`.
- Escribir fragmentos con y sin acentos en ambos buscadores; usar flechas/Enter/Escape.
- Deshacer/Rehacer, Apply, menú Más, guardar plantilla y publicar con roles autorizados.
- Simular dos pestañas editando el mismo evento y confirmar recuperación del 409.

## Aperturas

Recorrer todas las aperturas visibles, incluida Sin apertura. Probar CTA, Omitir animación, movimiento reducido y colores configurables. Verificar específicamente Rosa, Margarita/Manzanilla, Jardín luminoso, Flor nocturna, Corazón de partículas y Sobre personalizable.

Si una Store no está adquirida, preview debe funcionar y Apply debe explicar que queda pendiente de derecho; no debe aparentar éxito público silencioso.

## Sobre/lacre

Probar cada geometría, textura, ajustes, lacre, marcos y divisores. Guardar borrador, volver al Estudio y Apply. Abrir la invitación pública y confirmar que usa el sobre seleccionado, sin duplicar lacre.

## Personalización

En cada tipo de bloque: alineación, spacing, ancho, tamaño/peso título/texto, interlineado, tracking, casing, superficie, tono semántico y color directo. Probar HEX válidos/no válidos y contraste bajo. Verificar scroll automático al bloque activo.

## Multimedia

Subir archivos reales: JPG/PNG/WebP, varias fotos y MP3 permitido. Comprobar progreso/reintento, persistencia tras reload, portada, galería, lightbox y música. Ocultar hero/gallery/music mediante Recipe y confirmar que no se descargan/renderizan innecesariamente en Network/DOM.

## Impresión y QR

Generar invitación física, set QR/foto y QR por mesa. Confirmar que usan la Recipe activa, no una imagen histórica. Imprimir/abrir PDF y escanear al menos un QR con teléfono físico.

## Responsive

Mínimo: 320, 360, 390, 412, tablet y escritorio; Chrome/Edge, Firefox y Safari/WebKit si está disponible. Revisar nombres largos, `UNA INVITACIÓN PARA TI`, fecha, countdown, modales, topbar, Stationery y teclado/touch.

## Gate

Un FAIL funcional, de datos, permisos, sincronización, overflow o contraste en un preset oficial bloquea promoción. Una personalización deliberada del usuario puede mostrar advertencia de contraste sin alterar su selección.
