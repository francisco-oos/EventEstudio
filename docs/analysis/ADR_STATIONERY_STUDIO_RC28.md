# ADR RC28: estudio avanzado de sobres desacoplado del panel

Estado: aceptado  
Fecha: 2 de septiembre de 2026

## Contexto

RC27 resolvió la duplicación de motores de sobre y consolidó la persistencia de `stationery` y `seal`, pero trasladó los controles avanzados al panel de plantillas. Esa integración redujo el espacio disponible, mezcló dos contextos de trabajo y dejó menos accesibles varias combinaciones del generador general: geometría, material, liner, overlay, estampilla, marco, divisor, paleta y controles finos del lacre.

RC26 demostró que una herramienta especializada puede vivir en una ventana independiente sin crear una segunda fuente de verdad: el editor recibe `eventId`, lee el evento desde el servidor y persiste mediante la API existente. La limitación de RC26 era que sólo editaba el lacre.

## Decisión

1. El panel mantiene únicamente la selección de la entrada animada y un lanzador contextual.
2. Sólo la apertura declarada en `config/experiences.json` con `editor.type = "stationery-studio"` muestra el lanzador y carga `stationery-studio.html` al abrirlo. Ninguna otra apertura carga el motor del estudio en el panel.
3. `public/stationery-studio.html/.js/.css` contiene el editor avanzado de sobre, tarjeta y lacre. Reutiliza `stationery-engine.js` y `seal-renderer.js`; no implementa un renderer paralelo.
4. El estudio hereda nombres, fecha y tipografía desde `GET /api/admin/settings`. No existen campos editables duplicados para esos metadatos.
5. `Aplicar a la invitación` persiste en un único `PUT /api/admin/settings` los bloques `presentation`, `stationery` y `seal`. `presentation.openingStyle` se toma de `stationeryCatalog.openingId`, no de una constante local.
6. El servidor continúa siendo la única fuente de verdad. `BroadcastChannel` y `localStorage` se usan sólo como señal de invalidación entre ventanas; el panel responde con un nuevo `GET /api/admin/settings` y nunca confía en datos enviados por la ventana del estudio.
7. Se recupera `Guardar entrada` como acción separada. Elegir una apertura distinta no reescribe la papelería guardada; únicamente cambia qué política cromática está activa.
8. El acceso de escritura continúa gobernado por la feature `templates`. Owner/developer pueden aplicar; un perfil sin `templates` puede abrir el estudio en consulta, pero el servidor rechaza la persistencia de `stationery` o `seal`.

## Política cromática

La prioridad deja de depender únicamente de la existencia de una papelería personalizada.

1. Si la entrada activa es el sobre unificado, `stationery.customized === true` y `syncDesignTokens === true`, los tokens completos del sobre gobiernan web, portal de fotos, QR e impresión.
2. Si la entrada activa es independiente y declara `coordination.mode = "accent-harmony"`, se conserva el fondo, papel y tinta de la plantilla y sólo se coordinan `accent`, `gold` y/o `line` según metadatos del catálogo.
3. Si la entrada declara `coordination.mode = "template"`, no aporta tokens adicionales.
4. `Sin apertura` usa el diseño de la plantilla; un `designKit` que el usuario haya activado explícitamente sigue siendo respetado porque es una personalización independiente de la apertura.
5. La paleta final siempre pasa por `ensureAccessiblePalette`.

La función `stationeryIsAuthoritative()` corta de forma explícita la autoridad global de una papelería guardada cuando el usuario cambia a otra entrada. Esto evita que una selección antigua contamine visualmente una plantilla posterior.

## Configuración frente a hardcode

- La ruta y etiqueta del estudio viven en `config/experiences.json`.
- Las políticas de coordinación viven junto a cada apertura.
- Los colores de una entrada independiente provienen de campos de presentación o de un preset de `config/stationery.json`.
- Los límites de sliders de papelería y lacre viven en `config/stationery.json` y `config/seals.json`.
- Sugerencias de conector y modos de relieve del lacre viven en `config/seals.json`.
- Los valores predeterminados de colores florales se leen desde `config/default-settings.json` en la normalización del servidor.

## Alternativas evaluadas

### Mantener RC27 sin cambios

Rechazada. Conservaba un editor funcional, pero el panel administrativo se convertía en el espacio de edición de una herramienta especializada y dificultaba acceder al catálogo completo.

### Abrir un modal con todo el motor dentro de `admin.html`

Rechazada. Aunque mejoraba el espacio visual, el bundle y el DOM del editor seguirían cargándose siempre. También aumentaba el acoplamiento entre el panel y el generador.

### Restaurar el Seal Studio de RC26 y dejar el sobre en el panel

Rechazada. Volvía a separar dos objetos que ahora comparten paleta, monograma y persistencia.

### Copiar la paleta del sobre al `designKit`

Rechazada. Haría imposible distinguir una personalización del sobre de una decisión manual de diseño y permitiría que colores antiguos sobrevivieran al cambiar de entrada.

### Sincronizar ventanas usando el payload de `postMessage` o `localStorage`

Rechazada. Una señal del cliente no es una fuente confiable. La ventana principal vuelve a consultar el servidor después de recibir el aviso.

## Consecuencias

El panel queda más pequeño y conserva el flujo de selección/prueba/guardado. El editor avanzado recupera todo el espacio necesario y sólo existe cuando el usuario lo solicita. La configuración de papelería sigue persistida aunque se elija una entrada independiente, pero queda inactiva como fuente global de color hasta volver al sobre personalizable. Las mecánicas independientes no se reescriben y mantienen sus renderers existentes.

## Evolución posterior

RC29 conserva esta decisión arquitectónica, pero sustituye la presentación simplificada del estudio por la estructura/interacción del generador maestro. Para la experiencia visual vigente consultar `ADR_STATIONERY_INDEX_PARITY_RC29.md`.
