# Validación — Migración producción RC21 r3

## Caso específico reproducido

- esquema `plans` legacy real, sin `retention_days`, `max_published_events`, `publication_policy`, `tagline`, `public`, `featured` ni `sort_order`;
- `PRAGMA user_version = 0`;
- planes existentes preservados por ID/código;
- migración a `614210`;
- `integrity_check = ok`;
- `foreign_key_check = 0`;
- asociaciones `plan_products` conservadas;
- un único snapshot pre-migración;
- retry con `user_version=0` reutiliza el snapshot existente y no crea una tormenta de backups.

Resultado: PASS.

## Regresiones posteriores al hotfix

PASS:

- project-integrity;
- security-database;
- security-adversarial;
- commerce-migration;
- legacy-v0-production-migration;
- restore;
- origin-policy / security-headers / data-safety;
- permisos Owner/Developer/clientes;
- functional-parity: 46 controles;
- Mercado Pago;
- WhatsApp readiness;
- animation-contracts;
- RC21 visual: 59 plantillas;
- RC21 invitation journeys: 16 aperturas, preview, registro y RSVP.

En el contenedor de auditoría `better-sqlite3` se sustituyó exclusivamente para test por el adaptador `node:sqlite` incluido en `tests/support`; producción continúa usando `better-sqlite3` nativo instalado por Docker/Railway.
