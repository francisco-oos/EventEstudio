# Auditoría técnica y funcional RC12

Fecha: 7 de agosto de 2026

## Alcance

Se tomó como fuente `EventStudio-6.14.2-rc.11.zip`, cuyo SHA-256 es
`521196af90293ecf02448ab4166fe6d70a57cfca8955db009ee83a32c5b8c706`.
Se revisaron fuente, configuración, catálogo comercial, interfaz pública,
administración, pruebas, documentación, videos adjuntos y empaquetado.

## Hallazgos corregidos

| Severidad | Hallazgo | Corrección |
|---|---|---|
| Alta | 19 estilos fotográficos configurados no eran aceptados por `app.js` y caían a `cards`. | Se alineó el conjunto permitido y se añadió comportamiento CSS comprobable para cada estilo. |
| Alta | Una opción visual premium podía guardarse sin un derecho específico. | El servidor aplica autorización por producto y responde `DESIGN_PRODUCT_REQUIRED`. |
| Alta | Una experiencia ya guardada podía seguir publicándose después de perder su derecho. | `publicConfig` degrada Rosa eterna a sobre y la galería cinemática a clásico. |
| Media | 12 temas antiguos no declaraban sus metadatos estructurales. | Se completaron sus ocho campos y se exige el contrato a los 48 temas. |
| Media | Los planes con catálogo completo no enlazaban automáticamente los nuevos productos de experiencia. | Trial, Premium y Studio reciben los dos productos con `INSERT OR IGNORE`. |
| Media | La documentación vigente seguía señalando RC10. | Se añadió un índice RC12 y matriz requisito-decisión-archivo-prueba. |
| Baja | Muestra y vista previa no propagaban `photoStyle`. | Se añadió el atributo en muestra, catálogo y panel. |
| Alta | `npm audit` señaló la cadena transitiva con `brace-expansion 5.0.8` (GHSA-rgw5-rvv9-x895). | Se fijó el override compatible `^5.0.9`; instalación limpia y auditoría reportan 0 vulnerabilidades. |

## Seguridad y datos

- No se incorporaron claves, tokens, fotogramas ni código de los sitios
  analizados.
- Los derechos se resuelven en servidor a partir de plan, compra, cortesía o
  promoción activa; un control HTML no concede acceso.
- El cambio no altera ni borra eventos, invitados, fotos o pedidos.
- Las rutas administrativas conservan autenticación y el guardado conserva
  política de origen/CSRF y auditoría estructurada.
- El producto usa el esquema comercial existente y evita reconstruir la tabla
  `product_catalog`.

## Resultado de pruebas

- `npm ci`: correcto con 291 paquetes instalados desde el lockfile.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades.
- `npm test`: correcto en las 11 etapas encadenadas.
- Sintaxis Node de servidor, comercio y cuatro clientes web: correcta.
- 48 plantillas con 48 paletas de impresión y metadatos completos.
- 48 invitaciones físicas y 384 combinaciones tema × formato QR generadas en
  la prueba funcional.
- Restauración hostil y real: validada y protegida contra cuentas demo.

El SHA-256 del ZIP final se agrega después del empaquetado para no registrar un
valor circular dentro del propio archivo auditado.

## Límites

- Pago real, WhatsApp Business, OAuth de Google y traducción automática siguen
  sujetos a proveedores externos; RC12 no simula que están conectados.
- La reproducción de Spotify depende del reproductor oficial y de la política
  del navegador.
- La aceptación final en dispositivos físicos y producción requiere las
  pruebas manuales de `VALIDACION_RC12.md`.
