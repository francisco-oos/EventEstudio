# EventStudio 6.13.0 RC1

Versión candidata a producción para la boda real y primera validación comercial de EventStudio. Esta revisión exporta el plano planeado o confirmado a PDF, incorpora cuatro plantillas dinámicas nuevas y conserva las correcciones de mesas rectangulares de hasta 70%.

## Estado

- Funcional y verificada localmente con `npm test`.
- Lista para una prueba real controlada después de configurar HTTPS, volumen persistente, propietario inicial y un respaldo descargado.
- WhatsApp automático permanece oculto para clientes hasta conectar una cuenta de Meta, una plantilla aprobada y un webhook público.
- Los pagos reales y la restauración en caliente no están habilitados. El pago demo no puede acreditar compras en producción.

## Desarrollo local

```bash
npm ci
cp .env.example .env
npm run seed
npm start
```

Abre `http://localhost:3000/admin.html`. Las credenciales de demostración están separadas en `docs/DEVELOPMENT_DEMO.md` y nunca deben usarse en producción.

Se requiere Node.js 20 o superior. Si aparece `Cannot find module 'compression'`, ejecuta `npm ci` dentro de la carpeta que contiene `package.json`; no es un fallo del front.

## Producción

1. No ejecutes `npm run seed`.
2. Configura `NODE_ENV=production`, `SITE_URL=https://...`, `SESSION_SECRET`, `INITIAL_OWNER_EMAIL`, `INITIAL_OWNER_PASSWORD` y un `STORAGE_ROOT` persistente.
3. Inicia una sola réplica mientras se use SQLite.
4. Accede como propietario, cambia la contraseña inicial y crea un respaldo completo.
5. Crea el evento o importa el respaldo validado; publica sólo después de ejecutar los checklist.

El contenedor se detiene limpiamente ante `SIGTERM`, usa WAL, espera ante bloqueos de SQLite y conserva base, archivos y respaldos bajo el volumen persistente.

## Verificación

```bash
npm test
```

La prueba cubre sesiones y logout, registro de clientes, límites de intentos, aislamiento por evento, feature flags en backend, códigos automáticos, importación parcial, creación de mesas desde invitados, RSVP flexible, límites de menús, plano sin pista obligatoria, PDF planeado y confirmado, QR/PDF, aperturas dinámicas, invitación física automática, transferencia a cliente, plan de cortesía, música, Spotify, Excel, fotos, mensajería, respaldo, reinicio y ausencia de seed automático en producción.

## Documentos de entrega

- `AUDITORIA_RC1.md`
- `PLAN_PRODUCCION_RC1.md`
- `GUIA_RESPALDO_RESTAURACION.md`
- `GUIA_ACTUALIZACION.md`
- `GUIA_WHATSAPP_BUSINESS.md`
- `GUIA_WHATSAPP_PRODUCCION_V6_14.md`
- `GUIA_PUBLICACION_RAILWAY_V6_14.md`
- `GUIA_PLANTILLA_WHATSAPP.md`
- `GUIA_WEBHOOKS_WHATSAPP.md`
- `GUIA_REINTENTOS_WHATSAPP.md`
- `GUIA_DESPLIEGUE_ECONOMICO.md`
- `CHECKLIST_PUBLICACION_BODA.md`
- `CHECKLIST_QR_IMPRENTA.md`
- `CHECKLIST_FOTOS_MENSAJES.md`
- `ANALISIS_PLANTILLAS_VIDEOS_V6_13.md`
- `RELEASE_NOTES_V6_11_RC1.md`
- `RELEASE_NOTES_V6_12_RC1.md`
- `RELEASE_NOTES_V6_12_1_RC1.md`
- `RELEASE_NOTES_V6_13_RC1.md`
- `RELEASE_NOTES_V6_14_RC1.md`
- `RELEASE_NOTES_V6_14_1_RC1.md`
- `ESTADO_MODULOS_RC1.md`
- `VALIDACION_RC1.md`

## Datos y privacidad

- No se publican tokens, notas privadas ni archivos pendientes de moderación.
- Las fotos de invitados se sirven únicamente mediante una ruta administrativa autenticada.
- Las contraseñas se almacenan con bcrypt y las sesiones como HMAC; en producción la sesión viaja en cookie `HttpOnly`, `Secure` y `SameSite=Lax`.
- Las operaciones sensibles generan auditoría estructurada sin contraseñas, tokens ni datos bancarios.
