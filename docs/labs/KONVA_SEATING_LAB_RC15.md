# Konva Seating Lab — decisión RC15

Referencia: https://konvajs.org/docs/sandbox.html
Licencia: https://github.com/konvajs/konva/blob/master/LICENSE

Konva ofrece demos oficiales cercanas a EventStudio: Seats Reservation, Canvas Editor, Responsive Canvas Stage, Objects Snapping, Touch Gestures, Scale Image to Fit y Canvas to PDF.

## Veredicto

Aprobado para **PoC aislado**, no para reemplazo inmediato del plano estable.

## Prueba comparativa futura

El mismo archivo de seating deberá poder abrirse en:
- renderer actual;
- `KonvaSeatingAdapter` experimental.

Criterios de promoción:
- mover una persona no mueve otras;
- mesas redondas/cuadradas y capacidad;
- familia/grupo;
- drag, resize, rotate, snap, zoom/pinch;
- 25/50/100 mesas;
- undo/redo;
- responsive móvil;
- serialización independiente de Konva;
- exportación PDF/imagen;
- memoria/CPU mejores o al menos equivalentes al editor actual.

La fuente de verdad seguirá siendo el modelo EventStudio, no el JSON propietario del renderer.
