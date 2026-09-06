# EventStudio 6.16.0-rc.39 — Recipe/Stationery parity y datos reales

Estado: **candidata QA avanzada**.

## Cambios principales

- Recipes predefinidas proyectan su propia paleta, apertura y Stationery en preview;
- sincronización bidireccional Recipe ↔ Stationery para evitar heredar siempre el mismo sobre;
- autosave silencioso del sobre/lacre: ya no es obligatorio pulsar Guardar borrador antes de Apply;
- retorno de `mode=preview` al Estudio en un clic;
- filtrado de referencias de media ya inexistente;
- historia, ubicación, programa, vestimenta, portada, galería y música aprovechan datos reales del evento;
- portada existente se reutiliza si la Recipe la habilita;
- secciones no visibles/no activas colapsan sin huecos grandes;
- tamaños, pesos, interlineado, tracking y colores del inspector tienen efecto visible inmediato;
- Color Studio usa la paleta efectiva del DRAFT;
- owner/developer puede probar/aplicar experiencias comerciales para QA sin conceder derechos al cliente;
- hero cinematográfico del Design Lab corrige fondo/contraste usando `bg` + `bgContrast`;
- catálogo conserva preview nativo aunque existan filtros de recomendación;
- paridad cromática reforzada entre canvas, preview y renderer público.

## QA ejecutada

- 65 Recipes del Design Lab: 0 fallos, overflow 0, heading min ~11.34:1 y body min ~4.74:1;
- 130 renders Recipe: 0 fallos/overflow;
- 130 casos de readability y 130 de color parity: 0 fallos;
- 175,500 combinaciones de presentación;
- 1,300 proyecciones rol/perfil;
- 139 controles/botones con wiring;
- 64 casos de contenido largo y 32 de feature visibility;
- interacción pública, Stationery, álbum y sobre público: PASS en harnesses disponibles;
- BD preservada byte a byte respecto al ZIP base, `quick_check=ok`.

## Límite

El E2E que necesita iniciar el servidor real sigue **BLOCKED_ENV** por dependencias npm no disponibles en este runtime. Debe cerrarse con `npm ci`, `npm run test:preproduction` y `npm audit --audit-level=moderate` antes de producción.
