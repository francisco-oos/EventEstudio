# Release notes — EventStudio 6.14.2-rc.20

## Corregido

- Owner y developer abren en vista técnica completa y pueden ver/configurar Jardín luminoso.
- “Vista cliente” se renombra “Simular vista cliente” y deja de estar activa por defecto.
- Preview forzado sobre `motionLevel=still` ya no colapsa a 1 ms.
- Sobre minimalista y Sello marfil tienen secuencias completas de 4.0 y 4.3 s.
- Reglas de reduced-motion ya no anulan por precedencia un preview forzado de Sello marfil.

## Añadido

- Mercado Pago Checkout Pro listo para credenciales, con webhook firmado, consulta canónica, importe/moneda e idempotencia.
- Matriz de 1,200 usuarios/eventos, cuatro perfiles y 150 cortesías.
- Matriz dedicada QR/fotos para tres mesas.
- Prueba de traducción automática ES→EN/PT.
- Prueba de preparación WhatsApp Cloud.
- Investigación documentada de confeti, partículas y SVG trazado para futuras experiencias Store.

## Conservado

- Cortesías fuera de ingresos.
- Aislamiento por evento/cuenta y validación backend de productos.
- Reduced-motion público, salida manual y degradación segura.
- Gobierno de planes, perfiles, productos y publicación en SQLite/Product Studio.
- Jardín luminoso y candidatos nuevos permanecen no públicos hasta QA física y decisión del propietario.

## Estado

Automatización PASS. Sigue siendo release candidate: faltan matriz ocular en navegadores/hardware, QR de imprenta, credenciales sandbox/productivas y despliegue HTTPS real.
