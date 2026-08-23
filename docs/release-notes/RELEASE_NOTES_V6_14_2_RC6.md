# EventStudio 6.14.2 RC6

Versión candidata enfocada en los últimos hallazgos físicos de Android sobre
el panel propietario. Conserva el esquema SQLite `614204`; no agrega una
migración ni modifica los datos persistentes.

## Correcciones visibles

- Las tablas de usuarios, clientes y eventos alojados eliminan en móvil el
  ancho mínimo de escritorio y se muestran como tarjetas completas dentro de
  la pantalla.
- Acciones, selectores de plan y transferencia ocupan una sola columna táctil,
  sin cortar valores ni botones a la derecha.
- Al abrir el menú, EventStudio conserva la posición actual y fija la página
  del fondo. Sólo la navegación del cajón puede desplazarse; al cerrar se
  recupera exactamente el punto anterior.
- La configuración pública usa una revisión derivada del evento y no se guarda
  en caché. Una invitación abierta comprueba cambios al volver a la pestaña y
  periódicamente mientras está visible.
- Si cambia la apertura animada, la invitación se actualiza automáticamente;
  se evita confundir una pestaña antigua con un guardado fallido.
- La actualización se pospone si una familia está escribiendo su RSVP, para no
  perder datos aún no enviados.

## Limpieza y regresión

- Se añadió una prueba que verifica identificadores DOM, recursos estáticos,
  rutas de CSS/JavaScript y funciones declaradas sin llamadas.
- Las pruebas móviles ahora exigen que toda tabla convertida en tarjeta anule
  `min-width`, que el menú bloquee el documento raíz y que el desplazamiento
  se restaure al cerrarlo.
- La API comprueba que la revisión pública cambie después de guardar una
  apertura y que `/api/config` responda con `Cache-Control: no-store`.
- CSS y JavaScript usan la versión RC6 para invalidar cachés anteriores.

## Compatibilidad

- Actualización directa desde RC5 sin cambio de esquema.
- Se conservan `.env`, `data`, `uploads` y `backups`.
- No deben copiarse `node_modules`, `public`, `src` ni `scripts` de versiones
  anteriores sobre RC6.
