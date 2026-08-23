# Matriz de trazabilidad RC15

| Necesidad | Implementación RC15 | Evidencia/prueba |
|---|---|---|
| Carrito no cortado en móvil | grid responsive por áreas | `rc15-regressions.js` + prueba Android |
| No vender lo ya incluido | `productOwnedForEvent`, limpieza servidor, etiquetas | prueba Store |
| Probar ≠ agregar | rutas separadas + mensaje explícito | `previewStoreProduct` |
| Rosa fiel al concepto de floración | `RoseBloomScene` propio | renderer + preview |
| Galería gestual | Pointer Events + layout protagonista | swipe móvil |
| Logout sin menú fantasma | `.admin-layout.hidden` específica + `location.replace` | prueba móvil |
| Fotos por mesa correctas | `mesaSig` HMAC + validación evento/mesa | QR mesa A/B |
| Moderación fotográfica | filtros + conteos + ZIP | panel Fotografías |
| Hidden/draft no público | SQL `status='published'` + no-store | Showcase |
| Perfil comercial configurable | `catalog_mode` + `product_profile_links` | Mi negocio |
| Lugar físico correcto | fallback `venue/venues` | PDF físico |
| Analítica legible | humanización catálogo/tema | Mi negocio > analítica |
| Landing social | `catalogo.html` + UTM/source tracking | `catalogo.js` |
| Idiomas sin recarga obligatoria | UI_COPY + traducción estática observada | ES/EN/PT |
| Dashboard no infinito | máximo 2 `details` abiertos | Mi negocio |
