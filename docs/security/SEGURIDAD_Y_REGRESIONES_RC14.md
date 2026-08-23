# Seguridad y regresiones — RC14

## Principios conservados
- El rol de seguridad no depende del perfil comercial.
- `owner/developer` continúan gobernando catálogo, planes, perfiles y cortesías.
- El frontend nunca concede derechos; el servidor calcula entitlement y vuelve a comprobarlo al checkout.
- SQL sensible usa consultas preparadas/parametrizadas.
- IDs y enums recibidos se validan/normalizan antes de mutar estado.

## Rutas revisadas
- `/api/admin/commerce/products`
- `/api/admin/commerce/plans`
- `/api/admin/commercial-profiles`
- `/api/admin/events/:id/grants`
- `/api/admin/clients/:id/commercial-controls`

Todas requieren autenticación y `ownerOnly` para sus mutaciones sensibles.

## Referencias
- OWASP SQL Injection Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html

## Nota
Ningún release debe declararse “inmune” a inyección. La seguridad se conserva mediante capas, regresiones, mínimo privilegio y actualización continua.
