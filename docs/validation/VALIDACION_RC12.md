# Validación de EventStudio RC12

Fecha de corte: 7 de agosto de 2026

## Ejecución automatizada

```bash
npm ci
npm test
```

La suite verifica integridad, referencias DOM, viewport móvil, inicio LAN,
seguridad de datos, migración comercial, política de origen y CSRF, encabezados,
recorridos comerciales, comportamiento funcional, respaldo y restauración.

RC12 añade comprobaciones específicas para:

1. 48 temas únicos con paleta y metadatos completos.
2. Correspondencia entre cada layout/estilo fotográfico y su implementación.
3. Productos de Rosa eterna e Historia cinemática en el catálogo.
4. Trial con ambas experiencias activas.
5. Plan sin derecho: rechazo `403 DESIGN_PRODUCT_REQUIRED`.
6. Cortesía activa, publicación de Rosa eterna y degradación tras revocarla.
7. Compra pagada de Historia cinemática y publicación del carrusel adquirido.
8. Filtro por compatibilidad de tipo de evento.
9. Alternativa CSS para `prefers-reduced-motion`.

Resultado final: instalación limpia, auditoría de dependencias sin
vulnerabilidades y las 11 etapas de `npm test` correctas. El hash del
entregable se comunica junto con el ZIP, porque no puede incluirse dentro del
propio archivo sin modificarlo.

## Revisión visual recomendada antes de producción

- Teléfono de 390 px: apertura Rosa eterna, botones, foco y rotación.
- Teléfono y escritorio: galería cinematográfica con 1, 3, 8 y 20 fotos.
- Pasaporte al sí: muestra pública, PDF físico y formatos QR elegidos.
- Inglés y portugués: categoría Animaciones y textos personalizados.
- Modo de movimiento reducido del sistema operativo.
- Cuenta Express sin compra, cuenta con cortesía y cuenta con compra pagada.

Esta revisión física queda separada de la automatización porque depende de los
dispositivos, navegador, fotografías y cuentas reales del despliegue.
