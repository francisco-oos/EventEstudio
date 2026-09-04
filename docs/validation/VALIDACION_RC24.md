# Validación EventStudio 6.14.2-rc.24

## Alcance

RC24 modifica exclusivamente el módulo de Regalos sobre la base RC23. Mantiene vigentes los criterios de aceptación de perfiles, multi-tenancy, plantillas, animaciones e invitaciones públicas definidos en RC23.

## Casos nuevos

1. Transferencia bancaria con Openpay apagado.
2. Transferencia bancaria con sólo CLABE.
3. Transferencia bancaria con sólo número de cuenta.
4. Transferencia bancaria con ambos datos y campos adicionales.
5. Datos bancarios desactivados: el bloque público no debe renderizarse.
6. Openpay activado con monto sugerido.
7. Openpay activado con monto sugerido vacío: el invitado captura el monto.
8. Openpay desactivado: no se inicializa el SDK por interacción del bloque de regalos.
9. Mensajes habilitados: catálogo por tipo de evento y opción personalizada.
10. Mensajes deshabilitados: no se muestra el selector ni el textarea.
11. Compatibilidad con `gifts.bankInfo` de eventos anteriores.

## Validaciones ejecutables sin dependencias nativas

- `node --check public/admin.js`
- `node --check public/app.js`
- `node --check src/server.js`
- `node --check src/gift-settings.js`
- `node --check src/gift-message-presets.js`
- `node tests/rc24-gifts.js`
- `python3 tests/rc24-gifts-visual.py`
- contratos estáticos preexistentes que no requieren SQLite nativo.

## Puerta de promoción

RC24 continúa siendo candidata QA hasta ejecutar en un runner con dependencias reales:

```bash
npm ci
npm test
npm run test:rc23
npm run test:rc24
npm run test:visual
npm run audit
npm audit --audit-level=moderate
```

Un bloqueo de red o de dependencias no se interpreta como PASS.
