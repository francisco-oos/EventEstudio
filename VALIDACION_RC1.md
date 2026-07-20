# Validación técnica 6.11.0 RC1

Fecha: 17 de julio de 2026.

## Resultado local

| Verificación | Resultado |
|---|---|
| `npm ci` desde `package-lock.json` | Correcto, 359 dependencias de producción |
| `npm audit --omit=dev` | 0 vulnerabilidades conocidas |
| `node --check` en servidor, frontend y pruebas | Correcto |
| JSON de configuración | Correcto |
| `npm test` | Correcto: `Pruebas funcionales 6.11.0-rc.1 completadas` |
| Reinicio del servidor | Sesión, invitados, música, fotos y mensajes persistieron |
| Respaldo | ZIP descargado, SHA-256 presente, SQLite extraído e `integrity_check=ok` |
| Excel | Plantilla legible; reporte abierto con nueve hojas esperadas |
| PDF/QR | Ocho formatos y una invitación física válidos, dimensiones correctas y fuentes incrustadas |
| Dependencias demo en producción | Seed rechazado, sin evento automático y pagos demo deshabilitados |

## Cobertura funcional principal

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

1. Construcción de la imagen en Railway o en un equipo con Docker; el entorno de revisión no dispone de motor Docker.
2. Despliegue HTTPS con volumen `/app/storage` y ensayo de restauración en un segundo volumen.
3. Envío y webhook reales con una cuenta Meta, número y plantilla aprobados.
4. Escaneo físico de los QR impresos al 100 % con varios teléfonos y condiciones de luz.
5. Prueba de carga desde iPhone y Android sobre la red celular que usarán los invitados.

Estos puntos requieren infraestructura o dispositivos externos y por eso no se declaran aprobados en esta entrega.
