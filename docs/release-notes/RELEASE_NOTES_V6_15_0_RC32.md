# EventStudio 6.15.0-rc.32

## Design Engine

RC32 inicia la sustitución del crecimiento por plantillas estáticas mediante un motor basado en Assets, Components y Design Recipes v2.

### Nuevo

- Design Lab integrado al administrador.
- AssetManifest con búsqueda, categorías, paginación y carga bajo demanda.
- posicionamiento visual de assets con X/Y, escala, rotación, z-index, opacidad, tono y motion;
- 64 Recipes iniciales migradas desde el catálogo existente;
- miniaturas SVG derivadas de Recipe;
- 34 presentaciones fotográficas;
- 103 skins funcionales;
- 16 motion timelines;
- texturas controladas por Recipe;
- Color Studio con diez armonías y audit de contraste;
- recomendación comercial basada en capacidades seleccionadas;
- proyección pública de Recipe filtrada por entitlements.

### Preservado

- RSVP productivo;
- galería y lightbox;
- ubicación y agenda;
- regalos;
- QR;
- música subida y Spotify;
- Stationery / sobre / lacre;
- aperturas existentes;
- permisos y comercio.

### Correcciones detectadas por QA

- drag de assets con `currentTarget` inválido;
- overflow móvil en layouts botanical/split/scrapbook;
- superposición entre selector de idioma y música;
- pointer capture de galería bloqueando clic de mouse;
- harness RC30 actualizado al nuevo loader.

### Fuera de alcance

- VideoRenderer permanece en laboratorio/futuro.
- el generador utilitario de ZIP no se modifica en este sprint.
