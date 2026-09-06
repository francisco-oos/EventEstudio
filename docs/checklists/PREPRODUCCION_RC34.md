# Puerta de preproducción RC34

1. `npm ci`
2. `npm run test:preproduction`
3. `npm audit --audit-level=moderate`
4. Revisar físicamente en Android/iOS:
   - apertura seleccionada y `Probar apertura`;
   - orden recomendado de Recipes;
   - aplicar Recipe y confirmar overrides;
   - sobre: abrir Stationery sólo con `unified-envelope`;
   - nombres largos sin corte interno;
   - contraste de portada y secciones;
   - música, RSVP, galería, QR y enlaces;
   - cuentas owner/developer/client y cortesías/planes disponibles.
5. Sólo tras PASS completo desplegar el ZIP RELEASE.
