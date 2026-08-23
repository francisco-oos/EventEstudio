# Validación de EventStudio 6.14.2 RC13

Fecha: 9 de agosto de 2026

## Ejecutado en este entorno

- `node --check` sobre todos los `.js` de `src`, `public`, `tests` y `scripts`: **OK**.
- `node tests/project-integrity.js`: **OK**.
- `node tests/source-references.js`: **OK**.
- `node tests/mobile-ui.js`: **OK**.
- `node tests/local-network.js`: **OK**.
- integridad estructural del ZIP final: **OK** (`unzip -t`, sin errores).

## Suite completa

Se intentó `npm ci --ignore-scripts`. El mirror npm de este entorno respondió 404 para:

`zip-stream@7.0.5`

La falla ocurre antes de instalar dependencias/transpilar/ejecutar EventStudio y no demuestra un fallo funcional de RC13. Por ello **no se declara como ejecutada** aquí la parte de la suite que requiere `better-sqlite3`, Express y demás paquetes.

En un entorno con acceso al registro npm normal ejecutar:

```bash
npm ci
npm test
```

No promover a producción si cualquiera de esas pruebas falla.

## Pruebas manuales prioritarias antes de producción

1. migrar una copia real de RC12 y verificar backup previo;
2. abrir cada Daisy Atelier en 360/390/430 px, tablet y desktop;
3. cambiar Kit de diseño y confirmar web/QR/PDF;
4. crear categoría, perfil y producto de prueba; comprobar que un producto no aprobado no puede hacerse público;
5. probar Store, búsqueda, preview y Composer;
6. crear enlace temporal y abrirlo en teléfono fuera de la sesión;
7. comprobar expiración/revocación del preview;
8. solicitar publicación como cliente con modo manual;
9. aprobar/rechazar como owner;
10. habilitar `plan_policy` sólo en staging y verificar límite de publicaciones;
11. probar `seatReleaseAt` y liberar un asiento sin borrar RSVP;
12. comprobar Showcase y Sandbox;
13. verificar atribución pequeña en web/QR/impreso;
14. regresión de WhatsApp, QR, PDFs, fotos y respaldos.
