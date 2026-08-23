# EventStudio 6.14.2-rc.19

## Animaciones

- Margarita corregida: centro mayor, pétalos conectados y escala móvil legible.
- Vista previa de propietario/desarrollador puede forzar movimiento aunque Windows reduzca animaciones; la invitación pública respeta la preferencia del invitado.
- Intensidades recalibradas para ser perceptibles y botón “Omitir animación”.
- Nueva apertura gobernada **Jardín luminoso**, reinterpretada localmente a partir de la referencia entregada, sin ejecutar su código externo.
- Catálogo, producto, grant, preview y variables de color integrados sin publicación automática.

## Consola y APIs

- Sondeo de sesión opcional elimina el 401 esperado del panel sin debilitar autenticación.
- Mensajes de fotos funcionan en preview privado autorizado y continúan ocultos al público.
- UI de traducción conoce la capacidad del servidor y no llama un proveedor inexistente; captura manual ES/EN/PT preservada.
- Errores de extensiones Chrome/Edge y política `unload` clasificados y documentados como externos al código de EventStudio.

## Gobierno y calidad

- Preview de producto consulta el catálogo en vez de una lista manual divergente.
- Aperturas comerciales siguen bajo derechos, perfiles, planes y cortesías de BD.
- Suite funcional extensa, migración, seguridad, restauración, regresiones y animaciones en PASS.
- Versionado y caché actualizados a `6.14.2-rc.19`.

## Estado

RC19 es una candidata corregida y empaquetable. No se denomina estable hasta completar la revisión visual física del despliegue final y las puertas externas descritas en `VALIDACION_RC19.md`.
