# Matriz de trazabilidad — RC19

| Requisito / error | Implementación | Evidencia | Estado |
|---|---|---|---|
| Animaciones visibles con Windows reducido durante preview | `force-motion-preview` y `force-motion`; público conserva reduced motion | renderer/CSS/app + animation contracts | PASS |
| Centro de Margarita conectado | 88 px, pétalo 38×94, translate 30, móvil 0.78 | CSS + cálculo automatizado | PASS |
| Probar todas las aperturas | catálogo único + contrato por renderer/CSS/producto/grant | `tests/animation-contracts.js` | PASS automatizado |
| Integrar Animated Flower | `LuminousGardenScene`, producto y grant no públicos por defecto | config/renderer/commerce/tests | PASS |
| Evitar 401 de sesión esperado | `/api/auth/me?optional=1` | prueba funcional 401 normal/200 opcional | PASS |
| Evitar 404 de mensajes en preview | parámetros propagados + `previewAllowed` | prueba anónimo/preview | PASS |
| Evitar 503 repetido de traducción | capability pública, botón/guard, manual ES/EN/PT | RC19 + auditoría 161/161 | PASS |
| Clasificar errores de extensión/unload | ausencia de esquemas/extensión y listener unload | auditoría/doc | PASS |
| Roles y perfiles no se mezclan | autorización backend y perfiles comerciales sin rol | smoke/security journeys | PASS |
| Cortesías/compras/eventos/usuarios | recorridos temporales y migración | commerce journeys + smoke | PASS |
| Datos de ejemplo no reales | dominios `.local`/`.test`, almacenamiento temporal | seeds/tests | PASS |
| Paquete limpio | escáner de secretos/artefactos y extracción final | audit + validación ZIP | PASS |
| Compatibilidad física final | revisión manual en dispositivos/navegadores objetivo | operación de despliegue | Pendiente antes de stable |
