# Auditoría de aperturas y papelería coordinada RC27

Fecha: 3 de septiembre de 2026  
Base examinada: EventStudio 6.14.2-rc.26  
Referencia funcional: `index_sobre_generador_general_rc28_auditado.html`

## Criterio de decisión

Una apertura sólo se retira cuando su mecánica principal es el mismo ciclo de sobre —solapa, lacre, extracción de tarjeta— y su diferencia es una receta estética reproducible por el generador unificado. Las escenas con dibujo por partículas, crecimiento floral, plegado editorial, pergamino, órbitas, velos, telón o descorche permanecen activas.

La baja es compatible: el identificador histórico sigue aceptándose al leer configuraciones, se traduce a un preset y se publica como `unified-envelope`. No se reescribe la base de datos hasta que el usuario guarde el evento.

## Revisión individual

| # | Identificador | Mecánica observada | Decisión | Motivo |
|---:|---|---|---|---|
| 1 | `unified-envelope` | Motor paramétrico de sobre, tarjeta y lacre | Activa | Sustitución única para las recetas de sobre |
| 2 | `wax-envelope` | Solapa, lacre y extracción de tarjeta | Retirada | Receta clásica reproducida por el motor |
| 3 | `floral-envelope` | El mismo sobre con ornamento floral | Retirada | Diferencia visual expresada como material, liner y marco |
| 4 | `minimal-envelope` | El mismo sobre con acabado minimalista | Retirada | Diferencia visual expresada como preset |
| 5 | `cinematic-fold` | El mismo sobre con lino oscuro y oro | Retirada | Geometría y ciclo equivalentes al motor |
| 6 | `ivory-seal` | El mismo sobre con fibra marfil y sello oro | Retirada | Receta preservada y su derecho comercial continúa validándose |
| 7 | `rose-bloom` | Crecimiento y apertura de rosa | Activa | Mecánica floral independiente |
| 8 | `daisy-bloom` | Crecimiento de tallo, hojas y margarita | Activa | Mecánica floral independiente |
| 9 | `luminous-garden` | Jardín nocturno con flores y luces | Activa | Escena generativa independiente |
| 10 | `night-flower-original` | Tres flores originales con pétalos animados | Activa | Escena floral independiente |
| 11 | `particle-heart` | Trazado de corazón con partículas | Activa | Canvas y partículas; el fechador usa el lacre central |
| 12 | `newspaper-fold` | Plegado y despliegue editorial | Activa | Mecánica de gaceta, no sobre convencional |
| 13 | `vintage-parchment` | Desenrollado entre dos varillas | Activa | Mecánica de pergamino; recibe la varilla Onfalós |
| 14 | `olive-universe-orbit` | Órbitas y revelación circular | Activa | Mecánica orbital independiente |
| 15 | `olive-nectar-seal` | Sobre convencional con botánica y lacre | Retirada | Apariencia reproducida por preset y componentes |
| 16 | `blue-aurora-reveal` | Velos laterales de aurora | Activa | Revelación por velos independiente |
| 17 | `botanical-cosmos-orbit` | Órbitas botánicas y cosmos | Activa | Mecánica orbital independiente |
| 18 | `powder-blue-seal` | Sobre convencional perlado con lacre | Retirada | Apariencia reproducida por preset |
| 19 | `gala-curtain` | Apertura bilateral de telón | Activa | Mecánica de cortina independiente |
| 20 | `constellation-veil` | Rotación y retiro de velos orbitales | Activa | Mecánica de velo independiente |
| 21 | `blush-heart-emblem` | Carcasa de sobre con solapa y lacre | Retirada | La silueta y adornos se reproducen por formato y overlay |
| 22 | `reserve-uncork` | Presentación inspirada en botella y descorche | Activa | Mecánica temática independiente |
| 23 | `none` | Centinela sin animación | Activa | Opción funcional para omitir apertura |

Resultado: ocho variantes redundantes retiradas, trece mecánicas visuales independientes conservadas, un motor unificado activo y el centinela `none` intacto.

## Código legado

Se eliminaron la página, JavaScript y hoja de estilos de `seal-studio`. Los selectores históricos de las ocho aperturas retiradas permanecen temporalmente como capa inerte de compatibilidad para documentos ya almacenados en caché; no aparecen en el catálogo, no tienen temporización en `app.js` y el servidor normaliza sus IDs antes de renderizar.

