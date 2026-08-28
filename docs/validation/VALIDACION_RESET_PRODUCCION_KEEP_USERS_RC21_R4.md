# Validación — reset productivo preservando usuarios

Caso automatizado `tests/production-reset-keep-users.js`:

- Crea Owner, Developer y Client.
- Conserva `password_hash`, rol, estado e IDs.
- Conserva suscripción y controles comerciales.
- Simula $10,796 MXN en pagos más una orden adicional.
- Crea evento y asignación.
- Agrega multimedia activa.
- Ejecuta reset.
- Verifica ingreso=0, eventos=0, pagos=0, órdenes=0.
- Verifica usuarios/accesos byte-lógicamente equivalentes.
- Verifica `foreign_key_check` limpio e `integrity_check=ok`.
- Verifica multimedia archivada y carpetas activas vacías.
- Verifica snapshots pre/post-reset.

Resultado: PASS.

También se repitieron después de incorporar el script:
- migración v0→614210: PASS
- seguridad BD/XLSX: PASS
- auditoría adversarial HTTP: PASS
- data safety: PASS
- restore: PASS
- Owner/Developer/Client: PASS
- paridad funcional extendida (46 controles): PASS
