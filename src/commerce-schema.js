"use strict";

const commercialPlans=require("../config/commercial-plans.json");
const themes=require("../config/themes.json");
const {catalog:featureCatalog}=require("./features");

function ensureColumn(db,table,column,definition){
  const columns=db.prepare(`PRAGMA table_info(${table})`).all();
  if(!columns.some(item=>item.name===column)){
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initialize(db){
  ensureColumn(db,"users","preferred_locale","TEXT NOT NULL DEFAULT 'es'");
  ensureColumn(db,"plans","tagline","TEXT");
  ensureColumn(db,"plans","public","INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"plans","featured","INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db,"plans","sort_order","INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db,"plans","retention_days","INTEGER NOT NULL DEFAULT 30");
  ensureColumn(db,"plans","max_published_events","INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db,"plans","publication_policy","TEXT NOT NULL DEFAULT 'manual_owner'");

  db.exec(`
    CREATE TABLE IF NOT EXISTS product_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK(kind IN ('feature','bundle','template_collection','template','storage')),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL DEFAULT 0 CHECK(price_cents>=0),
      currency TEXT NOT NULL DEFAULT 'MXN',
      commercial_status TEXT NOT NULL DEFAULT 'available' CHECK(commercial_status IN ('available','experimental','hidden','disabled')),
      public INTEGER NOT NULL DEFAULT 1,
      grants_json TEXT NOT NULL DEFAULT '[]',
      dependencies_json TEXT NOT NULL DEFAULT '[]',
      event_types_json TEXT NOT NULL DEFAULT '["*"]',
      storage_mb INTEGER NOT NULL DEFAULT 0 CHECK(storage_mb>=0),
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plan_products (
      plan_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(plan_id,product_id),
      FOREIGN KEY(plan_id) REFERENCES plans(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES product_catalog(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('purchase','courtesy','promotion','legacy')),
      source_reference TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
      starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ends_at TEXT,
      usage_limit INTEGER CHECK(usage_limit IS NULL OR usage_limit>0),
      usage_used INTEGER NOT NULL DEFAULT 0 CHECK(usage_used>=0),
      storage_mb INTEGER NOT NULL DEFAULT 0 CHECK(storage_mb>=0),
      granted_by INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES product_catalog(id),
      FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      audience_plan_code TEXT,
      event_type TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','ended')),
      starts_at TEXT,
      ends_at TEXT,
      note TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS promotion_products (
      promotion_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      PRIMARY KEY(promotion_id,product_id),
      FOREIGN KEY(promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES product_catalog(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','submitted','abandoned')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      cart_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 100),
      unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(cart_id,product_id),
      FOREIGN KEY(cart_id) REFERENCES carts(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES product_catalog(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      cart_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment','paid','cancelled','refunded')),
      subtotal_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'MXN',
      provider TEXT,
      provider_reference TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(cart_id) REFERENCES carts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_cents INTEGER NOT NULL,
      PRIMARY KEY(order_id,product_id),
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES product_catalog(id)
    );

    CREATE TABLE IF NOT EXISTS account_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      event_id INTEGER,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS store_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '✦',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_category_links (
      product_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(product_id,category_id),
      FOREIGN KEY(product_id) REFERENCES product_catalog(id) ON DELETE CASCADE,
      FOREIGN KEY(category_id) REFERENCES store_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_profile_links (
      product_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(product_id,profile_id),
      FOREIGN KEY(product_id) REFERENCES product_catalog(id) ON DELETE CASCADE,
      FOREIGN KEY(profile_id) REFERENCES customer_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS account_commercial_controls (
      user_id INTEGER PRIMARY KEY,
      customer_profile_id INTEGER,
      max_events_override INTEGER,
      max_published_events_override INTEGER,
      publication_policy_override TEXT,
      note TEXT NOT NULL DEFAULT '',
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_profile_id) REFERENCES customer_profiles(id) ON DELETE SET NULL,
      FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS publication_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled','auto_approved')),
      requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      decided_at TEXT,
      decided_by INTEGER,
      note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(decided_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS conversion_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      user_id INTEGER,
      event_id INTEGER,
      event_name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'web',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS preview_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      event_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_opened_at TEXT,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS showcase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL DEFAULT 'demo' CHECK(source_type IN ('demo','event_snapshot')),
      source_event_id INTEGER,
      theme_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      event_type TEXT NOT NULL DEFAULT 'custom',
      asset_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','hidden')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      snapshot_json TEXT NOT NULL DEFAULT '{}',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(source_event_id) REFERENCES events(id) ON DELETE SET NULL,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_status ON product_catalog(commercial_status,public,active,sort_order);
    CREATE INDEX IF NOT EXISTS idx_grants_event_status ON event_grants(event_id,status,ends_at);
    CREATE INDEX IF NOT EXISTS idx_promotions_status_dates ON promotions(status,starts_at,ends_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_open_cart_per_event ON carts(user_id,event_id) WHERE status='open';
    CREATE INDEX IF NOT EXISTS idx_orders_user_event ON orders(user_id,event_id,status,created_at);
    CREATE INDEX IF NOT EXISTS idx_account_notifications_user ON account_notifications(user_id,read_at,created_at);
    CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_category_links(category_id,sort_order,product_id);
    CREATE INDEX IF NOT EXISTS idx_publication_requests_status ON publication_requests(status,requested_at);
    CREATE INDEX IF NOT EXISTS idx_conversion_events_name_time ON conversion_events(event_name,created_at);
    CREATE INDEX IF NOT EXISTS idx_conversion_events_event ON conversion_events(event_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_preview_links_event ON preview_links(event_id,expires_at);
    CREATE INDEX IF NOT EXISTS idx_showcase_status_order ON showcase_items(status,sort_order,id);
  `);

  ensureColumn(db,"account_notifications","product_id","INTEGER");
  ensureColumn(db,"account_notifications","grant_id","INTEGER");

  ensureColumn(db,"product_catalog","readiness_status","TEXT NOT NULL DEFAULT 'approved'");
  ensureColumn(db,"product_catalog","release_version","TEXT NOT NULL DEFAULT ''");
  ensureColumn(db,"product_catalog","presentation_slot","TEXT NOT NULL DEFAULT 'feature'");
  ensureColumn(db,"product_catalog","preview_strategy","TEXT NOT NULL DEFAULT 'none'");
  ensureColumn(db,"product_catalog","preview_manifest_json","TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db,"customer_profiles","recommendations_json","TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db,"customer_profiles","catalog_mode","TEXT NOT NULL DEFAULT 'all'");

  const categorySeed=[
    ["essentials","Esenciales","Lo necesario para publicar y compartir el evento.","✦",10],
    ["templates","Diseños y estilos","Plantillas y colecciones visuales compatibles con el evento.","✿",20],
    ["animations","Aperturas y experiencias","Animaciones y experiencias visuales que se pueden probar antes de comprar.","◇",30],
    ["logistics","Invitados y organización","RSVP, mesas, menús y herramientas operativas.","◎",40],
    ["photos","Fotos y recuerdos","Álbum colaborativo, QR y almacenamiento.","▣",50],
    ["print","Impresos y QR","Piezas físicas coordinadas con la identidad del evento.","▤",60]
  ];
  const upsertCategory=db.prepare(`
    INSERT INTO store_categories(code,name,description,icon,sort_order,active) VALUES(?,?,?,?,?,1)
    ON CONFLICT(code) DO NOTHING
  `);
  categorySeed.forEach(row=>upsertCategory.run(...row));

  const profileSeed=[
    ["couple-diy","Pareja / organizador particular","Experiencia guiada para organizar un evento propio sin saturar de herramientas.",10,["templates","animations","logistics","photos","print"]],
    ["family-simple","Familia / evento sencillo","Flujo compacto para una invitación bonita, RSVP y funciones esenciales.",20,["essentials","templates","logistics"]],
    ["planner","Planner profesional","Prioriza operación repetible, múltiples eventos, invitados, mesas y reportes.",30,["logistics","photos","print","templates"]],
    ["company","Empresa","Prioriza identidad de marca, asistentes, agenda, QR, reportes y publicación controlada.",40,["essentials","logistics","print","templates"]]
  ];
  const upsertProfile=db.prepare(`
    INSERT INTO customer_profiles(code,name,description,sort_order,recommendations_json,active) VALUES(?,?,?,?,?,1)
    ON CONFLICT(code) DO NOTHING
  `);
  profileSeed.forEach(([code,name,description,sortOrder,recommendations])=>
    upsertProfile.run(code,name,description,sortOrder,JSON.stringify(recommendations))
  );

  const settingSeed=db.prepare(`INSERT OR IGNORE INTO platform_settings(key,value_json) VALUES(?,?)`);
  settingSeed.run("publication",JSON.stringify({mode:"manual_owner"}));
  settingSeed.run("branding",JSON.stringify({
    proofWatermarkEnabled:true,
    attributionEnabled:true,
    attributionLabel:"Creado con EventStudio",
    attributionUrl:"",
    attributionOnInvitation:true,
    attributionOnPrint:true,
    attributionOnQr:true
  }));
  settingSeed.run("preview",JSON.stringify({defaultMinutes:120,maxMinutes:1440}));

  /* RC17: los límites y la política de publicación son decisiones operativas del
     propietario. Los valores por defecto sólo se aplican al crear un plan nuevo;
     el arranque nunca vuelve a escribir una decisión guardada en la base. */

  const planMetadata=db.prepare(`
    UPDATE plans SET tagline=?,public=?,featured=?,sort_order=?
    WHERE code=? AND tagline IS NULL
  `);
  commercialPlans.plans.forEach((plan,index)=>planMetadata.run(
    plan.tagline||"",plan.public?1:0,plan.featured?1:0,index,plan.code
  ));

  const seeds=[];
  featureCatalog.forEach((feature,index)=>seeds.push({
    code:`feature:${feature.key}`,kind:"feature",name:feature.label,
    description:`Acceso al módulo ${feature.label}.`,priceCents:0,
    status:feature.defaultState,public:false,grants:[feature.key],
    dependencies:[],eventTypes:["*"],storageMB:0,sortOrder:index
  }));

  [
    {code:"bundle:invitation",name:"Invitación digital",description:"Invitación, ubicaciones, música, galería y apertura.",priceCents:19900,grants:["invitation","locations","templates","music","gallery","thematicExperience"],eventTypes:["*"]},
    {code:"bundle:rsvp",name:"Invitados y confirmaciones",description:"Gestión de invitados, RSVP y envío manual individual.",priceCents:14900,grants:["guests","rsvp","whatsappManual"],eventTypes:["wedding","xv","birthday","kids-party","anniversary","baby-shower","gender-reveal","baptism","first-communion","graduation","corporate","custom"]},
    {code:"bundle:program",name:"Programa y ubicaciones",description:"Itinerario y navegación del evento.",priceCents:9900,grants:["program","locations"],eventTypes:["*"]},
    {code:"bundle:dress",name:"Vestimenta",description:"Código de vestimenta e inspiración visual.",priceCents:7900,grants:["dressCode"],eventTypes:["wedding","xv","anniversary","graduation","corporate","custom"]},
    {code:"bundle:gifts",name:"Regalos",description:"Mesa de regalos, sobres o transferencia.",priceCents:7900,grants:["gifts"],eventTypes:["wedding","xv","birthday","kids-party","anniversary","baby-shower","baptism","first-communion","graduation","custom"]},
    {code:"bundle:photos",name:"Álbum colaborativo",description:"Fotografías y mensajes de los invitados.",priceCents:14900,grants:["guestPhotoUpload","guestPhotoMessages"],eventTypes:["*"],storageMB:500},
    {code:"bundle:photo-qr",name:"QR para fotografías",description:"QR por mesa conectado al álbum colaborativo.",priceCents:22900,grants:["qrCards"],dependencies:["bundle:photos"],eventTypes:["*"],storageMB:500},
    {code:"bundle:physical",name:"Invitaciones físicas",description:"Generación imprimible independiente del álbum y los QR.",priceCents:9900,grants:["physicalInvitations"],eventTypes:["*"]},
    {code:"bundle:seating",name:"Plano y mesas",description:"Invitados, distribución y asignación de lugares.",priceCents:14900,grants:["seating","guests"],eventTypes:["wedding","xv","birthday","kids-party","anniversary","baby-shower","baptism","first-communion","graduation","corporate","custom"]},
    {code:"bundle:menus",name:"Menús y restricciones",description:"Opciones, alergias y necesidades especiales.",priceCents:9900,grants:["menus"],eventTypes:["wedding","xv","birthday","kids-party","anniversary","baby-shower","baptism","first-communion","graduation","corporate","custom"]},
    {code:"bundle:reports",name:"Reportes operativos",description:"Exportaciones y resumen de operación.",priceCents:7900,grants:["reports"],eventTypes:["*"]},
    {code:"experience:rose-bloom",name:"Apertura Rosa eterna",description:"Apertura interactiva original con pétalos, revelado ceremonial y alternativa sin movimiento.",priceCents:5900,grants:["opening:rose-bloom"],eventTypes:["wedding","xv","anniversary"]},
    {code:"experience:cinematic-depth",name:"Galería Historia cinemática",description:"Carrusel fotográfico con profundidad, enfoque central y navegación accesible.",priceCents:6900,grants:["galleryStyle:cinematic-depth"],eventTypes:["wedding","xv","birthday","anniversary","graduation","custom"]},
    {code:"experience:particle-heart",name:"Corazón de partículas",description:"Apertura original en Canvas: partículas dibujan un corazón luminoso, con adaptación de rendimiento y alternativa de movimiento reducido.",priceCents:5900,grants:["opening:particle-heart"],eventTypes:["wedding","xv","anniversary","custom"]},
    {code:"experience:ivory-seal",name:"Sello marfil ceremonial",description:"Apertura editorial con sello, pliegue suave y alternativa estática para movimiento reducido.",priceCents:4900,grants:["opening:ivory-seal"],eventTypes:["wedding","xv","anniversary","baptism","first-communion","custom"],public:false},
    {code:"experience:daisy-bloom",name:"Margarita en flor",description:"Apertura floral ligera con pétalos progresivos, adaptación por nivel de movimiento y alternativa estática.",priceCents:5900,grants:["opening:daisy-bloom"],eventTypes:["wedding","xv","birthday","baby-shower","baptism","first-communion","custom"],public:false},
    {code:"experience:luminous-garden",name:"Jardín luminoso",description:"Apertura nocturna con tres flores progresivas, luces ambientales, movimiento gobernado y alternativa estática accesible.",priceCents:6900,grants:["opening:luminous-garden"],eventTypes:["wedding","xv","birthday","anniversary","graduation","custom"],public:false},
    {code:"experience:night-flower-original",name:"Flor nocturna original",description:"Composición nocturna de cuatro pétalos por flor, pradera progresiva, luces ambientales, colores ajustables y alternativa estática accesible.",priceCents:6900,grants:["opening:night-flower-original"],eventTypes:["wedding","xv","birthday","anniversary","graduation","custom"],public:false},
    {code:"experience:focus-strip",name:"Tira de enfoque",description:"Galería táctil con foto protagonista, tira navegable y controles compatibles con mouse, teclado y touch.",priceCents:5900,grants:["galleryStyle:focus-strip"],eventTypes:["*"],public:false},
    {code:"experience:editorial-masonry",name:"Mural editorial",description:"Galería editorial adaptable que conserva proporciones y evita animación innecesaria.",priceCents:5900,grants:["galleryStyle:editorial-masonry"],eventTypes:["*"],public:false},
    {code:"experience:memories-orbit",name:"Órbita de recuerdos",description:"Galería de recuerdos destacados con límite de elementos activos y degradación segura en pantallas pequeñas o movimiento reducido.",priceCents:6900,grants:["galleryStyle:memories-orbit"],eventTypes:["wedding","xv","birthday","anniversary","graduation","custom"],public:false},
    {code:"storage:500",kind:"storage",name:"500 MB adicionales",description:"Espacio adicional para fotografías y archivos.",priceCents:5900,grants:[],eventTypes:["*"],storageMB:500}
  ].forEach((item,index)=>seeds.push({
    kind:item.kind||"bundle",status:"available",public:true,dependencies:[],
    storageMB:0,sortOrder:100+index,...item
  }));

  const tierLabels={express:"Express",starter:"Esencial",basic:"Plus",premium:"Premium"};
  const tierPrices={express:4900,starter:7900,basic:11900,premium:14900};
  Object.keys(tierLabels).forEach((tier,index)=>seeds.push({
    code:`themes:tier:${tier}`,kind:"template_collection",
    name:`Colección ${tierLabels[tier]}`,
    description:`Acceso a todas las plantillas del nivel ${tierLabels[tier]}.`,
    priceCents:tierPrices[tier],status:"available",public:true,
    grants:["templates",`themes:tier:${tier}`],dependencies:[],eventTypes:["*"],
    storageMB:0,sortOrder:200+index
  }));

  themes.forEach((theme,index)=>seeds.push({
    code:`theme:${theme.id}`,kind:"template",name:theme.name,
    description:theme.description||"Plantilla individual para la invitación.",
    priceCents:(theme.minPlan||"starter")==="premium"?5900:3900,
    status:"available",public:true,grants:["templates",`theme:${theme.id}`],
    dependencies:[],eventTypes:theme.eventTypes||["*"],storageMB:0,sortOrder:300+index
  }));

  const upsertProduct=db.prepare(`
    INSERT INTO product_catalog
      (code,kind,name,description,price_cents,currency,commercial_status,public,grants_json,dependencies_json,event_types_json,storage_mb,sort_order,active)
    VALUES (?,?,?,?,?,'MXN',?,?,?,?,?,?,?,1)
    ON CONFLICT(code) DO NOTHING
  `);
  seeds.forEach(product=>upsertProduct.run(
    product.code,product.kind,product.name,product.description||"",product.priceCents||0,
    product.status||"available",product.public?1:0,JSON.stringify(product.grants||[]),
    JSON.stringify(product.dependencies||[]),JSON.stringify(product.eventTypes||["*"]),
    product.storageMB||0,product.sortOrder||0
  ));

  const metadataForCode=code=>{
    if(code.startsWith("theme:"))return ["approved","theme","theme"];
    if(code==="experience:rose-bloom")return ["approved","opening","experience"];
    if(code==="experience:cinematic-depth")return ["approved","gallery","experience"];
    if(code==="experience:particle-heart")return ["approved","opening","experience"];
    if(["experience:ivory-seal","experience:daisy-bloom","experience:luminous-garden"].includes(code)||code==="experience:night-flower-original")return ["approved","opening","experience"];
    if(["experience:focus-strip","experience:editorial-masonry","experience:memories-orbit"].includes(code))return ["approved","gallery","experience"];
    if(code.startsWith("experience:"))return ["qa","opening","experience"];
    if(code==="bundle:physical")return ["approved","print","feature"];
    if(code==="bundle:photo-qr")return ["approved","feature","feature"];
    return ["approved","feature",code.startsWith("storage:")?"none":"feature"];
  };
  const updateMetadata=db.prepare(`
    UPDATE product_catalog SET readiness_status=?,presentation_slot=?,preview_strategy=?,release_version='6.14.2-rc.21'
    WHERE code=? AND release_version=''
  `);
  seeds.forEach(product=>{const [readiness,slot,preview]=metadataForCode(product.code);updateMetadata.run(readiness,slot,preview,product.code);});
  db.prepare(`
    UPDATE product_catalog SET release_version='6.14.2-rc.20'
    WHERE code IN ('experience:ivory-seal','experience:daisy-bloom','experience:luminous-garden')
      AND release_version='6.14.2-rc.19'
  `).run();
  db.prepare(`
    UPDATE product_catalog SET release_version='6.14.2-rc.21'
    WHERE code='experience:night-flower-original'
      AND release_version IN ('','6.14.2-rc.20')
  `).run();

  const categoryId=code=>db.prepare("SELECT id FROM store_categories WHERE code=? AND active=1").get(code)?.id;
  const categoryLink=db.prepare("INSERT OR IGNORE INTO product_category_links(product_id,category_id,sort_order) SELECT id,?,? FROM product_catalog WHERE code=?");
  const categoryForCode=code=>{
    if(code.startsWith("theme:")||code.startsWith("themes:tier:"))return "templates";
    if(code.startsWith("experience:"))return "animations";
    if(["bundle:photos","bundle:photo-qr"].includes(code)||code.startsWith("storage:"))return "photos";
    if(["bundle:rsvp","bundle:seating","bundle:menus","bundle:reports"].includes(code))return "logistics";
    if(code==="bundle:physical")return "print";
    return "essentials";
  };
  seeds.filter(product=>product.kind!=="feature").forEach((product,index)=>{
    const category=categoryId(categoryForCode(product.code));
    if(category)categoryLink.run(category,index,product.code);
  });

  /* Demostraciones editoriales: se inicializan una sola vez. Tras ese bootstrap,
     ocultar, editar o eliminar una muestra es una decisión persistente del propietario. */
  const showcaseMarker=db.prepare("SELECT value_json FROM platform_settings WHERE key='bootstrap_showcase_seed_v1'").get();
  if(!showcaseMarker){
    const showcaseSeed=db.prepare(`
      INSERT INTO showcase_items(source_type,theme_id,title,subtitle,event_type,asset_url,status,sort_order,snapshot_json)
      SELECT 'demo',?,?,?,?,?,'published',?,?
      WHERE NOT EXISTS(SELECT 1 FROM showcase_items WHERE source_type='demo' AND theme_id=?)
    `);
    [
      ["daisy-paper-orbit","Margarita de papel","Suite botánica de papel marfil","wedding","/assets/daisy-paper-orbit.svg",10],
      ["daisy-meadow-air","Prado de margaritas","Minimalismo floral con mucho aire","wedding","/assets/daisy-meadow-air.svg",20],
      ["daisy-editorial-light","Margarita editorial","Luz cálida y composición asimétrica","wedding","/assets/daisy-editorial-light.svg",30],
      ["daisy-shadow-studio","Luz y margaritas","Sombra arquitectónica y ramo moderno","wedding","/assets/daisy-shadow-studio.svg",40]
    ].forEach(([themeId,title,subtitle,eventType,assetUrl,sortOrder])=>showcaseSeed.run(
      themeId,title,subtitle,eventType,assetUrl,sortOrder,JSON.stringify({demo:true,themeId}),themeId
    ));
    db.prepare("INSERT INTO platform_settings(key,value_json) VALUES('bootstrap_showcase_seed_v1','true')").run();
  }

  if(!db.prepare("SELECT COUNT(*) total FROM plan_products").get().total){
    const link=db.prepare(`
      INSERT OR IGNORE INTO plan_products(plan_id,product_id)
      SELECT p.id,pc.id FROM plans p,product_catalog pc WHERE p.code=? AND pc.code=?
    `);
    const ranks={express:1,starter:2,basic:3,premium:4,trial:4,studio:5};
    commercialPlans.plans.forEach(plan=>{
      const included=plan.includesAllAvailable
        ?featureCatalog.filter(item=>item.key!=="developerTools").map(item=>item.key)
        :(plan.included||[]);
      included.forEach(key=>link.run(plan.code,`feature:${key}`));
      if(plan.includesAllAvailable){
        db.prepare("SELECT code FROM product_catalog WHERE active=1 AND commercial_status='available' AND readiness_status='approved' AND kind='bundle'").all()
          .forEach(product=>link.run(plan.code,product.code));
        db.prepare("SELECT code FROM product_catalog WHERE active=1 AND commercial_status='available' AND readiness_status='approved' AND code LIKE 'experience:%'").all()
          .forEach(product=>link.run(plan.code,product.code));
      }
      Object.keys(tierLabels).filter(tier=>ranks[tier]<=ranks[plan.code]).forEach(tier=>{
        link.run(plan.code,`themes:tier:${tier}`);
      });
    });
  }

  /* RC17: no se reinyectan productos en planes existentes durante cada inicio.
     La composición de cada plan pertenece al propietario y se modifica desde
     Product Studio. Las inclusiones iniciales sólo se crean cuando plan_products
     está vacío (bloque anterior). */

  const legacyGrant=db.prepare(`
    INSERT INTO event_grants(event_id,product_id,source,source_reference,note)
    SELECT ?,pc.id,'legacy',?,'Migrado desde RC9'
    FROM product_catalog pc
    WHERE pc.code=?
      AND NOT EXISTS(
        SELECT 1 FROM event_grants eg
        WHERE eg.event_id=? AND eg.source='legacy' AND eg.source_reference=?
      )
  `);
  db.prepare("SELECT id,settings_json FROM events").all().forEach(event=>{
    try{
      const purchased=JSON.parse(event.settings_json).purchasedFeatures||[];
      purchased.forEach(key=>{
        const reference=`rc9:${key}`;
        legacyGrant.run(event.id,reference,`feature:${key}`,event.id,reference);
      });
    }catch{}
  });
}

module.exports={initialize};
