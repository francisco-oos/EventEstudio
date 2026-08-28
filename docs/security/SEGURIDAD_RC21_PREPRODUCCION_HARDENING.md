# EventStudio 6.14.2-rc.21 — hardening de seguridad preproducción

Fecha: 2026-08-27

## Alcance

Esta pasada no modifica Store, plantillas, aperturas, RSVP, QR, pagos ni reglas comerciales. Se limita a defensas de infraestructura de entrada y persistencia:

1. integridad SQLite en arranque, respaldo y restauración;
2. endurecimiento de importaciones XLSX y multipart;
3. pruebas adversariales de autenticación, archivos y exposición de la base;
4. verificación de dependencias de alto riesgo conocidas a la fecha.

## Referencias de seguridad

### Strix

Repositorio: https://github.com/usestrix/strix

Se conserva como auditor adversarial externo y referencia para categorías como control de acceso, inyección, autenticación, SSRF, XSS y lógica de negocio. No gobierna EventStudio ni se integra como dependencia de producción. En este entorno no estaban disponibles Docker ni el CLI de Strix, por lo que las categorías relevantes se reprodujeron mediante pruebas HTTP propias y contratos automatizados.

### OWASP ASVS 5.0.0

Repositorio: https://github.com/OWASP/ASVS

Se añade como segunda referencia. Complementa el enfoque adversarial de Strix con una matriz verificable de controles y cobertura. La versión estable consultada es ASVS 5.0.0.

### SQLite

Guía oficial: https://www.sqlite.org/security.html

Se adoptan controles compatibles con el proyecto: `quick_check` al inicio, `cell_size_check=ON`, `trusted_schema=OFF`, `mmap_size=0`, `foreign_keys=ON` y `foreign_key_check` después de inicializar/migrar esquema.

## Hallazgos y decisiones

### 1. Base SQLite actual

Resultado sobre una copia de `data/wedding.db` incluida en el ZIP recibido:

- `quick_check`: `ok`
- `integrity_check`: `ok`
- `foreign_key_check`: sin violaciones
- esquema: `user_version=614210`

La base real de prueba abrió correctamente con el código endurecido.

### 2. Integridad en arranque

Antes, `quick_check` se ejecutaba antes de una migración y los respaldos/restauraciones usaban `integrity_check`, pero un arranque normal de una base ya actualizada no hacía un chequeo temprano.

Corrección:

- `quick_check` inmediatamente después de abrir SQLite;
- rechazo del arranque si la base no es legible;
- `foreign_key_check` tras inicializar/migrar esquema;
- permisos `0600` para `wedding.db` cuando el sistema operativo lo soporta;
- `trusted_schema=OFF`;
- `cell_size_check=ON`;
- `mmap_size=0`.

### 3. Respaldo y restauración

Se conserva el diseño existente:

- snapshot consistente mediante API de backup SQLite;
- `integrity_check` del snapshot;
- SHA-256 de la base dentro del manifiesto;
- rechazo de checksum incorrecto al restaurar;
- límites de tamaño/entradas/descompresión;
- prevención de rutas `..` y entradas inesperadas;
- rollback previo a restauración.

Se añadió además `foreign_key_check` y los pragmas defensivos a la validación de snapshot/restauración.

### 4. Multer

El `package-lock.json` recibido ya resolvía `multer 2.2.0`, versión que corrige CVE-2026-5079 y CVE-2026-5038. Para impedir que una instalación futura retroceda conceptualmente al rango anterior, `package.json` exige ahora `^2.2.0`.

También se configuran límites de campos, partes y `fieldNestingDepth: 1`, suficiente para los formularios planos de EventStudio.

### 5. ExcelJS 4.4.0 / XLSX no confiables

El 23 de agosto de 2026 se publicó GHSA-7cvf-3r55-r39q sobre consumo de memoria al cargar XLSX comprimidos de forma maliciosa. El upstream oficial sigue en 4.4.0 sin parche.

No se sustituyó ExcelJS por un fork no oficial en esta fase. Se añadió un preflight local con `adm-zip 0.6.0` que inspecciona el directorio central antes de llamar a ExcelJS y limita:

- número de entradas;
- tamaño comprimido;
- tamaño total descomprimido declarado;
- tamaño por entrada;
- relación de compresión;
- rutas internas;
- estructura mínima XLSX.

El propio `adm-zip 0.6.0` incluye la corrección de CVE-2026-39244 para asignaciones de memoria basadas en tamaños ZIP manipulados.

### 6. Dependencias transitorias de ExcelJS

El proyecto ya contenía overrides para `uuid` y `brace-expansion`. El lock recibido resuelve:

- `uuid 11.1.1`
- `brace-expansion 5.0.9`
- `tmp 0.2.7`
- `unzipper 0.12.5`
- `archiver 8.0.0`

Se fija también `tmp ^0.2.7` mediante `overrides` para conservar el árbol corregido.

## Pruebas nuevas

### `tests/security-database.js`

Verifica:

- pragmas defensivos;
- claves foráneas;
- permisos del archivo DB;
- rechazo de una base físicamente alterada;
- aceptación de XLSX normal;
- rechazo de XLSX con compresión anómala;
- Multer >= 2.2.0.

### `tests/security-adversarial.js`

Prueba contra un servidor real de test:

- endpoint de backups sin autenticación -> `401`;
- intento de SQLi en login -> `401`;
- sexto intento de contraseña errónea -> `429`;
- XLSX tipo bomba -> `400` y servidor sigue saludable;
- `/data/wedding.db` -> `404`;
- intento de path traversal hacia DB -> no obtiene `200`.

### Comando consolidado

```bash
npm run test:security
```

Ejecuta también headers, Origin/CSRF, data safety, restore, permisos, Mercado Pago y WhatsApp readiness.

## Riesgos residuales

1. ExcelJS 4.4.0 seguirá apareciendo en algunos scanners por el advisory aunque EventStudio aplique mitigación previa. Revisar una futura versión oficial antes de cambiar de librería.
2. El rate-limit de login es en memoria. Es adecuado para una instancia inicial, pero en despliegue multi-réplica deberá moverse a almacenamiento compartido o al borde/proxy.
3. `npm audit` no pudo consultar `registry.npmjs.org` desde el contenedor de auditoría por bloqueo de red. La revisión de advisories actuales se hizo contra GitHub Advisory Database y versiones resueltas del `package-lock`.
4. Strix no fue ejecutado porque este runtime no dispone de Docker/CLI. La suite adversarial local cubre los vectores críticos identificados; Strix podrá ejecutarse posteriormente contra staging autorizado, nunca contra terceros.
