# Auditoría RC35 — Design Studio y paridad de render

## Alcance
Se revisó el flujo Administración → Design Studio → Stationery → Public Renderer, prestando especial atención a navegación, persistencia, color, nombres dinámicos y regresiones de motores estabilizados.

## Conclusiones
- Stationery era un editor especializado correcto técnicamente, pero su apertura externa creaba dos experiencias visibles. Se mantuvo el motor y se integró su superficie.
- La protección de contraste ya existía en servidor, pero el navegador del constructor y el público podían no recorrer la misma ruta. Se creó un motor cromático compartido para eliminar esa divergencia.
- No se encontraron nombres reales hardcodeados en runtime después del saneamiento RC35.
- Las aperturas, sello, música, galería, RSVP, QR, álbum y layouts existentes continúan funcionando bajo Recipe-first.
- No se realizaron migraciones destructivas de BD para RC35.

## Deuda explícita
- Los textos estáticos de interfaz detectados por `audit-project.js` siguen siendo deuda i18n histórica; no pertenecen al contrato de datos de invitaciones.
- El E2E servidor/checkout requiere dependencias npm y queda como gate físico de preproducción por la falta de conectividad del contenedor.
