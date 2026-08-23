# EventStudio 6.14.2-rc.16 — limpieza estructural y optimización de carga

## Enfoque de la entrega
Esta versión deja de ser un hotfix puntual y pasa a una limpieza funcional del proyecto para reducir tiempos de carga percibidos, eliminar duplicación en el panel y ordenar la documentación.

## Cambios destacados
- Carga diferida para QR, notificaciones, resumen de plataforma, contexto de cuenta, estado de WhatsApp y paneles de propietario.
- Consolidación del despachador de pestañas del panel para evitar cargas repetidas.
- Refuerzo de la apertura `rose-bloom` en simulación y replay, especialmente para escritorio.
- Reordenamiento de documentos dentro de `docs/`.
- `.gitignore` ampliado para entornos locales, cachés y datos persistentes.
- Cambio de versión en los assets públicos para invalidar caché del navegador.

## Resultado esperado
- El panel debe quedar utilizable antes.
- Menor tiempo de espera en “Actualizando evento…”.
- Menor riesgo de que la animación floral no inicie en escritorio.
