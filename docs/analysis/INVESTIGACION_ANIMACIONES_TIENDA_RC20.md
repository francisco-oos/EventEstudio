# Investigación de futuras animaciones para Store — RC20

## Criterios obligatorios

- Concepto visual propio de EventStudio; no copiar demos ni assets sin licencia.
- Registro en `config/experiences.json`, renderer allowlisted y producto/grant independiente.
- Estado estático completo, botón Omitir, teclado, `prefers-reduced-motion` y preview forzado separado.
- Límite de partículas/DPR, pausa al ocultar pestaña y sin código ejecutable proveniente de BD.
- Contraste de texto mínimo 4.5:1 y prueba en 390×844, 768×1024 y 1440×900 antes de publicar.
- Flujo laboratorio → QA → aprobado → público. La investigación no concede ni publica productos.

## Candidatos

| Concepto propio propuesto | Referencia técnica | Licencia/estado | Decisión |
|---|---|---|---|
| Confeti ceremonial accesible | [canvas-confetti](https://github.com/catdad/canvas-confetti) ofrece partículas Canvas y opción `disableForReducedMotion`. | ISC | Candidato ligero. Preferir adaptar ideas al runtime local y fijar presupuesto de partículas. |
| Cielo de constelaciones / luciérnagas | [tsParticles](https://particles.js.org/) ofrece motor modular de partículas y declara licencia MIT. | MIT | Candidato para laboratorio; el bundle completo puede ser excesivo, evaluar paquetes mínimos. |
| Monograma dibujado | [Vivus](https://github.com/maxwellito/vivus) anima trazos SVG sin dependencias. | MIT | Buen candidato para iniciales/ornamentos SVG propios; requiere fallback final visible. |

## Accesibilidad de referencia

La preferencia del sistema debe detectarse con [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion). WCAG 2.2 explica que el movimiento activado por interacción debe poder deshabilitarse cuando no sea esencial: [Understanding SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).

## Estado

Ninguna dependencia nueva entra a producción en RC20. Los tres conceptos quedan como backlog investigado, sujeto a prototipo aislado, revisión de licencia de cualquier asset adicional y QA física.
