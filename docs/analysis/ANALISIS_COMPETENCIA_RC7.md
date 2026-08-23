# Análisis de invitaciones digitales y decisiones RC7

Revisión realizada el 28 de julio de 2026 sobre las páginas compartidas. El
objetivo fue identificar patrones útiles sin copiar marcas, textos, fotografías
ni mecanismos que debiliten la seguridad de EventStudio.

## Qué aporta cada referencia

| Referencia | Qué hace bien | Aporte adaptado a EventStudio |
|---|---|---|
| [Linvia: galería de boda](https://linvia.net/galeria-disenos-boda) | Explica con claridad cuatro niveles y permite comparar una muestra visual por paquete | Tres planes públicos fáciles de distinguir y nivel visible en cada plantilla |
| [DigitalRSVP: muestra de boda](https://digitalrsvp.mx/boda-auto?id=24236) | Entrada visual, portada fotográfica, cuenta regresiva, historia, ubicaciones, galería y RSVP en un recorrido corto | Catálogo visual, apertura reproducible, mapas y confirmación dentro de una sola experiencia |
| [Momento: muestras de boda](https://momento.vip/muestras/boda) | Biblioteca de muestras y jerarquía clara entre paquetes | Buscador y filtros por celebración, nivel y palabras de estilo |
| [Daniel y Martha](https://momento.vip/i/daniel-y-martha-2026?g=9IGIlsu6aqyqu_MhV3cBlVbI) | Personalización familiar, pases, mesa, QR, Wallet, programa, mapas, hoteles, regalos y RSVP | Se conserva el enlace seguro por familia, mesa asignada, QR, programa, mapas y regalos; Wallet queda como mejora futura |
| [Gael 2026](https://momento.vip/i/gael-2026) | Cambia por completo el lenguaje visual y los textos para un cumpleaños | Plantillas y textos sugeridos según tipo de evento, no sólo “boda” con otro título |
| [Cumple Abby](https://momento.vip/i/cumple-abby) | Recorrido sencillo con padres, cuenta regresiva, programa, vestimenta, regalos, música y WhatsApp | Se reutilizan módulos maduros de EventStudio según lo contratado |
| [Reel de Facebook](https://www.facebook.com/reel/1500145581415883) | La publicación visible anuncia una invitación digital en video de Bluey | Confirma el valor de diseños temáticos; no se analizó el video completo porque Facebook exige iniciar sesión |

## Hallazgos comerciales

- La invitación y el RSVP forman el producto mínimo entendible.
- Los paquetes comparados agrupan funciones, pero el modelo de complementos
  permite atraer a quien sólo necesita música, programa, galería, QR o mesas.
- La biblioteca de plantillas vende mejor cuando primero se ve el diseño y
  después el precio.
- Una prueba breve funciona mejor si comienza privada y aclara que no genera un
  cobro automático.
- El panel cliente debe reflejar la compra: ocultar una herramienta no
  contratada reduce ruido y también evita prometer funciones sin acceso.

## Decisión de producto implementada

| Plan | Precio de referencia | Incluye |
|---|---:|---|
| Invitación Esencial | $299 MXN | Invitación, RSVP, invitados, WhatsApp manual, ubicaciones y plantillas esenciales |
| Celebración Plus | $499 MXN | Esencial más música, programa, vestimenta, regalos, galería y reportes |
| Experiencia Premium | $999 MXN | Todos los módulos que el propietario mantenga disponibles |

Los precios son configuración comercial, no valores escritos en las vistas. Se
pueden cambiar en `config/commercial-plans.json`. Los complementos también
tienen precio configurable y su activación se realiza desde el panel
propietario; RC7 no simula un checkout real.

## Nuevos mercados y tipos de evento

- Baby shower y revelación de género ya tienen textos sugeridos y plantillas
  propias.
- Español e inglés cubren el mercado principal y los invitados
  internacionales más frecuentes.
- Portugués es el tercer idioma inicial por la escala y cercanía del mercado
  brasileño y por su afinidad con experiencias móviles compartidas por
  mensajería.

La traducción de RC7 cubre controles, fechas y textos automáticos. Los mensajes
personalizados no se traducen automáticamente para no cambiar lo escrito por
el anfitrión.

## Qué se descartó o dejó para después

- No se copiaron contadores de oferta, descuentos permanentes ni escasez
  artificial.
- No se sustituyó el enlace seguro por un RSVP público basado sólo en nombre.
- Apple Wallet, pases con validación en recepción, hoteles y video de portada
  quedan como módulos futuros; requieren recorridos y pruebas propios.
- Google OAuth y pagos reales continúan ocultos hasta conectar proveedores
  completos y auditables.
