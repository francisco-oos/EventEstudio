# Auditoría final RC11

Fecha: 29 de julio de 2026

## Resultado

`npm test` finalizó correctamente con:

- integridad del proyecto y referencias DOM;
- reglas específicas de interfaz móvil;
- migración SQLite con respaldo previo y `integrity_check`;
- política de orígenes, CSRF y encabezados;
- recorridos comerciales de alta, compra y administración;
- pruebas funcionales completas;
- respaldo y restauración protegida.

## Recorridos comerciales ejecutados

### Cliente nuevo

- Se registra con evento privado.
- Recibe el paquete interno `trial` durante siete días.
- Ve módulos y plantillas Premium, pero parte de 100 MB.
- Puede elegir idioma de panel y traducciones del evento.

### Cliente que compra

- Activa un paquete Express.
- Compra dos unidades de 500 MB; el límite pasa de 1,024 MB a 2,024 MB.
- Compra una plantilla Premium individual y obtiene acceso sólo a esa compra.
- Recibe notificaciones de activación.
- Mejora a Básico, renueva Básico y el servidor rechaza volver a Express.

### Propietario/desarrollador

- Ve el catálogo por estado global y miniatura.
- Cambia una plantilla a `hidden` y deja de aparecer en tienda.
- Consulta pedidos pagados, derechos y almacenamiento acumulado del cliente.
- Puede dar paquete, función, plantilla o almacenamiento de cortesía con ingreso
  de cero y notificación al cliente.

## Hallazgos corregidos

- La carga y reproducción inmediata de Spotify ya no compiten entre sí.
- El botón móvil **Agregar** dejó de estirarse al ancho completo.
- Modo desarrollador y tipografía ya no comparten dos columnas altas.
- El constructor de paquetes ya no depende de un arrastre poco descubrible.
- El almacenamiento ya no se bloquea después de la primera compra.
- Una orden pagada se aplica una sola vez aunque se confirme de nuevo.
- Los ingresos suman pagos de paquetes y órdenes pagadas, nunca pendientes ni
  cortesías.
- El ciclo de vida ya no toma una suscripción histórica vencida: usa la última
  del propietario y los días de conservación del paquete.
- El diálogo comercial bloquea el desplazamiento del fondo.
- Nuevo evento dejó de usar cuadros `prompt()`.
- No hay identificadores HTML duplicados.
- No se encontró la clave compartida por chat ni otro secreto pegado en fuente.

## Datos fijos revisados

- Los datos demo sólo se crean mediante `npm run seed` fuera de producción.
- Producción rechaza cuentas demo activas.
- Los textos por tipo de evento proceden de `config/event-types.json`.
- Planes, productos, plantillas y estados se leen desde catálogo o base; no se
  conceden desde casillas visuales históricas.
- Las claves de traducción y mensajería sólo se leen del entorno del servidor.

## Pendientes externos

- Conectar un proveedor real de pago y sus webhooks.
- Configurar un proveedor de traducción si se desea autogeneración; la edición
  manual funciona sin él.
- Realizar la comprobación física final en los teléfonos objetivo y con cuentas
  reales de Spotify antes de producción.
