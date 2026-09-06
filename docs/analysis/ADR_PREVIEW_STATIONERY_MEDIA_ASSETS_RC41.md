# ADR — Fidelidad Preview/ACTIVE, Stationery, portada y Assets — RC41

Fecha: 2026-09-05
Estado: ACCEPTED

## Contexto

Las pruebas físicas de RC40 detectaron cuatro desviaciones de fidelidad: algunas Recipes con `Sobre personalizable` mostraban en preview el mismo sobre aunque la invitación ACTIVE terminaba con la paleta correcta; un cambio de Stationery podía perderse si se pulsaba Aplicar antes del autosave; la portada guardada en BD podía quedar inaccesible tras restaurar un ZIP con el mismo archivo bajo otro prefijo de subida; y Assets colorizables visibles en Design Lab podían terminar con altura 0 en la invitación pública.

## Decisiones

1. **Recipe = identidad visual; Apertura superior = experiencia.** Si la apertura efectiva es `unified-envelope`, todas las Recipes usan la misma geometría de sobre, pero su paleta y textura generan una identidad de Stationery distinta.
2. **Stationery se vacía explícitamente antes de Preview/Apply.** El iframe expone sólo una capacidad local `flush()`. El contenedor la espera antes de promover DRAFT a ACTIVE.
3. **No se obliga al usuario a pulsar Guardar ahora.** El autosave sigue existiendo como mecanismo interno; Aplicar garantiza el flush.
4. **Medios restaurados se reconcilian sólo por coincidencia inequívoca.** Si el archivo exacto falta, se admite un único archivo del mismo directorio cuyo nombre original sea idéntico después del prefijo timestamp/hash. No se modifica la BD y no se elige entre candidatos ambiguos.
5. **Portada se encuadra por dispositivo.** Móvil y escritorio conservan `positionX`, `positionY` y `fit` independientes, con fallback a los campos históricos.
6. **Drag directo de portada y Assets.** La portada puede reposicionarse con pointer; los Assets mantienen drag y añaden escala rápida con Ctrl/Alt + rueda.
7. **Assets públicos tienen geometría real.** `aspectRatio` forma parte del manifest y del payload público; un SVG máscara ya no depende de contenido intrínseco para obtener altura.
8. **No crear revisiones de borrador idénticas.** PUT de Recipe/Stationery responde idempotente si hash, Stationery y Seal no cambiaron.
9. **Constructor general parte del ACTIVE cuando no existe trabajo pendiente.** Editar una Recipe desde catálogo abre el DRAFT preparado explícitamente.

## Consecuencias

- Preview, editor y publicación comparten mejor la misma fuente de verdad.
- Se reduce el riesgo de color/textura Stationery anterior aplicado por carrera de autosave.
- Una copia QA puede recuperar una portada existente sin inventar un reemplazo.
- Los medios siguen siendo propiedad del evento; la Recipe guarda presentación, no otra copia del archivo.
- DRAFT/ACTIVE continúa siendo obligatorio internamente para edición segura, aunque el usuario no deba gestionar ese detalle manualmente.
