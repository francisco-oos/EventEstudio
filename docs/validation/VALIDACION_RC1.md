# Validación técnica 6.14.2 RC1

Fecha: 27 de julio de 2026.

## Resultado local

| Verificación | Resultado |
|---|---|
| Estructura del ZIP de entrada | Correcta: sin secretos, base, fotos, respaldos, dependencias ni Git |
| `npm ci` desde `package-lock.json` | Correcto desde una extracción limpia |
| `npm audit --omit=dev` | 0 vulnerabilidades conocidas |
| `node --check` en servidor, frontend y pruebas | Correcto |
| JSON de configuración | Correcto |
| Identidad y textos multi-evento | Correcto: EventStudio unificado y textos genéricos sin supuestos de boda |
| Detección de red local | Correcto con Wi-Fi, adaptador virtual, IP preferida y validación de puerto |
| `npm test` | Correcto: integridad, red local, regresión 6.14.2 y restauración |
| Reinicio del servidor | Sesión, invitados, música, fotos y mensajes persistieron |
| Respaldo | ZIP descargado, SHA-256 presente, SQLite extraído e `integrity_check=ok` |
| Excel | Plantilla legible; reporte abierto con nueve hojas esperadas |
| PDF/QR | Ocho formatos y una invitación física válidos, dimensiones correctas y fuentes incrustadas |
| Dependencias demo en producción | Seed rechazado, sin evento automático y pagos demo deshabilitados |
| Lanzadores | Windows y Linux incluidos; ambos delegan en un único iniciador para evitar lógica duplicada |
| Hermeticidad | Correcta: la regresión fija su entorno y no depende del `.env` local |

## Cobertura funcional principal

- identidad del paquete, textos multi-evento, JSON y escucha explícita en red;
- detección de IP privada, preferencia de adaptador, URL para teléfono y puerto válido;
- login correcto/incorrecto, cookie, logout, límite de intentos y roles;
- aislamiento entre eventos y rechazo backend de módulos no autorizados;
- alta, edición, duplicado, límite de plan, importación parcial y borrado individual/múltiple de invitados;
- RSVP confirmado/rechazado, cupos, valores inválidos, niño, restricción, accesibilidad y responsable;
- `wa.me`, cola idempotente, teléfono ausente, cancelación, firma de webhook, fallo y reintento;
- carga/eliminación/persistencia de música local, Spotify válido/inválido y segundo inicial;
- plano planeado/confirmado, persistencia, cruces y asiento ocupado;
- fotografía válida/inválida, duplicado, mensaje vacío/largo, máximo de archivos y moderación;
- reporte Excel, nueve PDFs de impresión, respaldo íntegro y reinicio sin pérdida.

## Evidencia de impresión

`output/pdf` contiene los nueve PDFs generados y dos láminas de validación. La revisión visual no mostró texto superpuesto, recortes ni invasión de la zona silenciosa. Las mitades superiores invertidas de los formatos plegables son intencionales para quedar orientadas después del doblez.

## Validaciones externas pendientes

1. Ejecutar `INICIAR.bat` en el Windows real y recorrer el panel desde el Android del usuario; esta validación requiere ambos dispositivos en la misma LAN.
2. Probar físicamente Spotify real en Android y iPhone; los navegadores pueden imponer políticas distintas de reproducción.
3. Construir la imagen en Railway o en un equipo con Docker.
4. Desplegar por HTTPS con volumen `/app/storage` y ensayar restauración en un segundo volumen.
5. Enviar y recibir webhooks reales con una cuenta Meta, número y plantilla aprobados.
6. Escanear físicamente los QR impresos al 100 % con varios teléfonos y condiciones de luz.

Estos puntos requieren infraestructura o dispositivos externos y por eso no se declaran aprobados en esta entrega.
