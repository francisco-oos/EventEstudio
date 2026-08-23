# Decisiones técnicas — EventStudio 6.14.2-rc.19

## Base y precedencia

RC19 parte exclusivamente del ZIP `EventStudio-6.14.2-rc.18.zip` entregado por el propietario (SHA-256 `17bf423439c345b8b358ce871f1fd7b34c906283794e38fb7add27c94f5c6a1a`). Se revisaron primero README, documentación histórica RC13–RC18, catálogos, fronteras de autorización y pruebas existentes. Las decisiones RC19 prevalecen únicamente en los componentes modificados.

## Decisiones y razonamiento

| Tema | Decisión | Razón y protección de regresión |
|---|---|---|
| Movimiento desactivado en Windows | La invitación pública respeta `prefers-reduced-motion`; sólo una vista previa solicitada explícitamente por propietario/desarrollador añade `force-motion`. | Permite comprobar visualmente una apertura sin quitar la preferencia de accesibilidad a los invitados. Se valida en `tests/animation-contracts.js`. |
| Margarita pequeña y pétalos separados | Centro de 88 px, pétalos de 38 × 94 px, traslación final de 30 px y escala móvil 0.78. | El radio del centro supera la traslación radial por 14 px, creando un solape visible y comprobable. |
| Velocidad | Los niveles cambian riqueza, no vuelven imperceptible la escena: suave 1.20×, equilibrado 1.08× y dinámico 0.98×. | Evita que “dinámico” se convierta en un salto instantáneo en equipos rápidos. Las escenas florales conservan al menos 3.9 s visibles. |
| Cierre de apertura | Botón visible “Omitir animación” y tecla Escape. | Ninguna animación debe bloquear la invitación. El modo sin movimiento finaliza rápidamente en estado estático. |
| `Animated Flower.zip` | Se analizó como referencia y se creó un renderer local nuevo, `LuminousGardenScene`, con contrato `start/bloom/destroy`. No se copió el documento ejecutable externo. | El ZIP contiene HTML/CSS/JS autónomos y no declara licencia. La adaptación evita ejecutar código externo, dependencias SCSS/Compass o estilos globales. |
| Registro de experiencias | `luminous-garden` se incorpora en `config/experiences.json` y comercio con código y grant propios; queda no público por defecto. | La existencia técnica no concede ni publica el producto. El propietario conserva disponibilidad, precio, perfil, plan y cortesías. |
| 401 en `/api/auth/me` | Se preserva el 401 normal; el panel usa `?optional=1`, que responde 200 con `authenticated:false` al sondear una sesión inexistente. | Elimina ruido esperado sin debilitar la ruta protegida ni simular autenticación. |
| 404 de mensajes en preview | La API permite leer mensajes de un evento no publicado sólo si `previewAllowed` valida sesión con acceso o token de preview vigente. El cliente propaga esos parámetros. | La vista previa deja de repetir 404, pero el público anónimo sigue recibiendo 404. |
| 503 de traducción | El catálogo anuncia `capabilities.automaticTranslation`. Sin proveedor, el botón queda deshabilitado y la traducción manual permanece disponible. | No se hacen solicitudes condenadas a fallar. La ruta conserva 503 si un cliente intenta llamarla sin proveedor; esto es un contrato correcto, no una falsa traducción local. |
| Errores `content.js` / `chrome-extension://` | No se añadió ningún workaround a EventStudio. | `Extension context invalidated` y `Receiving end does not exist` pertenecen a extensiones del navegador. Capturarlos desde la aplicación ocultaría fallos ajenos y no los corregiría. |
| Violación de política `unload` | EventStudio no registra `unload`; se mantiene sin ese evento. | El aviso procede del contenedor/extensión que intenta usar una capacidad prohibida. La solución segura es no introducirla. |
| Datos y código estático | Los IDs de renderers son una allowlist de ejecución en código; productos, perfiles, planes, precios, concesiones y publicación permanecen gobernados por catálogo/BD. | Un renderer no puede llegar desde la BD como JavaScript arbitrario. Esto es una frontera de seguridad, no hardcodeo comercial. |

## Referencia Animated Flower

- Archivo revisado: `Animated Flower.zip`.
- SHA-256: `26d49671bedbe9b163664261dbd89b28ab03f34d297a8c7b99fac200baf437cb`.
- Contenido: `index.html`, `style.css`, `script.js`.
- Licencia: no incluida.
- Resultado: reinterpretación visual propia con tres flores (38 pétalos), 18 estrellas y 12 luces, variables de color seguras y estados accesibles.

## Regla para continuar

Una experiencia nueva debe registrarse en el catálogo, tener renderer local o CSS conocido, producto/grant si es comercial, fallback estático, salida manual, cobertura móvil y prueba de autorización. Una vista previa nunca concede derechos ni altera el evento publicado.
