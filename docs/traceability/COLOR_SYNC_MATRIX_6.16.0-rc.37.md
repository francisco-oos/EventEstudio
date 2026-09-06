# Matriz de sincronización de color — 6.16.0-rc.37

Resolver canónico: `ensureAccessiblePalette` en servidor y su equivalente navegador. Tokens base: `bg`, `paper`, `ink`, `muted`, `headingColor`, `bodyColor`, `accent`, `accent-dark`, `gold`, `line`. Alias semánticos derivados: `background`, `textPrimary`, `textSecondary`, `textMuted`, `accentSecondary`, `textOnAccent`, `textOnPaper`, `textOnBackground`, `highlight`, `linkColor`, `ctaBackground`, `ctaText`, `borderColor`.

| Canal | Fuente | Adaptación | Evidencia | Estado RC37 |
|---|---|---|---|---|
| Editor | DRAFT + Color Engine | CSS vars de canvas | V5/rc35 | PASS lógico |
| Preview | DRAFT autorizado | renderer público | V5 hash/payload | PASS de datos; visual NOT_RUN |
| Público | ACTIVE | renderer público | V5 hash/payload | PASS de datos; visual NOT_RUN |
| Thumbnail | Recipe | SVG reactivo | rc31/V5 | PASS estructural |
| Álbum/fotos | `_palette` ACTIVE | variables propias | rc33 | PASS lógico |
| QR/QR mesa | paleta ACTIVE | foreground con contraste/quiet zone prioritarios | qr-photo-matrix/rc33 | PASS funcional; escaneo físico NOT_RUN |
| Tarjeta/invitación física/PDF | descriptor de tema ACTIVE | familia print + paleta | rc30/33 | PASS funcional; visual NOT_RUN |
| Stationery/sobre/lacre | draft especializado/ACTIVE tras Apply | tokens coordinados sólo para sobre autoritativo | rc27–30/V5 | PASS lógico; visual NOT_RUN |

El editor avisa cuando el color elegido no alcanza AA sobre todas las superficies. La vista usa una variante legible, muestra cuáles tokens se adaptaron y ofrece “Ajustar colores automáticamente” para aceptar el cambio explícitamente.
