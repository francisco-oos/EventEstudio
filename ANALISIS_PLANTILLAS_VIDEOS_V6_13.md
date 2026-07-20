# Análisis de videos y decisiones de plantilla - V6.13

Se revisaron los cinco videos completos mediante doce cuadros representativos de cada uno. El objetivo fue identificar patrones de composición, movimiento y experiencia, sin copiar personajes, marcas, fotografías ni piezas gráficas de terceros.

## Video 1 - Invitaciones temáticas de recorrido vertical

### Aprendizajes

- La lectura en teléfono funciona mejor como una secuencia vertical de escenas cortas.
- Las ilustraciones en esquinas ayudan a separar fecha, ubicación, confirmación y cierre.
- Una invitación puede sentirse temática sin cambiar el flujo funcional.

### Aplicación

Se creó `Recorrido botánico`: presentación estrecha, detalles vegetales, tarjetas ligeras y galería con remates orgánicos. Todo usa fotografías y textos del evento activo.

## Video 2 - Presentación lavanda con retrato

### Aprendizajes

- El retrato principal, la cuenta regresiva y el botón flotante de música forman una entrada clara.
- Las transparencias y el color secundario pueden dar profundidad sin dificultar la lectura.
- Conviene mantener ubicación y confirmación como bloques independientes.

### Aplicación

Se creó `Lavanda couture`: panel translúcido, entrada suave, cuenta regresiva diferenciada y tarjetas lilas asimétricas.

## Video 3 - Sobre animado y narrativa de cuento

### Aprendizajes

- El sobre inicial crea una pausa ceremonial antes de mostrar el contenido.
- El sello funciona como llamada visual para abrir.
- El formato de cuento es útil si se adapta a una boda con tipografía y colores sobrios.

### Aplicación

Se creó `Sobre y sello`: papel marfil, doble marco y sello de cera generado con CSS. En V6.14 el aprendizaje se extendió a una apertura completa y reutilizable con cuatro variantes: cera, floral, minimalista y cinematográfica. Todas muestran los datos reales y no utilizan personajes ni material gráfico del video.

## Video 4 - Plataforma de gestión

### Aprendizajes operativos

- Exportación de información.
- QR de acceso y check-in.
- Notificaciones, códigos individuales y asignación de mesas.
- Diseño móvil y panel de control con indicadores simples.

### Decisión actual

El proyecto ya cubre confirmaciones, códigos, QR, mesas y reportes. En V6.13 sólo se incorporó la exportación PDF del plano, que era el pendiente confirmado. El check-in por QR queda como una evolución futura para evitar ampliar el alcance antes de la boda.

## Video 5 - Boda cinematográfica

### Aprendizajes

- Una fotografía a pantalla completa puede funcionar como portada si el texto se agrupa en una zona de alto contraste.
- Los tonos oscuros y el oro necesitan secciones interiores claras para conservar legibilidad.
- Las fotografías rectangulares y el contador tipo película dan continuidad visual.

### Aplicación

Se creó `Votos cinematográficos`: portada alineada al borde inferior, degradado oscuro, detalles dorados, contador de alto contraste y galería de marcos rectos.

## Criterios comunes

- Los datos siempre provienen del evento activo.
- Las animaciones respetan `prefers-reduced-motion`.
- La confirmación, música, mapas, programa y galería conservan el mismo comportamiento funcional.
- Las plantillas no añaden dependencias ni imágenes externas.
- La identidad de QR e invitación física reutiliza la paleta de cada plantilla nueva.
- La invitación física puede permanecer en `auto-theme`: cambia composición, motivos y paleta al seleccionar cualquier plantilla digital.
