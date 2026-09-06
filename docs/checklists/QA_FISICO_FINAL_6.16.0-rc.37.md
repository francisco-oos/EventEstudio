# QA físico final — EventStudio 6.16.0-rc.37

Objetivo: cerrar las pruebas visuales y físicas que este entorno no pudo ejecutar. Registrar cada caso como `PASS`, `FAIL`, `BLOCKED` o `NOT_RUN`; adjuntar captura/video y Recipe usada cuando falle.

## 1. Preparación segura

1. Extraer `EventStudio_6.16.0-rc.37_QA_CON_DATOS.zip` en una carpeta nueva; no sobrescribir otra instalación.
2. Confirmar el SHA-256 con `SHA256_6.16.0-rc.37.txt`.
3. Conservar una copia de `data/wedding.db` antes del primer arranque.
4. Instalar Node.js 20 o superior y ejecutar `npm ci`.
5. Ejecutar `npm run audit` con `EVENTSTUDIO_PACKAGE_PROFILE=qa` y después `npm run test:v5`.
6. Iniciar con `npm run local`; no ejecutar `npm run seed` sobre la BD QA.

## 2. Recorrido obligatorio

Usar un evento QA y grabar la sesión completa:

1. Panel → Plantillas.
2. Abrir Estudio de diseño; confirmar `eventId` y nombre de evento.
3. Elegir otro diseño y esperar `Borrador guardado`.
4. Modificar color de fondo, título, cuerpo y CTA; provocar una advertencia de contraste y verificar que nada cambia hasta pulsar `Ajustar colores automáticamente`.
5. En Bloques: reordenar dos bloques, ocultar/mostrar uno y ajustar tamaño, peso, alineación, ancho y espaciado.
6. En Elementos: añadir uno, arrastrarlo, moverlo con flechas y Shift+flecha, duplicarlo, rotarlo y eliminar la copia.
7. Deshacer/Rehacer los cambios anteriores.
8. Apertura → seleccionar sobre → `Editar sobre y lacre`; confirmar que no aparece una pestaña ni un segundo header.
9. Cambiar sobre/lacre, volver al constructor y comprobar que conserva panel, selección, dispositivo y borrador.
10. Previsualizar borrador; cerrar y volver exactamente al Estudio.
11. Abrir invitación pública en otra sesión: antes de Apply debe conservar ACTIVE anterior.
12. Pulsar `Aplicar cambios a mi invitación` dos veces rápidamente; debe haber una sola promoción y feedback inequívoco.
13. Recargar público: debe mostrar el nuevo ACTIVE.
14. Volver al panel: debe regresar a Plantillas, no a Resumen.
15. Repetir Back/Forward, refresh con DRAFT pendiente, error de red/retry y conflicto desde dos sesiones.

## 3. Matriz visual mínima

Repetir el recorrido esencial en Chromium, Firefox y WebKit/Safari cuando estén disponibles:

| Viewport | Orientación/entrada | Resultado |
|---|---|---|
| 320×568 | touch/portrait | ☐ |
| 360×800 | touch/portrait | ☐ |
| 390×844 | touch/portrait | ☐ |
| 430×932 | touch/portrait | ☐ |
| 768×1024 | touch/teclado | ☐ |
| 1024×768 | landscape | ☐ |
| 1366×768 | mouse/teclado | ☐ |
| 1920×1080 | mouse/teclado | ☐ |
| 2560×1440 | mouse | ☐ |
| 3840×2160 | mouse | ☐ |

En cada tamaño verificar: cero overflow horizontal, nombres sin corte dentro de palabra, CTA visible, controles touch utilizables, foco visible, sin bloques superpuestos y sin flashes al cambiar de modo. Activar también `prefers-reduced-motion`.

## 4. Paridad multicanal

Con la misma DRAFT, guardar captura de Editor y Preview; después de Apply guardar captura de Público. Comparar:

- fondo/papel, títulos, cuerpo, CTA, links, bordes y acentos;
- fuentes, pesos, tamaños, wrapping, ancho, interlineado y tracking;
- orden/visibilidad/spacing de bloques;
- assets, color, posición, escala, rotación, opacidad y movimiento;
- apertura, sobre y lacre;
- miniatura, álbum, QR, QR de mesa, tarjeta y PDF/print.

No aprobar por igualdad de JSON: inspeccionar el render.

## 5. Recipes, contenido y perfiles

- Recorrer las 65 Recipes al menos en móvil y escritorio: selección, edición, preview, Apply, público y miniatura.
- Probar fixtures ficticios de boda, cumpleaños infantil, quinceañera, bautizo, baby shower, graduación, corporativo, aniversario, fiesta temática y familiar.
- Incluir nombres/direcciones/historias largas y combinaciones sin foto, sin música y sin algunos servicios.
- Verificar Owner, Developer, diseñador autorizado, Cortesía, Gratis/restringido, Básico, Intermedio, Completo, Planner/Agency, Company, Couple DIY y Family Simple según la matriz de permisos.
- Confirmar que cliente no ve/publica catálogo y que un servicio premium en DRAFT no se habilita públicamente sin entitlement.

## 6. Hardware y accesibilidad

- Teclado: orden lógico, foco visible, Esc/cierre y flechas sobre elementos.
- Lector de pantalla: nombres de controles, estados de guardado y diálogos.
- Touch real: drag sin scroll accidental, controles sin doble activación.
- QR: imprimir invitación y tarjetas; probar quiet zone/contraste y escaneo con al menos dos teléfonos.
- PDF/print: tipografía, márgenes, assets y colores coherentes; ningún dato cortado.
- Música: play/pause, con/sin pista y políticas de autoplay en móvil.

## 7. Registro de incidencias

Por cada FAIL registrar: ID, usuario/rol, evento QA, Recipe, navegador/dispositivo, viewport, pasos, resultado esperado, resultado observado, captura/video y si ACTIVE cambió. No probar envíos reales de WhatsApp ni cobros reales.

La candidata sólo puede promoverse después de resolver los FAIL y actualizar `VALIDACION_6.16.0-rc.37.md` con evidencia de esta ejecución.
