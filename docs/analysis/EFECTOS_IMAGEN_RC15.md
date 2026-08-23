# Evaluación de efectos de imagen — RC15

Referencia estudiada: https://prismic.io/blog/css-image-effects

## Aceptados como principios

- zoom/scale muy sutil en hover;
- revelados/máscaras únicamente cuando aporten a una experiencia específica;
- profundidad 2.5D sólo en experiencias premium evaluadas;
- transiciones suaves de imagen;
- `prefers-reduced-motion` obligatorio.

RC15 aplica únicamente un realce ligero de escala/saturación a tarjetas de catálogo/Showcase. Es CSS local, no dependencia externa.

## Rechazados para uso general

- glitch;
- night-vision;
- distorsiones fuertes;
- 3D sliced permanente;
- efectos que dificulten texto/QR;
- animaciones que aumenten carga sin aportar al propósito del evento.

La regla sigue siendo adaptar la técnica a EventStudio, no adaptar EventStudio a una colección de efectos.
