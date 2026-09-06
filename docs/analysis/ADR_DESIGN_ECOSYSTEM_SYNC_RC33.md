# ADR RC33 — Design Ecosystem, sincronización multicanal y zero-hardcode

## Estado

Aceptado para `6.15.0-rc.33`.

## Contexto

RC32 introdujo el motor `Assets + Components + Recipes` y separó diseño, datos, servicios, comercio y renderizado. RC33 consolida esa decisión y extiende el contrato para que el Design Engine controle toda la presentación visual reutilizable: paleta, tipografía, layout, texturas, fotografía, motion, aperturas y assets decorativos; los módulos funcionales existentes continúan siendo la autoridad operativa.

El objetivo es sustituir el crecimiento por plantillas estáticas antes de que EventStudio acumule múltiples eventos reales difíciles de migrar.

## Decisiones

### 1. Recipe como autoridad visual

Una `DesignRecipe v2` contiene únicamente decisiones visuales y referencias estables. No almacena nombres, fechas, invitados, fotografías operativas, RSVP ni derechos comerciales.

La Recipe controla:

- layout;
- paleta semántica;
- teoría del color;
- tipografías;
- textura;
- presentación fotográfica;
- motion preset y timeline;
- opening seleccionado;
- orden/visibilidad/skin de componentes;
- instancias de Assets con X/Y, escala, rotación, z-index, opacidad, tono y motion.

### 2. Zero-hardcode práctico

Las Recipes prehechas conservan su paleta predeterminada, pero el usuario puede sobreescribir todos los tokens cromáticos expuestos por el motor. Los renderers no deben depender de colores específicos de una Recipe.

Los datos reales del evento siguen llegando desde `settings_json`/modelo productivo. Las Recipes sólo deciden cómo presentarlos.

Se mantienen valores de fallback técnicos para seguridad, contraste, estados vacíos y compatibilidad legacy; esos fallbacks no representan datos de un evento real ni conceden servicios.

### 3. Teoría del color y autoridad efectiva

Color Studio ofrece diez armonías y genera tokens semánticos. El usuario puede editar después individualmente fondo, papel, tinta, texto secundario, acento principal, acento secundario, dorado y línea.

Cuando Stationery personalizado es la autoridad cromática efectiva, su paleta coordinada continúa prevaleciendo para invitación, QR, papelería, álbum y lacre. Se descarta permitir dos autoridades cromáticas simultáneas.

### 4. Sincronización multicanal

La misma resolución de identidad visual alimenta:

- invitación pública;
- QR raster y tarjetas QR de mesa;
- invitación física/PDF;
- álbum colaborativo;
- Stationery y lacre.

PDF consume la tipografía efectiva y Assets compatibles. El álbum hereda paleta, tipografía, textura, layout y Assets aprobados expuestos por el `AssetManifest` público.

### 5. Entitlements fuera de Recipe

Una Recipe puede conservar un bloque aunque el servicio no esté adquirido. La proyección pública filtra secciones por entitlement antes del render.

No se borra la configuración privada al retirar un servicio. Si el derecho se adquiere posteriormente, la presentación puede reaparecer sin reconstruir el diseño.

### 6. Música

La función de música se preserva. Recipe controla únicamente la presentación del componente. La reproducción de archivo/Spotify sigue perteneciendo al reproductor productivo de `public/app.js` y sólo se expone cuando existe configuración válida y entitlement.

### 7. Asset Library

`AssetManifest` usa IDs estables, categorías, metadata, miniaturas, búsqueda, paginación y carga bajo demanda. La Recipe guarda referencia + transformaciones; nunca copia el SVG completo.

El renderer público recibe sólo los Assets realmente utilizados por la Recipe publicada.

### 8. Responsive y contenido extremo

No se permite resolver overflow ocultando globalmente contenido funcional. Las familias de layout deben degradar transformaciones decorativas en viewports compactos cuando sea necesario.

Nombres, direcciones y textos extensos deben envolver dentro de sus marcos. El contrato RC33 se valida desde 320 px hasta 3840×2160.

### 9. Animaciones y lacre

Las mecánicas de opening verificadas se reutilizan; no se reescriben sólo por incorporarlas al constructor. La solapa y tarjeta mantienen curvas independientes de desaceleración/inercia.

El lacre centralizado usa relieve, iluminación difusa, highlight especular y textura procedural. Las variantes legacy retiradas no se reintroducen.

### 10. Landing comercial Recipe-first

La landing pública muestra Recipes reales derivadas del catálogo, miniaturas reactivas y una demostración del lacre. El CTA principal comunica el flujo `diseña primero → decide servicios después`.

No se cargan fotografías remotas en el primer pantallazo de la nueva demostración.

## Alternativas descartadas

- continuar creando HTML/CSS por plantilla;
- copiar de forma literal los HTML monolíticos de Gemini/Claude;
- guardar assets completos dentro de cada evento;
- conceder derechos comerciales desde el diseño;
- eliminar módulos funcionales estables y reemplazarlos por mocks visuales;
- ocultar overflow global como sustituto de responsive;
- hacer del generador de video parte de RC33.

## Consecuencias

- el catálogo puede crecer mediante Recipes sin crecimiento proporcional del código;
- diseñadores pueden producir composiciones nuevas sin tocar backend/renderers;
- paquetes y plantillas evolucionan de forma independiente;
- la identidad visual se propaga a canales satélite;
- la migración legacy puede ser agresiva en presentación sin comprometer los datos reales del evento.
