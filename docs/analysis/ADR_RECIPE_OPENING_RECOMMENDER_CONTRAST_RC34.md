# ADR RC34 — Apertura como recomendador de Recipes y contraste semántico

**Estado:** Aceptado para EventStudio 6.15.0-rc.34.

## Contexto
En RC33 el panel "Apertura y experiencia" persistía una configuración paralela a la Recipe. Al aplicar posteriormente una Recipe, sus valores predeterminados podían volver obsoleta la selección superior. Además, una superficie clara podía conservar texto heredado blanco de estilos legacy, y nombres extensos podían partirse dentro de una palabra.

## Decisión
1. El panel superior deja de tener un botón de guardado independiente.
2. Apertura, recorrido, movimiento, galería y colores de la experiencia son **intención/override de presentación**.
3. Al modificar esos controles, el catálogo se reordena por afinidad estética con la apertura elegida.
4. Al aplicar una Recipe, los overrides viajan juntos en `presentationOverrides` y sustituyen los defaults de esa Recipe.
5. `Probar apertura` se conserva y usa una URL de preview autorizada; no persiste cambios ni concede derechos.
6. Si la apertura declara `editor.type = stationery-studio`, se muestra el acceso al editor avanzado. Las demás aperturas no cargan Stationery.
7. La Recipe comercial puede previsualizarse libremente, pero la API bloquea su aplicación si no fue adquirida o incluida en el plan.
8. La Recipe sí puede conservar intención visual de experiencias/servicios no adquiridos; la proyección pública por entitlement decide qué renderizar.
9. Las paletas predefinidas conservan su armonía cromática y derivan tokens semánticos de contraste (`paperContrast`, `bgContrast`, `accentText`, `goldText`, `accentContrast`, `goldContrast`).
10. Los nombres del evento nunca se dividen dentro de una palabra. El motor intenta una línea, reduce tipografía dentro de límites y sólo después permite salto entre palabras.

## Alternativas descartadas
- Mantener `Guardar entrada`: creaba dos autoridades de presentación.
- Hacer que aplicar una Recipe reemplace siempre la apertura elegida arriba: sorprendente para el usuario.
- Forzar un único color de texto global para fondos claros y oscuros: no representa correctamente superficies diferentes.
- Permitir `overflow-wrap:anywhere` en nombres: evita overflow pero produce cortes tipográficos inaceptables.

## Consecuencia
La Recipe queda como unidad de composición y el selector de apertura como recomendador/override, mientras comercio y servicios permanecen desacoplados.
