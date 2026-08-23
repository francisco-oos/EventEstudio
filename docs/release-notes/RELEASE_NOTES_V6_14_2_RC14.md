# EventStudio 6.14.2-rc.14 — Notas de versión

## Propósito
Candidata correctiva construida sobre 6.14.2-rc.13 a partir de pruebas manuales en escritorio y teléfono. La prioridad es corregir regresiones funcionales y reducir saturación visual sin alterar la autoridad del propietario/desarrollador ni el modelo comercial aprobado.

## Correcciones principales
- RSVP: validación inmediata de negativos, enteros y cupos; actualización visual inmediata al guardar sin recargar.
- Álbum de invitados: `crypto.randomUUID()` deja de ser requisito para LAN HTTP; se incorpora generación compatible del identificador de idempotencia y se evita COOP/OAC en desarrollo LAN no confiable, conservándolos en producción HTTPS.
- Mesas: la importación heredada de `guests.table_name` se ejecuta una sola vez. Después, `seating_assignments` es la fuente de verdad; mover una persona no debe reubicar a las demás.
- Plantillas: preview en modal; “Probar apertura” reenvía correctamente `previewOpening` y usa datos reales del evento.
- Color: se calcula una variante `accentText` legible conservando el acento original para decoración; tinta, texto secundario y acento textual se verifican contra el fondo.
- Nombres: presentación con capitalización coherente sin modificar el dato fuente.
- Plan y extras: se separa en bloques colapsables, Store sin preview persistente y simulación en modal con vistas teléfono/escritorio escaladas.
- Store: los clientes dejan de ver como comprables productos que ya reciben por plan, compra o cortesía; el servidor revalida al iniciar checkout para evitar cobros duplicados.
- Mi negocio: secciones colapsables, tarjetas comerciales más legibles, constructor de paquetes ampliado y productos con vista visual.
- Cortesías: notificación detallada, indicador `NEW` y preview de menú del cliente sin abandonar el contexto de propietario.
- Diseño coordinado: se añade textura ligera al Design Kit.
- Vista global: se renombra para explicar que “Vista cliente” simula interfaz, no cambia rol ni permisos.
- Logout: limpieza de estado local y redirección con invalidación visual de caché.

## Decisiones diferidas conscientemente
La animación de cierre queda aprobada como capacidad futura (`closing experience`), pero no se ata todavía al envío RSVP en esta candidata correctiva. Debe modelarse como slot independiente y configurable para no impedir que el invitado siga consultando mapa, fotos u otros datos después de confirmar.

## Migración
`schemaVersion = 614208` agrega la marca `seating_legacy_imports` para impedir que la compatibilidad heredada vuelva a reescribir asignaciones de mesas.

## Estado
Candidata para validación integral. No sustituir producción hasta ejecutar la suite completa en un entorno con acceso normal al registro npm y validar migración sobre una copia de la base real.
