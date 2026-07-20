# WhatsApp Business: preparación de producción

EventStudio funciona desde ahora en tres modos:

- `manual`: genera enlaces `wa.me`, no necesita API y exige que una persona confirme cada envío;
- `simulation`: prueba la cola y los estados sin enviar mensajes reales;
- `whatsapp-cloud`: envía por la API oficial de WhatsApp Business Platform.

La aplicación de WhatsApp Business para teléfono puede ser gratuita, pero la automatización por Business Platform se cobra por mensaje entregado, categoría y mercado. Por eso el modo manual sigue siendo una alternativa válida para la boda y la API oficial debe activarse sólo cuando la cuenta de Meta esté lista.

## Dónde colocar las credenciales

Nunca pegues tokens en el panel, en GitHub ni dentro de un ZIP compartido. En desarrollo se escriben en un archivo `.env` local que no se confirma en Git. En Railway se agregan en **Variables** como secretos.

Para un solo número:

```dotenv
WHATSAPP_PROVIDER=whatsapp-cloud
WHATSAPP_GRAPH_VERSION=VERSION_ACTUAL_MOSTRADA_POR_META
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_INVITATION_TEMPLATE=invitacion_evento
WHATSAPP_TEMPLATE_LANGUAGE=es_MX
```

Para poder cambiar de número sin modificar código:

```dotenv
WHATSAPP_ACTIVE_PROFILE=BODA
WHATSAPP_BODA_PROVIDER=whatsapp-cloud
WHATSAPP_BODA_PHONE_NUMBER_ID=
WHATSAPP_BODA_BUSINESS_ACCOUNT_ID=
WHATSAPP_BODA_ACCESS_TOKEN=
WHATSAPP_BODA_APP_SECRET=
WHATSAPP_BODA_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_BODA_INVITATION_TEMPLATE=invitacion_evento
WHATSAPP_BODA_TEMPLATE_LANGUAGE=es_MX
WHATSAPP_BODA_GRAPH_VERSION=VERSION_ACTUAL_MOSTRADA_POR_META
```

Después puedes crear las mismas claves con prefijo `WHATSAPP_NEGOCIO_...` y cambiar únicamente:

```dotenv
WHATSAPP_ACTIVE_PROFILE=NEGOCIO
```

Al reiniciar, el panel mostrará el perfil activo y un check de cada requisito, pero jamás devolverá el token ni el secreto.

## Preparativos en Meta

1. Crea o usa un portafolio empresarial de Meta que controles tú.
2. Crea una aplicación de tipo Business y agrega el producto WhatsApp.
3. Vincula un número que puedas verificar. Decide si será el número definitivo del negocio o uno exclusivo para la boda.
4. Obtén el identificador del número y el identificador de la cuenta de WhatsApp Business.
5. Copia la versión de Graph API vigente que Meta muestre en el panel; no la dejes fija a partir de un ejemplo antiguo.
6. Crea un usuario del sistema con los permisos mínimos necesarios y genera un token de larga duración; no dependas del token temporal de pruebas.
7. Crea una plantilla aprobada. El código actual espera dos parámetros de cuerpo, en este orden: nombre de la familia y URL personalizada.
8. En Webhooks configura `https://TU-DOMINIO/api/messaging/webhook`, usa como token de verificación el valor secreto elegido y suscribe los estados de mensajes.
9. Copia el secreto de la aplicación como `APP_SECRET` para validar la firma HMAC de cada webhook.
10. Empieza con `WHATSAPP_PROVIDER=simulation`; cuando cola, reintentos y webhook estén verificados, cambia a `whatsapp-cloud`.

## Plantilla sugerida

Categoría y aprobación dependen de Meta. Mantén el contenido transaccional, claro y sin promociones:

```text
Hola {{1}}. Hemos preparado su invitación personalizada.
Consulta los detalles y confirma tu asistencia aquí: {{2}}
```

Cada invitado debe haber aceptado recibir mensajes. EventStudio conserva el modo manual y no intenta eludir las reglas, aprobaciones o cobros de Meta.

## Comprobación

1. Abre **Invitados → WhatsApp** y revisa que todas las marcas estén en verde.
2. Encola primero una invitación de prueba con un número tuyo.
3. Procesa un solo mensaje.
4. Confirma que pase por `sent`, `delivered` y, al abrirlo, `read`.
5. Verifica que un segundo intento con la misma campaña no duplique el mensaje.

Documentación oficial: [inicio de Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started), [precios de WhatsApp Business Platform](https://business.whatsapp.com/products/platform-pricing).
