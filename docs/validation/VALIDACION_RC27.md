# Validación RC27

Fecha: 3 de septiembre de 2026

## Alcance automatizado ejecutado

- integridad del proyecto y referencias DOM;
- panel móvil y tipografía;
- catálogo y auditoría de aperturas;
- migración de IDs históricos a presets;
- validación de IDs, colores y límites;
- herencia de nombres, fecha y tipografía;
- persistencia atómica de presentación, papelería y lacre;
- prioridad de tokens y fallback de plantilla;
- propagación a web, álbum, QR y PDF;
- compatibilidad de lacre en plantillas y fechador de partículas;
- permisos explícitos para propietario, desarrollador y perfiles sin `templates`;
- sincronía geométrica de pergamino y varillas;
- contratos `prefers-reduced-motion` y uso de transformaciones compuestas.

## Resultado

Los siguientes contratos estáticos finalizaron correctamente:

```text
project-integrity.js                 PASS
source-references.js                 PASS
mobile-ui.js                         PASS
animation-contracts.js               PASS
rc20-regressions.js                  PASS
rc21-visual-contracts.js             PASS
rc22-modules.js                      PASS
rc23-acceptance-contracts.js         PASS
rc24-gifts.js                        PASS
rc25-gifts-modular.js                PASS
rc27-stationery-engine.js            PASS
node --check (archivos modificados)  PASS
```

## Validación que requiere entorno completo

El contenedor de auditoría no incluye `node_modules`, Playwright ni un navegador Chromium. Por ello no se declara evidencia nueva de FPS, CLS o recorridos HTTP con base temporal para RC27. Los contratos verifican que la animación nueva usa exclusivamente `transform` y conserva `prefers-reduced-motion`, pero el candidato debe ejecutar antes de producción:

```bash
npm ci
npm test
npm run test:visual
```

Criterios de aceptación en el equipo de QA: 390×844, 768×1024 y 1365×724; overflow horizontal máximo 2 px; CLS máximo 0.05; promedio objetivo 60 FPS y mínimo aceptable 48 FPS; p95 de intervalos `requestAnimationFrame` máximo 40 ms.

## Perfiles

- Propietario y desarrollador: pueden aplicar papelería y omitir derechos comerciales internos.
- Cliente con `templates`: puede editar y persistir; los presets comerciales continúan comprobando su concesión.
- Cortesía o perfil sin `templates`: recibe `403 TEMPLATES_REQUIRED` y no modifica el estado.

No se incluyeron `.env`, bases SQLite, cargas, respaldos ni credenciales en la entrega.

