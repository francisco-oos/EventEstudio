require("dotenv").config();
const express=require("express");
const helmet=require("helmet");
const compression=require("compression");
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const crypto=require("crypto");
const bcrypt=require("bcryptjs");
const sanitize=require("sanitize-filename");
const QRCode=require("qrcode");
const ExcelJS=require("exceljs");
const PDFDocument=require("pdfkit");
const archiverModule=require("archiver");
const db=require("./db");
const commerce=require("./commerce");
const themes=require("../config/themes.json");
const qrTemplates=require("../config/qr-templates.json");
const eventTypes=require("../config/event-types.json");
const defaultSettings=require("../config/default-settings.json");
const experienceCatalog=require("./experience-catalog");
const {catalog:featureCatalog,normalizeFeatureSettings,featureDecision,featureOverview}=require("./features");
const {log,audit}=require("./logger");
const messaging=require("./messaging");
const paymentGateway=require("./payments");
const backups=require("./backup");
const restore=require("./restore");
const {numberSetting}=require("./config");
const {validateImageStructure}=require("./media-validation");

/* Archiver 8 expone clases ESM/CommonJS en lugar de la antigua función fábrica.
   Este adaptador conserva compatibilidad con ambas formas para que la exportación
   ZIP de fotografías no dependa de una versión concreta de la dependencia. */
function createZipArchive(options={}){
  if(typeof archiverModule==="function")return archiverModule("zip",options);
  if(typeof archiverModule.ZipArchive==="function")return new archiverModule.ZipArchive(options);
  throw new Error("No se encontró un renderer ZIP compatible en archiver.");
}
const {validateXlsxArchive}=require("./spreadsheet-security");
const {
  NEUTRAL_PALETTE,
  loadThemeDesigns,
  themeDesignFor,
  printFamilyFor,
  ensureAccessiblePalette
}=require("./theme-design");

const app=express();
const PORT=numberSetting("PORT",3000,{min:1,max:65535,integer:true});
const HOST=String(process.env.HOST||"0.0.0.0").trim()||"0.0.0.0";
const IS_PRODUCTION=process.env.NODE_ENV==="production";
const SESSION_SECRET=String(process.env.SESSION_SECRET||(IS_PRODUCTION?"":"eventstudio-local-development-only-secret"));
const SESSION_HOURS=numberSetting("SESSION_HOURS",12,{min:1,max:720,integer:true});
const SESSION_COOKIE=String(process.env.SESSION_COOKIE||"eventstudio_session");
const SITE_URL=(process.env.SITE_URL||`http://localhost:${PORT}`).replace(/\/$/,"");
let SITE_ORIGIN="";
try{
  const parsedSiteUrl=new URL(SITE_URL);
  if(!["http:","https:"].includes(parsedSiteUrl.protocol)||parsedSiteUrl.username||parsedSiteUrl.password){
    throw new Error();
  }
  if((parsedSiteUrl.pathname&&parsedSiteUrl.pathname!=="/")||parsedSiteUrl.search||parsedSiteUrl.hash){
    throw new Error();
  }
  SITE_ORIGIN=parsedSiteUrl.origin;
}catch{throw new Error("SITE_URL debe contener únicamente un origen HTTP(S) válido, sin ruta, usuario, consulta ni fragmento.");}
if(!/^[A-Za-z0-9_.-]+$/.test(SESSION_COOKIE))throw new Error("SESSION_COOKIE contiene caracteres no permitidos.");
const MAX_UPLOAD_MB=numberSetting("MAX_UPLOAD_MB",25,{min:1,max:1024});
const PAYMENT_PROVIDER=String(process.env.PAYMENT_PROVIDER||"disabled").trim().toLowerCase();
const GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID||"";
const TRIAL_DAYS=numberSetting("TRIAL_DAYS",7,{min:1,max:3650,integer:true});
const ALLOW_PUBLIC_REGISTRATION=String(process.env.ALLOW_PUBLIC_REGISTRATION||(!IS_PRODUCTION)).toLowerCase()==="true";
const ENABLE_DEMO_PAYMENTS=!IS_PRODUCTION&&String(process.env.ENABLE_DEMO_PAYMENTS||"false").toLowerCase()==="true";
const ENABLE_AUTOMATIC_PURGE=String(process.env.ENABLE_AUTOMATIC_PURGE||"false").toLowerCase()==="true";
const TRANSLATION_ENDPOINT=String(process.env.TRANSLATION_ENDPOINT||"").trim();
const TRANSLATION_API_KEY=String(process.env.TRANSLATION_API_KEY||"").trim();
const SUPPORTED_LOCALES=new Set(["es","en","pt"]);
const root=path.join(__dirname,"..");
const publicDir=path.join(root,"public");
const themeDesigns=loadThemeDesigns(themes,path.join(publicDir,"styles.css"));
const storageRoot=process.env.STORAGE_ROOT?path.resolve(process.env.STORAGE_ROOT):root;
const uploadsDir=process.env.UPLOADS_DIR?path.resolve(process.env.UPLOADS_DIR):path.join(storageRoot,"uploads");
const guestPhotosDir=path.join(uploadsDir,"guest-photos");
const siteMediaDir=path.join(uploadsDir,"site-media");
const tempDir=path.join(storageRoot,"data","temp");
[guestPhotosDir,siteMediaDir,tempDir].forEach(d=>fs.mkdirSync(d,{recursive:true}));

if(IS_PRODUCTION){
  if(SESSION_SECRET.length<32)throw new Error("SESSION_SECRET debe tener al menos 32 caracteres en producción.");
  if(!SITE_URL.startsWith("https://"))throw new Error("SITE_URL debe usar HTTPS en producción.");
  if(String(process.env.TRUST_PROXY||"").toLowerCase()!=="true"){
    throw new Error("TRUST_PROXY=true es obligatorio en producción detrás de Railway o un proxy HTTPS.");
  }
  const persistentStorageConfigured=Boolean(process.env.STORAGE_ROOT)
    ||Boolean(process.env.DB_PATH&&process.env.UPLOADS_DIR&&process.env.BACKUPS_DIR);
  if(!persistentStorageConfigured){
    throw new Error("Configura STORAGE_ROOT o rutas persistentes separadas antes de iniciar en producción.");
  }
}

function ensureInitialOwner(){
  const email=String(process.env.INITIAL_OWNER_EMAIL||"").trim().toLowerCase();
  const password=String(process.env.INITIAL_OWNER_PASSWORD||"");
  if(!email&&!password)return;
  if(!email||password.length<12){
    log("warn","initial_owner_invalid",{message:"INITIAL_OWNER_EMAIL e INITIAL_OWNER_PASSWORD deben configurarse juntos; la contraseña requiere 12 caracteres."});
    return;
  }
  if(db.prepare("SELECT id FROM users WHERE email=?").get(email))return;
  db.prepare(`
    INSERT INTO users(email,password_hash,display_name,role,active,auth_provider,login_identifier,must_change_password)
    VALUES(?,?,?,'owner',1,'local',?,1)
  `).run(email,bcrypt.hashSync(password,12),cleanText(process.env.INITIAL_OWNER_NAME||"Propietario EventStudio",120),email);
  log("info","initial_owner_created",{email});
}
ensureInitialOwner();

if(String(process.env.TRUST_PROXY||"").toLowerCase()==="true")app.set("trust proxy",1);
if(IS_PRODUCTION){
  const activeDemoAccounts=db.prepare(`
    SELECT COUNT(*) total FROM users
    WHERE active=1 AND (
      lower(email) LIKE '%@eventstudio.local'
      OR lower(email) LIKE '%@demo.eventstudio.local'
      OR lower(COALESCE(auth_provider,''))='demo'
      OR lower(COALESCE(login_identifier,'')) LIKE 'demo%'
    )
  `).get().total;
  if(activeDemoAccounts){
    throw new Error(`Producción bloqueada: desactiva las ${activeDemoAccounts} cuenta(s) de demostración activa(s).`);
  }
}
app.use((req,res,next)=>{req.requestId=crypto.randomUUID();res.setHeader("X-Request-Id",req.requestId);next();});
app.use((req,res,next)=>{
  if(!req.path.startsWith("/api/"))return next();
  const sendJson=res.json.bind(res);
  res.json=payload=>{
    if(res.statusCode>=400&&payload&&typeof payload==="object"&&!Array.isArray(payload)&&payload.error){
      payload={ok:false,code:payload.code||`HTTP_${res.statusCode}`,...payload};
    }
    return sendJson(payload);
  };
  next();
});
app.use(helmet({
  /* COOP/OAC requieren un origen potencialmente confiable. En pruebas LAN por HTTP
     (192.168.x.x) el navegador los ignora y puede mezclar agent clusters. Se mantienen
     activos en producción HTTPS y se desactivan sólo en desarrollo local/LAN. */
  crossOriginOpenerPolicy:IS_PRODUCTION?{policy:"same-origin"}:false,
  originAgentCluster:IS_PRODUCTION,
  crossOriginResourcePolicy:{policy:"same-site"},
  contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"],scriptSrc:["'self'","https://open.spotify.com"],styleSrc:["'self'","'unsafe-inline'"],
    imgSrc:["'self'","data:","blob:","https:"],mediaSrc:["'self'","blob:"],
    connectSrc:["'self'"],
    frameSrc:["'self'","https://open.spotify.com"],fontSrc:["'self'","data:"],objectSrc:["'none'"],
    baseUri:["'self'"],formAction:["'self'"],frameAncestors:["'self'"],
    "upgrade-insecure-requests":IS_PRODUCTION?[]:null
  }}
}));
app.use(compression());
app.use(express.json({limit:"4mb",verify:(req,_res,buffer)=>{req.rawBody=Buffer.from(buffer);}}));
app.use(express.urlencoded({extended:true}));
app.use((req,res,next)=>{
  if(req.path.startsWith("/api/auth/")||req.path.startsWith("/api/admin/")||req.path.startsWith("/api/invitation/")||req.path.startsWith("/api/config"))res.setHeader("Cache-Control","no-store");
  next();
});
app.use("/uploads/site-media",express.static(siteMediaDir,{immutable:true,maxAge:"1d",fallthrough:false}));
app.use(express.static(publicDir,{
  etag:true,
  maxAge:IS_PRODUCTION?"1h":0,
  setHeaders:(res,filePath)=>{
    if(path.extname(filePath).toLowerCase()===".html")res.setHeader("Cache-Control","no-cache");
  }
}));

function currentEvent(req){ return req.event||null; }
function eventBySlug(slug){ return db.prepare("SELECT * FROM events WHERE slug=?").get(slug); }
function normalizeHostname(value){
  return String(value||"")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//,"")
    .replace(/\/.*$/,"")
    .replace(/:\d+$/,"")
    .replace(/\.$/,"");
}
function eventByHostname(hostname){
  const host=normalizeHostname(hostname);
  if(!host||host==="localhost"||host==="127.0.0.1")return null;
  return db.prepare(`
    SELECT e.*
    FROM event_domains d
    JOIN events e ON e.id=d.event_id
    WHERE d.hostname=? AND d.verified=1 AND COALESCE(e.archived,0)=0
    LIMIT 1
  `).get(host);
}

function settingsOf(event){ return normalizeFeatureSettings(JSON.parse(event.settings_json)); }
function saveSettings(eventId,settings){ db.prepare("UPDATE events SET settings_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(settings),eventId); }
function makeToken(){ return crypto.randomBytes(16).toString("hex"); }
function slugify(v){ return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||`evento-${Date.now()}`; }
function freshEventSettings(name,eventType="custom"){
  const settings=JSON.parse(JSON.stringify(defaultSettings));
  const profile=eventTypes.find(item=>item.id===eventType)||eventTypes.find(item=>item.id==="custom");
  const {storyTitle,...presentationDefaults}=profile?.defaults||{};
  settings.couple={partner1:"",partner2:"",displayName:name};
  settings.event={dateTime:"",dateLabel:"Fecha por confirmar",heroMessage:"",closingMessage:""};
  settings.story={...(settings.story||{}),title:storyTitle||"Información del evento",text:""};
  settings.venue={title:"Lugar del evento",name:"",ceremonyTime:"",receptionTime:"",address:"",mapsUrl:"",notes:""};
  settings.venues={
    samePlace:true,
    ceremony:{title:"Ceremonia",name:"",time:"",address:"",mapsUrl:"",lat:"",lng:"",notes:""},
    reception:{title:"Celebración",name:"",time:"",address:"",mapsUrl:"",lat:"",lng:"",notes:""}
  };
  settings.agenda={enabled:true,sameLocation:true,items:[]};
  settings.media={...(settings.media||{}),heroImage:"",music:"",gallery:[],spotifyUrl:"",spotifyUri:"",spotifyTrackName:"",spotifyArtists:"",spotifyDurationMs:0,spotifyStartSeconds:0,musicSource:"none",musicStartSeconds:0};
  settings.presentation={...(settings.presentation||{}),...presentationDefaults};
  settings.creativeBrief=normalizeCreativeBrief(settings.creativeBrief,{});
  settings.localization={defaultLocale:"es",enabledLocales:["es"],contentTranslations:{}};
  settings.purchasedFeatures=[];
  settings.event.eventType=eventType;
  settings.developer={mode:"production",showBanner:false,ownerOnly:true};
  return settings;
}

function normalizeLocalization(currentLocalization,incomingLocalization){
  const current=currentLocalization&&typeof currentLocalization==="object"?currentLocalization:{};
  const incoming=incomingLocalization&&typeof incomingLocalization==="object"?incomingLocalization:{};
  const requestedDefault=String(incoming.defaultLocale||current.defaultLocale||"es").toLowerCase();
  const defaultLocale=SUPPORTED_LOCALES.has(requestedDefault)?requestedDefault:"es";
  const requested=Array.isArray(incoming.enabledLocales)
    ?incoming.enabledLocales
    :(Array.isArray(current.enabledLocales)?current.enabledLocales:["es"]);
  const enabledLocales=[...new Set(requested.map(item=>String(item).toLowerCase()).filter(item=>SUPPORTED_LOCALES.has(item)))];
  if(!enabledLocales.includes(defaultLocale))enabledLocales.unshift(defaultLocale);
  const sourceTranslations=incoming.contentTranslations&&typeof incoming.contentTranslations==="object"
    ?incoming.contentTranslations
    :(current.contentTranslations&&typeof current.contentTranslations==="object"?current.contentTranslations:{});
  const allowedPaths=new Set([
    "event.heroMessage","event.closingMessage","story.title","story.text",
    "dressCode.title","dressCode.description","gifts.title","gifts.message",
    "gifts.description","venue.title","venue.notes"
  ]);
  const contentTranslations={};
  for(const locale of enabledLocales){
    if(locale===defaultLocale)continue;
    const values=sourceTranslations[locale]&&typeof sourceTranslations[locale]==="object"?sourceTranslations[locale]:{};
    contentTranslations[locale]={};
    for(const [key,value] of Object.entries(values)){
      if(allowedPaths.has(key))contentTranslations[locale][key]=cleanText(value,2000);
    }
  }
  return {defaultLocale,enabledLocales,contentTranslations};
}


function publicCommercialPlans(){
  return db.prepare(`
    SELECT code,name,tagline,price_cents,currency,duration_days,retention_days,max_events,max_guests,max_storage_mb,
           max_published_events,publication_policy,featured,sort_order
    FROM plans WHERE active=1 AND public=1 ORDER BY sort_order,price_cents,id
  `).all().map(row=>{
    const included=[...new Set(commerce.planProducts(row.code).flatMap(product=>[product.code,...product.grants]))];
    return {
      ...row,featured:Boolean(row.featured),includesAllAvailable:false,included
    };
  });
}

function themeAllowedForPlan(theme,settings,planCode){
  if(!theme)return false;
  const keys=new Set(commerce.planProducts(planCode).flatMap(product=>[product.code,...product.grants]));
  if(keys.has(`theme:${theme.id}`))return true;
  const required=commerce.PLAN_RANK[theme.minPlan||"starter"]||2;
  return Object.entries(commerce.PLAN_RANK).some(([tier,rank])=>
    rank>=required&&keys.has(`themes:tier:${tier}`)
  )||keys.has("premiumTemplates");
}

function safeHttpUrl(value){
  try{
    const url=new URL(String(value||"").trim());
    return ["http:","https:"].includes(url.protocol)?url.toString():"";
  }catch{
    return "";
  }
}

function spotifyEntity(value){
  try{
    const url=new URL(String(value||"").trim());
    if(url.protocol!=="https:"||url.hostname!=="open.spotify.com")return null;
    const [type,id]=url.pathname.split("/").filter(Boolean);
    if(!["track","playlist","album"].includes(type)||!/^\w+$/.test(id||""))return null;
    return {
      type,
      id,
      url:`https://open.spotify.com/${type}/${id}`,
      uri:`spotify:${type}:${id}`
    };
  }catch{
    return null;
  }
}

function booleanValue(value){
  return value===true||value===1||value==="1"||value==="true"||value==="yes";
}

function cleanText(value,maxLength=1000){
  return String(value??"").trim().slice(0,maxLength);
}

function titleCaseName(value){
  const minorWords=new Set(["y","e","de","del","la","las","los","familia"]);let wordIndex=0;
  return String(value||"").trim().toLocaleLowerCase("es-MX").split(/([\s-]+)/).map(part=>{
    if(!part||/^[\s-]+$/.test(part))return part;
    const current=wordIndex++;if(["xv","xxv"].includes(part))return part.toLocaleUpperCase("es-MX");if(current>0&&minorWords.has(part))return part;
    return part.replace(/^\p{L}/u,letter=>letter.toLocaleUpperCase("es-MX"));
  }).join("");
}
function presentedName(value,typography={}){
  const mode=typography.nameCase||"title";
  if(mode==="uppercase")return String(value||"").toLocaleUpperCase("es-MX");
  if(mode==="title"||mode==="small-caps")return titleCaseName(value);
  return String(value||"");
}
function normalizeTypography(currentTypography,incomingTypography){
  const current=currentTypography&&typeof currentTypography==="object"?currentTypography:{};
  const incoming=incomingTypography&&typeof incomingTypography==="object"?incomingTypography:{};
  const headingFonts=new Set(["georgia","baskerville","garamond","didot","classic","great-vibes","cormorant","playfair","cinzel"]);
  const bodyFonts=new Set(["system","humanist","classic","lora","montserrat","cormorant"]);
  const nameCases=new Set(["preserve","title","uppercase","small-caps"]);
  const scales=new Set(["compact","comfortable","large"]);
  return {
    heading:headingFonts.has(incoming.heading)?incoming.heading:(headingFonts.has(current.heading)?current.heading:"georgia"),
    body:bodyFonts.has(incoming.body)?incoming.body:(bodyFonts.has(current.body)?current.body:"system"),
    scale:scales.has(incoming.scale)?incoming.scale:(scales.has(current.scale)?current.scale:"comfortable"),
    nameCase:nameCases.has(incoming.nameCase)?incoming.nameCase:(nameCases.has(current.nameCase)?current.nameCase:"title")
  };
}
function normalizePresentation(currentPresentation,incomingPresentation){
  const current=currentPresentation&&typeof currentPresentation==="object"?currentPresentation:{};
  const incoming=incomingPresentation&&typeof incomingPresentation==="object"?incomingPresentation:{};
  const next={...current};
  const textFields=[
    "openingEyebrow","heroEyebrow","openButton","countdownEyebrow","storyEyebrow",
    "galleryEyebrow","galleryTitle","dressEyebrow","rsvpEyebrow","rsvpTitle",
    "giftEyebrow","agendaEyebrow","agendaTitle","guestLabel","dashboardTitle",
    "dashboardDescription","reportTitle","reportDescription"
  ];
  for(const key of textFields){
    if(Object.prototype.hasOwnProperty.call(incoming,key))next[key]=cleanText(incoming[key],key.endsWith("Description")?1000:240);
  }
  const openingStyles=experienceCatalog.openingIds;
  if(openingStyles.has(incoming.openingStyle))next.openingStyle=incoming.openingStyle;
  else if(!openingStyles.has(next.openingStyle))next.openingStyle="wax-envelope";
  const experienceModes=new Set(["auto","classic","story","poster","gallery"]);
  const motionLevels=experienceCatalog.motionLevelIds;
  const galleryStyles=experienceCatalog.galleryIds;
  next.experienceMode=experienceModes.has(incoming.experienceMode)
    ?incoming.experienceMode
    :(experienceModes.has(next.experienceMode)?next.experienceMode:"auto");
  next.motionLevel=motionLevels.has(incoming.motionLevel)
    ?incoming.motionLevel
    :(motionLevels.has(next.motionLevel)?next.motionLevel:"balanced");
  next.galleryStyle=galleryStyles.has(incoming.galleryStyle)
    ?incoming.galleryStyle
    :(galleryStyles.has(next.galleryStyle)?next.galleryStyle:"classic");
  const colorFields={rosePetalColor:"#b70f36",floralPetalColor:"#f7f3de",floralCenterColor:"#d8ad61"};
  for(const [key,fallback] of Object.entries(colorFields)){
    if(Object.prototype.hasOwnProperty.call(incoming,key)){
      const color=String(incoming[key]||"").trim();
      next[key]=/^#[0-9a-f]{6}$/i.test(color)?color.toLowerCase():fallback;
    }else if(!/^#[0-9a-f]{6}$/i.test(String(next[key]||"")))next[key]=fallback;
  }
  return next;
}

function normalizeCreativeBrief(currentBrief,incomingBrief){
  const current=currentBrief&&typeof currentBrief==="object"?currentBrief:{};
  const incoming=incomingBrief&&typeof incomingBrief==="object"?incomingBrief:{};
  const tones=new Set(["joyful","sweet","adventurous","elegant","playful"]);
  return {
    protagonist:cleanText(incoming.protagonist??current.protagonist,160),
    milestone:cleanText(incoming.milestone??current.milestone,80),
    theme:cleanText(incoming.theme??current.theme,160),
    tone:tones.has(incoming.tone)?incoming.tone:(tones.has(current.tone)?current.tone:"joyful"),
    visualNotes:cleanText(incoming.visualNotes??current.visualNotes,1200),
    assetRightsConfirmed:booleanValue(incoming.assetRightsConfirmed??current.assetRightsConfirmed)
  };
}

function nextGuestCode(eventId){
  const used=new Set(db.prepare("SELECT UPPER(code) code FROM guests WHERE event_id=?").all(eventId).map(row=>row.code));
  for(let number=1;number<=999999;number++){
    const code=`FAM-${String(number).padStart(4,"0")}`;
    if(!used.has(code))return code;
  }
  return `FAM-${Date.now().toString(36).toUpperCase()}`;
}

function normalizeMediaUpdate(currentMedia,incomingMedia){
  const current=currentMedia&&typeof currentMedia==="object"?currentMedia:{};
  const incoming=incomingMedia&&typeof incomingMedia==="object"?incomingMedia:{};
  const source=["none","upload","spotify"].includes(incoming.musicSource)
    ? incoming.musicSource
    : (current.musicSource||"none");
  const entity=spotifyEntity(incoming.spotifyUrl??current.spotifyUrl);

  if(source==="upload"&&!current.music){
    throw new Error("Primero sube un archivo de música.");
  }
  if(source==="spotify"&&!entity){
    throw new Error("El enlace de Spotify no es válido.");
  }

  const spotifyDurationMs=entity?Math.max(0,Number(incoming.spotifyDurationMs??current.spotifyDurationMs)||0):0;
  const requestedSpotifyStart=Math.max(0,Math.floor(Number(incoming.spotifyStartSeconds??current.spotifyStartSeconds)||0));
  const spotifyMaxSeconds=spotifyDurationMs>0?Math.max(0,Math.floor(spotifyDurationMs/1000)-1):3600;
  const spotifyStartSeconds=entity?.type==="track"
    ? Math.min(requestedSpotifyStart,spotifyMaxSeconds)
    : 0;

  return {
    ...current,
    ...incoming,
    /* Las rutas de archivos sólo pueden cambiar mediante sus endpoints de carga. */
    heroImage:current.heroImage||"",
    music:current.music||"",
    gallery:Array.isArray(current.gallery)?current.gallery:[],
    musicSource:source,
    musicStartSeconds:Math.max(0,Number(incoming.musicStartSeconds??current.musicStartSeconds)||0),
    spotifyUrl:entity?.url||"",
    spotifyUri:entity?.uri||"",
    spotifyTrackName:entity?cleanText(incoming.spotifyTrackName??current.spotifyTrackName,180):"",
    spotifyArtists:entity?cleanText(incoming.spotifyArtists??current.spotifyArtists,240):"",
    spotifyDurationMs,
    /* El iFrame API oficial admite startAt al cargar una canción. */
    spotifyStartSeconds
  };
}

function eventOwnerId(event){
  if(event?.owner_user_id)return Number(event.owner_user_id);
  const linked=db.prepare(`
    SELECT ue.user_id
    FROM user_events ue
    JOIN users u ON u.id=ue.user_id
    WHERE ue.event_id=? AND u.role='client'
    ORDER BY ue.user_id LIMIT 1
  `).get(event.id);
  return linked?.user_id||null;
}

function eventEntitlement(event){
  const ownerId=eventOwnerId(event);
  if(!ownerId)return null;
  return accountEntitlement(ownerId);
}

function commercialFeatureContext(event){
  return commerce.featureContext(event,eventEntitlement(event));
}
const DESIGN_PRODUCT_KEYS=Object.freeze({
  opening:experienceCatalog.openingGrantMap,
  gallery:experienceCatalog.galleryGrantMap
});
function authorizedProductGrantOptions(){
  const values=new Set(featureCatalog.map(item=>item.key));
  values.add("templates");
  themes.forEach(theme=>values.add(`theme:${theme.id}`));
  Object.values(DESIGN_PRODUCT_KEYS.opening).forEach(value=>values.add(value));
  Object.values(DESIGN_PRODUCT_KEYS.gallery).forEach(value=>values.add(value));
  try{commerce.allProducts().forEach(product=>(product.grants||[]).forEach(value=>values.add(String(value))));}catch{}
  return [...values].filter(Boolean).sort((a,b)=>a.localeCompare(b,"es"));
}
function previewManifestFromGrants(grants=[]){
  const manifest={};
  const theme=grants.find(value=>String(value).startsWith("theme:"));
  if(theme)manifest.theme=String(theme).slice(6);
  const opening=Object.entries(DESIGN_PRODUCT_KEYS.opening).find(([,value])=>grants.includes(value));
  if(opening)manifest.opening=opening[0];
  const gallery=Object.entries(DESIGN_PRODUCT_KEYS.gallery).find(([,value])=>grants.includes(value));
  if(gallery)manifest.gallery=gallery[0];
  return manifest;
}

function designAccessForEvent(event,{platform=false}={}){
  const keys=platform?null:commerce.accessForEvent(event,eventEntitlement(event)).keys;
  return {
    opening:Object.fromEntries(Object.entries(DESIGN_PRODUCT_KEYS.opening).map(([style,key])=>[style,platform||keys.has(key)])),
    gallery:Object.fromEntries(Object.entries(DESIGN_PRODUCT_KEYS.gallery).map(([style,key])=>[style,platform||keys.has(key)]))
  };
}
function eventFeatureDecision(event,key,{role="public",forceClientView=false}={}){
  const context=commercialFeatureContext(event);
  return featureDecision(settingsOf(event),key,{
    role,forceClientView,planCode:context.planCode,
    includedFeatures:context.includedFeatures,grantedFeatures:context.grantedFeatures,
    globalStates:context.globalStates
  });
}
function eventFeatureOverview(event,{role="public",forceClientView=false}={}){
  const context=commercialFeatureContext(event);
  return featureOverview(settingsOf(event),{
    role,forceClientView,planCode:context.planCode,
    includedFeatures:context.includedFeatures,grantedFeatures:context.grantedFeatures,
    globalStates:context.globalStates
  });
}

function mediaPathFromUrl(url){
  const raw=String(url||"");
  if(!raw.startsWith("/uploads/"))return null;
  const relative=raw.slice("/uploads/".length);
  const resolved=path.resolve(uploadsDir,relative);
  const uploadsRoot=path.resolve(uploadsDir);
  return resolved===uploadsRoot||resolved.startsWith(`${uploadsRoot}${path.sep}`)?resolved:null;
}

function existingFile(file){
  try{return Boolean(file&&fs.statSync(file).isFile());}catch{return false;}
}

function safePublicMediaUrl(value,{allowHttps=false}={}){
  const raw=String(value||"").trim();
  const storedPath=mediaPathFromUrl(raw);
  /* Una BD restaurada puede conservar referencias a uploads que no viajaron con
     ella. No expongamos URLs locales inexistentes: evita 404 repetidos y vistas
     rotas sin borrar automáticamente la referencia recuperable de la BD. */
  if(storedPath&&storedPath!==path.resolve(uploadsDir)&&existingFile(storedPath)){
    const relative=path.relative(path.resolve(uploadsDir),storedPath)
      .split(path.sep)
      .map(part=>encodeURIComponent(part))
      .join("/");
    return `/uploads/${relative}`;
  }
  if(allowHttps){
    try{
      const external=new URL(raw);
      return external.protocol==="https:"?external.toString():"";
    }catch{}
  }
  return "";
}

function eventMediaReferenceReport(event){
  const settings=settingsOf(event);
  const entries=[
    {kind:"hero",url:settings.media?.heroImage||""},
    {kind:"music",url:settings.media?.music||""},
    ...(settings.media?.gallery||[]).map(url=>({kind:"gallery",url})),
    ...(settings.dressCode?.referenceImages||[]).map(url=>({kind:"dress",url}))
  ].filter(item=>item.url&&mediaPathFromUrl(item.url));
  const missing=entries.filter(item=>!existingFile(mediaPathFromUrl(item.url)));
  return {missingCount:missing.length,missing,checkedCount:entries.length};
}

function eventMediaPaths(event){
  const settings=settingsOf(event);
  const urls=[
    settings.media?.heroImage,
    settings.media?.music,
    ...(settings.media?.gallery||[]),
    ...(settings.dressCode?.referenceImages||[])
  ].filter(Boolean);
  const paths=urls.map(mediaPathFromUrl).filter(Boolean);
  const photoRows=db.prepare("SELECT stored_name FROM photos WHERE event_id=?").all(event.id);
  photoRows.forEach(row=>paths.push(path.join(guestPhotosDir,row.stored_name)));
  return [...new Set(paths)];
}

function eventStorageUsage(event){
  let bytes=0;
  for(const filePath of eventMediaPaths(event)){
    try{bytes+=fs.statSync(filePath).size;}catch{}
  }
  const entitlement=eventEntitlement(event);
  const limitMb=(entitlement?.max_storage_mb||2048)+commerce.accessForEvent(event,entitlement).extraStorageMb;
  const limitBytes=limitMb*1024*1024;
  const percent=limitBytes?Math.round((bytes/limitBytes)*1000)/10:0;
  return {bytes,usedMb:Math.round(bytes/1024/1024*10)/10,limitMb,limitBytes,percent};
}

function removeFiles(files){
  for(const file of files||[]){
    try{
      const filePath=file.path||file;
      if(filePath&&fs.existsSync(filePath))fs.unlinkSync(filePath);
    }catch{}
  }
}

function ensureStorageCapacity(event,incomingBytes,replacedUrls=[]){
  const usage=eventStorageUsage(event);
  const replacedBytes=(replacedUrls||[]).reduce((total,url)=>{
    const filePath=mediaPathFromUrl(url);
    try{return total+(filePath?fs.statSync(filePath).size:0);}catch{return total;}
  },0);
  const projectedBytes=Math.max(0,usage.bytes-replacedBytes)+Number(incomingBytes||0);
  return {
    ...usage,
    projectedBytes,
    allowed:projectedBytes<=usage.limitBytes
  };
}

function purgeEventFiles(event){
  removeFiles(eventMediaPaths(event));
}

function purgeEventPermanent(eventId){
  const event=db.prepare("SELECT * FROM events WHERE id=?").get(eventId);
  if(!event)return false;
  purgeEventFiles(event);
  db.prepare("DELETE FROM events WHERE id=?").run(eventId);
  return true;
}

function syncExpiredLifecycle(){
  const expired=db.prepare(`
    SELECT e.id,s.ends_at,COALESCE(p.retention_days,30) retention_days
    FROM events e
    JOIN subscriptions s ON s.id=(
      SELECT s2.id FROM subscriptions s2
      WHERE s2.user_id=e.owner_user_id
      ORDER BY s2.id DESC LIMIT 1
    )
    JOIN plans p ON p.id=s.plan_id
    WHERE s.ends_at IS NOT NULL
      AND datetime(s.ends_at)<=CURRENT_TIMESTAMP
      AND COALESCE(e.cleanup_status,'active')='active'
  `).all();

  const mark=db.prepare(`
    UPDATE events SET
      expires_at=COALESCE(expires_at,?),
      grace_until=COALESCE(grace_until,datetime(?,'+'||?||' days')),
      cleanup_after=COALESCE(cleanup_after,datetime(?,'+'||?||' days')),
      cleanup_status='grace'
    WHERE id=?
  `);
  expired.forEach(row=>mark.run(row.ends_at,row.ends_at,row.retention_days,row.ends_at,row.retention_days,row.id));

  if(!ENABLE_AUTOMATIC_PURGE)return;
  const due=db.prepare(`
    SELECT id FROM events
    WHERE cleanup_status='grace'
      AND cleanup_after IS NOT NULL
      AND datetime(cleanup_after)<=CURRENT_TIMESTAMP
      AND COALESCE(protected,0)=0
  `).all();

  due.forEach(row=>{
    const event=db.prepare("SELECT * FROM events WHERE id=?").get(row.id);
    if(!event)return;
    purgeEventFiles(event);
    db.transaction(()=>{
      db.prepare("DELETE FROM photos WHERE event_id=?").run(row.id);
      db.prepare("DELETE FROM guests WHERE event_id=?").run(row.id);
      db.prepare(`
        UPDATE events SET archived=1,published=0,cleanup_status='purged'
        WHERE id=?
      `).run(row.id);
    })();
  });
}

function applySubscriptionLifecycle(userId,endsAt){
  if(!endsAt)return;
  db.prepare(`
    UPDATE events SET expires_at=?,grace_until=NULL,cleanup_after=NULL,
      cleanup_status='active',archived=0
    WHERE owner_user_id=?
  `).run(endsAt,userId);
}

function normalizePhone(v){ let p=String(v||"").replace(/\D/g,""); if(p.length===10)p="52"+p; return p; }

function platformSetting(key,fallback={}){
  const row=db.prepare("SELECT value_json FROM platform_settings WHERE key=?").get(key);
  if(!row)return fallback;
  try{const parsed=JSON.parse(row.value_json);return parsed&&typeof parsed==="object"?parsed:fallback;}catch{return fallback;}
}

function savePlatformSetting(key,value,userId=null){
  db.prepare(`
    INSERT INTO platform_settings(key,value_json,updated_by,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP
  `).run(key,JSON.stringify(value||{}),userId||null);
}

function publicBaseUrl(event){
  const alias=event?.id?db.prepare(`
    SELECT hostname FROM event_domains
    WHERE event_id=? AND verified=1
    ORDER BY is_primary DESC,id DESC LIMIT 1
  `).get(event.id):null;
  return alias?.hostname?`https://${normalizeHostname(alias.hostname)}`:SITE_URL.replace(/\/$/,"");
}

function invitationUrl(event,token){ return `${publicBaseUrl(event)}/e/${event.slug}?i=${encodeURIComponent(token)}`; }
function tableQrSignature(event,table){
  if(!event||!table)return "";
  return crypto.createHmac("sha256",SESSION_SECRET).update(`${event.id}|${event.slug}|${String(table).trim()}`).digest("base64url").slice(0,32);
}
function albumUrl(event,table=""){
  const normalized=String(table||"").trim();
  const tableQuery=normalized?`&mesa=${encodeURIComponent(normalized)}&mesaSig=${encodeURIComponent(tableQrSignature(event,normalized))}`:"";
  return `${publicBaseUrl(event)}/album.html?e=${encodeURIComponent(event.slug)}${tableQuery}`;
}

function commercialProfileRows({activeOnly=false}={}){
  const rows=db.prepare(`SELECT id,code,name,description,sort_order,active,recommendations_json,catalog_mode FROM customer_profiles ${activeOnly?"WHERE active=1":""} ORDER BY sort_order,name,id`).all();
  const links=db.prepare("SELECT product_id FROM product_profile_links WHERE profile_id=? ORDER BY sort_order,product_id");
  return rows.map(row=>{let recommendedCategories=[];try{recommendedCategories=JSON.parse(row.recommendations_json||"[]");}catch{}return {...row,recommendedCategories:Array.isArray(recommendedCategories)?recommendedCategories:[],catalogMode:row.catalog_mode||"all",curatedProductIds:links.all(row.id).map(link=>Number(link.product_id))};});
}

function accountCommercialControls(userId){
  const row=db.prepare(`
    SELECT acc.user_id,acc.max_events_override,acc.max_published_events_override,acc.publication_policy_override,acc.note,
           cp.id profile_id,cp.code profile_code,cp.name profile_name,cp.description profile_description,cp.recommendations_json profile_recommendations_json,cp.catalog_mode profile_catalog_mode
    FROM account_commercial_controls acc
    LEFT JOIN customer_profiles cp ON cp.id=acc.customer_profile_id
    WHERE acc.user_id=?
  `).get(userId);
  if(!row)return {user_id:userId,max_events_override:null,max_published_events_override:null,publication_policy_override:null,note:"",profile_id:null,profile_code:"couple-diy",profile_name:"Pareja / organizador particular",recommendedCategories:[],catalog_mode:"all"};
  let recommendedCategories=[];try{recommendedCategories=JSON.parse(row.profile_recommendations_json||"[]");}catch{}
  return {...row,recommendedCategories:Array.isArray(recommendedCategories)?recommendedCategories:[],catalog_mode:row.profile_catalog_mode||"all"};
}

function publicationAccess(user,event=null){
  if(!user)return {allowed:false,reason:"AUTH_REQUIRED",mode:"manual_owner"};
  if(["owner","developer"].includes(user.role))return {allowed:true,auto:true,mode:"platform",maxPublishedEvents:1000000,publishedCount:0};
  const entitlement=accountEntitlement(user.id);
  const controls=accountCommercialControls(user.id);
  const global=platformSetting("publication",{mode:"manual_owner"});
  const usable=subscriptionUsable(entitlement);
  const maxPublishedEvents=Math.max(0,Number(controls.max_published_events_override??entitlement?.max_published_events??entitlement?.max_events??0));
  const publishedCount=db.prepare(`
    SELECT COUNT(DISTINCT e.id) total
    FROM events e LEFT JOIN user_events ue ON ue.event_id=e.id
    WHERE (e.owner_user_id=? OR ue.user_id=?) AND COALESCE(e.archived,0)=0 AND COALESCE(e.published,0)=1
  `).get(user.id,user.id).total;
  const policy=String(controls.publication_policy_override||entitlement?.publication_policy||"manual_owner");
  const withinLimit=publishedCount<maxPublishedEvents||Boolean(event?.published);
  const auto=global.mode==="plan_policy"&&policy==="auto_after_entitlement"&&usable&&withinLimit;
  return {
    allowed:usable&&withinLimit,auto,mode:global.mode||"manual_owner",policy,usable,withinLimit,
    maxPublishedEvents,publishedCount,profileCode:controls.profile_code||"couple-diy"
  };
}

function previewTokenDigest(value){return crypto.createHash("sha256").update(String(value||"")).digest("hex");}
function previewLinkRow(rawToken,eventId){
  if(!rawToken)return null;
  return db.prepare(`
    SELECT * FROM preview_links
    WHERE token_hash=? AND event_id=? AND revoked_at IS NULL AND datetime(expires_at)>CURRENT_TIMESTAMP
    LIMIT 1
  `).get(previewTokenDigest(rawToken),eventId)||null;
}
function previewAllowed(req,event){
  return previewAccess(req,event).allowed;
}
function previewAccess(req,event){
  const sessionUser=req.query.preview==="1"?currentUser(req):null;
  const sessionPreview=Boolean(sessionUser&&userCanAccessEvent(sessionUser,event.id));
  const shared=previewLinkRow(String(req.query.previewToken||""),event.id);
  if(shared)db.prepare("UPDATE preview_links SET last_opened_at=CURRENT_TIMESTAMP WHERE id=?").run(shared.id);
  const sharedCreator=shared?db.prepare(`
    SELECT id,email,phone,display_name,role,active,auth_provider,company_name,must_change_password,preferred_locale
    FROM users WHERE id=? AND active=1
  `).get(shared.created_by):null;
  const actor=sessionPreview?sessionUser:sharedCreator;
  return {
    allowed:Boolean(sessionPreview||shared),
    actor:actor||null,
    platform:Boolean(actor&&["owner","developer"].includes(actor.role)&&userCanAccessEvent(actor,event.id)),
    catalog:Boolean(actor&&userCanAccessEvent(actor,event.id))
  };
}

const CONVERSION_EVENT_NAMES=new Set([
  "landing_view","catalog_view","showcase_view","template_previewed","store_view","store_search",
  "store_product_previewed","cart_added","cart_removed","checkout_started","payment_completed",
  "publication_requested","published","preview_link_created","preview_link_opened"
]);
function safeAnalyticsMetadata(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return {};
  const allowed=new Set(["productCode","category","queryLength","themeId","eventType","planCode","source","resultCount","orderId","publicationMode","campaign","medium","referrerHost","productId","kind","subtotalCents"]);
  const out={};
  for(const [key,value] of Object.entries(input)){
    if(!allowed.has(key))continue;
    if(typeof value==="number"&&Number.isFinite(value))out[key]=value;
    else if(typeof value==="boolean")out[key]=value;
    else out[key]=cleanText(String(value||""),120);
  }
  return out;
}
function recordConversion({sessionKey,userId=null,eventId=null,eventName,source="web",metadata={}}){
  if(!CONVERSION_EVENT_NAMES.has(eventName))return false;
  const key=cleanText(sessionKey||"",80);
  if(!key)return false;
  db.prepare(`INSERT INTO conversion_events(session_key,user_id,event_id,event_name,source,metadata_json) VALUES(?,?,?,?,?,?)`)
    .run(key,userId||null,eventId||null,eventName,cleanText(source||"web",30),JSON.stringify(safeAnalyticsMetadata(metadata)));
  return true;
}

function attendeeNameList(value){
  return String(value||"")
    .split(/\r?\n|,|;|\s+y\s+/i)
    .map(name=>cleanText(name,120))
    .filter(Boolean);
}

function seatingPeople(eventId,{confirmedOnly=false}={}){
  const rows=db.prepare(`
    SELECT g.id guest_id,g.family_name,g.status,g.max_adults,g.max_children,g.table_name,
           r.attending,r.adults,r.children,r.attendee_names,r.updated_at rsvp_updated_at
    FROM guests g
    LEFT JOIN rsvps r ON r.guest_id=g.id
    WHERE g.event_id=? AND COALESCE(g.is_test,0)=0
    ORDER BY g.family_name,g.id
  `).all(eventId);
  const event=db.prepare("SELECT settings_json FROM events WHERE id=?").get(eventId);
  let seatReleaseAt=null;
  try{const parsed=JSON.parse(event?.settings_json||"{}");seatReleaseAt=parsed.rsvp?.seatReleaseAt?new Date(parsed.rsvp.seatReleaseAt):null;}catch{}
  const releaseWindowOpen=seatReleaseAt instanceof Date&&!Number.isNaN(seatReleaseAt.getTime())&&Date.now()>=seatReleaseAt.getTime();
  const people=[];
  for(const row of rows){
    const attending=Number(row.attending)===1;
    if(confirmedOnly&&!attending)continue;
    const adults=confirmedOnly?Number(row.adults||0):Number(row.max_adults||0);
    const children=confirmedOnly?Number(row.children||0):Number(row.max_children||0);
    const names=confirmedOnly?attendeeNameList(row.attendee_names):[];
    const planStatus=attending?"confirmed":(row.status==="declined"?"declined":"pending");
    for(let index=0;index<adults;index++){
      people.push({
        guestId:row.guest_id,personKey:`adult-${index+1}`,
        name:names[index]||`${row.family_name} · Adulto ${index+1}`,
        family:row.family_name,type:"adult",status:confirmedOnly?"confirmed":planStatus,
        releaseEligible:!confirmedOnly&&(planStatus==="declined"||(releaseWindowOpen&&planStatus==="pending")),
        releaseReason:planStatus==="declined"?"declined":(releaseWindowOpen&&planStatus==="pending"?"pending_after_release_at":""),
        legacyTable:row.table_name||""
      });
    }
    for(let index=0;index<children;index++){
      people.push({
        guestId:row.guest_id,personKey:`child-${index+1}`,
        name:names[adults+index]||`${row.family_name} · Niño ${index+1}`,
        family:row.family_name,type:"child",status:confirmedOnly?"confirmed":planStatus,
        releaseEligible:!confirmedOnly&&(planStatus==="declined"||(releaseWindowOpen&&planStatus==="pending")),
        releaseReason:planStatus==="declined"?"declined":(releaseWindowOpen&&planStatus==="pending"?"pending_after_release_at":""),
        legacyTable:row.table_name||""
      });
    }
  }
  return people;
}

function ensureEventTables(eventId){
  const existingTables=db.prepare("SELECT * FROM event_tables WHERE event_id=? ORDER BY order_index,id").all(eventId);
  let names=db.prepare(`
      SELECT table_name name,COALESCE(SUM(max_adults+max_children),0) places
      FROM guests
      WHERE event_id=? AND COALESCE(is_test,0)=0 AND TRIM(COALESCE(table_name,''))<>''
      GROUP BY table_name ORDER BY table_name
    `).all(eventId);
  if(!names.length&&!existingTables.length)names=[{name:"Mesa 1",places:10},{name:"Mesa 2",places:10}];
  const positions=[
    [6,7],[42,5],[78,7],[6,66],[42,72],[78,66],
    [4,36],[80,36],[23,5],[61,5],[23,76],[61,76]
  ];
  const byName=new Map(existingTables.map(table=>[String(table.name).trim().toLocaleLowerCase("es-MX"),table]));
  const insert=db.prepare(`
    INSERT INTO event_tables(event_id,name,shape,capacity,x,y,width,height,rotation,order_index)
    VALUES(?,?,?,?,?,?,?,?,?,?)
  `);
  const grow=db.prepare("UPDATE event_tables SET capacity=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND capacity<?");
  db.transaction(()=>names.slice(0,80).forEach(row=>{
    const key=String(row.name||"").trim().toLocaleLowerCase("es-MX");
    const places=Math.max(1,Math.min(30,Number(row.places||10)));
    const existing=byName.get(key);
    if(existing){
      grow.run(places,existing.id,places);
      return;
    }
    const index=byName.size;
    const [x,y]=positions[index]||[6+(index%5)*19,6+Math.floor(index/5)*24];
    const name=cleanText(row.name,80);
    const info=insert.run(eventId,name,"round",Math.max(4,places),x,y,14,18,0,index);
    byName.set(key,{id:Number(info.lastInsertRowid),name,capacity:Math.max(4,places)});
  }))();
  const zoneCount=db.prepare("SELECT COUNT(*) total FROM event_floor_zones WHERE event_id=?").get(eventId).total;
  if(!zoneCount&&!existingTables.length){
    db.prepare(`
      INSERT INTO event_floor_zones(event_id,type,label,x,y,width,height,rotation,order_index)
      VALUES(?,?,?,?,?,?,?,?,?)
    `).run(eventId,"dance_floor","Pista de baile",34,34,32,28,0,0);
  }
}

function initializeLegacySeating(eventId){
  /* La columna guests.table_name es una compatibilidad histórica de nivel familia.
     RC13 intentaba reconstruir personas faltantes en CADA snapshot, de modo que una
     persona liberada/manualmente movida podía volver a una mesa antigua al refrescar.
     RC14 hace la conversión una sola vez por evento y después seating_assignments es
     la única fuente de verdad para el plano. */
  const alreadyImported=db.prepare("SELECT 1 FROM seating_legacy_imports WHERE event_id=?").get(eventId);
  if(alreadyImported)return;
  const existingAssignments=Number(db.prepare("SELECT COUNT(*) total FROM seating_assignments WHERE event_id=?").get(eventId).total||0);
  if(existingAssignments===0){
    const people=[...seatingPeople(eventId),...seatingPeople(eventId,{confirmedOnly:true})]
      .filter((person,index,list)=>list.findIndex(item=>item.guestId===person.guestId&&item.personKey===person.personKey)===index);
    const tables=db.prepare("SELECT * FROM event_tables WHERE event_id=? ORDER BY order_index,id").all(eventId);
    const byName=new Map(tables.map(table=>[String(table.name).trim().toLowerCase(),table]));
    const occupiedByTable=new Map(tables.map(table=>[table.id,new Set()]));
    const insert=db.prepare(`
      INSERT OR IGNORE INTO seating_assignments(event_id,guest_id,person_key,table_id,seat_index)
      VALUES(?,?,?,?,?)
    `);
    db.transaction(()=>people.forEach(person=>{
      const table=byName.get(String(person.legacyTable||"").trim().toLowerCase());
      if(!table)return;
      const occupied=occupiedByTable.get(table.id)||new Set();
      let seat=0;
      for(let candidate=1;candidate<=table.capacity;candidate++)if(!occupied.has(candidate)){seat=candidate;break;}
      if(!seat)return;
      insert.run(eventId,person.guestId,person.personKey,table.id,seat);
      occupied.add(seat);
    }))();
  }
  db.prepare("INSERT OR IGNORE INTO seating_legacy_imports(event_id) VALUES(?)").run(eventId);
}

function syncGuestSeatingFromTable(eventId,guestId){
  ensureEventTables(eventId);
  const guest=db.prepare(`
    SELECT id,table_name,max_adults,max_children
    FROM guests WHERE id=? AND event_id=?
  `).get(guestId,eventId);
  if(!guest)return {assigned:0,total:0,complete:false};

  const people=seatingPeople(eventId).filter(person=>person.guestId===guestId);
  const tableName=String(guest.table_name||"").trim();
  const tx=db.transaction(()=>{
    db.prepare("DELETE FROM seating_assignments WHERE event_id=? AND guest_id=?").run(eventId,guestId);
    if(!tableName||!people.length)return {assigned:0,total:people.length,complete:people.length===0};

    const table=db.prepare(`
      SELECT id,name,capacity FROM event_tables
      WHERE event_id=? AND LOWER(TRIM(name))=LOWER(TRIM(?))
      ORDER BY id LIMIT 1
    `).get(eventId,tableName);
    if(!table)return {assigned:0,total:people.length,complete:false};

    const occupied=new Set(db.prepare(`
      SELECT seat_index FROM seating_assignments
      WHERE event_id=? AND table_id=? AND guest_id<>?
    `).all(eventId,table.id,guestId).map(row=>Number(row.seat_index)));
    const insert=db.prepare(`
      INSERT INTO seating_assignments(event_id,guest_id,person_key,table_id,seat_index)
      VALUES(?,?,?,?,?)
    `);
    let assigned=0;
    for(const person of people){
      let seat=0;
      for(let candidate=1;candidate<=Number(table.capacity||0);candidate++){
        if(!occupied.has(candidate)){seat=candidate;break;}
      }
      if(!seat)break;
      insert.run(eventId,guestId,person.personKey,table.id,seat);
      occupied.add(seat);
      assigned++;
    }
    return {assigned,total:people.length,complete:assigned===people.length,tableId:table.id,tableName:table.name};
  });
  return tx();
}

function seatingSnapshot(eventId,{confirmedOnly=false}={}){
  ensureEventTables(eventId);
  initializeLegacySeating(eventId);
  const people=seatingPeople(eventId,{confirmedOnly});
  const validPeople=new Set([...seatingPeople(eventId),...seatingPeople(eventId,{confirmedOnly:true})].map(person=>`${person.guestId}:${person.personKey}`));
  const stale=db.prepare("SELECT id,guest_id,person_key FROM seating_assignments WHERE event_id=?").all(eventId)
    .filter(row=>!validPeople.has(`${row.guest_id}:${row.person_key}`));
  if(stale.length){
    const remove=db.prepare("DELETE FROM seating_assignments WHERE id=?");
    db.transaction(()=>stale.forEach(row=>remove.run(row.id)))();
  }
  const assignments=db.prepare(`
    SELECT id,guest_id AS guestId,person_key AS personKey,table_id AS tableId,seat_index AS seatIndex
    FROM seating_assignments WHERE event_id=? ORDER BY table_id,seat_index
  `).all(eventId);
  const activeKeys=new Set(people.map(person=>`${person.guestId}:${person.personKey}`));
  const activeAssignments=assignments.filter(row=>activeKeys.has(`${row.guestId}:${row.personKey}`));
  const assignmentByPerson=new Map(assignments.map(row=>[`${row.guestId}:${row.personKey}`,row]));
  const tables=db.prepare(`
    SELECT id,name,shape,capacity,x,y,width,height,rotation,order_index AS orderIndex
    FROM event_tables WHERE event_id=? ORDER BY order_index,id
  `).all(eventId).map(table=>{
    const tableAssignments=activeAssignments.filter(item=>item.tableId===table.id);
    const tableKeys=new Set(tableAssignments.map(item=>`${item.guestId}:${item.personKey}`));
    const tablePeople=people.filter(person=>tableKeys.has(`${person.guestId}:${person.personKey}`));
    const families=[...new Set(tablePeople.map(person=>person.family))];
    return {...table,occupied:tableAssignments.length,available:Math.max(0,table.capacity-tableAssignments.length),families};
  });
  const zones=db.prepare(`
    SELECT id,type,shape,label,x,y,width,height,rotation,order_index AS orderIndex
    FROM event_floor_zones WHERE event_id=? ORDER BY order_index,id
  `).all(eventId);
  const enrichedPeople=people.map(person=>({
    ...person,
    assignment:assignmentByPerson.get(`${person.guestId}:${person.personKey}`)||null
  }));
  const assigned=enrichedPeople.filter(person=>person.assignment).length;
  return {
    mode:confirmedOnly?"confirmed":"planned",tables,zones,people:enrichedPeople,
    summary:{
      people:people.length,assigned,unassigned:people.length-assigned,
      capacity:tables.reduce((sum,table)=>sum+table.capacity,0),
      availableSeats:tables.reduce((sum,table)=>sum+table.available,0)
    }
  };
}

function normalizeDesignKit(current={},incoming={}){
  const safe=/^#[0-9a-f]{6}$/i;
  const keys=["bg","paper","ink","muted","accent","gold","line"];
  const textures=new Set(["none","paper","linen","soft-grain","wash"]);
  const currentPalette=current?.palette&&typeof current.palette==="object"?current.palette:{};
  const requested=incoming?.palette&&typeof incoming.palette==="object"?incoming.palette:{};
  const palette={};
  keys.forEach(key=>{
    const value=String(requested[key]??currentPalette[key]??"").trim();
    if(safe.test(value))palette[key]=value;
  });
  const requestedTexture=String(incoming?.texture??current?.texture??"none");
  return {
    enabled:booleanValue(incoming?.enabled??current?.enabled),
    palette,
    texture:textures.has(requestedTexture)?requestedTexture:"none"
  };
}
function themeDescriptor(settings){
  const base=themeDesignFor(themeDesigns,settings?.themeId);
  const kit=normalizeDesignKit({},settings?.designKit||{});
  const merged=kit.enabled?{...base.palette,...kit.palette}:base.palette;
  return {...base,palette:Object.freeze(ensureAccessiblePalette(merged)),texture:kit.enabled?kit.texture:"none"};
}

function qrPalette(settings){
  return qrDesignOf(settings).useInvitationColors===false
    ?NEUTRAL_PALETTE
    :themeDescriptor(settings).palette;
}

const QR_TEMPLATE_IDS=new Set(qrTemplates.map(item=>item.id));
const PHYSICAL_TEMPLATE_IDS=new Set(["auto-theme","coordinated-arch","editorial-silk","classic-frame"]);

function normalizeQrDesign(currentDesign,incomingDesign={}){
  const current=currentDesign&&typeof currentDesign==="object"?currentDesign:{};
  const incoming=incomingDesign&&typeof incomingDesign==="object"?incomingDesign:{};
  const merged={
    templateId:"classic-holder",
    title:"Captura nuestros recuerdos",
    message:"Escanea el código y comparte las fotografías que tomes durante la celebración.",
    instruction:"No necesitas instalar ninguna aplicación.",
    showTableName:true,
    showFamilies:false,
    useInvitationColors:true,
    ...current,
    ...incoming
  };
  return {
    templateId:QR_TEMPLATE_IDS.has(String(merged.templateId))?String(merged.templateId):"classic-holder",
    title:cleanText(merged.title,120)||"Captura nuestros recuerdos",
    message:cleanText(merged.message,360)||"Escanea el código y comparte las fotografías que tomes durante la celebración.",
    instruction:cleanText(merged.instruction,180)||"No necesitas instalar ninguna aplicación.",
    showTableName:booleanValue(merged.showTableName),
    showFamilies:booleanValue(merged.showFamilies),
    useInvitationColors:booleanValue(merged.useInvitationColors)
  };
}

function normalizePhysicalInvitation(currentInvitation,incomingInvitation={}){
  const current=currentInvitation&&typeof currentInvitation==="object"?currentInvitation:{};
  const incoming=incomingInvitation&&typeof incomingInvitation==="object"?incomingInvitation:{};
  const templateId=String(incoming.templateId||current.templateId||"auto-theme");
  return {templateId:PHYSICAL_TEMPLATE_IDS.has(templateId)?templateId:"auto-theme"};
}

function qrDesignOf(settings){
  return normalizeQrDesign({},settings?.qrDesign);
}

function qrFamilies(eventId,table){
  if(!String(table||"").trim())return [];
  return db.prepare(`
    SELECT family_name FROM guests
    WHERE event_id=? AND COALESCE(is_test,0)=0 AND LOWER(TRIM(COALESCE(table_name,'')))=LOWER(TRIM(?))
    ORDER BY family_name LIMIT 12
  `).all(eventId,table).map(row=>row.family_name);
}

function drawStar(doc,cx,cy,outerRadius,innerRadius,points=5){
  for(let index=0;index<points*2;index++){
    const radius=index%2===0?outerRadius:innerRadius;
    const angle=-Math.PI/2+Math.PI*index/points;
    const px=cx+Math.cos(angle)*radius;
    const py=cy+Math.sin(angle)*radius;
    if(index===0)doc.moveTo(px,py);else doc.lineTo(px,py);
  }
  doc.closePath();
}

function drawThemeMotif(doc,{motif="spark",palette,x,y,scale=1,darkBackground=false,opacity=.22}){
  const primary=darkBackground?"#ffffff":palette.accent;
  const secondary=darkBackground?"#ffffff":palette.gold;
  const s=Math.max(.5,Number(scale)||1);
  doc.save().fillOpacity(opacity).strokeOpacity(Math.min(1,opacity+.22)).lineWidth(Math.max(.7,s));
  switch(motif){
    case "paw":
      doc.fillColor(primary).ellipse(x,y+6*s,9*s,7*s).fill();
      [[-9,-4],[-3,-9],[4,-9],[10,-4]].forEach(([dx,dy])=>doc.circle(x+dx*s,y+dy*s,3.4*s).fill());
      break;
    case "block":
    case "pixel":
      for(let row=0;row<3;row++)for(let column=0;column<3;column++){
        if((row+column+(motif==="pixel"?1:0))%2===0)doc.fillColor((row+column)%3?primary:secondary).rect(x+(column-1)*8*s,y+(row-1)*8*s,6*s,6*s).fill();
      }
      break;
    case "bubble":
    case "cloud":
      [[-10,2,8],[-2,-5,11],[9,1,8],[1,6,10]].forEach(([dx,dy,r])=>doc.fillColor(primary).circle(x+dx*s,y+dy*s,r*s).fill());
      break;
    case "confetti":
      [[-12,-8,7,2],[-2,4,3,8],[8,-6,8,3],[11,8,4,7]].forEach(([dx,dy,rx,ry],index)=>{
        doc.save().translate(x+dx*s,y+dy*s).rotate(index*27).fillColor(index%2?secondary:primary).rect(-rx*s/2,-ry*s/2,rx*s,ry*s).fill().restore();
      });
      break;
    case "flag":
      doc.strokeColor(primary).moveTo(x-18*s,y-10*s).bezierCurveTo(x-4*s,y-16*s,x+6*s,y-4*s,x+19*s,y-10*s).stroke();
      [-12,-2,8].forEach((dx,index)=>doc.fillColor(index%2?secondary:primary).moveTo(x+dx*s,y-10*s).lineTo(x+(dx+7)*s,y-8*s).lineTo(x+(dx+3)*s,y*s).closePath().fill());
      break;
    case "frame":
      doc.strokeColor(primary).rect(x-16*s,y-12*s,32*s,24*s).stroke();
      doc.strokeColor(secondary).rect(x-11*s,y-8*s,22*s,16*s).stroke();
      break;
    case "daisy":
      for(let index=0;index<8;index++){
        doc.save().translate(x,y).rotate(index*45).fillColor(darkBackground?"#ffffff":palette.paper).ellipse(0,-10*s,4.3*s,9.5*s).fill().restore();
      }
      doc.fillColor(secondary).circle(x,y,5.2*s).fill();
      doc.strokeColor(primary).moveTo(x,y+5*s).bezierCurveTo(x-2*s,y+13*s,x+3*s,y+20*s,x+s,y+27*s).stroke();
      doc.save().translate(x-2*s,y+18*s).rotate(-32).fillColor(primary).ellipse(0,0,5*s,2.2*s).fill().restore();
      break;
    case "leaf":
      [-10,0,10].forEach((dx,index)=>{
        doc.save().translate(x+dx*s,y+(index%2?3:-2)*s).rotate(index%2?35:-35).fillColor(index%2?secondary:primary).ellipse(0,0,8*s,3.5*s).fill().restore();
      });
      break;
    case "paper":
      doc.save().translate(x,y).rotate(-9).fillColor(primary).rect(-14*s,-10*s,28*s,20*s).fill().restore();
      doc.save().translate(x+3*s,y+2*s).rotate(7).fillColor(secondary).rect(-12*s,-9*s,24*s,18*s).fill().restore();
      break;
    case "stamp":
      doc.strokeColor(primary).circle(x,y,14*s).stroke();
      doc.strokeColor(secondary).circle(x,y,9*s).stroke();
      doc.fillColor(primary).circle(x,y,2.5*s).fill();
      break;
    case "light":
      doc.strokeColor(primary);
      for(let index=0;index<8;index++){
        const angle=Math.PI*2*index/8;
        doc.moveTo(x+Math.cos(angle)*7*s,y+Math.sin(angle)*7*s)
          .lineTo(x+Math.cos(angle)*16*s,y+Math.sin(angle)*16*s).stroke();
      }
      doc.fillColor(secondary).circle(x,y,5*s).fill();
      break;
    case "star":
    case "spark":
    default:
      doc.fillColor(primary);drawStar(doc,x,y,15*s,6*s,motif==="spark"?4:5);doc.fill();
      doc.fillColor(secondary).circle(x+14*s,y-10*s,2.4*s).fill();
      break;
  }
  doc.restore();
}

function drawDecorativeCorners(doc,palette,x,y,w,h,templateId,theme,darkBackground){
  doc.save();
  doc.lineWidth(1);
  if(["classic-holder","photo-frame","acrylic-arch"].includes(templateId)){
    doc.strokeColor(palette.gold).moveTo(x+16,y+42).bezierCurveTo(x+28,y+14,x+52,y+18,x+68,y+8).stroke();
    doc.fillColor(palette.accent).circle(x+25,y+28,3).fill();
    doc.fillColor(palette.gold).circle(x+44,y+20,2.5).fill();
    doc.strokeColor(palette.gold).moveTo(x+w-16,y+h-42).bezierCurveTo(x+w-28,y+h-14,x+w-52,y+h-18,x+w-68,y+h-8).stroke();
  }else if(templateId==="table-number-combo"){
    doc.strokeColor(palette.gold).lineWidth(2);
    doc.rect(x+12,y+12,18,18).stroke();
    doc.rect(x+w-30,y+12,18,18).stroke();
    doc.rect(x+12,y+h-30,18,18).stroke();
    doc.rect(x+w-30,y+h-30,18,18).stroke();
  }
  doc.restore();
  drawThemeMotif(doc,{
    motif:theme?.motif||"spark",
    palette,
    x:x+w-31,
    y:y+31,
    scale:.55,
    darkBackground,
    opacity:.18
  });
}

const QR_PAGE_SIZES={
  "5x7":[360,504],
  square:[360,360],
  "4x9":[288,648],
  "letter-fold":"LETTER"
};

function qrPageSize(format){
  return QR_PAGE_SIZES[format]||QR_PAGE_SIZES["5x7"];
}

const PDF_FONT_FILES={
  EventSans:path.join(publicDir,"fonts","montserrat-400.ttf"),
  EventSansBold:path.join(publicDir,"fonts","montserrat-600.ttf"),
  EventSerif:path.join(publicDir,"fonts","cormorant-garamond-400.ttf"),
  EventSerifBold:path.join(publicDir,"fonts","cormorant-garamond-600.ttf")
};
const PDF_CUSTOM_FONTS_AVAILABLE=Object.values(PDF_FONT_FILES).every(file=>fs.existsSync(file));

function registerPdfFonts(doc){
  if(!PDF_CUSTOM_FONTS_AVAILABLE)return false;
  for(const [name,file] of Object.entries(PDF_FONT_FILES))doc.registerFont(name,file);
  return true;
}

async function renderPdfBuffer(options,draw){
  const doc=new PDFDocument(options);
  registerPdfFonts(doc);
  const chunks=[];
  const completed=new Promise((resolve,reject)=>{
    doc.on("data",chunk=>chunks.push(chunk));
    doc.once("end",()=>resolve(Buffer.concat(chunks)));
    doc.once("error",reject);
  });
  try{
    await draw(doc);
    doc.end();
    return await completed;
  }catch(error){
    doc.removeAllListeners();
    try{doc.end();}catch{}
    throw error;
  }
}

function pdfFont(font){
  if(!PDF_CUSTOM_FONTS_AVAILABLE)return font;
  return {Helvetica:"EventSans","Helvetica-Bold":"EventSansBold","Helvetica-Oblique":"EventSerif",Times:"EventSerif","Times-Roman":"EventSerif","Times-Bold":"EventSerifBold","Times-Italic":"EventSerif"}[font]||font;
}

function drawBoundedText(doc,text,{x,y,width,height,font="Helvetica",size=10,minSize=6.5,color="#222222",align="center",lineGap=1,ellipsis=true,characterSpacing=0}={}){
  const value=String(text||"").trim();
  if(!value)return;
  let fitted=size;
  doc.font(pdfFont(font));
  while(fitted>minSize){
    doc.fontSize(fitted);
    if(doc.heightOfString(value,{width,lineGap,characterSpacing})<=height)break;
    fitted=Math.max(minSize,fitted-0.5);
  }
  doc.fontSize(fitted).fillColor(color).text(value,x,y,{width,height,align,lineGap,ellipsis,characterSpacing});
}

function drawPlatformAttribution(doc,{channel="print",darkBackground=false}={}){
  const branding=platformSetting("branding",{});
  if(!branding.attributionEnabled)return;
  if(channel==="qr"&&!branding.attributionOnQr)return;
  if(channel==="print"&&!branding.attributionOnPrint)return;
  const label=cleanText(branding.attributionLabel||"Creado con EventStudio",80)||"Creado con EventStudio";
  const pageW=doc.page.width,pageH=doc.page.height;
  doc.save().fillOpacity(.72).font("Helvetica").fontSize(5.2).fillColor(darkBackground?"#f6f2eb":"#777777")
    .text(label,20,pageH-12,{width:pageW-40,align:"center",lineBreak:false});
  doc.restore();
}

function drawTablePill(doc,{text,x,y,width,height,palette,darkBackground,fontSize=10.5}){
  doc.save();
  if(darkBackground)doc.fillColor("#ffffff").fillOpacity(0.16);
  else doc.fillColor("#f2e8df");
  doc.roundedRect(x,y,width,height,height/2).fill();
  doc.restore();
  drawBoundedText(doc,text||"QR general",{
    x:x+8,y:y+Math.max(5,(height-fontSize)/2-1),width:width-16,height:fontSize+4,
    font:"Helvetica-Bold",size:fontSize,minSize:7.5,color:darkBackground?"#ffffff":palette.accent
  });
}

function drawStandardQrCard(doc,{settings,table,families=[],qr,templateId,pageSize,palette,bg,ink,darkBackground,theme}){
  const design=qrDesignOf(settings);
  const pageW=doc.page.width;
  const pageH=doc.page.height;
  const isSquare=pageSize==="square";
  const isStrip=pageSize==="4x9";
  const frame=isSquare
    ?{x:14,y:14,w:pageW-28,h:pageH-28,r:14}
    :isStrip
      ?{x:18,y:18,w:pageW-36,h:pageH-36,r:14}
      :{x:20,y:18,w:pageW-40,h:pageH-36,r:templateId==="acrylic-arch"?82:16};

  const layout=isSquare?{
    kicker:{y:30,h:10,size:7.5},title:{y:44,h:36,size:17},qr:{y:86,size:128},
    message:{y:222,h:30,size:7.5},instruction:{y:257,h:14,size:6.5},
    pill:{y:278,w:154,h:24},couple:{y:309,h:15,size:9.5},date:{y:330,h:9,size:6.5}
  }:isStrip?{
    kicker:{y:42,h:11,size:8},title:{y:59,h:50,size:19},qr:{y:123,size:156},
    message:{y:300,h:78,size:9},instruction:{y:389,h:28,size:7.5},
    pill:{y:454,w:168,h:28},couple:{y:498,h:20,size:11},date:{y:524,h:12,size:7.5}
  }:{
    kicker:{y:38,h:11,size:8.5},title:{y:54,h:44,size:21},qr:{y:108,size:168},
    message:{y:290,h:47,size:9},instruction:{y:344,h:20,size:7.5},
    pill:{y:375,w:170,h:26},couple:{y:413,h:18,size:11},date:{y:438,h:11,size:7.25}
  };

  doc.rect(0,0,pageW,pageH).fill(bg);
  doc.roundedRect(frame.x,frame.y,frame.w,frame.h,frame.r).lineWidth(1.35).strokeColor(palette.gold).stroke();
  drawDecorativeCorners(doc,palette,frame.x,frame.y,frame.w,frame.h,templateId,theme,darkBackground);

  drawBoundedText(doc,"COMPARTE TUS FOTOS",{
    x:frame.x+22,y:layout.kicker.y,width:frame.w-44,height:layout.kicker.h,
    font:"Times-Roman",size:layout.kicker.size,minSize:6.5,color:palette.gold,characterSpacing:1.1
  });
  drawBoundedText(doc,design.title,{
    x:frame.x+24,y:layout.title.y,width:frame.w-48,height:layout.title.h,
    font:"Times-Bold",size:layout.title.size,minSize:12,color:ink,lineGap:1
  });

  const qrX=(pageW-layout.qr.size)/2;
  doc.roundedRect(qrX-6,layout.qr.y-6,layout.qr.size+12,layout.qr.size+12,9).fill("#ffffff");
  doc.image(qr,qrX,layout.qr.y,{width:layout.qr.size,height:layout.qr.size});

  drawBoundedText(doc,design.message,{
    x:frame.x+25,y:layout.message.y,width:frame.w-50,height:layout.message.h,
    font:"Helvetica",size:layout.message.size,minSize:6.5,color:ink,lineGap:1.5
  });
  drawBoundedText(doc,design.instruction,{
    x:frame.x+28,y:layout.instruction.y,width:frame.w-56,height:layout.instruction.h,
    font:"Helvetica-Oblique",size:layout.instruction.size,minSize:6,color:darkBackground?"#f1e9dc":palette.muted,lineGap:1
  });

  if(design.showTableName){
    drawTablePill(doc,{
      text:table,x:(pageW-layout.pill.w)/2,y:layout.pill.y,width:layout.pill.w,height:layout.pill.h,
      palette,darkBackground,fontSize:isSquare?9:10.5
    });
  }
  const familyText=design.showFamilies&&families.length?families.join(" · "):"";
  if(familyText)drawBoundedText(doc,familyText,{
    x:frame.x+25,y:layout.pill.y+layout.pill.h+3,width:frame.w-50,height:isSquare?10:14,
    font:"Helvetica",size:isSquare?5.7:6.4,minSize:5.2,color:darkBackground?"#f1e9dc":palette.muted
  });
  const familyCoupleOffset=familyText?(isSquare?5:5):0;
  const familyDateOffset=familyText?(isSquare?0:5):0;
  drawBoundedText(doc,presentedName(settings.couple?.displayName||"Nuestro evento",settings.typography),{
    x:frame.x+24,y:layout.couple.y+familyCoupleOffset,width:frame.w-48,height:layout.couple.h,
    font:"Times-Bold",size:layout.couple.size,minSize:8,color:ink
  });
  drawBoundedText(doc,settings.event?.dateLabel||"",{
    x:frame.x+24,y:layout.date.y+familyDateOffset,width:frame.w-48,height:layout.date.h,
    font:"Helvetica",size:layout.date.size,minSize:6,color:darkBackground?"#f1e9dc":palette.muted
  });
  drawPlatformAttribution(doc,{channel:"qr",darkBackground});
}

function drawPhotoQrCard(doc,{settings,table,families=[],qr,palette,bg,ink,darkBackground,theme,heroPath}){
  const design=qrDesignOf(settings);
  const pageW=doc.page.width;
  const pageH=doc.page.height;
  const frame={x:18,y:18,w:pageW-36,h:pageH-36};
  doc.rect(0,0,pageW,pageH).fill(bg);
  doc.roundedRect(frame.x,frame.y,frame.w,frame.h,16).lineWidth(1.25).strokeColor(palette.gold).stroke();

  const cover={x:30,y:30,w:pageW-60,h:154};
  doc.save().roundedRect(cover.x,cover.y,cover.w,cover.h,14).clip();
  if(heroPath&&fs.existsSync(heroPath)){
    doc.image(heroPath,cover.x,cover.y,{cover:[cover.w,cover.h],align:"center",valign:"center"});
    doc.fillColor("#000000").fillOpacity(.28).rect(cover.x,cover.y,cover.w,cover.h).fill();
  }else{
    doc.fillColor(palette.accent).rect(cover.x,cover.y,cover.w,cover.h).fill();
    drawThemeMotif(doc,{motif:theme?.motif,palette,x:cover.x+cover.w/2,y:cover.y+cover.h/2,scale:2.5,darkBackground:true,opacity:.22});
  }
  doc.restore();
  drawBoundedText(doc,design.title,{
    x:cover.x+22,y:cover.y+45,width:cover.w-44,height:50,font:"Times-Bold",size:22,minSize:14,color:"#ffffff"
  });
  drawBoundedText(doc,"FOTOGRAFÍA Y ÁLBUM DEL EVENTO",{
    x:cover.x+20,y:cover.y+112,width:cover.w-40,height:12,font:"Helvetica-Bold",size:7,minSize:6,
    color:"#ffffff",characterSpacing:.8
  });

  const qrSize=132;
  const qrX=(pageW-qrSize)/2;
  const qrY=202;
  doc.roundedRect(qrX-6,qrY-6,qrSize+12,qrSize+12,9).fill("#ffffff");
  doc.image(qr,qrX,qrY,{width:qrSize,height:qrSize});
  drawBoundedText(doc,design.message,{
    x:42,y:348,width:pageW-84,height:33,font:"Helvetica",size:7.8,minSize:6.2,color:ink,lineGap:1.2
  });
  if(design.showTableName)drawTablePill(doc,{
    text:table,x:(pageW-174)/2,y:389,width:174,height:27,palette,darkBackground,fontSize:10
  });
  if(design.showFamilies&&families.length)drawBoundedText(doc,families.join(" · "),{
    x:38,y:421,width:pageW-76,height:13,font:"Helvetica",size:6,minSize:5.2,
    color:darkBackground?"#f1e9dc":palette.muted
  });
  drawBoundedText(doc,presentedName(settings.couple?.displayName||"Nuestro evento",settings.typography),{
    x:35,y:443,width:pageW-70,height:18,font:"Times-Bold",size:11,minSize:8,color:ink
  });
  drawBoundedText(doc,settings.event?.dateLabel||"",{
    x:35,y:466,width:pageW-70,height:10,font:"Helvetica",size:6.8,minSize:5.8,
    color:darkBackground?"#f1e9dc":palette.muted
  });
  drawPlatformAttribution(doc,{channel:"qr",darkBackground});
}

function drawTableNumberQrCard(doc,{settings,table,families=[],qr,palette,bg,ink,darkBackground,theme}){
  const design=qrDesignOf(settings);
  const pageW=doc.page.width;
  const pageH=doc.page.height;
  doc.rect(0,0,pageW,pageH).fill(bg);
  doc.roundedRect(18,18,pageW-36,pageH-36,14).lineWidth(1.5).strokeColor(palette.gold).stroke();
  drawThemeMotif(doc,{motif:theme?.motif,palette,x:55,y:54,scale:1,darkBackground,opacity:.2});
  drawThemeMotif(doc,{motif:theme?.motif,palette,x:pageW-55,y:54,scale:1,darkBackground,opacity:.2});
  drawBoundedText(doc,"MESA",{
    x:32,y:39,width:pageW-64,height:13,font:"Helvetica-Bold",size:8,minSize:6.5,
    color:palette.gold,characterSpacing:2
  });
  drawBoundedText(doc,table||"QR general",{
    x:30,y:62,width:pageW-60,height:60,font:"Times-Bold",size:31,minSize:17,color:ink
  });
  doc.moveTo(70,130).lineTo(pageW-70,130).lineWidth(.8).strokeColor(palette.gold).stroke();
  const qrSize=164;
  const qrX=(pageW-qrSize)/2;
  const qrY=148;
  doc.roundedRect(qrX-7,qrY-7,qrSize+14,qrSize+14,10).fill("#ffffff");
  doc.image(qr,qrX,qrY,{width:qrSize,height:qrSize});
  drawBoundedText(doc,design.title,{
    x:38,y:329,width:pageW-76,height:33,font:"Times-Bold",size:16,minSize:10,color:ink
  });
  drawBoundedText(doc,design.message,{
    x:43,y:367,width:pageW-86,height:39,font:"Helvetica",size:7.5,minSize:6,color:ink,lineGap:1.3
  });
  if(design.showFamilies&&families.length)drawBoundedText(doc,families.join(" · "),{
    x:38,y:410,width:pageW-76,height:17,font:"Helvetica",size:6.1,minSize:5.2,
    color:darkBackground?"#f1e9dc":palette.muted
  });
  drawBoundedText(doc,presentedName(settings.couple?.displayName||"Nuestro evento",settings.typography),{
    x:34,y:438,width:pageW-68,height:17,font:"Times-Bold",size:10.5,minSize:8,color:ink
  });
  drawBoundedText(doc,settings.event?.dateLabel||"",{
    x:34,y:460,width:pageW-68,height:10,font:"Helvetica",size:6.8,minSize:5.8,
    color:darkBackground?"#f1e9dc":palette.muted
  });
  drawPlatformAttribution(doc,{channel:"qr",darkBackground});
}

function drawFoldPanel(doc,{settings,table,families=[],qr,palette,ink,darkBackground,theme,x,y,w,h}){
  const design=qrDesignOf(settings);
  const leftX=x+28;
  const leftW=w-235;
  const qrSize=148;
  const qrX=x+w-28-qrSize;
  const qrY=y+61;

  doc.roundedRect(x,y,w,h,16).lineWidth(1.25).strokeColor(palette.gold).stroke();
  drawThemeMotif(doc,{motif:theme?.motif,palette,x:x+w-35,y:y+32,scale:.6,darkBackground,opacity:.2});
  drawBoundedText(doc,"COMPARTE TUS FOTOS",{
    x:leftX,y:y+34,width:leftW,height:12,font:"Times-Roman",size:8,minSize:6.5,
    color:palette.gold,align:"left",characterSpacing:1.1
  });
  drawBoundedText(doc,design.title,{
    x:leftX,y:y+55,width:leftW,height:54,font:"Times-Bold",size:22,minSize:14,color:ink,align:"left",lineGap:1
  });
  drawBoundedText(doc,design.message,{
    x:leftX,y:y+121,width:leftW,height:70,font:"Helvetica",size:9.5,minSize:7,color:ink,align:"left",lineGap:2
  });
  drawBoundedText(doc,design.instruction,{
    x:leftX,y:y+202,width:leftW,height:32,font:"Helvetica-Oblique",size:8,minSize:6.5,
    color:darkBackground?"#f1e9dc":palette.muted,align:"left",lineGap:1
  });
  drawBoundedText(doc,presentedName(settings.couple?.displayName||"Nuestro evento",settings.typography),{
    x:leftX,y:y+252,width:leftW,height:22,font:"Times-Bold",size:13,minSize:9,color:ink,align:"left"
  });
  drawBoundedText(doc,settings.event?.dateLabel||"",{
    x:leftX,y:y+280,width:leftW,height:14,font:"Helvetica",size:7.5,minSize:6,
    color:darkBackground?"#f1e9dc":palette.muted,align:"left"
  });

  doc.roundedRect(qrX-7,qrY-7,qrSize+14,qrSize+14,10).fill("#ffffff");
  doc.image(qr,qrX,qrY,{width:qrSize,height:qrSize});
  if(design.showTableName){
    drawTablePill(doc,{
      text:table,x:qrX-4,y:y+233,width:qrSize+8,height:28,palette,darkBackground,fontSize:10
    });
  }
  if(design.showFamilies&&families.length)drawBoundedText(doc,families.join(" · "),{
    x:leftX,y:y+303,width:leftW,height:18,font:"Helvetica",size:6.2,minSize:5.2,
    color:darkBackground?"#f1e9dc":palette.muted,align:"left"
  });
  drawBoundedText(doc,"Escanea para abrir el álbum",{
    x:qrX-6,y:y+277,width:qrSize+12,height:14,font:"Helvetica-Bold",size:7.5,minSize:6.5,
    color:darkBackground?"#ffffff":palette.accent
  });
}

function drawPremiumFrontPanel(doc,{settings,table,palette,ink,darkBackground,theme,x,y,w,h}){
  doc.roundedRect(x,y,w,h,16).lineWidth(1.25).strokeColor(palette.gold).stroke();
  drawThemeMotif(doc,{motif:theme?.motif,palette,x:x+w/2,y:y+95,scale:2.2,darkBackground,opacity:.2});
  drawBoundedText(doc,"RECUERDOS DEL EVENTO",{
    x:x+45,y:y+35,width:w-90,height:13,font:"Helvetica-Bold",size:7,minSize:6,
    color:palette.gold,characterSpacing:1.5
  });
  drawBoundedText(doc,presentedName(settings.couple?.displayName||"Nuestro evento",settings.typography),{
    x:x+45,y:y+135,width:w-90,height:52,font:"Times-Bold",size:24,minSize:15,color:ink
  });
  drawBoundedText(doc,settings.event?.dateLabel||"",{
    x:x+50,y:y+197,width:w-100,height:15,font:"Helvetica",size:8,minSize:6.5,
    color:darkBackground?"#f1e9dc":palette.muted,characterSpacing:.5
  });
  drawTablePill(doc,{
    text:table,x:x+(w-190)/2,y:y+238,width:190,height:30,palette,darkBackground,fontSize:11
  });
  drawBoundedText(doc,"El código para compartir fotografías se encuentra al reverso.",{
    x:x+65,y:y+286,width:w-130,height:24,font:"Helvetica-Oblique",size:7,minSize:6,
    color:darkBackground?"#f1e9dc":palette.muted
  });
}

function colorIsDark(value){
  const hex=String(value||"").replace("#","");
  if(!/^[0-9a-f]{6}$/i.test(hex))return false;
  const [red,green,blue]=[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16));
  return (red*299+green*587+blue*114)/1000<118;
}

function drawQrCard(doc,{settings,table,families=[],qr,templateId,pageSize,heroPath=null}){
  const descriptor=themeDescriptor(settings);
  const theme=descriptor.theme;
  const palette=qrPalette(settings);
  const pageW=doc.page.width;
  const pageH=doc.page.height;
  const premiumBackground=templateId==="double-sided-premium"
    ?(colorIsDark(palette.paper)?palette.bg:palette.accent)
    :null;
  const darkBackground=templateId==="double-sided-premium"||colorIsDark(palette.paper);
  const bg=premiumBackground||(darkBackground?palette.bg:palette.paper);
  const ink=darkBackground?"#ffffff":palette.ink;
  if(templateId==="photo-frame"){
    drawPhotoQrCard(doc,{settings,table,families,qr,palette,bg,ink,darkBackground,theme,heroPath});
    return;
  }
  if(templateId==="table-number-combo"){
    drawTableNumberQrCard(doc,{settings,table,families,qr,palette,bg,ink,darkBackground,theme});
    return;
  }
  if(pageSize!=="letter-fold"){
    drawStandardQrCard(doc,{settings,table,families,qr,templateId,pageSize,palette,bg,ink,darkBackground,theme});
    return;
  }

  doc.rect(0,0,pageW,pageH).fill(bg);
  const panel={x:36,w:pageW-72,h:342};
  doc.save();
  doc.rotate(180,{origin:[pageW/2,pageH/4]});
  if(templateId==="double-sided-premium"){
    drawPremiumFrontPanel(doc,{settings,table,palette,ink,darkBackground,theme,...panel,y:27});
  }else{
    drawFoldPanel(doc,{settings,table,families,qr,palette,ink,darkBackground,theme,...panel,y:27});
  }
  doc.restore();
  drawFoldPanel(doc,{settings,table,families,qr,palette,ink,darkBackground,theme,...panel,y:423});
  doc.save().dash(5,{space:5}).strokeColor(darkBackground?"#ffffff":palette.muted).strokeOpacity(darkBackground?0.5:1)
    .moveTo(30,pageH/2).lineTo(pageW-30,pageH/2).stroke().undash().restore();
  drawBoundedText(doc,"DOBLAR",{
    x:pageW-78,y:pageH/2-5,width:45,height:10,font:"Helvetica-Bold",size:6,minSize:6,
    color:darkBackground?"#ffffff":palette.muted,align:"right"
  });
}

function drawAutoPhysicalMotif(doc,{family,palette,pageW,pageH,theme}){
  doc.save();
  if(family==="cinematic"){
    doc.rect(0,0,17,pageH).fill(palette.accent);doc.rect(pageW-9,0,9,pageH).fill(palette.gold);
  }else if(family==="botanical"){
    doc.fillColor(palette.accent).fillOpacity(.12);
    [[24,30,18],[45,17,12],[pageW-26,pageH-28,20],[pageW-48,pageH-13,12]].forEach(([x,y,r])=>doc.ellipse(x,y,r,r*.46).fill());
    doc.fillOpacity(1);
  }else if(family==="storybook"){
    doc.rect(18,18,pageW-36,pageH-36).lineWidth(.55).strokeColor(palette.gold).stroke();
    doc.circle(pageW/2,pageH-24,11).fill(palette.accent);doc.circle(pageW/2,pageH-24,7).lineWidth(.5).strokeColor(palette.paper).stroke();
  }else if(family==="lavender"){
    doc.fillColor(palette.accent).fillOpacity(.08).circle(28,70,72).fill().circle(pageW-20,pageH-55,86).fill();doc.fillOpacity(1);
  }else if(family==="playful"){
    doc.fillColor(palette.accent).fillOpacity(.08).circle(32,70,82).fill();
    doc.fillColor(palette.gold).fillOpacity(.1).circle(pageW-24,pageH-62,92).fill();
    doc.fillOpacity(1);
  }else{
    doc.moveTo(26,20).bezierCurveTo(110,3,pageW-110,3,pageW-26,20).lineWidth(.7).strokeColor(palette.gold).stroke();
  }
  doc.restore();
  drawThemeMotif(doc,{motif:theme?.motif,palette,x:36,y:36,scale:.72,opacity:.16});
  drawThemeMotif(doc,{motif:theme?.motif,palette,x:pageW-36,y:pageH-36,scale:.72,opacity:.16});
}

function primaryEventLocation(settings={}){
  const agendaItems=Array.isArray(settings.agenda?.items)?settings.agenda.items:[];
  const agenda=agendaItems.find(item=>item&&item.enabled!==false&&(item.venue||item.address||item.mapsUrl));
  if(agenda){
    return {
      title:cleanText(agenda.title||settings.presentation?.agendaTitle||"CEREMONIA Y CELEBRACIÓN",120),
      name:cleanText(agenda.venue||agenda.name||"",180),
      address:cleanText(agenda.address||"",300),
      mapsUrl:safeHttpUrl(agenda.mapsUrl||"")
    };
  }
  const ceremony=settings.venues?.ceremony||{},reception=settings.venues?.reception||{};
  const chosen=(ceremony.name||ceremony.address||ceremony.mapsUrl)?ceremony:reception;
  if(chosen.name||chosen.address||chosen.mapsUrl){
    return {title:cleanText(chosen.title||"CEREMONIA Y CELEBRACIÓN",120),name:cleanText(chosen.name||"",180),address:cleanText(chosen.address||"",300),mapsUrl:safeHttpUrl(chosen.mapsUrl||"")};
  }
  const legacy=settings.venue||{};
  return {title:cleanText(legacy.title||"CEREMONIA Y CELEBRACIÓN",120),name:cleanText(legacy.name||"",180),address:cleanText(legacy.address||"",300),mapsUrl:safeHttpUrl(legacy.mapsUrl||"")};
}

function drawPhysicalInvitation(doc,{settings,guest,qr,heroPath,templateId="auto-theme"}){
  const descriptor=themeDescriptor(settings);
  const theme=descriptor.theme;
  const palette=descriptor.palette;
  const autoFamily=templateId==="auto-theme"?printFamilyFor(theme):"";
  const effectiveTemplate=templateId==="auto-theme"
    ?(autoFamily==="cinematic"?"editorial-silk":autoFamily==="storybook"?"classic-frame":"coordinated-arch")
    :templateId;
  const pageW=doc.page.width;
  const pageH=doc.page.height;
  const margin=22;
  doc.rect(0,0,pageW,pageH).fill(palette.paper);
  doc.roundedRect(12,12,pageW-24,pageH-24,12).lineWidth(1).strokeColor(palette.gold).stroke();
  if(effectiveTemplate==="classic-frame")doc.rect(18,18,pageW-36,pageH-36).lineWidth(.5).strokeColor(palette.gold).stroke();
  if(effectiveTemplate==="editorial-silk"){
    doc.rect(0,0,18,pageH).fill(palette.accent);
    doc.rect(pageW-10,0,10,pageH).fill(palette.gold);
  }
  if(templateId==="auto-theme")drawAutoPhysicalMotif(doc,{family:autoFamily,palette,pageW,pageH,theme});

  const cover={x:margin,y:margin,w:pageW-margin*2,h:152};
  doc.save();
  const coverRadius=effectiveTemplate==="coordinated-arch"?76:(effectiveTemplate==="classic-frame"?4:18);
  doc.roundedRect(cover.x,cover.y,cover.w,cover.h,coverRadius).clip();
  if(heroPath&&fs.existsSync(heroPath)){
    doc.image(heroPath,cover.x,cover.y,{cover:[cover.w,cover.h],align:"center",valign:"center"});
    doc.fillColor("#000000").fillOpacity(0.3).rect(cover.x,cover.y,cover.w,cover.h).fill();
  }else{
    doc.fillColor(palette.accent).rect(cover.x,cover.y,cover.w,cover.h).fill();
    doc.fillColor(palette.gold).fillOpacity(0.3).circle(pageW-62,52,64).fill();
    doc.fillColor(palette.paper).fillOpacity(0.12).circle(70,150,75).fill();
  }
  doc.restore();
  drawBoundedText(doc,settings.presentation?.heroEyebrow||"INVITACIÓN ESPECIAL",{
    x:cover.x+25,y:cover.y+37,width:cover.w-50,height:13,font:"Helvetica-Bold",size:7,minSize:6,
    color:"#ffffff",characterSpacing:1.4
  });
  drawBoundedText(doc,presentedName(settings.couple?.displayName||"Nuestro evento",settings.typography),{
    x:cover.x+24,y:cover.y+58,width:cover.w-48,height:55,font:"Times-Bold",size:25,minSize:15,
    color:"#ffffff",lineGap:1
  });
  drawBoundedText(doc,settings.event?.dateLabel||"",{
    x:cover.x+24,y:cover.y+119,width:cover.w-48,height:14,font:"Helvetica",size:8,minSize:6.5,
    color:"#ffffff",characterSpacing:.6
  });

  drawBoundedText(doc,"HEMOS RESERVADO UN LUGAR PARA",{
    x:34,y:194,width:292,height:11,font:"Helvetica-Bold",size:6.6,minSize:6,color:palette.gold,characterSpacing:1.15
  });
  drawBoundedText(doc,presentedName(guest.family_name,settings.typography),{
    x:34,y:211,width:292,height:37,font:"Times-Bold",size:21,minSize:13,color:palette.ink
  });
  const places=[
    guest.max_adults?`${guest.max_adults} adulto${guest.max_adults===1?"":"s"}`:"",
    guest.max_children?`${guest.max_children} niño${guest.max_children===1?"":"s"}`:""
  ].filter(Boolean).join(" · ");
  drawBoundedText(doc,places,{
    x:34,y:250,width:292,height:14,font:"Helvetica",size:8,minSize:6.5,color:palette.muted
  });
  doc.moveTo(64,275).lineTo(pageW-64,275).lineWidth(.7).strokeColor(palette.gold).stroke();
  drawBoundedText(doc,settings.event?.heroMessage||"Nos dará mucha alegría compartir este día contigo.",{
    x:44,y:288,width:272,height:48,font:"Times-Italic",size:10.5,minSize:8,color:palette.ink,lineGap:2
  });

  const qrSize=88;
  const qrX=pageW-margin-qrSize;
  const qrY=365;
  doc.roundedRect(qrX-5,qrY-5,qrSize+10,qrSize+10,7).fill("#ffffff");
  doc.image(qr,qrX,qrY,{width:qrSize,height:qrSize});
  drawBoundedText(doc,"Escanea para ver la invitación y confirmar",{
    x:qrX-8,y:458,width:qrSize+16,height:22,font:"Helvetica",size:6.5,minSize:5.8,color:palette.muted,lineGap:1
  });
  const physicalVenue=primaryEventLocation(settings);
  drawBoundedText(doc,physicalVenue.title||"CEREMONIA Y CELEBRACIÓN",{
    x:35,y:365,width:185,height:12,font:"Helvetica-Bold",size:6.5,minSize:5.8,color:palette.gold,
    align:"left",characterSpacing:.8
  });
  drawBoundedText(doc,physicalVenue.name||physicalVenue.address||"Consulta los detalles en la invitación",{
    x:35,y:384,width:185,height:35,font:"Times-Bold",size:12,minSize:8.5,color:palette.ink,align:"left",lineGap:1
  });
  drawBoundedText(doc,physicalVenue.address||"",{
    x:35,y:424,width:185,height:28,font:"Helvetica",size:7.2,minSize:6,color:palette.muted,align:"left",lineGap:1
  });
  drawPlatformAttribution(doc,{channel:"print",darkBackground:false});
}

const SEATING_ZONE_LABELS={
  dance_floor:"Pista de baile",stage:"Escenario",entrance:"Entrada",bar:"Bar",
  aisle:"Pasillo",restrooms:"Sanitarios",other:"Área especial"
};

function seatingModeLabel(mode){return mode==="confirmed"?"Sólo personas confirmadas":"Todos los lugares planeados";}

function drawSeatingPdfPageHeader(doc,{settings,snapshot,palette,title="Plano y distribución de mesas",subtitle=""}){
  const pageW=doc.page.width;
  doc.rect(0,0,pageW,72).fill(palette.accent);
  drawBoundedText(doc,presentedName(settings.couple?.displayName||settings._event?.name||"Evento",settings.typography),{
    x:34,y:18,width:500,height:28,font:"Times-Bold",size:21,minSize:14,color:"#ffffff",align:"left"
  });
  drawBoundedText(doc,title,{
    x:35,y:48,width:500,height:13,font:"Helvetica",size:8,minSize:7,color:"#ffffff",align:"left",characterSpacing:.5
  });
  doc.roundedRect(pageW-222,20,188,30,15).fillColor(palette.gold).fill();
  drawBoundedText(doc,seatingModeLabel(snapshot.mode),{
    x:pageW-214,y:29,width:172,height:12,font:"Helvetica-Bold",size:7.5,minSize:6.4,color:"#ffffff"
  });
  if(subtitle)drawBoundedText(doc,subtitle,{
    x:pageW-222,y:54,width:188,height:10,font:"Helvetica",size:6.5,minSize:6,color:"#ffffff",align:"right"
  });
}

function drawSeatingPlanPdf(doc,{settings,snapshot}){
  const palette=qrPalette(settings);
  const pageW=doc.page.width;
  const pageH=doc.page.height;
  drawSeatingPdfPageHeader(doc,{settings,snapshot,palette,subtitle:settings.event?.dateLabel||""});

  const stats=[
    ["Personas",snapshot.summary.people],
    ["Asignadas",snapshot.summary.assigned],
    ["Sin mesa",snapshot.summary.unassigned],
    ["Capacidad",snapshot.summary.capacity],
    ["Lugares libres",snapshot.summary.availableSeats]
  ];
  const statsX=36,statsY=82,statsGap=8,statsW=(pageW-72-statsGap*4)/5;
  stats.forEach(([label,value],index)=>{
    const x=statsX+index*(statsW+statsGap);
    doc.roundedRect(x,statsY,statsW,35,9).fillColor(palette.paper).strokeColor(palette.gold).lineWidth(.65).fillAndStroke();
    drawBoundedText(doc,String(value),{x:x+8,y:88,width:36,height:18,font:"Helvetica-Bold",size:13,minSize:9,color:palette.accent,align:"left"});
    drawBoundedText(doc,label,{x:x+43,y:92,width:statsW-49,height:12,font:"Helvetica",size:6.8,minSize:5.8,color:palette.muted,align:"left"});
  });

  const canvas={x:36,y:129,w:pageW-72,h:419};
  doc.roundedRect(canvas.x,canvas.y,canvas.w,canvas.h,12).fillColor("#ffffff").strokeColor("#aeb9c8").lineWidth(1.1).fillAndStroke();
  doc.save().strokeColor("#e8edf2").strokeOpacity(.9).lineWidth(.35);
  for(let step=1;step<20;step++){
    const gx=canvas.x+canvas.w*(step/20),gy=canvas.y+canvas.h*(step/20);
    doc.moveTo(gx,canvas.y).lineTo(gx,canvas.y+canvas.h).stroke();
    doc.moveTo(canvas.x,gy).lineTo(canvas.x+canvas.w,gy).stroke();
  }
  doc.restore();
  drawBoundedText(doc,"SALÓN",{x:canvas.x+11,y:canvas.y+8,width:80,height:10,font:"Helvetica-Bold",size:6.4,minSize:6,color:palette.muted,align:"left",characterSpacing:1});

  for(const zone of snapshot.zones){
    const x=canvas.x+canvas.w*(Number(zone.x)/100),y=canvas.y+canvas.h*(Number(zone.y)/100);
    const w=canvas.w*(Number(zone.width)/100),h=canvas.h*(Number(zone.height)/100);
    const center=[x+w/2,y+h/2];
    doc.save().rotate(Number(zone.rotation||0),{origin:center});
    doc.fillColor(palette.gold).fillOpacity(.13).strokeColor(palette.gold).strokeOpacity(1).lineWidth(1).dash(4,{space:3});
    if(zone.shape==="rounded"||zone.shape==="arc")doc.roundedRect(x,y,w,h,Math.min(18,w/2,h/2)).fillAndStroke();
    else doc.rect(x,y,w,h).fillAndStroke();
    doc.undash().restore();
    drawBoundedText(doc,zone.label||SEATING_ZONE_LABELS[zone.type]||"Área",{
      x:x+4,y:y+Math.max(8,h/2-8),width:Math.max(12,w-8),height:18,font:"Helvetica-Bold",size:Math.min(10,Math.max(6,w/8)),minSize:5.5,color:palette.accent
    });
  }

  for(const table of snapshot.tables){
    const x=canvas.x+canvas.w*(Number(table.x)/100),y=canvas.y+canvas.h*(Number(table.y)/100);
    const w=canvas.w*(Number(table.width)/100),h=canvas.h*(Number(table.height)/100);
    const cx=x+w/2,cy=y+h/2;
    doc.save().rotate(Number(table.rotation||0),{origin:[cx,cy]});
    doc.fillColor(palette.paper).strokeColor(palette.accent).lineWidth(1.35);
    if(table.shape==="round")doc.ellipse(cx,cy,w/2,h/2).fillAndStroke();
    else doc.roundedRect(x,y,w,h,Math.min(12,w/5,h/5)).fillAndStroke();
    const dots=Math.min(Number(table.capacity)||0,16);
    for(let index=0;index<dots;index++){
      const angle=Math.PI*2*index/Math.max(1,dots)-Math.PI/2;
      const dx=cx+Math.cos(angle)*Math.max(2,w/2-5),dy=cy+Math.sin(angle)*Math.max(2,h/2-5);
      doc.circle(dx,dy,Math.max(1.2,Math.min(2.1,Math.min(w,h)/20)))
        .fillColor(index<Number(table.occupied||0)?"#3f8f66":"#ffffff").strokeColor(index<Number(table.occupied||0)?"#3f8f66":"#7e91ab").lineWidth(.6).fillAndStroke();
    }
    drawBoundedText(doc,table.name||"Mesa",{
      x:x+5,y:cy-15,width:Math.max(12,w-10),height:17,font:"Times-Bold",size:Math.min(12,Math.max(6.5,w/5)),minSize:5.7,color:palette.ink
    });
    drawBoundedText(doc,`${table.occupied} / ${table.capacity} · ${table.available} libres`,{
      x:x+5,y:cy+3,width:Math.max(12,w-10),height:10,font:"Helvetica",size:Math.min(6.7,Math.max(5.2,w/10)),minSize:4.9,color:palette.muted
    });
    if(table.families?.length)drawBoundedText(doc,table.families.slice(0,2).join(" · "),{
      x:x+5,y:cy+15,width:Math.max(12,w-10),height:Math.max(10,Math.min(25,h/3)),font:"Helvetica",size:5.4,minSize:4.7,color:palette.accent,lineGap:.5
    });
    doc.restore();
  }

  drawBoundedText(doc,`${snapshot.tables.length} mesa${snapshot.tables.length===1?"":"s"} · ${snapshot.zones.length} área${snapshot.zones.length===1?"":"s"}`,{
    x:36,y:563,width:330,height:12,font:"Helvetica-Bold",size:7,minSize:6,color:palette.muted,align:"left"
  });
  drawBoundedText(doc,"Las proporciones corresponden al plano guardado en EventStudio.",{
    x:pageW-390,y:563,width:354,height:12,font:"Helvetica",size:6.5,minSize:6,color:palette.muted,align:"right"
  });
  drawSeatingRosterPdf(doc,{settings,snapshot,palette});
  doc.font(pdfFont("Helvetica")).fontSize(1).fillColor("#ffffff").text(`EVENTSTUDIO_SEATING_${snapshot.mode.toUpperCase()}`,1,pageH-2,{lineBreak:false});
}

function drawSeatingRosterPdf(doc,{settings,snapshot,palette}){
  const pageW=doc.page.width;
  const pageH=doc.page.height;
  let pageNumber=2;
  let y=96;
  const addPage=()=>{
    doc.addPage({size:"LETTER",layout:"landscape",margin:0});
    drawSeatingPdfPageHeader(doc,{settings,snapshot,palette,title:"Distribución por mesa",subtitle:`Página ${pageNumber}`});
    y=92;pageNumber++;
  };
  const ensureSpace=height=>{if(y+height>pageH-36)addPage();};
  addPage();

  for(const table of snapshot.tables){
    const people=snapshot.people.filter(person=>Number(person.assignment?.tableId)===Number(table.id));
    const chunks=people.length?Array.from({length:Math.ceil(people.length/10)},(_,index)=>people.slice(index*10,index*10+10)):[[]];
    chunks.forEach((chunk,chunkIndex)=>{
      const peopleText=chunk.length?chunk.map(person=>`${person.assignment?.seatIndex||"-"}. ${person.name} · ${person.family}${person.type==="child"?" · Niño":""}`).join("\n"):"Sin personas asignadas en esta vista.";
      doc.font(pdfFont("Helvetica")).fontSize(7.5);
      const bodyHeight=Math.max(28,doc.heightOfString(peopleText,{width:pageW-280,lineGap:2}));
      const blockHeight=Math.max(66,bodyHeight+26);
      ensureSpace(blockHeight+10);
      doc.roundedRect(36,y,pageW-72,blockHeight,12).fillColor(palette.paper).strokeColor(palette.gold).lineWidth(.65).fillAndStroke();
      drawBoundedText(doc,`${table.name}${chunkIndex?" · continuación":""}`,{
        x:52,y:y+14,width:190,height:20,font:"Times-Bold",size:13,minSize:9,color:palette.ink,align:"left"
      });
      drawBoundedText(doc,`${table.occupied}/${table.capacity} ocupados · ${table.available} libres`,{
        x:52,y:y+39,width:190,height:12,font:"Helvetica",size:7,minSize:6,color:palette.muted,align:"left"
      });
      drawBoundedText(doc,peopleText,{
        x:258,y:y+13,width:pageW-310,height:blockHeight-22,font:"Helvetica",size:7.4,minSize:6.2,color:palette.ink,align:"left",lineGap:2,ellipsis:false
      });
      y+=blockHeight+10;
    });
  }

  const unassigned=snapshot.people.filter(person=>!person.assignment);
  const chunks=unassigned.length?Array.from({length:Math.ceil(unassigned.length/12)},(_,index)=>unassigned.slice(index*12,index*12+12)):[];
  chunks.forEach((chunk,index)=>{
    const peopleText=chunk.map(person=>`${person.name} · ${person.family}${person.type==="child"?" · Niño":""}`).join("\n");
    doc.font(pdfFont("Helvetica")).fontSize(7.5);
    const blockHeight=Math.max(66,doc.heightOfString(peopleText,{width:pageW-310,lineGap:2})+26);
    ensureSpace(blockHeight+10);
    doc.roundedRect(36,y,pageW-72,blockHeight,12).fillColor("#fff7df").strokeColor("#d4a62a").lineWidth(.75).fillAndStroke();
    drawBoundedText(doc,index?"Sin mesa · continuación":"Personas sin mesa",{
      x:52,y:y+14,width:190,height:22,font:"Times-Bold",size:13,minSize:9,color:"#875d12",align:"left"
    });
    drawBoundedText(doc,peopleText,{
      x:258,y:y+13,width:pageW-310,height:blockHeight-22,font:"Helvetica",size:7.4,minSize:6.2,color:palette.ink,align:"left",lineGap:2,ellipsis:false
    });
    y+=blockHeight+10;
  });
}

function whatsappUrl(event,g){ const s=settingsOf(event); const p=normalizePhone(g.phone); const places=[g.max_adults?`${g.max_adults} adulto(s)`:"",g.max_children?`${g.max_children} niño(s)`:""].filter(Boolean).join(" y "); const eventName=presentedName(s.couple?.displayName||event.name,s.typography); const guestName=presentedName(g.family_name,s.typography); const text=[`Hola, ${guestName}.`,"",`Te compartimos la invitación a ${eventName}.`,places?`Hemos reservado ${places} para ustedes.`:"",g.custom_message||"","","Aquí pueden consultar los detalles y confirmar su asistencia:",invitationUrl(event,g.token)].filter(Boolean).join("\n"); return p?`https://wa.me/${p}?text=${encodeURIComponent(text)}`:""; }
function safeName(n){ const ext=path.extname(n).toLowerCase(); const base=sanitize(path.basename(n,ext))||"archivo"; return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${base}${ext}`; }

/* Multer 2.2 permite limitar también la profundidad de nombres multipart.
   EventStudio usa campos planos, así que una profundidad de 1 evita estructuras
   arbitrariamente anidadas sin cambiar los formularios existentes. */
const multipartBaseLimits={fields:24,fieldSize:64*1024,fieldNestingDepth:1};
const photoUpload=multer({storage:multer.diskStorage({destination:guestPhotosDir,filename:(_r,f,cb)=>cb(null,safeName(f.originalname))}),limits:{...multipartBaseLimits,fileSize:MAX_UPLOAD_MB*1024*1024,files:20,parts:48},fileFilter:(_r,f,cb)=>{const ok=["image/jpeg","image/png","image/webp","image/heic","image/heif"].includes(f.mimetype);cb(ok?null:new Error("Sólo fotografías."),ok);}});
const mediaUpload=multer({storage:multer.diskStorage({destination:siteMediaDir,filename:(_r,f,cb)=>cb(null,safeName(f.originalname))}),limits:{...multipartBaseLimits,fileSize:70*1024*1024,files:30,parts:64},fileFilter:(_r,f,cb)=>{const ok=f.mimetype.startsWith("image/")||f.mimetype.startsWith("audio/");cb(ok?null:new Error("Sólo imágenes o audio."),ok);}});
const excelUpload=multer({dest:tempDir,limits:{...multipartBaseLimits,fields:4,fileSize:8*1024*1024,files:1,parts:6},fileFilter:(_r,f,cb)=>{const ok=/\.(xlsx|csv)$/i.test(f.originalname);cb(ok?null:new Error("Usa un archivo .xlsx o .csv."),ok);}});
const backupRestoreUpload=multer({
  dest:tempDir,
  limits:{...multipartBaseLimits,fields:4,fileSize:numberSetting("MAX_RESTORE_MB",4096,{min:64,max:16384})*1024*1024,files:1,parts:6},
  fileFilter:(_req,file,callback)=>{
    const accepted=/\.zip$/i.test(file.originalname)&&["application/zip","application/x-zip-compressed","application/octet-stream"].includes(file.mimetype);
    callback(accepted?null:new Error("Selecciona un respaldo ZIP generado por EventStudio."),accepted);
  }
});

function detectedImageMime(filePath){
  const header=Buffer.alloc(16);
  const descriptor=fs.openSync(filePath,"r");
  try{fs.readSync(descriptor,header,0,header.length,0);}finally{fs.closeSync(descriptor);}
  if(header[0]===0xff&&header[1]===0xd8&&header[2]===0xff)return "image/jpeg";
  if(header.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return "image/png";
  if(header.toString("ascii",0,4)==="RIFF"&&header.toString("ascii",8,12)==="WEBP")return "image/webp";
  if(header.toString("ascii",4,8)==="ftyp"&&/heic|heix|hevc|hevx|mif1|msf1/.test(header.toString("ascii",8,16)))return "image/heic";
  return "";
}

function printableImagePathFromUrl(url){
  const filePath=mediaPathFromUrl(url);
  if(!filePath||!fs.existsSync(filePath))return null;
  return ["image/jpeg","image/png"].includes(detectedImageMime(filePath))?filePath:null;
}

function detectedAudioMime(filePath){
  const header=Buffer.alloc(16);
  const descriptor=fs.openSync(filePath,"r");
  try{fs.readSync(descriptor,header,0,header.length,0);}finally{fs.closeSync(descriptor);}
  if(header.toString("ascii",0,3)==="ID3"||(header[0]===0xff&&(header[1]&0xe0)===0xe0))return "audio/mpeg";
  if(header.toString("ascii",0,4)==="OggS")return "audio/ogg";
  if(header.toString("ascii",0,4)==="RIFF"&&header.toString("ascii",8,12)==="WAVE")return "audio/wav";
  if(header.toString("ascii",0,4)==="fLaC")return "audio/flac";
  if(header.toString("ascii",4,8)==="ftyp")return "audio/mp4";
  return "";
}

function normalizeUploadedMediaFile(file,kind){
  const mime=kind==="image"?detectedImageMime(file.path):detectedAudioMime(file.path);
  if(!mime)throw new Error(kind==="image"?"El archivo no contiene una imagen válida.":"El archivo no contiene audio válido.");
  if(kind==="image")validateImageStructure(file.path,mime);
  const extension={"image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/heic":".heic","audio/mpeg":".mp3","audio/ogg":".ogg","audio/wav":".wav","audio/flac":".flac","audio/mp4":".m4a"}[mime];
  const base=path.basename(file.filename,path.extname(file.filename));
  const nextName=`${base}${extension}`;
  const nextPath=path.join(path.dirname(file.path),nextName);
  if(nextPath!==file.path)fs.renameSync(file.path,nextPath);
  file.filename=nextName;file.path=nextPath;file.mimetype=mime;
  return file;
}


// Public event routes
app.get("/e/:slug",(req,res)=>{
  const event=eventBySlug(req.params.slug);
  if(!event||event.archived)return res.status(404).send("Evento no encontrado");
  const preview=previewAllowed(req,event);
  const invitationAllowed=eventFeatureDecision(event,"invitation",{role:"public"}).allowed;
  if((!event.published||!invitationAllowed)&&!preview)return res.status(404).send("Evento no publicado");
  res.sendFile(path.join(publicDir,"index.html"));
});
app.get("/api/health",(_req,res)=>res.json({ok:true,version:require("../package.json").version}));

function cookiesOf(req){
  return String(req.headers.cookie||"").split(";").reduce((out,part)=>{
    const index=part.indexOf("=");
    if(index<1)return out;
    try{out[decodeURIComponent(part.slice(0,index).trim())]=decodeURIComponent(part.slice(index+1).trim());}catch{}
    return out;
  },{});
}

function sessionDigest(token){
  return crypto.createHmac("sha256",SESSION_SECRET).update(String(token||"")).digest("hex");
}

function sessionTokenOf(req){
  const bearer=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  return bearer||cookiesOf(req)[SESSION_COOKIE]||"";
}

function setSessionCookie(res,token){
  const attrs=[`${SESSION_COOKIE}=${encodeURIComponent(token)}`,"Path=/","HttpOnly","SameSite=Lax",`Max-Age=${SESSION_HOURS*3600}`];
  if(IS_PRODUCTION)attrs.push("Secure");
  res.setHeader("Set-Cookie",attrs.join("; "));
}

function clearSessionCookie(res){
  const attrs=[`${SESSION_COOKIE}=`,"Path=/","HttpOnly","SameSite=Lax","Max-Age=0"];
  if(IS_PRODUCTION)attrs.push("Secure");
  res.setHeader("Set-Cookie",attrs.join("; "));
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM sessions WHERE datetime(expires_at)<=CURRENT_TIMESTAMP").run();
  db.prepare("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)").run(sessionDigest(token),userId,expires);
  return token;
}

function currentUser(req) {
  const token=sessionTokenOf(req);
  if (!token) return null;
  const user=db.prepare(`
    SELECT u.id,u.email,u.phone,u.display_name,u.role,u.active,u.auth_provider,u.company_name,u.must_change_password,u.preferred_locale
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token=? AND datetime(s.expires_at)>CURRENT_TIMESTAMP AND u.active=1
  `).get(sessionDigest(token));
  if(user)Object.defineProperty(user,"_sessionDigest",{value:sessionDigest(token),enumerable:false});
  return user;
}

function authRequired(req,res,next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({error:"Sesión no válida o vencida."});
  req.user = user;
  if(user.must_change_password&&!['/api/auth/me','/api/auth/password','/api/auth/logout'].includes(req.path)){
    return res.status(428).json({error:"Debes cambiar la contraseña temporal antes de continuar.",code:"PASSWORD_CHANGE_REQUIRED"});
  }
  next();
}


function accountEntitlement(userId) {
  return db.prepare(`
    SELECT s.id subscription_id,s.status,s.starts_at,s.ends_at,
           p.id plan_id,p.code plan_code,p.name plan_name,p.price_cents,p.currency,
           p.duration_days,p.retention_days,p.sort_order,p.max_events,p.max_guests,p.max_storage_mb,
           p.max_published_events,p.publication_policy
    FROM subscriptions s
    JOIN plans p ON p.id=s.plan_id
    WHERE s.user_id=?
    ORDER BY s.id DESC LIMIT 1
  `).get(userId) || null;
}

function subscriptionUsable(entitlement) {
  if (!entitlement) return false;
  if (!["active","trial"].includes(entitlement.status)) return false;
  return !entitlement.ends_at || new Date(entitlement.ends_at).getTime() > Date.now();
}

function ownerOnly(req,res,next) {
  if (!req.user || !["owner","developer"].includes(req.user.role)) {
    return res.status(403).json({error:"Esta función es exclusiva del propietario/desarrollador."});
  }
  next();
}

function userCanAccessEvent(user,eventId){
  if(!user)return false;
  if(["owner","developer"].includes(user.role))return Boolean(db.prepare("SELECT id FROM events WHERE id=?").get(eventId));
  return Boolean(db.prepare("SELECT 1 FROM user_events WHERE user_id=? AND event_id=?").get(user.id,eventId));
}

function eventAllowed(req,res,next) {
  const eventId = Number(req.headers["x-event-id"] || req.query.eventId || req.body?.eventId || 0);
  if (!eventId) return res.status(400).json({error:"Evento no seleccionado.",code:"EVENT_REQUIRED"});
  const event=db.prepare("SELECT * FROM events WHERE id=?").get(eventId);
  if(!event)return res.status(404).json({error:"Evento no encontrado.",code:"EVENT_NOT_FOUND"});
  if (!userCanAccessEvent(req.user,eventId)) return res.status(403).json({error:"No tienes acceso a este evento.",code:"EVENT_FORBIDDEN"});
  req.eventId = eventId;
  req.event=event;
  next();
}

function featureRequired(key){
  return (req,res,next)=>{
    const decision=eventFeatureDecision(req.event,key,{role:req.user.role});
    if(!decision.allowed)return res.status(403).json({error:"Este módulo no está habilitado para el evento o plan actual.",code:"FEATURE_UNAVAILABLE",feature:key,reason:decision.reason});
    req.featureDecision=decision;
    next();
  };
}

function normalizedOrigin(value){
  try{return new URL(String(value||"")).origin;}catch{return "";}
}

function requestHostOrigin(req){
  const host=String(req.get("host")||"").trim();
  if(!host)return "";
  return normalizedOrigin(`${req.protocol}://${host}`);
}

function mutationOriginAllowed(req,origin){
  const supplied=normalizedOrigin(origin);
  if(!supplied)return false;
  if(IS_PRODUCTION)return supplied===SITE_ORIGIN;
  return supplied===SITE_ORIGIN||supplied===requestHostOrigin(req);
}

app.use((req,res,next)=>{
  if(!["POST","PUT","PATCH","DELETE"].includes(req.method))return next();
  if(req.path==="/api/messaging/webhook"||req.path==="/api/payments/mercadopago/webhook")return next();
  const usesCookie=Boolean(cookiesOf(req)[SESSION_COOKIE])&&!req.headers.authorization;
  if(!usesCookie)return next();
  if(!mutationOriginAllowed(req,req.headers.origin)){
    return res.status(403).json({error:"Origen de solicitud no permitido.",code:"CSRF_ORIGIN"});
  }
  next();
});


app.get("/api/public/auth-options",(_req,res)=>{
  const paymentStatus=paymentGateway.status();
  res.json({
    googleEnabled:false,
    googleConfigured:Boolean(GOOGLE_CLIENT_ID),
    paymentProvider:ENABLE_DEMO_PAYMENTS?"demo":(paymentStatus.configured?paymentStatus.provider:"disabled"),
    trialDays:TRIAL_DAYS,
    registrationEnabled:ALLOW_PUBLIC_REGISTRATION
  });
});

app.get("/api/public/plans",(_req,res)=>{
  if(!ALLOW_PUBLIC_REGISTRATION)return res.status(404).json({error:"Registro público deshabilitado.",code:"REGISTRATION_DISABLED"});
  res.json(publicCommercialPlans());
});

app.get("/api/public/catalog",(_req,res)=>{
  const publicThemeProducts=new Map(commerce.allProducts()
    .filter(product=>product.kind==="template"&&product.public&&product.commercial_status==="available"&&product.readiness_status==="approved")
    .map(product=>[product.code,product]));
  res.json({
    trialDays:TRIAL_DAYS,
    registrationEnabled:ALLOW_PUBLIC_REGISTRATION,
    capabilities:{automaticTranslation:Boolean(TRANSLATION_ENDPOINT)},
    experiences:experienceCatalog.publicCatalog,
    locales:[
      {code:"es",name:"Español"},
      {code:"en",name:"English"},
      {code:"pt",name:"Português"}
    ],
    plans:publicCommercialPlans(),
    addons:commerce.allProducts()
      .filter(product=>product.public&&product.commercial_status==="available"&&product.readiness_status==="approved"&&["bundle","storage","template_collection"].includes(product.kind))
      .map(product=>({key:product.code,name:product.name,description:product.description,price_cents:product.price_cents,currency:product.currency})),
    eventTypes:eventTypes.map(({id,name,icon,catalogSample})=>({id,name,icon,catalogSample:catalogSample||{}})),
    themes:themes.filter(theme=>publicThemeProducts.has(`theme:${theme.id}`)).map(({
      id,name,description,className,preview,tags,eventTypes:types,minPlan,
      layoutFamily,layoutLabel,motionPreset,motionLabel,photoStyle,photoStyleLabel,motif,defaultExperience
    })=>({
      id,name,description,className,preview,tags:tags||[],eventTypes:types||[],minPlan:minPlan||"starter",
      layoutFamily:layoutFamily||"classic",layoutLabel:layoutLabel||"Clásica",
      motionPreset:motionPreset||"subtle",motionLabel:motionLabel||"Movimiento sutil",
      photoStyle:photoStyle||"cards",photoStyleLabel:photoStyleLabel||"Fotos en tarjetas",
      motif:motif||"spark",defaultExperience:defaultExperience||"classic",
      price_cents:publicThemeProducts.get(`theme:${id}`).price_cents,
      currency:publicThemeProducts.get(`theme:${id}`).currency
    }))
  });
});


app.post("/api/analytics/track",(req,res)=>{
  const eventName=String(req.body?.eventName||"");
  if(!CONVERSION_EVENT_NAMES.has(eventName))return res.status(400).json({error:"Evento analítico no permitido.",code:"ANALYTICS_EVENT_INVALID"});
  const sessionKey=cleanText(req.body?.sessionKey||"",80);
  if(sessionKey.length<8)return res.status(400).json({error:"Identificador de sesión inválido.",code:"ANALYTICS_SESSION_INVALID"});
  const user=currentUser(req);
  const slug=cleanText(req.body?.eventSlug||"",120);
  const event=slug?eventBySlug(slug):null;
  const eventId=event?.id||null;
  const duplicate=db.prepare(`
    SELECT 1 FROM conversion_events WHERE session_key=? AND event_name=?
      AND COALESCE(event_id,0)=COALESCE(?,0) AND datetime(created_at)>=datetime('now','-2 seconds') LIMIT 1
  `).get(sessionKey,eventName,eventId);
  if(!duplicate)recordConversion({sessionKey,userId:user?.id||null,eventId,eventName,source:cleanText(req.body?.source||"web",30),metadata:req.body?.metadata||{}});
  res.status(202).json({ok:true});
});

app.get("/api/admin/analytics/funnel",authRequired,ownerOnly,(req,res)=>{
  const days=Math.max(1,Math.min(365,Number(req.query.days)||30));
  const counts=db.prepare(`
    SELECT event_name,COUNT(*) total,COUNT(DISTINCT session_key) sessions
    FROM conversion_events WHERE datetime(created_at)>=datetime('now',?)
    GROUP BY event_name ORDER BY total DESC
  `).all(`-${days} days`);
  const topProducts=db.prepare(`
    SELECT json_extract(metadata_json,'$.productCode') product,COUNT(*) total
    FROM conversion_events
    WHERE datetime(created_at)>=datetime('now',?) AND json_extract(metadata_json,'$.productCode') IS NOT NULL
    GROUP BY product ORDER BY total DESC LIMIT 12
  `).all(`-${days} days`);
  const topThemes=db.prepare(`
    SELECT json_extract(metadata_json,'$.themeId') theme,COUNT(*) total
    FROM conversion_events
    WHERE datetime(created_at)>=datetime('now',?) AND json_extract(metadata_json,'$.themeId') IS NOT NULL
    GROUP BY theme ORDER BY total DESC LIMIT 12
  `).all(`-${days} days`);
  const eventTypes=db.prepare(`
    SELECT COALESCE(e.event_type,json_extract(c.metadata_json,'$.eventType'),'sin-evento') event_type,COUNT(*) total
    FROM conversion_events c LEFT JOIN events e ON e.id=c.event_id
    WHERE datetime(c.created_at)>=datetime('now',?)
    GROUP BY event_type ORDER BY total DESC LIMIT 12
  `).all(`-${days} days`);
  res.json({days,counts,topProducts,topThemes,eventTypes});
});

app.get("/api/public/showcase",(_req,res)=>{
  res.setHeader("Cache-Control","no-store, max-age=0");
  const rows=db.prepare(`
    SELECT id,source_type,theme_id,title,subtitle,event_type,asset_url,sort_order,snapshot_json
    FROM showcase_items WHERE status='published' ORDER BY sort_order,id
  `).all().map(row=>{
    let snapshot={};try{snapshot=JSON.parse(row.snapshot_json||"{}");}catch{}
    return {...row,snapshot};
  });
  res.json(rows);
});

app.get("/api/admin/showcase",authRequired,ownerOnly,(_req,res)=>{
  res.json(db.prepare(`SELECT * FROM showcase_items ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,sort_order,id`).all());
});

app.patch("/api/admin/showcase/:id",authRequired,ownerOnly,(req,res)=>{
  const id=Number(req.params.id),status=String(req.body.status||"");
  if(!["draft","published","hidden"].includes(status))return res.status(400).json({error:"Estado Showcase inválido."});
  const info=db.prepare("UPDATE showcase_items SET status=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(status,Math.max(0,Math.min(10000,Number(req.body.sortOrder)||0)),id);
  if(!info.changes)return res.status(404).json({error:"Elemento Showcase no encontrado."});
  audit(req,"showcase.updated",{targetType:"showcase_item",targetId:id,metadata:{status}});
  res.json({ok:true});
});

app.post("/api/admin/preview-links",authRequired,eventAllowed,(req,res)=>{
  const previewSettings=platformSetting("preview",{defaultMinutes:120,maxMinutes:1440});
  const requested=Number(req.body.minutes)||Number(previewSettings.defaultMinutes)||120;
  const minutes=Math.max(5,Math.min(Number(previewSettings.maxMinutes)||1440,requested));
  const raw=crypto.randomBytes(24).toString("base64url");
  const info=db.prepare(`INSERT INTO preview_links(token_hash,event_id,created_by,expires_at) VALUES(?,?,?,datetime('now',?))`)
    .run(previewTokenDigest(raw),req.event.id,req.user.id,`+${minutes} minutes`);
  const base=publicBaseUrl(req.event);
  const url=`${base}/e/${encodeURIComponent(req.event.slug)}?previewToken=${encodeURIComponent(raw)}`;
  recordConversion({sessionKey:`user-${req.user.id}`,userId:req.user.id,eventId:req.event.id,eventName:"preview_link_created",source:"preview",metadata:{eventType:req.event.event_type}});
  audit(req,"preview.link_created",{eventId:req.event.id,targetType:"preview_link",targetId:info.lastInsertRowid,metadata:{minutes}});
  const previewRow=db.prepare("SELECT expires_at FROM preview_links WHERE id=?").get(info.lastInsertRowid);
  res.status(201).json({ok:true,url,expiresInMinutes:minutes,expiresAt:previewRow?.expires_at||null,id:Number(info.lastInsertRowid)});
});

app.delete("/api/admin/preview-links/:id",authRequired,eventAllowed,(req,res)=>{
  const info=db.prepare("UPDATE preview_links SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=? AND revoked_at IS NULL").run(Number(req.params.id),req.event.id);
  if(!info.changes)return res.status(404).json({error:"Vista previa no encontrada."});
  res.json({ok:true});
});

app.get("/api/admin/plans",authRequired,ownerOnly,(_req,res)=>{
  res.json(db.prepare(`
    SELECT id,code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb,max_published_events,publication_policy
    FROM plans WHERE active=1 ORDER BY price_cents
  `).all());
});

function serializedProduct(product){
  if(!product)return null;
  return {
    id:product.id,code:product.code,kind:product.kind,name:product.name,
    description:product.description,price_cents:Number(product.price_cents||0),
    currency:product.currency,commercial_status:product.commercial_status,readiness_status:product.readiness_status||"approved",
    release_version:product.release_version||"",presentation_slot:product.presentation_slot||"feature",preview_strategy:product.preview_strategy||"none",
    previewManifest:product.previewManifest||{},categories:product.categories||[],profileIds:product.profileIds||[],
    public:Boolean(product.public),grants:product.grants||[],
    dependencies:product.dependencies||[],eventTypes:product.eventTypes||["*"],
    storage_mb:Number(product.storage_mb||0),sort_order:Number(product.sort_order||0),
    preview:product.kind==="template"
      ?(themes.find(theme=>`theme:${theme.id}`===product.code)?.preview||null)
      :null
  };
}

function commercialPlanRows(){
  return db.prepare(`
    SELECT id,code,name,tagline,price_cents,currency,duration_days,max_events,
           max_guests,max_storage_mb,retention_days,max_published_events,publication_policy,public,featured,sort_order,active
    FROM plans WHERE active=1 ORDER BY sort_order,price_cents,id
  `).all().map(plan=>({
    ...plan,public:Boolean(plan.public),featured:Boolean(plan.featured),
    products:commerce.planProducts(plan.code).map(serializedProduct)
  })).map(plan=>({
    ...plan,
    catalog_value_cents:plan.products.reduce((sum,product)=>sum+Number(product.price_cents||0),0)
  }));
}

app.get("/api/admin/commerce/catalog",authRequired,ownerOnly,(_req,res)=>{
  res.json({
    products:commerce.allProducts().map(serializedProduct),
    plans:commercialPlanRows(),
    categories:db.prepare("SELECT id,code,name,description,icon,sort_order,active FROM store_categories ORDER BY sort_order,name,id").all(),
    profiles:commercialProfileRows(),
    platformSettings:{publication:platformSetting("publication",{mode:"manual_owner"}),branding:platformSetting("branding",{})},
    authorizedGrants:authorizedProductGrantOptions(),
    eventTypes:eventTypes.map(({id,name,icon})=>({id,name,icon})),
    states:["available","experimental","hidden","disabled"],
    readinessStates:["draft","lab","qa","approved","retired"],
    kinds:["feature","bundle","template_collection","template","storage"]
  });
});

app.post("/api/admin/commerce/categories",authRequired,ownerOnly,(req,res)=>{
  const name=cleanText(req.body.name||"",80);
  const code=slugify(cleanText(req.body.code||name,40)).slice(0,40);
  if(!name||!code)return res.status(400).json({error:"Escribe un nombre para la categoría.",code:"CATEGORY_NAME_REQUIRED"});
  if(db.prepare("SELECT 1 FROM store_categories WHERE code=?").get(code))return res.status(409).json({error:"Ya existe una categoría con ese código.",code:"CATEGORY_CODE_EXISTS"});
  const sortOrder=Math.max(0,Math.min(10000,Number(req.body.sortOrder)||0));
  const info=db.prepare("INSERT INTO store_categories(code,name,description,icon,sort_order,active) VALUES(?,?,?,?,?,1)")
    .run(code,name,cleanText(req.body.description||"",240),cleanText(req.body.icon||"",12),sortOrder);
  audit(req,"commerce.category_created",{targetType:"store_category",targetId:info.lastInsertRowid,metadata:{code}});
  res.status(201).json({ok:true});
});

app.put("/api/admin/commerce/categories/:id",authRequired,ownerOnly,(req,res)=>{
  const id=Number(req.params.id),existing=db.prepare("SELECT * FROM store_categories WHERE id=?").get(id);
  if(!existing)return res.status(404).json({error:"Categoría no encontrada."});
  const name=cleanText(req.body.name??existing.name,80);
  const description=cleanText(req.body.description??existing.description,240);
  const icon=cleanText(req.body.icon??existing.icon,12);
  const sortOrder=Math.max(0,Math.min(10000,Number(req.body.sortOrder??existing.sort_order)||0));
  const active=req.body.active===undefined?existing.active:(booleanValue(req.body.active)?1:0);
  if(!name)return res.status(400).json({error:"La categoría necesita nombre."});
  db.prepare("UPDATE store_categories SET name=?,description=?,icon=?,sort_order=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(name,description,icon,sortOrder,active,id);
  audit(req,"commerce.category_updated",{targetType:"store_category",targetId:id,metadata:{active:Boolean(active)}});
  res.json({ok:true});
});

app.post("/api/admin/commercial-profiles",authRequired,ownerOnly,(req,res)=>{
  const name=cleanText(req.body.name||"",100);
  const code=slugify(cleanText(req.body.code||name,40)).slice(0,40);
  if(!name||!code)return res.status(400).json({error:"Escribe un nombre para el perfil comercial."});
  if(db.prepare("SELECT 1 FROM customer_profiles WHERE code=?").get(code))return res.status(409).json({error:"Ya existe un perfil con ese código."});
  const sortOrder=Math.max(0,Math.min(10000,Number(req.body.sortOrder)||0));
  const allowedCategories=new Set(db.prepare("SELECT code FROM store_categories WHERE active=1").all().map(row=>row.code));
  const recommendedCategories=[...new Set((Array.isArray(req.body.recommendedCategories)?req.body.recommendedCategories:[]).map(value=>String(value)).filter(value=>allowedCategories.has(value)))];
  const requestedRecommendations=Array.isArray(req.body.recommendedCategories)?new Set(req.body.recommendedCategories.map(String)).size:0;
  if(recommendedCategories.length!==requestedRecommendations)return res.status(400).json({error:"Hay una categoría recomendada inválida."});
  const catalogMode=["all","curated"].includes(String(req.body.catalogMode||"all"))?String(req.body.catalogMode||"all"):"all";
  const info=db.prepare("INSERT INTO customer_profiles(code,name,description,sort_order,active,recommendations_json,catalog_mode) VALUES(?,?,?,?,1,?,?)")
    .run(code,name,cleanText(req.body.description||"",300),sortOrder,JSON.stringify(recommendedCategories),catalogMode);
  audit(req,"commercial_profile.created",{targetType:"customer_profile",targetId:info.lastInsertRowid,metadata:{code}});
  res.status(201).json({ok:true});
});

app.put("/api/admin/commercial-profiles/:id",authRequired,ownerOnly,(req,res)=>{
  const id=Number(req.params.id),existing=db.prepare("SELECT * FROM customer_profiles WHERE id=?").get(id);
  if(!existing)return res.status(404).json({error:"Perfil comercial no encontrado."});
  const name=cleanText(req.body.name??existing.name,100);
  const description=cleanText(req.body.description??existing.description,300);
  const sortOrder=Math.max(0,Math.min(10000,Number(req.body.sortOrder??existing.sort_order)||0));
  const active=req.body.active===undefined?existing.active:(booleanValue(req.body.active)?1:0);
  let recommendedCategories;try{recommendedCategories=JSON.parse(existing.recommendations_json||"[]");}catch{recommendedCategories=[];}
  if(Array.isArray(req.body.recommendedCategories)){
    const allowedCategories=new Set(db.prepare("SELECT code FROM store_categories WHERE active=1").all().map(row=>row.code));
    const requested=[...new Set(req.body.recommendedCategories.map(value=>String(value)))];
    const next=requested.filter(value=>allowedCategories.has(value));
    if(next.length!==requested.length)return res.status(400).json({error:"Hay una categoría recomendada inválida."});
    recommendedCategories=next;
  }
  if(!name)return res.status(400).json({error:"El perfil necesita nombre."});
  const catalogMode=["all","curated"].includes(String(req.body.catalogMode||existing.catalog_mode||"all"))?String(req.body.catalogMode||existing.catalog_mode||"all"):"all";
  let curatedProductIds=db.prepare("SELECT product_id FROM product_profile_links WHERE profile_id=?").all(id).map(row=>Number(row.product_id));
  if(Array.isArray(req.body.curatedProductIds)){
    const requested=[...new Set(req.body.curatedProductIds.map(Number).filter(Number.isInteger))];
    if(requested.length){
      const placeholders=requested.map(()=>"?").join(",");
      const found=Number(db.prepare(`SELECT COUNT(*) total FROM product_catalog WHERE active=1 AND id IN (${placeholders})`).get(...requested).total||0);
      if(found!==requested.length)return res.status(400).json({error:"Hay productos de perfil inválidos."});
    }
    curatedProductIds=requested;
  }
  db.transaction(()=>{
    db.prepare("UPDATE customer_profiles SET name=?,description=?,sort_order=?,active=?,recommendations_json=?,catalog_mode=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(name,description,sortOrder,active,JSON.stringify(recommendedCategories),catalogMode,id);
    db.prepare("DELETE FROM product_profile_links WHERE profile_id=?").run(id);
    const link=db.prepare("INSERT INTO product_profile_links(product_id,profile_id,sort_order) VALUES(?,?,?)");
    curatedProductIds.forEach((productId,index)=>link.run(productId,id,index));
  })();
  audit(req,"commercial_profile.updated",{targetType:"customer_profile",targetId:id,metadata:{active:Boolean(active),catalogMode,curatedProductIds}});
  res.json({ok:true});
});

app.post("/api/admin/commerce/plans",authRequired,ownerOnly,(req,res)=>{
  const name=cleanText(req.body.name||"",120);
  const code=slugify(cleanText(req.body.code||name,40)).slice(0,40);
  if(!name||!code)return res.status(400).json({error:"Escribe un nombre y código para el plan.",code:"PLAN_NAME_REQUIRED"});
  if(db.prepare("SELECT 1 FROM plans WHERE code=?").get(code)){
    return res.status(409).json({error:"Ya existe un plan con ese código.",code:"PLAN_CODE_EXISTS"});
  }
  const price=Math.max(0,Math.min(100000000,Number(req.body.priceCents)||0));
  const duration=Math.max(1,Math.min(3650,Number(req.body.durationDays)||120));
  const maxEvents=Math.max(1,Math.min(10000,Number(req.body.maxEvents)||1));
  const maxGuests=Math.max(0,Math.min(1000000,Number(req.body.maxGuests)||300));
  const maxStorage=Math.max(0,Math.min(1000000,Number(req.body.maxStorageMb)||2048));
  const maxPublishedEvents=Math.max(0,Math.min(10000,Number(req.body.maxPublishedEvents??1)));
  const retentionDays=Math.max(0,Math.min(3650,Number(req.body.retentionDays??30)));
  const publicationPolicy=["manual_owner","auto_after_entitlement","disabled"].includes(req.body.publicationPolicy)?req.body.publicationPolicy:"manual_owner";
  if(![price,duration,maxEvents,maxGuests,maxStorage,maxPublishedEvents,retentionDays].every(Number.isInteger)){
    return res.status(400).json({error:"Precio y límites deben ser números enteros.",code:"PLAN_LIMIT_INVALID"});
  }
  const sortOrder=(db.prepare("SELECT COALESCE(MAX(sort_order),0)+1 next FROM plans").get().next||1);
  const info=db.prepare(`
    INSERT INTO plans(code,name,tagline,price_cents,currency,duration_days,max_events,max_guests,
      max_storage_mb,retention_days,max_published_events,publication_policy,active,public,featured,sort_order)
    VALUES(?,?,?,?,'MXN',?,?,?,?,?,?,?,1,?,?,?)
  `).run(
    code,name,cleanText(req.body.tagline||"",240),price,duration,maxEvents,maxGuests,maxStorage,retentionDays,maxPublishedEvents,publicationPolicy,
    booleanValue(req.body.public)?1:0,booleanValue(req.body.featured)?1:0,sortOrder
  );
  audit(req,"commerce.plan_created",{targetType:"plan",targetId:info.lastInsertRowid,metadata:{code,priceCents:price}});
  res.status(201).json({ok:true,plan:commercialPlanRows().find(plan=>plan.id===Number(info.lastInsertRowid))});
});

app.post("/api/admin/commerce/products",authRequired,ownerOnly,(req,res)=>{
  const name=cleanText(req.body.name||"",120);
  let code=cleanText(req.body.code||"",80).toLowerCase();
  if(!code)code=`custom:${slugify(name).slice(0,60)}`;
  if(!code.includes(":"))code=`custom:${code}`;
  if(!/^[a-z0-9][a-z0-9:_-]{2,79}$/.test(code))return res.status(400).json({error:"El código sólo puede usar letras minúsculas, números, :, _ y -.",code:"PRODUCT_CODE_INVALID"});
  if(!name)return res.status(400).json({error:"Escribe un nombre para el producto.",code:"PRODUCT_NAME_REQUIRED"});
  if(db.prepare("SELECT 1 FROM product_catalog WHERE code=?").get(code))return res.status(409).json({error:"Ya existe un producto con ese código.",code:"PRODUCT_CODE_EXISTS"});
  const kinds=new Set(["feature","bundle","template_collection","template","storage"]);
  const kind=String(req.body.kind||"bundle");
  if(!kinds.has(kind))return res.status(400).json({error:"Tipo de producto inválido.",code:"PRODUCT_KIND_INVALID"});
  const allowedGrants=new Set(authorizedProductGrantOptions());
  const grants=[...new Set((Array.isArray(req.body.grants)?req.body.grants:[]).map(value=>String(value)).filter(value=>allowedGrants.has(value)))];
  const requestedGrants=Array.isArray(req.body.grants)?req.body.grants.filter(Boolean).length:0;
  if(grants.length!==requestedGrants)return res.status(400).json({error:"El producto intenta usar una capacidad no autorizada. Los motores nuevos deben pasar por desarrollo y QA antes de venderse.",code:"PRODUCT_GRANT_NOT_AUTHORIZED"});
  const knownEventTypes=new Set(["*",...eventTypes.map(item=>item.id)]);
  const requestedEventTypes=Array.isArray(req.body.eventTypes)&&req.body.eventTypes.length?req.body.eventTypes:["*"];
  const productEventTypes=[...new Set(requestedEventTypes.map(value=>String(value)).filter(value=>knownEventTypes.has(value)))];
  if(productEventTypes.length!==requestedEventTypes.length)return res.status(400).json({error:"Hay un tipo de evento no reconocido.",code:"PRODUCT_EVENT_TYPE_INVALID"});
  const price=Math.max(0,Math.min(100000000,Number(req.body.priceCents)||0));
  const storageMb=Math.max(0,Math.min(1000000,Number(req.body.storageMb)||0));
  if(!Number.isInteger(price)||!Number.isInteger(storageMb))return res.status(400).json({error:"Precio y almacenamiento deben ser enteros.",code:"PRODUCT_NUMBER_INVALID"});
  const readinessStates=new Set(["draft","lab","qa","approved","retired"]);
  const readiness=readinessStates.has(req.body.readinessStatus)?req.body.readinessStatus:"draft";
  const states=new Set(["available","experimental","hidden","disabled"]);
  const commercialStatus=states.has(req.body.commercialStatus)?req.body.commercialStatus:"hidden";
  const isPublic=booleanValue(req.body.public)?1:0;
  if(isPublic&&readiness!=="approved")return res.status(409).json({error:"Sólo un producto aprobado puede publicarse.",code:"PRODUCT_NOT_APPROVED"});
  const categoryIds=[...new Set((Array.isArray(req.body.categoryIds)?req.body.categoryIds:[]).map(Number).filter(Number.isInteger))];
  if(categoryIds.length){
    const placeholders=categoryIds.map(()=>"?").join(",");
    const total=db.prepare(`SELECT COUNT(*) total FROM store_categories WHERE active=1 AND id IN (${placeholders})`).get(...categoryIds).total;
    if(total!==categoryIds.length)return res.status(400).json({error:"Una categoría ya no existe.",code:"PRODUCT_CATEGORY_INVALID"});
  }
  const presentationSlot=cleanText(req.body.presentationSlot||"feature",40)||"feature";
  const previewStrategy=cleanText(req.body.previewStrategy||"none",40)||"none";
  const previewManifest=previewManifestFromGrants(grants);
  const sortOrder=(db.prepare("SELECT COALESCE(MAX(sort_order),0)+1 next FROM product_catalog").get().next||1);
  const id=db.transaction(()=>{
    const info=db.prepare(`
      INSERT INTO product_catalog(code,kind,name,description,price_cents,currency,commercial_status,readiness_status,release_version,
        presentation_slot,preview_strategy,preview_manifest_json,public,grants_json,dependencies_json,event_types_json,storage_mb,sort_order,active)
      VALUES(?,?,?,?,?,'MXN',?,?,?,?,?,?,?,?,?,?,?, ?,1)
    `).run(code,kind,name,cleanText(req.body.description||"",500),price,commercialStatus,readiness,
      cleanText(req.body.releaseVersion||"",60),presentationSlot,previewStrategy,JSON.stringify(previewManifest),isPublic,
      JSON.stringify(grants),JSON.stringify([]),JSON.stringify(productEventTypes),storageMb,sortOrder);
    const productId=Number(info.lastInsertRowid);
    const link=db.prepare("INSERT INTO product_category_links(product_id,category_id,sort_order) VALUES(?,?,?)");
    categoryIds.forEach((categoryId,index)=>link.run(productId,categoryId,index));
    return productId;
  })();
  audit(req,"commerce.product_created",{targetType:"product",targetId:id,metadata:{code,kind,readiness,priceCents:price,grants,eventTypes:productEventTypes}});
  res.status(201).json({ok:true,product:serializedProduct(commerce.allProducts().find(item=>item.id===id))});
});

app.put("/api/admin/commerce/products/:id",authRequired,ownerOnly,(req,res)=>{
  const id=Number(req.params.id);
  const existing=db.prepare("SELECT * FROM product_catalog WHERE id=? AND active=1").get(id);
  if(!existing)return res.status(404).json({error:"Producto no encontrado.",code:"PRODUCT_NOT_FOUND"});
  const states=new Set(["available","experimental","hidden","disabled"]);
  const state=String(req.body.commercialStatus||existing.commercial_status);
  if(!states.has(state))return res.status(400).json({error:"Estado comercial inválido.",code:"PRODUCT_STATE_INVALID"});
  const price=Math.max(0,Math.min(100000000,Number(req.body.priceCents??existing.price_cents)));
  if(!Number.isInteger(price))return res.status(400).json({error:"El precio debe expresarse en centavos enteros.",code:"PRODUCT_PRICE_INVALID"});
  const readinessStates=new Set(["draft","lab","qa","approved","retired"]);
  const readiness=String(req.body.readinessStatus||existing.readiness_status||"approved");
  if(!readinessStates.has(readiness))return res.status(400).json({error:"Estado técnico inválido.",code:"PRODUCT_READINESS_INVALID"});
  const name=cleanText(req.body.name??existing.name,120);
  const description=cleanText(req.body.description??existing.description,500);
  const releaseVersion=cleanText(req.body.releaseVersion??existing.release_version,60);
  const presentationSlot=cleanText(req.body.presentationSlot??existing.presentation_slot,40)||"feature";
  const previewStrategy=cleanText(req.body.previewStrategy??existing.preview_strategy,40)||"none";
  const isPublic=booleanValue(req.body.public??existing.public)?1:0;
  const allowedGrants=new Set(authorizedProductGrantOptions());
  let grants;try{grants=JSON.parse(existing.grants_json||"[]");}catch{grants=[];}
  if(Array.isArray(req.body.grants)){
    const requested=req.body.grants.map(value=>String(value)).filter(Boolean);
    const next=[...new Set(requested.filter(value=>allowedGrants.has(value)))];
    if(next.length!==new Set(requested).size)return res.status(400).json({error:"El producto intenta usar una capacidad no autorizada. Los motores nuevos deben pasar por desarrollo y QA.",code:"PRODUCT_GRANT_NOT_AUTHORIZED"});
    grants=next;
  }
  let productEventTypes;try{productEventTypes=JSON.parse(existing.event_types_json||"[\"*\"]");}catch{productEventTypes=["*"];}
  if(Array.isArray(req.body.eventTypes)){
    const knownEventTypes=new Set(["*",...eventTypes.map(item=>item.id)]);
    const requested=req.body.eventTypes.length?req.body.eventTypes.map(value=>String(value)):["*"];
    const next=[...new Set(requested.filter(value=>knownEventTypes.has(value)))];
    if(next.length!==new Set(requested).size)return res.status(400).json({error:"Hay un tipo de evento no reconocido.",code:"PRODUCT_EVENT_TYPE_INVALID"});
    productEventTypes=next;
  }
  const storageMb=Math.max(0,Math.min(1000000,Number(req.body.storageMb??existing.storage_mb)||0));
  if(!Number.isInteger(storageMb))return res.status(400).json({error:"El almacenamiento debe ser un entero.",code:"PRODUCT_STORAGE_INVALID"});
  const previewManifest=previewManifestFromGrants(grants);
  const categoryIds=[...new Set((Array.isArray(req.body.categoryIds)?req.body.categoryIds:[]).map(Number).filter(Number.isInteger))];
  if(categoryIds.length){
    const placeholders=categoryIds.map(()=>"?").join(",");
    const total=db.prepare(`SELECT COUNT(*) total FROM store_categories WHERE active=1 AND id IN (${placeholders})`).get(...categoryIds).total;
    if(total!==categoryIds.length)return res.status(400).json({error:"Una categoría ya no existe.",code:"PRODUCT_CATEGORY_INVALID"});
  }
  if(isPublic&&readiness!=="approved"){
    return res.status(409).json({error:"Sólo un producto técnicamente aprobado puede marcarse visible para venta.",code:"PRODUCT_NOT_APPROVED"});
  }
  db.transaction(()=>{
    db.prepare(`
      UPDATE product_catalog SET name=?,description=?,price_cents=?,commercial_status=?,readiness_status=?,
        release_version=?,presentation_slot=?,preview_strategy=?,preview_manifest_json=?,public=?,grants_json=?,event_types_json=?,storage_mb=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(name,description,price,state,readiness,releaseVersion,presentationSlot,previewStrategy,JSON.stringify(previewManifest),isPublic,JSON.stringify(grants),JSON.stringify(productEventTypes),storageMb,id);
    if(Array.isArray(req.body.categoryIds)){
      db.prepare("DELETE FROM product_category_links WHERE product_id=?").run(id);
      const link=db.prepare("INSERT INTO product_category_links(product_id,category_id,sort_order) VALUES(?,?,?)");
      categoryIds.forEach((categoryId,index)=>link.run(id,categoryId,index));
    }
  })();
  audit(req,"commerce.product_updated",{targetType:"product",targetId:id,metadata:{state,readiness,priceCents:price,public:Boolean(isPublic),categoryIds,grants,eventTypes:productEventTypes,storageMb}});
  res.json({ok:true,product:serializedProduct(commerce.allProducts().find(item=>item.id===id))});
});

app.put("/api/admin/commerce/plans/:id",authRequired,ownerOnly,(req,res)=>{
  const id=Number(req.params.id);
  const existing=db.prepare("SELECT * FROM plans WHERE id=? AND active=1").get(id);
  if(!existing)return res.status(404).json({error:"Plan no encontrado.",code:"PLAN_NOT_FOUND"});
  const productIds=[...new Set((Array.isArray(req.body.productIds)?req.body.productIds:[]).map(Number).filter(Number.isInteger))];
  if(productIds.length){
    const placeholders=productIds.map(()=>"?").join(",");
    const found=db.prepare(`SELECT COUNT(*) total FROM product_catalog WHERE active=1 AND id IN (${placeholders})`).get(...productIds).total;
    if(found!==productIds.length)return res.status(400).json({error:"El plan contiene un producto inexistente.",code:"PLAN_PRODUCT_INVALID"});
  }
  const premiumPlan=db.prepare("SELECT id FROM plans WHERE code='premium' AND active=1").get();
  if(existing.code!=="premium"&&existing.code!=="studio"&&premiumPlan){
    const premiumProducts=new Set(db.prepare("SELECT product_id FROM plan_products WHERE plan_id=?").all(premiumPlan.id).map(row=>row.product_id));
    const outsidePremium=productIds.find(productId=>!premiumProducts.has(productId));
    if(outsidePremium)return res.status(409).json({
      error:"Los planes inferiores no pueden ofrecer más que Experiencia Premium. Agrega primero ese producto al plan máximo.",
      code:"PLAN_EXCEEDS_PREMIUM"
    });
  }
  if(existing.code==="premium"){
    const lowerProductIds=new Set(db.prepare(`
      SELECT pp.product_id FROM plan_products pp
      JOIN plans p ON p.id=pp.plan_id
      WHERE p.active=1 AND p.code IN ('express','starter','basic')
    `).all().map(row=>row.product_id));
    const missingLower=[...lowerProductIds].find(productId=>!productIds.includes(productId));
    if(missingLower)return res.status(409).json({
      error:"Experiencia Premium debe conservar todo lo que ya ofrecen los planes inferiores.",
      code:"PREMIUM_MUST_BE_MAXIMUM"
    });
  }
  const price=Math.max(0,Math.min(100000000,Number(req.body.priceCents??existing.price_cents)));
  const duration=Math.max(1,Math.min(3650,Number(req.body.durationDays??existing.duration_days)));
  const maxEvents=Math.max(1,Math.min(10000,Number(req.body.maxEvents??existing.max_events)));
  const maxGuests=Math.max(0,Math.min(1000000,Number(req.body.maxGuests??existing.max_guests)));
  const maxStorage=Math.max(0,Math.min(1000000,Number(req.body.maxStorageMb??existing.max_storage_mb)));
  const maxPublishedEvents=Math.max(0,Math.min(10000,Number(req.body.maxPublishedEvents??existing.max_published_events??existing.max_events)));
  const retentionDays=Math.max(0,Math.min(3650,Number(req.body.retentionDays??existing.retention_days??30)));
  const publicationPolicy=["manual_owner","auto_after_entitlement","disabled"].includes(req.body.publicationPolicy)?req.body.publicationPolicy:(existing.publication_policy||"manual_owner");
  if(![price,duration,maxEvents,maxGuests,maxStorage,maxPublishedEvents,retentionDays].every(Number.isInteger)){
    return res.status(400).json({error:"Precio y límites deben ser números enteros.",code:"PLAN_LIMIT_INVALID"});
  }
  db.transaction(()=>{
    db.prepare(`
      UPDATE plans SET name=?,tagline=?,price_cents=?,duration_days=?,max_events=?,
        max_guests=?,max_storage_mb=?,retention_days=?,max_published_events=?,publication_policy=?,public=?,featured=? WHERE id=?
    `).run(
      cleanText(req.body.name??existing.name,120),
      cleanText(req.body.tagline??existing.tagline,240),
      price,duration,maxEvents,maxGuests,maxStorage,retentionDays,maxPublishedEvents,publicationPolicy,
      booleanValue(req.body.public??existing.public)?1:0,
      booleanValue(req.body.featured??existing.featured)?1:0,id
    );
    db.prepare("DELETE FROM plan_products WHERE plan_id=?").run(id);
    const link=db.prepare("INSERT INTO plan_products(plan_id,product_id) VALUES(?,?)");
    productIds.forEach(productId=>link.run(id,productId));
  })();
  audit(req,"commerce.plan_updated",{targetType:"plan",targetId:id,metadata:{productIds,priceCents:price}});
  res.json({ok:true,plan:commercialPlanRows().find(plan=>plan.id===id)});
});

app.delete("/api/admin/commerce/plans/:id",authRequired,ownerOnly,(req,res)=>{
  const id=Number(req.params.id);
  const plan=db.prepare("SELECT * FROM plans WHERE id=? AND active=1").get(id);
  if(!plan)return res.status(404).json({error:"Plan no encontrado.",code:"PLAN_NOT_FOUND"});
  if(["trial","express","starter","basic","premium","studio"].includes(plan.code)){
    return res.status(409).json({error:"Los paquetes base se conservan para mantener el historial. Puedes ocultarlos de la tienda.",code:"BASE_PLAN_PROTECTED"});
  }
  const inUse=db.prepare("SELECT COUNT(*) total FROM subscriptions WHERE plan_id=?").get(id).total;
  if(inUse)return res.status(409).json({error:"Este paquete ya tiene historial. Ocúltalo en vez de eliminarlo.",code:"PLAN_HAS_HISTORY"});
  db.transaction(()=>{
    db.prepare("DELETE FROM plan_products WHERE plan_id=?").run(id);
    db.prepare("DELETE FROM plans WHERE id=?").run(id);
  })();
  audit(req,"commerce.plan_deleted",{targetType:"plan",targetId:id,metadata:{code:plan.code}});
  res.json({ok:true});
});

app.get("/api/admin/commerce/promotions",authRequired,ownerOnly,(_req,res)=>{
  const rows=db.prepare(`
    SELECT pr.*,GROUP_CONCAT(pp.product_id) product_ids
    FROM promotions pr LEFT JOIN promotion_products pp ON pp.promotion_id=pr.id
    GROUP BY pr.id ORDER BY pr.created_at DESC,pr.id DESC
  `).all().map(row=>({
    ...row,product_ids:String(row.product_ids||"").split(",").filter(Boolean).map(Number)
  }));
  res.json(rows);
});

app.post("/api/admin/commerce/promotions",authRequired,ownerOnly,(req,res)=>{
  const productIds=[...new Set((Array.isArray(req.body.productIds)?req.body.productIds:[]).map(Number).filter(Number.isInteger))];
  if(!productIds.length)return res.status(400).json({error:"Selecciona al menos un producto.",code:"PROMOTION_PRODUCT_REQUIRED"});
  const statusValue=["draft","active","paused"].includes(req.body.status)?req.body.status:"draft";
  const startsAt=req.body.startsAt?new Date(req.body.startsAt):null;
  const endsAt=req.body.endsAt?new Date(req.body.endsAt):null;
  if((startsAt&&Number.isNaN(startsAt.getTime()))||(endsAt&&Number.isNaN(endsAt.getTime()))||(startsAt&&endsAt&&endsAt<=startsAt)){
    return res.status(400).json({error:"La vigencia de la promoción no es válida.",code:"PROMOTION_DATES_INVALID"});
  }
  const promotionId=db.transaction(()=>{
    const info=db.prepare(`
      INSERT INTO promotions(name,audience_plan_code,event_type,status,starts_at,ends_at,note,created_by)
      VALUES(?,?,?,?,?,?,?,?)
    `).run(
      cleanText(req.body.name||"Promoción",120),
      cleanText(req.body.audiencePlanCode||"",40)||null,
      cleanText(req.body.eventType||"",40)||null,statusValue,
      startsAt?.toISOString()||null,endsAt?.toISOString()||null,
      cleanText(req.body.note||"",500),req.user.id
    );
    const link=db.prepare("INSERT INTO promotion_products(promotion_id,product_id) SELECT ?,id FROM product_catalog WHERE id=? AND active=1");
    productIds.forEach(productId=>link.run(info.lastInsertRowid,productId));
    return Number(info.lastInsertRowid);
  })();
  audit(req,"commerce.promotion_created",{targetType:"promotion",targetId:promotionId,metadata:{productIds,status:statusValue}});
  res.status(201).json({ok:true,id:promotionId});
});

app.patch("/api/admin/commerce/promotions/:id",authRequired,ownerOnly,(req,res)=>{
  const statusValue=String(req.body.status||"");
  if(!["draft","active","paused","ended"].includes(statusValue))return res.status(400).json({error:"Estado de promoción inválido."});
  const info=db.prepare("UPDATE promotions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(statusValue,Number(req.params.id));
  if(!info.changes)return res.status(404).json({error:"Promoción no encontrada."});
  audit(req,"commerce.promotion_status",{targetType:"promotion",targetId:req.params.id,metadata:{status:statusValue}});
  res.json({ok:true,status:statusValue});
});

app.get("/api/admin/clients/:id/commercial-profile",authRequired,ownerOnly,(req,res)=>{
  const clientId=Number(req.params.id);
  const client=db.prepare("SELECT id,display_name,email,phone,active,preferred_locale FROM users WHERE id=? AND role='client'").get(clientId);
  if(!client)return res.status(404).json({error:"Cliente no encontrado.",code:"CLIENT_NOT_FOUND"});
  const subscription=accountEntitlement(clientId);
  const clientEvents=db.prepare(`
    SELECT DISTINCT e.* FROM events e
    LEFT JOIN user_events ue ON ue.event_id=e.id
    WHERE e.owner_user_id=? OR ue.user_id=?
    ORDER BY e.archived,e.updated_at DESC
  `).all(clientId,clientId).map(event=>{
    const context=commerce.featureContext(event,subscription);
    return {
      id:event.id,name:event.name,slug:event.slug,event_type:event.event_type,
      archived:Boolean(event.archived),published:Boolean(event.published),
      features:eventFeatureOverview(event,{role:"client"}).filter(item=>item.allowed).map(item=>({key:item.key,label:item.label,group:item.group})),
      origins:context.access.origins,
      storage_limit_mb:(subscription?.max_storage_mb||2048)+context.access.extraStorageMb
    };
  });
  const orders=db.prepare(`
    SELECT id,event_id,status,subtotal_cents,currency,provider_reference,paid_at,created_at
    FROM orders WHERE user_id=? ORDER BY created_at DESC,id DESC
  `).all(clientId);
  const notifications=db.prepare(`
    SELECT n.id,n.kind,n.title,n.message,n.event_id,n.product_id,n.grant_id,n.read_at,n.created_at,
           pc.name product_name,pc.description product_description,pc.kind product_kind,pc.presentation_slot,pc.grants_json
    FROM account_notifications n
    LEFT JOIN product_catalog pc ON pc.id=n.product_id
    WHERE n.user_id=? ORDER BY n.created_at DESC,n.id DESC LIMIT 20
  `).all(clientId);
  res.json({
    client,subscription,events:clientEvents,orders,notifications,
    plans:commercialPlanRows(),products:commerce.allProducts().map(serializedProduct),
    commercialControls:accountCommercialControls(clientId),
    profiles:commercialProfileRows({activeOnly:true}),
    platform:{publication:platformSetting("publication",{mode:"manual_owner"}),branding:platformSetting("branding",{})}
  });
});

app.post("/api/admin/events/:id/grants",authRequired,ownerOnly,(req,res)=>{
  const eventId=Number(req.params.id);
  const event=db.prepare("SELECT id,name FROM events WHERE id=?").get(eventId);
  if(!event)return res.status(404).json({error:"Evento no encontrado.",code:"EVENT_NOT_FOUND"});
  const product=db.prepare("SELECT id,name,kind,storage_mb FROM product_catalog WHERE id=? AND active=1").get(Number(req.body.productId));
  if(!product)return res.status(404).json({error:"Producto no encontrado.",code:"PRODUCT_NOT_FOUND"});
  const endsAt=req.body.endsAt?new Date(req.body.endsAt):null;
  if(endsAt&&(!Number.isFinite(endsAt.getTime())||endsAt<=new Date()))return res.status(400).json({error:"La fecha final debe estar en el futuro."});
  const usageLimit=req.body.usageLimit==null||req.body.usageLimit===""?null:Number(req.body.usageLimit);
  const storageMb=Math.max(0,Math.min(1000000,Number(req.body.storageMb)||Number(product.storage_mb)||0));
  if(usageLimit!==null&&(!Number.isInteger(usageLimit)||usageLimit<1))return res.status(400).json({error:"El límite de usos debe ser un entero positivo."});
  const eventOwner=db.prepare("SELECT owner_user_id FROM events WHERE id=?").get(eventId);
  const info=db.transaction(()=>{
    const grant=db.prepare(`
      INSERT INTO event_grants(event_id,product_id,source,source_reference,ends_at,usage_limit,storage_mb,granted_by,note)
      VALUES(?,?,'courtesy',?,?,?,?,?,?)
    `).run(eventId,product.id,`courtesy:${crypto.randomUUID()}`,endsAt?.toISOString()||null,usageLimit,storageMb,req.user.id,cleanText(req.body.note||"Cortesía del propietario",500));
    if(eventOwner?.owner_user_id)db.prepare(`
      INSERT INTO account_notifications(user_id,kind,title,message,event_id,product_id,grant_id)
      VALUES(?,'courtesy','Recibiste una cortesía',?,?,?,?)
    `).run(
      eventOwner.owner_user_id,
      `${product.name}${storageMb?` · ${storageMb} MB`:''} fue activado sin costo en ${event.name}.`,
      eventId,product.id,Number(grant.lastInsertRowid)
    );
    return grant;
  })();
  audit(req,"commerce.courtesy_granted",{eventId,targetType:"event_grant",targetId:info.lastInsertRowid,metadata:{productId:product.id,usageLimit,storageMb,complimentary:true}});
  res.status(201).json({ok:true,id:Number(info.lastInsertRowid),complimentary:true,revenue_cents:0});
});

app.delete("/api/admin/events/:eventId/grants/:grantId",authRequired,ownerOnly,(req,res)=>{
  const eventId=Number(req.params.eventId),grantId=Number(req.params.grantId);
  const info=db.prepare(`
    UPDATE event_grants SET status='revoked',revoked_at=CURRENT_TIMESTAMP
    WHERE id=? AND event_id=? AND source IN ('courtesy','legacy')
  `).run(grantId,eventId);
  if(!info.changes)return res.status(404).json({error:"Concesión revocable no encontrada."});
  audit(req,"commerce.grant_revoked",{eventId,targetType:"event_grant",targetId:grantId});
  res.json({ok:true});
});

function openCart(userId,eventId,{create=false}={}){
  let cart=db.prepare("SELECT * FROM carts WHERE user_id=? AND event_id=? AND status='open'").get(userId,eventId);
  if(!cart&&create){
    const info=db.prepare("INSERT INTO carts(user_id,event_id,status) VALUES(?,?,'open')").run(userId,eventId);
    cart=db.prepare("SELECT * FROM carts WHERE id=?").get(info.lastInsertRowid);
  }
  return cart||null;
}

function cartPayload(userId,eventId){
  const cart=openCart(userId,eventId);
  if(!cart)return {id:null,items:[],subtotal_cents:0,currency:"MXN"};
  const event=db.prepare("SELECT * FROM events WHERE id=?").get(eventId);
  const entitlement=event?eventEntitlement(event):null;
  const access=event?commerce.accessForEvent(event,entitlement):null;
  const controls=accountCommercialControls(userId);
  const allowed=new Map((event?commerce.relevantProducts(event,entitlement,{profile:controls}):[]).map(product=>[Number(product.id),product]));
  const rows=db.prepare(`
    SELECT ci.product_id,ci.quantity,ci.unit_price_cents,pc.code,pc.kind,pc.name,pc.description,pc.currency,
           pc.presentation_slot,pc.preview_strategy
    FROM cart_items ci JOIN product_catalog pc ON pc.id=ci.product_id
    WHERE ci.cart_id=? ORDER BY ci.created_at,pc.sort_order
  `).all(cart.id);
  const stale=rows.filter(item=>{
    const product=allowed.get(Number(item.product_id));
    return !product||(product.kind!=="storage"&&commerce.productOwnedForEvent(product,event,entitlement,access));
  });
  if(stale.length){
    const remove=db.prepare("DELETE FROM cart_items WHERE cart_id=? AND product_id=?");
    db.transaction(()=>stale.forEach(item=>remove.run(cart.id,item.product_id)))();
  }
  const items=rows.filter(item=>!stale.includes(item));
  return {id:cart.id,items,subtotal_cents:items.reduce((sum,item)=>sum+item.quantity*item.unit_price_cents,0),currency:items[0]?.currency||"MXN"};
}

function activatePaidOrder(orderId,{provider="demo",reference=""}={}){
  const order=db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
  if(!order)return null;
  if(order.status==="paid")return order;
  if(order.status!=="pending_payment")throw Object.assign(new Error("La orden no se puede activar en su estado actual."),{code:"ORDER_STATE_INVALID"});
  db.transaction(()=>{
    const items=db.prepare(`
      SELECT oi.product_id,oi.product_name,oi.quantity,pc.storage_mb
      FROM order_items oi JOIN product_catalog pc ON pc.id=oi.product_id
      WHERE oi.order_id=?
    `).all(orderId);
    const grant=db.prepare(`
      INSERT INTO event_grants(event_id,product_id,source,source_reference,storage_mb,note)
      SELECT ?,?,'purchase',?,?,?
      WHERE NOT EXISTS(
        SELECT 1 FROM event_grants WHERE event_id=? AND source='purchase' AND source_reference=?
      )
    `);
    items.forEach(item=>{
      const sourceReference=`order:${orderId}:product:${item.product_id}`;
      grant.run(
        order.event_id,item.product_id,sourceReference,
        Number(item.storage_mb||0)*Number(item.quantity||1),
        `Compra confirmada · ${item.quantity} × ${item.product_name}`,
        order.event_id,sourceReference
      );
    });
    db.prepare(`
      UPDATE orders SET status='paid',provider=?,provider_reference=?,paid_at=CURRENT_TIMESTAMP
      WHERE id=? AND status='pending_payment'
    `).run(provider,reference||`${provider}-${orderId}`,orderId);
    db.prepare(`
      INSERT INTO account_notifications(user_id,kind,title,message,event_id)
      VALUES(?,'purchase','Compra activada',?,?)
    `).run(order.user_id,`Tu compra #${orderId} quedó activa. Las funciones, plantillas o el espacio aparecen en el módulo correspondiente.`,order.event_id);
  })();
  return db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
}

async function createOrderCheckout(orderId){
  const order=db.prepare(`
    SELECT o.*,u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?
  `).get(orderId);
  if(!order||order.status!=="pending_payment")throw Object.assign(new Error("La orden no está disponible para checkout."),{code:"ORDER_STATE_INVALID"});
  const items=db.prepare(`
    SELECT product_id id,product_name title,quantity,unit_price_cents unitPriceCents,o.currency
    FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.order_id=? ORDER BY oi.product_id
  `).all(orderId);
  const preference=await paymentGateway.createPreference({
    reference:`eventstudio-order:${order.id}`,items,payerEmail:order.email,siteUrl:SITE_URL
  });
  db.prepare("UPDATE orders SET provider='mercadopago',provider_reference=? WHERE id=? AND status='pending_payment'")
    .run(`preference:${preference.id}`,order.id);
  return preference;
}

function activatePaidPlanPayment(paymentId,{provider="mercadopago",reference=""}={}){
  const payment=db.prepare(`
    SELECT py.*,p.code plan_code,p.name plan_name,p.duration_days
    FROM payments py JOIN plans p ON p.id=py.plan_id WHERE py.id=?
  `).get(paymentId);
  if(!payment)return null;
  if(payment.status==="paid")return payment;
  if(payment.status!=="pending")throw Object.assign(new Error("El pago de plan no se puede activar en su estado actual."),{code:"PAYMENT_STATE_INVALID"});
  const current=accountEntitlement(payment.user_id);
  const startsAt=current?.ends_at&&new Date(current.ends_at).getTime()>Date.now()&&current.plan_code===payment.plan_code
    ?new Date(current.ends_at):new Date();
  const endsAt=new Date(startsAt.getTime()+Number(payment.duration_days)*86400000).toISOString();
  db.transaction(()=>{
    db.prepare("UPDATE payments SET status='paid',provider=?,provider_reference=?,paid_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'")
      .run(provider,reference||`${provider}-${payment.id}`,payment.id);
    db.prepare("UPDATE subscriptions SET status='expired' WHERE user_id=? AND status IN ('trial','active')").run(payment.user_id);
    db.prepare("INSERT INTO subscriptions(user_id,plan_id,status,starts_at,ends_at) VALUES(?,?, 'active', CURRENT_TIMESTAMP, ?)")
      .run(payment.user_id,payment.plan_id,endsAt);
    db.prepare("INSERT INTO account_notifications(user_id,kind,title,message) VALUES(?,'purchase','Plan activado',?)")
      .run(payment.user_id,`${payment.plan_name} quedó activo hasta ${endsAt.slice(0,10)}.`);
  })();
  applySubscriptionLifecycle(payment.user_id,endsAt);
  return db.prepare("SELECT * FROM payments WHERE id=?").get(payment.id);
}

async function createPlanCheckout(paymentId){
  const payment=db.prepare(`
    SELECT py.*,p.name plan_name,u.email FROM payments py
    JOIN plans p ON p.id=py.plan_id JOIN users u ON u.id=py.user_id WHERE py.id=?
  `).get(paymentId);
  if(!payment||payment.status!=="pending")throw Object.assign(new Error("El pago de plan no está disponible para checkout."),{code:"PAYMENT_STATE_INVALID"});
  const preference=await paymentGateway.createPreference({
    reference:`eventstudio-plan:${payment.id}`,
    items:[{id:`plan-${payment.plan_id}`,title:`Plan ${payment.plan_name}`,quantity:1,unitPriceCents:payment.amount_cents,currency:payment.currency}],
    payerEmail:payment.email,siteUrl:SITE_URL
  });
  db.prepare("UPDATE payments SET provider='mercadopago',provider_reference=? WHERE id=? AND status='pending'")
    .run(`preference:${preference.id}`,payment.id);
  return preference;
}

app.get("/api/store",authRequired,eventAllowed,(req,res)=>{
  const entitlement=eventEntitlement(req.event);
  const context=commerce.featureContext(req.event,entitlement);
  const customerProfile=accountCommercialControls(req.user.id);
  const paymentStatus=paymentGateway.status();
  res.json({
    event:{id:req.event.id,name:req.event.name,slug:req.event.slug,event_type:req.event.event_type},
    plan:entitlement?{code:entitlement.plan_code,name:entitlement.plan_name,ends_at:entitlement.ends_at}:null,
    products:commerce.relevantProducts(req.event,entitlement,{profile:customerProfile}).map(product=>({...serializedProduct(product),owned:Boolean(product.owned),origin:product.origin||null})),
    rights:context.access.origins,
    cart:cartPayload(req.user.id,req.event.id),
    categories:commerce.storeCategories(),
    customerProfile,
    publication:publicationAccess(req.user,req.event),
    plans:publicCommercialPlans(),
    paymentProvider:PAYMENT_PROVIDER==="demo"&&ENABLE_DEMO_PAYMENTS?"demo":(paymentStatus.configured?paymentStatus.provider:"pending-integration")
  });
});

app.post("/api/store/cart/items",authRequired,eventAllowed,(req,res)=>{
  if(req.user.role!=="client")return res.status(403).json({error:"La tienda opera desde una cuenta cliente.",code:"CLIENT_STORE_ONLY"});
  const controls=accountCommercialControls(req.user.id);
  const product=commerce.relevantProducts(req.event,eventEntitlement(req.event),{profile:controls}).find(item=>item.id===Number(req.body.productId));
  if(!product)return res.status(404).json({error:"Este producto no está disponible para el evento.",code:"PRODUCT_NOT_AVAILABLE"});
  const entitlement=eventEntitlement(req.event);
  const access=commerce.accessForEvent(req.event,entitlement);
  if(commerce.productOwnedForEvent(product,req.event,entitlement,access)){
    return res.status(409).json({error:"Este producto ya está incluido o activo.",code:"PRODUCT_ALREADY_OWNED"});
  }
  const cart=openCart(req.user.id,req.event.id,{create:true});
  db.prepare(`
    INSERT INTO cart_items(cart_id,product_id,quantity,unit_price_cents)
    VALUES(?,?,1,?)
    ON CONFLICT(cart_id,product_id) DO UPDATE SET
      quantity=CASE WHEN product_id IN (SELECT id FROM product_catalog WHERE kind='storage')
        THEN MIN(100,cart_items.quantity+1) ELSE cart_items.quantity END,
      unit_price_cents=excluded.unit_price_cents
  `).run(cart.id,product.id,product.price_cents);
  db.prepare("UPDATE carts SET updated_at=CURRENT_TIMESTAMP WHERE id=?").run(cart.id);
  res.status(201).json({ok:true,cart:cartPayload(req.user.id,req.event.id)});
});

app.patch("/api/store/cart/items/:productId",authRequired,eventAllowed,(req,res)=>{
  if(req.user.role!=="client")return res.status(403).json({error:"La tienda opera desde una cuenta cliente."});
  const quantity=Math.max(1,Math.min(100,Number(req.body.quantity)||1));
  if(!Number.isInteger(quantity))return res.status(400).json({error:"La cantidad debe ser un entero."});
  const cart=openCart(req.user.id,req.event.id);
  if(!cart)return res.status(404).json({error:"El carrito está vacío."});
  const product=db.prepare("SELECT kind FROM product_catalog WHERE id=?").get(Number(req.params.productId));
  if(!product)return res.status(404).json({error:"Producto no encontrado."});
  if(product.kind!=="storage"&&quantity!==1)return res.status(409).json({error:"Sólo el almacenamiento admite varias unidades."});
  db.prepare("UPDATE cart_items SET quantity=? WHERE cart_id=? AND product_id=?").run(quantity,cart.id,Number(req.params.productId));
  res.json({ok:true,cart:cartPayload(req.user.id,req.event.id)});
});

app.delete("/api/store/cart/items/:productId",authRequired,eventAllowed,(req,res)=>{
  if(req.user.role!=="client")return res.status(403).json({error:"La tienda opera desde una cuenta cliente."});
  const cart=openCart(req.user.id,req.event.id);
  if(cart)db.prepare("DELETE FROM cart_items WHERE cart_id=? AND product_id=?").run(cart.id,Number(req.params.productId));
  res.json({ok:true,cart:cartPayload(req.user.id,req.event.id)});
});

app.delete("/api/store/cart",authRequired,eventAllowed,(req,res)=>{
  if(req.user.role!=="client")return res.status(403).json({error:"La tienda opera desde una cuenta cliente."});
  const cart=openCart(req.user.id,req.event.id);
  if(cart)db.prepare("DELETE FROM cart_items WHERE cart_id=?").run(cart.id);
  res.json({ok:true,cart:cartPayload(req.user.id,req.event.id)});
});

app.post("/api/store/cart/submit",authRequired,eventAllowed,async(req,res)=>{
  if(req.user.role!=="client")return res.status(403).json({error:"La tienda opera desde una cuenta cliente."});
  const cart=openCart(req.user.id,req.event.id);
  if(!cart)return res.status(400).json({error:"El carrito está vacío.",code:"CART_EMPTY"});
  const payload=cartPayload(req.user.id,req.event.id);
  if(!payload.items.length)return res.status(400).json({error:"El carrito está vacío.",code:"CART_EMPTY"});
  /* Revalida derechos al confirmar: el cliente pudo subir de plan o recibir una
     cortesía después de haber añadido un producto al carrito. Nunca cobramos un
     producto que ya está incluido en su derecho actual. */
  const entitlement=eventEntitlement(req.event);
  const context=commerce.featureContext(req.event,entitlement);
  const newlyOwned=payload.items.filter(item=>{
    const product=commerce.allProducts().find(candidate=>candidate.id===Number(item.product_id));
    return product&&commerce.productOwnedForEvent(product,req.event,entitlement,context.access);
  });
  if(newlyOwned.length){
    const remove=db.prepare("DELETE FROM cart_items WHERE cart_id=? AND product_id=?");
    db.transaction(()=>newlyOwned.forEach(item=>remove.run(cart.id,item.product_id)))();
    return res.status(409).json({
      error:`${newlyOwned.map(item=>item.name).join(", ")} ya está incluido en tu plan o fue concedido. Lo retiramos del carrito para evitar un cobro duplicado.`,
      code:"CART_CONTAINS_OWNED_PRODUCT",
      removedProductIds:newlyOwned.map(item=>item.product_id)
    });
  }
  const orderId=db.transaction(()=>{
    const order=db.prepare(`
      INSERT INTO orders(user_id,event_id,cart_id,status,subtotal_cents,currency)
      VALUES(?,?,?,'pending_payment',?,'MXN')
    `).run(req.user.id,req.event.id,cart.id,payload.subtotal_cents);
    const add=db.prepare(`
      INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_cents)
      VALUES(?,?,?,?,?)
    `);
    payload.items.forEach(item=>add.run(order.lastInsertRowid,item.product_id,item.name,item.quantity,item.unit_price_cents));
    db.prepare("UPDATE carts SET status='submitted',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(cart.id);
    return Number(order.lastInsertRowid);
  })();
  audit(req,"commerce.order_created",{eventId:req.event.id,targetType:"order",targetId:orderId,metadata:{subtotalCents:payload.subtotal_cents,status:"pending_payment"}});
  const response={
    ok:true,orderId,status:"pending_payment",subtotal_cents:payload.subtotal_cents,
    demoConfirmationAvailable:PAYMENT_PROVIDER==="demo"&&ENABLE_DEMO_PAYMENTS&&!IS_PRODUCTION,
    message:"Tu selección quedó guardada. No se activará ni se registrará como ingreso hasta confirmar el pago con el proveedor."
  };
  if(PAYMENT_PROVIDER==="mercadopago"){
    try{
      const checkout=await createOrderCheckout(orderId);
      response.checkoutUrl=checkout.checkoutUrl;response.provider="mercadopago";
    }catch(error){
      return res.status(502).json({error:error.message,code:error.code||"PAYMENT_PROVIDER_ERROR",orderId,status:"pending_payment"});
    }
  }
  res.status(201).json(response);
});

app.post("/api/store/orders/:id/checkout",authRequired,async(req,res)=>{
  const order=db.prepare("SELECT * FROM orders WHERE id=?").get(Number(req.params.id));
  if(!order)return res.status(404).json({error:"Orden no encontrada.",code:"ORDER_NOT_FOUND"});
  if(req.user.role==="client"&&order.user_id!==req.user.id)return res.status(403).json({error:"No puedes abrir esta orden."});
  if(PAYMENT_PROVIDER!=="mercadopago")return res.status(503).json({error:"Mercado Pago no está habilitado.",code:"PAYMENT_PROVIDER_DISABLED"});
  try{const checkout=await createOrderCheckout(order.id);res.json({ok:true,orderId:order.id,checkoutUrl:checkout.checkoutUrl});}
  catch(error){res.status(502).json({error:error.message,code:error.code||"PAYMENT_PROVIDER_ERROR"});}
});

app.post("/api/store/orders/:id/confirm-demo",authRequired,(req,res)=>{
  if(PAYMENT_PROVIDER!=="demo"||!ENABLE_DEMO_PAYMENTS||IS_PRODUCTION){
    return res.status(403).json({error:"La confirmación demo sólo existe en desarrollo.",code:"DEMO_PAYMENT_DISABLED"});
  }
  const order=db.prepare("SELECT * FROM orders WHERE id=?").get(Number(req.params.id));
  if(!order)return res.status(404).json({error:"Orden no encontrada.",code:"ORDER_NOT_FOUND"});
  if(req.user.role==="client"&&order.user_id!==req.user.id)return res.status(403).json({error:"No puedes confirmar esta orden."});
  try{
    const paid=activatePaidOrder(order.id,{provider:"demo",reference:`DEMO-ORDER-${order.id}`});
    audit(req,"commerce.order_paid",{eventId:order.event_id,targetType:"order",targetId:order.id,metadata:{subtotalCents:order.subtotal_cents,provider:"demo"}});
    res.json({ok:true,order:paid,message:"Pago demo aprobado y compra activada."});
  }catch(error){
    res.status(409).json({error:error.message,code:error.code||"ORDER_ACTIVATION_FAILED"});
  }
});

app.post("/api/payments/mercadopago/webhook",async(req,res)=>{
  if(PAYMENT_PROVIDER!=="mercadopago")return res.status(404).json({error:"Proveedor no habilitado."});
  const dataId=String(req.query["data.id"]||req.body?.data?.id||"");
  const requestId=String(req.headers["x-request-id"]||"");
  const signature=String(req.headers["x-signature"]||"");
  let signatureValid=false;
  try{signatureValid=paymentGateway.verifyWebhookSignature({signature,requestId,dataId});}catch(error){return res.status(503).json({error:error.message,code:error.code});}
  if(!signatureValid)return res.status(401).json({error:"Firma de webhook inválida.",code:"PAYMENT_WEBHOOK_SIGNATURE_INVALID"});
  try{
    const payment=await paymentGateway.getPayment(dataId);
    const reference=String(payment.external_reference||"");
    const match=/^eventstudio-(order|plan):(\d+)$/.exec(reference);
    if(!match)return res.status(202).json({ok:true,ignored:true});
    if(payment.status!=="approved")return res.status(202).json({ok:true,status:payment.status||"unknown"});
    const type=match[1],localId=Number(match[2]);
    const expected=type==="order"
      ?db.prepare("SELECT subtotal_cents amount_cents,currency FROM orders WHERE id=?").get(localId)
      :db.prepare("SELECT amount_cents,currency FROM payments WHERE id=?").get(localId);
    if(!expected)return res.status(202).json({ok:true,ignored:true});
    const receivedCents=Math.round(Number(payment.transaction_amount)*100);
    if(receivedCents!==Number(expected.amount_cents)||String(payment.currency_id)!==String(expected.currency)){
      audit({user:null,ip:req.ip,headers:req.headers},"payment.webhook_amount_mismatch",{targetType:type,targetId:localId,metadata:{receivedCents,currency:payment.currency_id}});
      return res.status(409).json({error:"El importe o moneda no coincide con la orden.",code:"PAYMENT_AMOUNT_MISMATCH"});
    }
    if(type==="order")activatePaidOrder(localId,{provider:"mercadopago",reference:`payment:${payment.id}`});
    else activatePaidPlanPayment(localId,{provider:"mercadopago",reference:`payment:${payment.id}`});
    res.json({ok:true,activated:true});
  }catch(error){
    log("error","payment.webhook_failed",{message:error.message,code:error.code});
    res.status(502).json({error:"No se pudo verificar el pago con el proveedor.",code:error.code||"PAYMENT_PROVIDER_ERROR"});
  }
});

app.put("/api/account/locale",authRequired,(req,res)=>{
  const locale=String(req.body.locale||"").toLowerCase();
  if(!SUPPORTED_LOCALES.has(locale))return res.status(400).json({error:"Idioma no compatible."});
  db.prepare("UPDATE users SET preferred_locale=? WHERE id=?").run(locale,req.user.id);
  res.json({ok:true,locale});
});

app.get("/api/account/notifications",authRequired,(req,res)=>{
  const rows=db.prepare(`
    SELECT n.id,n.kind,n.title,n.message,n.event_id,n.product_id,n.grant_id,n.read_at,n.created_at,
           e.name event_name,e.slug event_slug,
           pc.name product_name,pc.description product_description,pc.kind product_kind,
           pc.presentation_slot,pc.preview_strategy,pc.grants_json
    FROM account_notifications n
    LEFT JOIN events e ON e.id=n.event_id
    LEFT JOIN product_catalog pc ON pc.id=n.product_id
    WHERE n.user_id=?
    ORDER BY n.created_at DESC,n.id DESC LIMIT 50
  `).all(req.user.id);
  res.json({unread:rows.filter(row=>!row.read_at).length,items:rows});
});

app.patch("/api/account/notifications/:id/read",authRequired,(req,res)=>{
  const info=db.prepare(`
    UPDATE account_notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP)
    WHERE id=? AND user_id=?
  `).run(Number(req.params.id),req.user.id);
  if(!info.changes)return res.status(404).json({error:"Notificación no encontrada."});
  res.json({ok:true});
});

app.post("/api/admin/localization/translate",authRequired,eventAllowed,async(req,res)=>{
  if(!TRANSLATION_ENDPOINT){
    return res.status(503).json({error:"Configura TRANSLATION_ENDPOINT en el servidor para generar traducciones automáticas. Mientras tanto puedes escribirlas y guardarlas manualmente.",code:"TRANSLATION_PROVIDER_DISABLED"});
  }
  const row=db.prepare("SELECT settings_json FROM events WHERE id=?").get(req.eventId);
  if(!row)return res.status(404).json({error:"Evento no encontrado."});
  const eventSettings=JSON.parse(row.settings_json);
  const localization=normalizeLocalization(eventSettings.localization,req.body.localization||eventSettings.localization||{});
  const source=localization.defaultLocale;
  const paths=[
    "event.heroMessage","event.closingMessage","story.title","story.text",
    "dressCode.title","dressCode.description","gifts.title","gifts.message",
    "gifts.description","venue.title","venue.notes"
  ];
  const valueAt=(object,key)=>key.split(".").reduce((value,part)=>value?.[part],object);
  try{
    const contentTranslations={...(localization.contentTranslations||{})};
    for(const target of localization.enabledLocales.filter(locale=>locale!==source)){
      const translated={...(contentTranslations[target]||{})};
      await Promise.all(paths.map(async key=>{
        const text=String(valueAt(eventSettings,key)||"").trim();
        if(!text)return;
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),12000);
        try{
          const response=await fetch(TRANSLATION_ENDPOINT,{
            method:"POST",headers:{"Content-Type":"application/json",...(TRANSLATION_API_KEY?{Authorization:`Bearer ${TRANSLATION_API_KEY}`}:{})},
            body:JSON.stringify({q:text,source,target,format:"text",...(TRANSLATION_API_KEY?{api_key:TRANSLATION_API_KEY}:{})}),
            signal:controller.signal
          });
          const payload=await response.json().catch(()=>({}));
          if(!response.ok||!payload.translatedText)throw new Error(payload.error||`Proveedor ${response.status}`);
          translated[key]=cleanText(payload.translatedText,2000);
        }finally{clearTimeout(timer);}
      }));
      contentTranslations[target]=translated;
    }
    const next=normalizeLocalization(localization,{...localization,contentTranslations});
    eventSettings.localization=next;
    db.prepare("UPDATE events SET settings_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(eventSettings),req.eventId);
    audit(req,"localization.translated",{eventId:req.eventId,metadata:{source,targets:localization.enabledLocales.filter(locale=>locale!==source)}});
    res.json({ok:true,localization:next});
  }catch(error){
    res.status(502).json({error:`No se pudieron generar las traducciones: ${error.name==="AbortError"?"el proveedor tardó demasiado":error.message}`,code:"TRANSLATION_PROVIDER_FAILED"});
  }
});

function boundedAttemptState(store,key,windowMs,maxEntries=10000){
  const now=Date.now();
  const previous=store.get(key);
  if(previous&&now-previous.startedAt<=windowMs)return previous;
  if(previous)store.delete(key);
  if(store.size>=maxEntries){
    for(const [storedKey,row] of store){
      if(now-row.startedAt>windowMs)store.delete(storedKey);
    }
  }
  while(store.size>=maxEntries)store.delete(store.keys().next().value);
  const fresh={count:0,startedAt:now};
  store.set(key,fresh);
  return fresh;
}

const registrationAttempts=new Map();
function registrationRateStatus(req){
  return boundedAttemptState(registrationAttempts,String(req.ip||"unknown"),60*60*1000);
}

app.post("/api/auth/register",(req,res)=>{
  if(!ALLOW_PUBLIC_REGISTRATION)return res.status(403).json({error:"El registro público está deshabilitado.",code:"REGISTRATION_DISABLED"});
  const attempt=registrationRateStatus(req);
  if(attempt.count>=5)return res.status(429).json({error:"Se alcanzó el límite de registros desde esta conexión. Intenta en una hora.",code:"REGISTRATION_RATE_LIMIT"});
  attempt.count++;
  const displayName=String(req.body.displayName||"").trim();
  const rawEmail=String(req.body.email||"").trim().toLowerCase();
  const phone=normalizePhone(req.body.phone||"");
  const password=String(req.body.password||"");
  const planCode=String(req.body.planCode||"basic");
  const eventType=String(req.body.eventType||"custom");
  const requestedTheme=String(req.body.themeId||"");
  const requestedEventName=cleanText(req.body.eventName||"",160);
  const requestedEventDate=/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.eventDate||""))?String(req.body.eventDate):"";
  const preferredLocale=SUPPORTED_LOCALES.has(String(req.body.locale||"es").toLowerCase())
    ?String(req.body.locale||"es").toLowerCase()
    :"es";
  if(!displayName || (!rawEmail && !phone) || password.length<12 || req.body.acceptTerms!==true){
    return res.status(400).json({error:"Escribe tu nombre, correo o teléfono, una contraseña de al menos 12 caracteres y acepta iniciar la prueba."});
  }
  const identifier=rawEmail||phone;
  const email=rawEmail||`phone-${phone}@local.invalid`;
  if(db.prepare("SELECT id FROM users WHERE lower(email)=? OR phone=? OR login_identifier=?").get(email,phone,identifier)){
    return res.status(409).json({error:"Ya existe una cuenta con esos datos."});
  }
  const publicPlanCodes=new Set(db.prepare("SELECT code FROM plans WHERE active=1 AND public=1").all().map(item=>item.code));
  const selectedPlanCode=publicPlanCodes.has(planCode)?planCode:"basic";
  const trialPlan=db.prepare("SELECT * FROM plans WHERE code='trial' AND active=1").get();
  const plan=trialPlan || db.prepare("SELECT * FROM plans WHERE code='premium' AND active=1").get();
  const selectedEventType=eventTypes.some(item=>item.id===eventType)?eventType:"custom";
  const initialEventName=requestedEventName||`Evento de ${displayName}`;
  const settings=freshEventSettings(initialEventName,selectedEventType);
  if(requestedEventDate){
    const date=new Date(`${requestedEventDate}T12:00:00`);
    settings.event.dateTime=`${requestedEventDate}T18:00`;
    settings.event.dateLabel=Number.isNaN(date.getTime())?requestedEventDate:date.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  }
  const theme=themes.find(item=>item.id===requestedTheme);
  if(theme&&themeAllowedForPlan(theme,settings,plan.code))settings.themeId=theme.id;
  settings.trialIntent={planCode:selectedPlanCode,createdAt:new Date().toISOString()};
  const tx=db.transaction(()=>{
    const userInfo=db.prepare("INSERT INTO users(email,phone,login_identifier,password_hash,display_name,role,auth_provider,preferred_locale) VALUES(?,?,?,?,?,'client','local',?)")
      .run(email,phone||null,identifier,bcrypt.hashSync(password,12),displayName,preferredLocale);
    const slug=`evento-${slugify(initialEventName)}-${Date.now().toString().slice(-5)}`;
    const eventInfo=db.prepare(`
      INSERT INTO events(slug,name,settings_json,event_type,owner_user_id,published,protected)
      VALUES(?,?,?,?,?,0,0)
    `).run(slug,initialEventName,JSON.stringify(settings),selectedEventType,userInfo.lastInsertRowid);
    db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,'manage')").run(userInfo.lastInsertRowid,eventInfo.lastInsertRowid);
    db.prepare("INSERT INTO subscriptions(user_id,plan_id,status,ends_at) VALUES(?,?, 'trial', datetime('now', ?))")
      .run(userInfo.lastInsertRowid,plan.id,`+${TRIAL_DAYS} days`);
    return {userId:userInfo.lastInsertRowid,eventId:eventInfo.lastInsertRowid};
  });
  const created=tx();
  applySubscriptionLifecycle(created.userId,accountEntitlement(created.userId)?.ends_at);
  const token=createSession(created.userId);
  setSessionCookie(res,token);
  audit(req,"auth.register",{targetType:"user",targetId:created.userId,metadata:{eventId:created.eventId}});
  res.status(201).json({ok:true,...(!IS_PRODUCTION?{token}:{}),user:{id:created.userId,email:rawEmail,phone,displayName,role:'client',preferred_locale:preferredLocale},eventId:created.eventId,billing:{status:'trial',paid:false}});
});

app.post("/api/auth/google",(_req,res)=>{
  if(!GOOGLE_CLIENT_ID)return res.status(503).json({error:"El acceso con Google aún no está configurado. Agrega GOOGLE_CLIENT_ID y el flujo OAuth antes de producción."});
  res.status(501).json({error:"El endpoint OAuth está preparado, pero requiere configurar las credenciales y callback del dominio definitivo."});
});

const loginAttempts=new Map();
function loginRateKey(req,identifier){return `${req.ip}:${String(identifier).slice(0,120)}`;}
function loginRateStatus(key){
  return boundedAttemptState(loginAttempts,key,15*60*1000);
}

app.post("/api/auth/login",(req,res)=>{
  const identifier=String(req.body.email||req.body.identifier||"").trim().toLowerCase();
  const normalizedPhone=normalizePhone(identifier);
  const password=String(req.body.password||"");
  const rateKey=loginRateKey(req,identifier);
  const attempt=loginRateStatus(rateKey);
  if(attempt.count>=5)return res.status(429).json({error:"Demasiados intentos. Espera 15 minutos.",code:"LOGIN_RATE_LIMIT"});
  const user=db.prepare("SELECT * FROM users WHERE active=1 AND (lower(email)=? OR login_identifier=? OR phone=?)").get(identifier,identifier,normalizedPhone);
  if(!user || !bcrypt.compareSync(password,user.password_hash)){
    attempt.count++;
    audit(req,"auth.login_failed",{targetType:"user",metadata:{identifier}});
    return res.status(401).json({error:"Correo o contraseña incorrectos.",code:"INVALID_CREDENTIALS"});
  }
  loginAttempts.delete(rateKey);
  db.prepare("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?").run(user.id);
  const token=createSession(user.id);
  setSessionCookie(res,token);
  req.user={id:user.id,role:user.role};
  audit(req,"auth.login",{targetType:"user",targetId:user.id});
  res.json({...(!IS_PRODUCTION?{token}:{}),user:{id:user.id,email:user.email,displayName:user.display_name,role:user.role,preferred_locale:user.preferred_locale||"es",mustChangePassword:Boolean(user.must_change_password)}});
});

app.post("/api/auth/logout",authRequired,(req,res)=>{
  db.prepare("DELETE FROM sessions WHERE token=?").run(req.user._sessionDigest);
  clearSessionCookie(res);
  audit(req,"auth.logout",{targetType:"user",targetId:req.user.id});
  res.json({ok:true});
});

app.get("/api/auth/me",(req,res)=>{
  const user=currentUser(req);
  if(!user){
    /* El panel consulta este modo al abrir la pantalla de acceso. Evita un 401
       esperado en consola sin debilitar el contrato normal del endpoint. */
    if(req.query.optional==="1")return res.json({authenticated:false});
    return res.status(401).json({error:"Sesión no válida o vencida."});
  }
  res.json({...user,authenticated:true});
});

app.put("/api/auth/password",authRequired,(req,res)=>{
  const currentPassword=String(req.body.currentPassword||"");
  const newPassword=String(req.body.newPassword||"");
  const user=db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  if(!bcrypt.compareSync(currentPassword,user.password_hash))return res.status(401).json({error:"La contraseña actual no coincide.",code:"CURRENT_PASSWORD_INVALID"});
  if(newPassword.length<12)return res.status(400).json({error:"La contraseña nueva debe tener al menos 12 caracteres.",code:"PASSWORD_TOO_SHORT"});
  db.transaction(()=>{
    db.prepare("UPDATE users SET password_hash=?,must_change_password=0,password_changed_at=CURRENT_TIMESTAMP WHERE id=?").run(bcrypt.hashSync(newPassword,12),user.id);
    db.prepare("DELETE FROM sessions WHERE user_id=? AND token<>?").run(user.id,req.user._sessionDigest);
  })();
  audit(req,"auth.password_changed",{targetType:"user",targetId:user.id});
  res.json({ok:true});
});


app.get("/api/admin/platform-summary",authRequired,ownerOnly,(_req,res)=>{
  const clients=db.prepare("SELECT COUNT(*) total FROM users WHERE role='client' AND active=1").get().total;
  const events=db.prepare("SELECT COUNT(*) total FROM events WHERE COALESCE(archived,0)=0").get().total;
  const weddings=db.prepare("SELECT COUNT(*) total FROM events WHERE COALESCE(archived,0)=0 AND event_type='wedding'").get().total;
  const guests=db.prepare("SELECT COUNT(*) total FROM guests WHERE COALESCE(is_test,0)=0").get().total;
  const photos=db.prepare("SELECT COUNT(*) total FROM photos").get().total;
  res.json({clients,events,weddings,guests,photos});
});

app.get("/api/admin/owner-summary",authRequired,ownerOnly,(_req,res)=>{
  const totals=db.prepare(`SELECT COUNT(*) clients, SUM(active=1) active_clients FROM users WHERE role='client'`).get();
  const events=db.prepare("SELECT COUNT(*) total FROM events").get().total;
  const publishedEvents=db.prepare("SELECT COUNT(*) total FROM events WHERE COALESCE(published,0)=1 AND COALESCE(archived,0)=0").get().total;
  const planRevenue=db.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM payments WHERE status='paid'").get().total;
  const addonRevenue=db.prepare("SELECT COALESCE(SUM(subtotal_cents),0) total FROM orders WHERE status='paid'").get().total;
  const trials=db.prepare("SELECT COUNT(*) total FROM subscriptions WHERE status='trial' AND datetime(ends_at)>datetime('now')").get().total;
  res.json({...totals,events,published_events:publishedEvents,revenue_cents:Number(planRevenue)+Number(addonRevenue),active_trials:trials});
});

app.get("/api/admin/clients",authRequired,ownerOnly,(_req,res)=>{
  res.json(db.prepare(`
    SELECT u.id,u.display_name,u.email,u.phone,u.active,u.last_login_at,u.created_at,u.preferred_locale,
      p.code plan_code,p.name plan_name,s.status subscription_status,s.ends_at,
      COUNT(DISTINCT ue.event_id) event_count,
      (SELECT COUNT(DISTINCT e2.id) FROM events e2 LEFT JOIN user_events ue2 ON ue2.event_id=e2.id
        WHERE (e2.owner_user_id=u.id OR ue2.user_id=u.id) AND COALESCE(e2.archived,0)=0 AND COALESCE(e2.published,0)=1) published_event_count,
      (SELECT COALESCE(SUM(amount_cents),0) FROM payments WHERE user_id=u.id AND status='paid')
      +(SELECT COALESCE(SUM(subtotal_cents),0) FROM orders WHERE user_id=u.id AND status='paid') paid_cents
    FROM users u
    LEFT JOIN user_events ue ON ue.user_id=u.id
    LEFT JOIN subscriptions s ON s.id=(SELECT s2.id FROM subscriptions s2 WHERE s2.user_id=u.id ORDER BY s2.id DESC LIMIT 1)
    LEFT JOIN plans p ON p.id=s.plan_id
    WHERE u.role='client'
    GROUP BY u.id ORDER BY u.created_at DESC
  `).all());
});


app.get("/api/admin/commercial-controls",authRequired,ownerOnly,(_req,res)=>{
  res.json({
    profiles:commercialProfileRows({activeOnly:true}),
    platform:{publication:platformSetting("publication",{mode:"manual_owner"}),branding:platformSetting("branding",{})}
  });
});

app.put("/api/admin/platform-settings/commercial",authRequired,ownerOnly,(req,res)=>{
  const currentPublication=platformSetting("publication",{mode:"manual_owner"});
  const currentBranding=platformSetting("branding",{});
  const publicationMode=["manual_owner","plan_policy"].includes(req.body.publicationMode)?req.body.publicationMode:(currentPublication.mode||"manual_owner");
  const attributionLabel=cleanText(req.body.attributionLabel??currentBranding.attributionLabel??"Creado con EventStudio",80);
  const rawAttributionUrl=String(req.body.attributionUrl??currentBranding.attributionUrl??"").trim();
  const attributionUrl=rawAttributionUrl?safeHttpUrl(rawAttributionUrl):"";
  if(rawAttributionUrl&&!attributionUrl)return res.status(400).json({error:"La URL de atribución debe usar http o https.",code:"ATTRIBUTION_URL_INVALID"});
  const branding={
    proofWatermarkEnabled:booleanValue(req.body.proofWatermarkEnabled??currentBranding.proofWatermarkEnabled),
    attributionEnabled:booleanValue(req.body.attributionEnabled??currentBranding.attributionEnabled),
    attributionLabel:attributionLabel||"Creado con EventStudio",
    attributionUrl,
    attributionOnInvitation:booleanValue(req.body.attributionOnInvitation??currentBranding.attributionOnInvitation),
    attributionOnPrint:booleanValue(req.body.attributionOnPrint??currentBranding.attributionOnPrint),
    attributionOnQr:booleanValue(req.body.attributionOnQr??currentBranding.attributionOnQr)
  };
  savePlatformSetting("publication",{mode:publicationMode},req.user.id);
  savePlatformSetting("branding",branding,req.user.id);
  audit(req,"platform.commercial_settings_updated",{targetType:"platform",metadata:{publicationMode,attributionEnabled:branding.attributionEnabled}});
  res.json({ok:true,publication:{mode:publicationMode},branding});
});

app.put("/api/admin/clients/:id/commercial-controls",authRequired,ownerOnly,(req,res)=>{
  const userId=Number(req.params.id);
  const client=db.prepare("SELECT id,display_name FROM users WHERE id=? AND role='client'").get(userId);
  if(!client)return res.status(404).json({error:"Cliente no encontrado.",code:"CLIENT_NOT_FOUND"});
  const profileId=req.body.profileId==null||req.body.profileId===""?null:Number(req.body.profileId);
  if(profileId&&!db.prepare("SELECT 1 FROM customer_profiles WHERE id=? AND active=1").get(profileId))return res.status(400).json({error:"Perfil comercial inválido.",code:"CUSTOMER_PROFILE_INVALID"});
  const normalizeOverride=value=>value==null||value===""?null:Number(value);
  const maxEvents=normalizeOverride(req.body.maxEventsOverride);
  const maxPublished=normalizeOverride(req.body.maxPublishedEventsOverride);
  if(maxEvents!==null&&(!Number.isInteger(maxEvents)||maxEvents<0||maxEvents>10000))return res.status(400).json({error:"Límite de eventos inválido."});
  if(maxPublished!==null&&(!Number.isInteger(maxPublished)||maxPublished<0||maxPublished>10000))return res.status(400).json({error:"Límite de sitios publicados inválido."});
  const policy=String(req.body.publicationPolicyOverride||"");
  const publicationPolicy=["","manual_owner","auto_after_entitlement","disabled"].includes(policy)?(policy||null):null;
  if(policy&&!publicationPolicy)return res.status(400).json({error:"Política de publicación inválida."});
  db.prepare(`
    INSERT INTO account_commercial_controls(user_id,customer_profile_id,max_events_override,max_published_events_override,publication_policy_override,note,updated_by,updated_at)
    VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET customer_profile_id=excluded.customer_profile_id,max_events_override=excluded.max_events_override,
      max_published_events_override=excluded.max_published_events_override,publication_policy_override=excluded.publication_policy_override,
      note=excluded.note,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP
  `).run(userId,profileId,maxEvents,maxPublished,publicationPolicy,cleanText(req.body.note||"",500),req.user.id);
  audit(req,"client.commercial_controls_updated",{targetType:"user",targetId:userId,metadata:{profileId,maxEvents,maxPublished,publicationPolicy}});
  res.json({ok:true,controls:accountCommercialControls(userId)});
});

app.get("/api/admin/publication-requests",authRequired,ownerOnly,(_req,res)=>{
  const rows=db.prepare(`
    SELECT pr.id,pr.event_id,pr.user_id,pr.status,pr.requested_at,pr.decided_at,pr.note,
           e.name event_name,e.slug,e.published,u.display_name,u.email
    FROM publication_requests pr
    JOIN events e ON e.id=pr.event_id JOIN users u ON u.id=pr.user_id
    ORDER BY CASE pr.status WHEN 'pending' THEN 0 ELSE 1 END,pr.requested_at DESC,pr.id DESC
    LIMIT 250
  `).all();
  res.json(rows.map(row=>({...row,published:Boolean(row.published)})));
});

app.patch("/api/admin/publication-requests/:id",authRequired,ownerOnly,(req,res)=>{
  const requestId=Number(req.params.id);
  const row=db.prepare(`SELECT pr.*,e.archived,e.published FROM publication_requests pr JOIN events e ON e.id=pr.event_id WHERE pr.id=?`).get(requestId);
  if(!row)return res.status(404).json({error:"Solicitud no encontrada."});
  if(row.status!=="pending")return res.status(409).json({error:"La solicitud ya fue atendida."});
  const action=String(req.body.action||"");
  if(!["approve","reject"].includes(action))return res.status(400).json({error:"Acción inválida."});
  if(action==="approve"){
    if(row.archived)return res.status(409).json({error:"No se puede publicar un evento archivado."});
    const owner=db.prepare("SELECT * FROM users WHERE id=?").get(row.user_id);
    const access=publicationAccess(owner,db.prepare("SELECT * FROM events WHERE id=?").get(row.event_id));
    if(!access.withinLimit)return res.status(409).json({error:`El cliente alcanzó su límite de ${access.maxPublishedEvents} sitio(s) publicado(s).`,code:"PUBLISHED_EVENT_LIMIT"});
    db.transaction(()=>{
      db.prepare("UPDATE events SET published=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.event_id);
      db.prepare("UPDATE publication_requests SET status='approved',decided_at=CURRENT_TIMESTAMP,decided_by=?,note=? WHERE id=?")
        .run(req.user.id,cleanText(req.body.note||"Aprobado por propietario/desarrollador",500),requestId);
    })();
    audit(req,"publication.request_approved",{eventId:row.event_id,targetType:"publication_request",targetId:requestId});
    return res.json({ok:true,status:"approved",published:true});
  }
  db.prepare("UPDATE publication_requests SET status='rejected',decided_at=CURRENT_TIMESTAMP,decided_by=?,note=? WHERE id=?")
    .run(req.user.id,cleanText(req.body.note||"Rechazado por propietario/desarrollador",500),requestId);
  audit(req,"publication.request_rejected",{eventId:row.event_id,targetType:"publication_request",targetId:requestId});
  res.json({ok:true,status:"rejected",published:Boolean(row.published)});
});

app.post("/api/admin/users/:id/grant-plan",authRequired,ownerOnly,(req,res)=>{
  const userId=Number(req.params.id);
  const user=db.prepare("SELECT id,display_name,role,active FROM users WHERE id=?").get(userId);
  if(!user||user.role!=="client")return res.status(404).json({error:"Cliente no encontrado."});
  if(!user.active)return res.status(409).json({error:"Activa la cuenta antes de asignarle un plan."});
  const plan=db.prepare("SELECT * FROM plans WHERE code=? AND active=1").get(cleanText(req.body.planCode,40));
  if(!plan)return res.status(404).json({error:"Plan no encontrado."});
  const durationDays=Math.max(1,Math.min(730,Number(req.body.durationDays)||plan.duration_days));
  const reason=cleanText(req.body.reason||"Cortesía asignada por la plataforma",240);
  const subscriptionId=db.transaction(()=>{
    db.prepare("UPDATE subscriptions SET status='expired' WHERE user_id=? AND status IN ('trial','active')").run(userId);
    const info=db.prepare(`
      INSERT INTO subscriptions(user_id,plan_id,status,starts_at,ends_at,granted_by,grant_reason)
      VALUES(?,?,'active',CURRENT_TIMESTAMP,datetime('now',?),?,?)
    `).run(userId,plan.id,`+${durationDays} days`,req.user.id,reason);
    db.prepare(`
      INSERT INTO account_notifications(user_id,kind,title,message)
      VALUES(?,'courtesy','Recibiste un paquete de cortesía',?)
    `).run(userId,`${plan.name} fue activado por ${durationDays} días sin costo.`);
    return Number(info.lastInsertRowid);
  })();
  applySubscriptionLifecycle(userId,accountEntitlement(userId)?.ends_at);
  audit(req,"subscription.granted",{targetType:"user",targetId:userId,metadata:{planCode:plan.code,durationDays,subscriptionId,complimentary:true}});
  res.json({ok:true,subscriptionId,plan:{code:plan.code,name:plan.name},durationDays,complimentary:true});
});

app.post("/api/admin/events/:id/transfer",authRequired,ownerOnly,(req,res)=>{
  const eventId=Number(req.params.id);
  const clientId=Number(req.body.clientId);
  const event=db.prepare("SELECT id,name,owner_user_id FROM events WHERE id=?").get(eventId);
  if(!event)return res.status(404).json({error:"Evento no encontrado."});
  const client=db.prepare("SELECT id,display_name,role,active FROM users WHERE id=?").get(clientId);
  if(!client||client.role!=="client")return res.status(404).json({error:"Selecciona una cuenta cliente válida."});
  if(!client.active)return res.status(409).json({error:"La cuenta cliente está desactivada."});
  db.transaction(()=>{
    db.prepare("UPDATE events SET owner_user_id=?,subscription_required=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(clientId,eventId);
    db.prepare(`DELETE FROM user_events WHERE event_id=? AND user_id IN (SELECT id FROM users WHERE role='client' AND id<>?)`).run(eventId,clientId);
    db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,'manage') ON CONFLICT(user_id,event_id) DO UPDATE SET permission='manage'").run(clientId,eventId);
  })();
  const entitlement=accountEntitlement(clientId);
  applySubscriptionLifecycle(clientId,entitlement?.ends_at);
  audit(req,"event.transferred",{eventId,targetType:"event",targetId:eventId,metadata:{fromUserId:event.owner_user_id||null,toUserId:clientId}});
  res.json({ok:true,eventId,client:{id:client.id,name:client.display_name},subscriptionUsable:subscriptionUsable(entitlement),plan:entitlement?.plan_name||null});
});

app.get("/api/account/context",authRequired,(req,res)=>{
  const entitlement=accountEntitlement(req.user.id);
  const eventCount=["owner","developer"].includes(req.user.role)
    ? db.prepare("SELECT COUNT(*) total FROM events WHERE COALESCE(archived,0)=0").get().total
    : db.prepare(`
        SELECT COUNT(*) total FROM user_events ue
        JOIN events e ON e.id=ue.event_id
        WHERE ue.user_id=? AND COALESCE(e.archived,0)=0
      `).get(req.user.id).total;
  const commercialControls=["owner","developer"].includes(req.user.role)?null:accountCommercialControls(req.user.id);
  const maxEvents=["owner","developer"].includes(req.user.role)?null:Math.max(0,Number(commercialControls?.max_events_override??entitlement?.max_events??0));
  const publication=publicationAccess(req.user);
  res.json({
    role:req.user.role,
    isPlatformUser:["owner","developer"].includes(req.user.role),
    entitlement,commercialControls,publication,
    subscriptionUsable:subscriptionUsable(entitlement),
    eventCount,maxEvents,
    canCreateEvent:["owner","developer"].includes(req.user.role) ||
      (subscriptionUsable(entitlement) && eventCount<maxEvents),
    preferredLocale:req.user.preferred_locale||"es"
  });
});


app.get("/api/admin/domains",authRequired,eventAllowed,featureRequired("customDomains"),(req,res)=>{
  const event=currentEvent(req);
  const aliases=db.prepare(`
    SELECT id,hostname,verified,is_primary,created_at,verified_at
    FROM event_domains
    WHERE event_id=?
    ORDER BY is_primary DESC,id DESC
  `).all(event.id);

  res.json({
    includedUrl:`${SITE_URL}/e/${event.slug}`,
    aliases,
    dnsTarget:normalizeHostname(new URL(SITE_URL).hostname),
    event:{id:event.id,slug:event.slug,name:event.name}
  });
});

app.post("/api/admin/domains",authRequired,eventAllowed,featureRequired("customDomains"),(req,res)=>{
  const event=currentEvent(req);
  const hostname=normalizeHostname(req.body.hostname);

  if(!hostname||!hostname.includes(".")){
    return res.status(400).json({error:"Escribe un dominio o subdominio válido."});
  }
  if(["localhost","127.0.0.1"].includes(hostname)){
    return res.status(400).json({error:"No puedes registrar localhost como dominio público."});
  }

  try{
    db.prepare(`
      INSERT INTO event_domains(event_id,hostname,verified,is_primary)
      VALUES(?,?,0,0)
      ON CONFLICT(hostname) DO UPDATE SET event_id=excluded.event_id
    `).run(event.id,hostname);

    res.json({
      ok:true,
      hostname,
      status:"pending",
      dns:{
        type:"CNAME",
        name:hostname,
        target:normalizeHostname(new URL(SITE_URL).hostname)
      },
      message:"Dominio guardado. Falta apuntar el DNS y verificarlo antes de publicarlo."
    });
  }catch(error){
    res.status(400).json({error:"No se pudo registrar el dominio."});
  }
});

app.delete("/api/admin/domains/:id",authRequired,eventAllowed,featureRequired("customDomains"),(req,res)=>{
  const event=currentEvent(req);
  const info=db.prepare("DELETE FROM event_domains WHERE id=? AND event_id=?")
    .run(Number(req.params.id),event.id);
  if(!info.changes)return res.status(404).json({error:"Dominio no encontrado."});
  res.json({ok:true});
});

app.get("/api/billing/me",authRequired,(req,res)=>{
  const subscription=db.prepare(`SELECT s.*,p.code,p.name,p.price_cents,p.currency,p.duration_days,p.retention_days,p.max_events,p.max_guests,p.max_storage_mb,p.sort_order FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.id DESC LIMIT 1`).get(req.user.id);
  const payments=db.prepare("SELECT id,provider,provider_reference,amount_cents,currency,status,paid_at,created_at FROM payments WHERE user_id=? ORDER BY id DESC").all(req.user.id);
  let plans=["owner","developer"].includes(req.user.role)
    ?db.prepare("SELECT id,code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb FROM plans WHERE active=1 ORDER BY price_cents").all()
    :publicCommercialPlans();
  if(!["owner","developer"].includes(req.user.role)&&subscription&&subscription.code!=="trial"){
    plans=plans.filter(plan=>Number(plan.sort_order)>=Number(subscription.sort_order));
  }
  const paymentStatus=paymentGateway.status();
  res.json({subscription,payments,plans,provider:ENABLE_DEMO_PAYMENTS&&PAYMENT_PROVIDER==="demo"?"demo":(paymentStatus.configured?paymentStatus.provider:"disabled")});
});

app.post("/api/billing/checkout",authRequired,async(req,res)=>{
  const requestedPlan=String(req.body.planCode||"basic");
  const publicPlanCodes=new Set(db.prepare("SELECT code FROM plans WHERE active=1 AND public=1").all().map(item=>item.code));
  if(!["owner","developer"].includes(req.user.role)&&!publicPlanCodes.has(requestedPlan)){
    return res.status(404).json({error:"Plan no encontrado."});
  }
  const plan=db.prepare("SELECT * FROM plans WHERE code=? AND active=1").get(requestedPlan);
  if(!plan)return res.status(404).json({error:"Plan no encontrado."});
  const current=accountEntitlement(req.user.id);
  if(!["owner","developer"].includes(req.user.role)&&current&&current.plan_code!=="trial"&&Number(plan.sort_order)<Number(current.sort_order)){
    return res.status(409).json({error:"Desde Plan y extras sólo puedes renovar tu paquete actual o elegir uno superior.",code:"PLAN_DOWNGRADE_NOT_ALLOWED"});
  }
  if(PAYMENT_PROVIDER==="mercadopago"){
    if(!paymentGateway.status().configured)return res.status(503).json({error:"Mercado Pago requiere Access Token y secreto de webhook.",code:"PAYMENT_PROVIDER_DISABLED"});
    const info=db.prepare("INSERT INTO payments(user_id,plan_id,provider,amount_cents,currency,status) VALUES(?,?, 'mercadopago', ?, ?, 'pending')")
      .run(req.user.id,plan.id,plan.price_cents,plan.currency);
    try{
      const checkout=await createPlanCheckout(Number(info.lastInsertRowid));
      return res.status(201).json({ok:true,paymentId:Number(info.lastInsertRowid),checkoutUrl:checkout.checkoutUrl,provider:"mercadopago",message:"Pago preparado. El plan se activará únicamente tras verificar el webhook."});
    }catch(error){
      return res.status(502).json({error:error.message,code:error.code||"PAYMENT_PROVIDER_ERROR",paymentId:Number(info.lastInsertRowid)});
    }
  }
  if(PAYMENT_PROVIDER!=="demo"||!ENABLE_DEMO_PAYMENTS)return res.status(503).json({error:"No hay un proveedor de pago real habilitado. El modo demo nunca acredita pagos en producción.",code:"PAYMENT_PROVIDER_DISABLED"});
  const ref=`DEMO-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const startsAt=current?.ends_at&&new Date(current.ends_at).getTime()>Date.now()&&current.plan_code===plan.code
    ?new Date(current.ends_at)
    :new Date();
  const endsAt=new Date(startsAt.getTime()+plan.duration_days*86400000).toISOString();
  const tx=db.transaction(()=>{
    db.prepare("INSERT INTO payments(user_id,plan_id,provider,provider_reference,amount_cents,currency,status,paid_at) VALUES(?,?, 'demo', ?, ?, ?, 'paid', CURRENT_TIMESTAMP)")
      .run(req.user.id,plan.id,ref,plan.price_cents,plan.currency);
    db.prepare("UPDATE subscriptions SET status='expired' WHERE user_id=? AND status IN ('trial','active')").run(req.user.id);
    db.prepare("INSERT INTO subscriptions(user_id,plan_id,status,starts_at,ends_at) VALUES(?,?, 'active', CURRENT_TIMESTAMP, ?)")
      .run(req.user.id,plan.id,endsAt);
    db.prepare(`
      INSERT INTO account_notifications(user_id,kind,title,message)
      VALUES(?,'purchase','Plan activado',?)
    `).run(req.user.id,`${plan.name} quedó activo hasta ${endsAt.slice(0,10)}.`);
  });tx();
  applySubscriptionLifecycle(req.user.id,endsAt);
  res.json({ok:true,reference:ref,message:"Pago demo aprobado. En producción se sustituirá por un proveedor real."});
});


app.get("/api/admin/platform-events",authRequired,ownerOnly,(_req,res)=>{
  const rows=db.prepare(`
    SELECT e.id,e.name,e.slug,e.event_type,e.owner_user_id,e.archived,e.published,e.protected,e.cleanup_status,
           e.expires_at,e.grace_until,e.cleanup_after,e.created_at,e.updated_at,
           u.display_name owner_name,u.email owner_email,
           COUNT(DISTINCT g.id) guest_count,
           COUNT(DISTINCT p.id) photo_count
    FROM events e
    LEFT JOIN users u ON u.id=e.owner_user_id
    LEFT JOIN guests g ON g.event_id=e.id AND COALESCE(g.is_test,0)=0
    LEFT JOIN photos p ON p.event_id=e.id
    GROUP BY e.id
    ORDER BY e.archived,e.updated_at DESC
  `).all();
  res.json(rows);
});

app.delete("/api/admin/events/:id",authRequired,ownerOnly,(req,res)=>{
  const eventId=Number(req.params.id);
  const mode=String(req.query.mode||"archive");
  const event=db.prepare("SELECT * FROM events WHERE id=?").get(eventId);
  if(!event)return res.status(404).json({error:"Evento no encontrado."});

  if(mode==="permanent"){
    if(event.protected){
      const confirmed=cleanText(req.body?.confirmName,200);
      const backup=db.prepare("SELECT id FROM backup_records WHERE status='ready' ORDER BY created_at DESC,id DESC LIMIT 1").get();
      if(confirmed!==event.name)return res.status(409).json({error:"Este evento está protegido. Escribe su nombre exacto para confirmar.",code:"PROTECTED_EVENT_CONFIRMATION"});
      if(!backup)return res.status(409).json({error:"Crea un respaldo completo antes de borrar un evento protegido.",code:"BACKUP_REQUIRED"});
    }
    purgeEventPermanent(eventId);
    audit(req,"event.deleted_permanently",{targetType:"event",targetId:eventId,metadata:{name:event.name,formerEventId:eventId}});
    return res.json({ok:true,mode:"permanent"});
  }

  const graceDays=Math.max(1,Number(req.query.graceDays||15));
  db.prepare(`
    UPDATE events SET archived=1,published=0,cleanup_status='grace',
      grace_until=datetime('now','+'||?||' days'),
      cleanup_after=datetime('now','+'||?||' days')
    WHERE id=?
  `).run(graceDays,graceDays,eventId);
  audit(req,"event.archived",{eventId,targetType:"event",targetId:eventId,metadata:{graceDays}});
  res.json({ok:true,mode:"archive",graceDays});
});

app.post("/api/admin/events/:id/restore",authRequired,ownerOnly,(req,res)=>{
  const info=db.prepare(`
    UPDATE events SET archived=0,cleanup_status='active',
      grace_until=NULL,cleanup_after=NULL
    WHERE id=?
  `).run(Number(req.params.id));
  if(!info.changes)return res.status(404).json({error:"Evento no encontrado."});
  audit(req,"event.restored",{eventId:Number(req.params.id),targetType:"event",targetId:req.params.id});
  res.json({ok:true});
});

app.delete("/api/admin/users/:id",authRequired,ownerOnly,(req,res)=>{
  const userId=Number(req.params.id);
  if(userId===req.user.id)return res.status(400).json({error:"No puedes eliminar tu propia cuenta."});
  const user=db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  if(!user)return res.status(404).json({error:"Usuario no encontrado."});
  if(user.role==="owner")return res.status(403).json({error:"No se puede eliminar una cuenta propietaria."});

  const mode=String(req.query.mode||"deactivate");
  if(mode==="permanent"){
    const owned=db.prepare("SELECT id,name,protected FROM events WHERE owner_user_id=?").all(userId);
    const protectedEvent=owned.find(event=>event.protected);
    if(protectedEvent)return res.status(409).json({error:`La cuenta administra el evento protegido “${protectedEvent.name}”. Elimínalo por separado con respaldo y confirmación, o desactiva la cuenta.`,code:"PROTECTED_EVENT_OWNED"});
    owned.forEach(event=>purgeEventPermanent(event.id));
    db.prepare("DELETE FROM users WHERE id=?").run(userId);
    audit(req,"user.deleted_permanently",{targetType:"user",targetId:userId});
    return res.json({ok:true,mode:"permanent"});
  }

  db.transaction(()=>{
    db.prepare("UPDATE users SET active=0 WHERE id=?").run(userId);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
  })();
  audit(req,"user.deactivated",{targetType:"user",targetId:userId});
  res.json({ok:true,mode:"deactivate"});
});

app.get("/api/admin/users",authRequired,ownerOnly,(_req,res)=>{
  const rows=db.prepare(`
    SELECT u.id,u.email,u.phone,u.display_name,u.role,u.active,u.auth_provider,u.must_change_password,u.last_login_at,u.created_at,u.preferred_locale,
      GROUP_CONCAT(ue.event_id) event_ids
    FROM users u LEFT JOIN user_events ue ON ue.user_id=u.id
    GROUP BY u.id ORDER BY u.display_name
  `).all().map(row=>({...row,event_ids:String(row.event_ids||"").split(",").filter(Boolean).map(Number)}));
  res.json(rows);
});

app.post("/api/admin/users",authRequired,ownerOnly,(req,res,next)=>{
  const {email,displayName,role="client",password,eventIds=[]}=req.body;
  const normalizedEmail=String(email||"").trim().toLowerCase();
  const normalizedName=cleanText(displayName,120);
  const rawPassword=String(password||"");
  if(!normalizedEmail||!normalizedName||!rawPassword)return res.status(400).json({error:"Nombre, correo y contraseña temporal son obligatorios."});
  if(!["client","developer"].includes(role))return res.status(400).json({error:"Rol no permitido."});
  if(rawPassword.length<12)return res.status(400).json({error:"La contraseña debe tener al menos 12 caracteres."});
  const assignedEventIds=[...new Set((Array.isArray(eventIds)?eventIds:[]).map(Number).filter(Number.isInteger))];
  let selectedPlan=null;
  if(role==="client"){
    const planCode=cleanText(req.body.planCode||"trial",40);
    selectedPlan=db.prepare("SELECT * FROM plans WHERE code=? AND active=1").get(planCode);
    if(!selectedPlan)return res.status(400).json({error:"Selecciona un plan inicial válido para el cliente.",code:"INITIAL_PLAN_REQUIRED"});
  }
  try{
    const created=db.transaction(()=>{
      const info=db.prepare(`
        INSERT INTO users(email,login_identifier,password_hash,display_name,role,active,auth_provider,must_change_password,preferred_locale)
        VALUES(?,?,?,?,?,1,'local',1,'es')
      `).run(normalizedEmail,normalizedEmail,bcrypt.hashSync(rawPassword,12),normalizedName,role);
      const userId=Number(info.lastInsertRowid);
      const link=db.prepare(`
        INSERT OR IGNORE INTO user_events(user_id,event_id,permission)
        SELECT ?,id,'manage' FROM events WHERE id=?
      `);
      assignedEventIds.forEach(id=>link.run(userId,id));
      let subscriptionId=null;
      if(selectedPlan){
        const isTrial=selectedPlan.code==="trial";
        const durationDays=isTrial?TRIAL_DAYS:Math.max(1,Number(selectedPlan.duration_days)||1);
        const subscription=db.prepare(`
          INSERT INTO subscriptions(user_id,plan_id,status,starts_at,ends_at,granted_by,grant_reason)
          VALUES(?,?,?,CURRENT_TIMESTAMP,datetime('now',?),?,?)
        `).run(userId,selectedPlan.id,isTrial?"trial":"active",`+${durationDays} days`,req.user.id,isTrial?"Alta de cliente con prueba controlada":"Plan inicial de cortesía asignado al crear la cuenta");
        subscriptionId=Number(subscription.lastInsertRowid);
      }
      return {userId,subscriptionId};
    })();
    if(role==="client")applySubscriptionLifecycle(created.userId,accountEntitlement(created.userId)?.ends_at);
    audit(req,"user.created",{targetType:"user",targetId:created.userId,metadata:{role,eventIds:assignedEventIds,planCode:selectedPlan?.code||null,subscriptionId:created.subscriptionId}});
    res.status(201).json({ok:true,id:created.userId,subscriptionId:created.subscriptionId,plan:selectedPlan?{code:selectedPlan.code,name:selectedPlan.name}:null,mustChangePassword:true});
  }catch(error){
    if(String(error.code||"").startsWith("SQLITE_CONSTRAINT"))return res.status(409).json({error:"Ese correo ya pertenece a otra cuenta.",code:"EMAIL_ALREADY_USED"});
    return next(error);
  }
});

app.put("/api/admin/users/:id",authRequired,ownerOnly,(req,res,next)=>{
  const {displayName,role,password,eventIds=[]}=req.body;
  const userId=Number(req.params.id);
  const existing=db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  if(!existing)return res.status(404).json({error:"Usuario no encontrado."});
  if(existing.role==="owner")return res.status(403).json({error:"La cuenta propietaria no puede modificarse desde esta vista."});
  if(!["client","developer"].includes(role))return res.status(400).json({error:"Rol no permitido."});
  if(password&&String(password).length<12)return res.status(400).json({error:"La contraseña debe tener al menos 12 caracteres."});
  const email=String(req.body.email||existing.email||"").trim().toLowerCase();
  if(!email)return res.status(400).json({error:"El correo es obligatorio.",code:"EMAIL_REQUIRED"});
  try{
    db.transaction(()=>{
      db.prepare("UPDATE users SET email=?,login_identifier=?,display_name=?,role=? WHERE id=?")
        .run(email,email,cleanText(displayName,120),role,userId);
      if(password){
        db.prepare("UPDATE users SET password_hash=?,must_change_password=1,password_changed_at=NULL WHERE id=?")
          .run(bcrypt.hashSync(String(password),12),userId);
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
      }
      db.prepare("DELETE FROM user_events WHERE user_id=?").run(userId);
      const link=db.prepare(`
        INSERT INTO user_events(user_id,event_id,permission)
        SELECT ?,id,'manage' FROM events WHERE id=?
      `);
      [...new Set(eventIds.map(Number).filter(Number.isInteger))].forEach(id=>link.run(userId,id));
    })();
  }catch(error){
    if(String(error.code||"").startsWith("SQLITE_CONSTRAINT"))return res.status(409).json({error:"Ese correo ya pertenece a otra cuenta.",code:"EMAIL_ALREADY_USED"});
    return next(error);
  }
  audit(req,"user.updated",{targetType:"user",targetId:userId,metadata:{role,email,eventIds:[...new Set(eventIds.map(Number).filter(Number.isInteger))]}});
  res.json({ok:true});
});

app.post("/api/admin/users/:id/reactivate",authRequired,ownerOnly,(req,res)=>{
  const userId=Number(req.params.id);
  if(userId===req.user.id)return res.status(400).json({error:"Tu cuenta ya está activa."});
  const user=db.prepare("SELECT id,role,active FROM users WHERE id=?").get(userId);
  if(!user)return res.status(404).json({error:"Usuario no encontrado.",code:"USER_NOT_FOUND"});
  if(user.role==="owner")return res.status(403).json({error:"La cuenta propietaria se recupera mediante el flujo seguro.",code:"OWNER_REACTIVATION_FORBIDDEN"});
  db.transaction(()=>{
    db.prepare("UPDATE users SET active=1 WHERE id=?").run(userId);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
  })();
  audit(req,"user.reactivated",{targetType:"user",targetId:userId,metadata:{planPreserved:true,eventAssignmentsPreserved:true}});
  res.json({ok:true,active:true});
});

app.post("/api/admin/users/:id/reset-password",authRequired,ownerOnly,(req,res)=>{
  const userId=Number(req.params.id);
  const temporaryPassword=String(req.body.temporaryPassword||"");
  const user=db.prepare("SELECT id,role FROM users WHERE id=?").get(userId);
  if(!user)return res.status(404).json({error:"Usuario no encontrado.",code:"USER_NOT_FOUND"});
  if(user.role==="owner")return res.status(403).json({error:"La contraseña propietaria se cambia desde su propia sesión.",code:"OWNER_RESET_FORBIDDEN"});
  if(temporaryPassword.length<12)return res.status(400).json({error:"La contraseña temporal debe tener al menos 12 caracteres.",code:"PASSWORD_TOO_SHORT"});
  db.transaction(()=>{
    db.prepare("UPDATE users SET password_hash=?,must_change_password=1,password_changed_at=NULL WHERE id=?").run(bcrypt.hashSync(temporaryPassword,12),userId);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
  })();
  audit(req,"user.password_reset",{targetType:"user",targetId:userId});
  res.json({ok:true,mustChangePassword:true});
});

app.post("/api/admin/guests/mark-sent",authRequired,eventAllowed,featureRequired("whatsappManual"),(req,res)=>{
  const ids=Array.isArray(req.body.ids)?req.body.ids.map(Number):[];
  if(!ids.length)return res.status(400).json({error:"No seleccionaste invitados."});
  const q=ids.map(()=>"?").join(",");
  const info=db.prepare(`UPDATE guests SET delivery_status='sent',sent_at=CURRENT_TIMESTAMP,last_delivery_at=CURRENT_TIMESTAMP
              WHERE event_id=? AND id IN (${q})`).run(req.eventId,...ids);
  res.json({ok:true,updated:info.changes});
});

app.get("/api/admin/guests/whatsapp-batch",authRequired,eventAllowed,featureRequired("whatsappManual"),(req,res)=>{
  const ids=String(req.query.ids||"").split(",").map(Number).filter(Boolean);
  if(!ids.length)return res.json([]);
  const q=ids.map(()=>"?").join(",");
  const event=currentEvent(req);
  const rows=db.prepare(`SELECT * FROM guests WHERE event_id=? AND id IN (${q}) ORDER BY family_name`)
    .all(req.eventId,...ids);
  res.json(rows.map(g=>({id:g.id,family:g.family_name,phone:g.phone,url:whatsappUrl(event,g)})));
});

function publicConfig(event,{preview=false,platformPreview=false,catalogPreview=false,previewOptions={}}={}){
  const settings=settingsOf(event);
  const publicDesignAccess=designAccessForEvent(event);
  let openingPreviewApplied=false,galleryPreviewApplied=false;
  if(preview){
    const requestedTheme=themes.find(item=>item.id===previewOptions.themeId);
    const themeProduct=requestedTheme?commerce.allProducts().find(product=>product.code===`theme:${requestedTheme.id}`):null;
    if(requestedTheme&&themeProduct?.public&&themeProduct.commercial_status==="available"&&themeProduct.readiness_status==="approved"
      &&(themeProduct.eventTypes.includes("*")||themeProduct.eventTypes.includes(event.event_type||"custom")))settings.themeId=requestedTheme.id;
    const opening=String(previewOptions.opening||"");
    const previewableOpenings=new Set([...experienceCatalog.openingIds].filter(id=>id!=="none"));
    const openingProductCode=experienceCatalog.openingProductMap[opening];
    const openingProduct=openingProductCode?commerce.allProducts().find(product=>product.code===openingProductCode):null;
    const openingCompatible=openingProduct&&(openingProduct.eventTypes.includes("*")||openingProduct.eventTypes.includes(event.event_type||"custom"));
    const catalogOpeningAllowed=Boolean(catalogPreview&&openingProduct&&openingProduct.public&&openingProduct.commercial_status==="available"&&openingProduct.readiness_status==="approved"&&openingCompatible);
    const entitledOpeningAllowed=Boolean(catalogPreview&&publicDesignAccess.opening[opening]);
    if(previewableOpenings.has(opening)&&(platformPreview||catalogOpeningAllowed||entitledOpeningAllowed)){
      /* La URL de preview ya está protegida por sesión con acceso al evento o token
         temporal. Por ello puede ensayar una apertura autorizada sin tener que
         guardarla primero ni conceder derechos comerciales. */
      settings.presentation={...(settings.presentation||{}),openingStyle:opening};
      openingPreviewApplied=true;
    }
    const gallery=String(previewOptions.gallery||"");
    const galleryProductCode=experienceCatalog.galleryProductMap[gallery];
    const galleryProduct=galleryProductCode?commerce.allProducts().find(product=>product.code===galleryProductCode):null;
    const galleryCompatible=galleryProduct&&(galleryProduct.eventTypes.includes("*")||galleryProduct.eventTypes.includes(event.event_type||"custom"));
    const catalogGalleryAllowed=Boolean(catalogPreview&&galleryProduct&&galleryProduct.public&&galleryProduct.commercial_status==="available"&&galleryProduct.readiness_status==="approved"&&galleryCompatible);
    const entitledGalleryAllowed=Boolean(catalogPreview&&publicDesignAccess.gallery[gallery]);
    if(galleryProduct&&(platformPreview||catalogGalleryAllowed||entitledGalleryAllowed)){
      settings.presentation={...(settings.presentation||{}),galleryStyle:gallery};
      galleryPreviewApplied=true;
    }
  }
  const revision=crypto.createHash("sha256").update(`${event.settings_json||""}|${JSON.stringify(previewOptions||{})}`).digest("hex").slice(0,16);
  const publicFeatures=Object.fromEntries(eventFeatureOverview(event,{role:"public"}).map(item=>[item.key,item.allowed]));
  const selectedTheme=themes.find(item=>item.id===settings.themeId)||themes[0]||{};
  settings.features=publicFeatures;
  delete settings.featureStates;
  delete settings.purchasedFeatures;
  if(!publicFeatures.music)settings.media={...(settings.media||{}),music:"",spotifyUrl:"",spotifyUri:"",musicSource:"none"};
  if(!publicFeatures.gallery&&settings.media)settings.media.gallery=[];
  if(!publicFeatures.program)settings.agenda={enabled:false,items:[]};
  if(!publicFeatures.locations){settings.venue={};settings.venues={samePlace:true,ceremony:{},reception:{}};}
  if(!publicFeatures.dressCode)settings.dressCode={enabled:false};
  if(!publicFeatures.gifts)settings.gifts={enabled:false,items:[]};
  if(!publicFeatures.thematicExperience){
    settings.presentation={...(settings.presentation||{}),experienceMode:"classic",motionLevel:"still"};
  }
  const currentOpening=settings.presentation?.openingStyle;
  const previewOpeningBypass=openingPreviewApplied&&String(previewOptions.opening||"")===currentOpening;
  if(!previewOpeningBypass&&DESIGN_PRODUCT_KEYS.opening[currentOpening]&&!publicDesignAccess.opening[currentOpening])settings.presentation.openingStyle="wax-envelope";
  const currentGallery=settings.presentation?.galleryStyle;
  const previewGalleryBypass=galleryPreviewApplied&&String(previewOptions.gallery||"")===currentGallery;
  if(!previewGalleryBypass&&DESIGN_PRODUCT_KEYS.gallery[currentGallery]&&!publicDesignAccess.gallery[currentGallery])settings.presentation.galleryStyle="classic";
  /* El brief es material de trabajo interno, no contenido de la invitación. */
  delete settings.creativeBrief;
  if(settings.media){
    settings.media.heroImage=safePublicMediaUrl(settings.media.heroImage,{allowHttps:true});
    settings.media.music=safePublicMediaUrl(settings.media.music);
    settings.media.gallery=(settings.media.gallery||[])
      .map(item=>safePublicMediaUrl(item,{allowHttps:true}))
      .filter(Boolean);
  }
  if(settings.dressCode?.referenceImages){
    settings.dressCode.referenceImages=settings.dressCode.referenceImages
      .map(item=>safePublicMediaUrl(item,{allowHttps:true}))
      .filter(Boolean);
  }
  if(settings.gifts)settings.gifts.link=safeHttpUrl(settings.gifts.link);
  if(settings.venue)settings.venue.mapsUrl=safeHttpUrl(settings.venue.mapsUrl);
  if(settings.venues){
    if(settings.venues.ceremony)settings.venues.ceremony.mapsUrl=safeHttpUrl(settings.venues.ceremony.mapsUrl);
    if(settings.venues.reception)settings.venues.reception.mapsUrl=safeHttpUrl(settings.venues.reception.mapsUrl);
  }
  if(settings.agenda?.items){
    settings.agenda.items=settings.agenda.items.map(item=>({...item,mapsUrl:safeHttpUrl(item.mapsUrl)}));
  }
  if(!preview)delete settings.developer;
  const branding=platformSetting("branding",{});
  return {
    ...settings,
    _experiences:experienceCatalog.publicCatalog,
    _platform:{branding:{
      attributionEnabled:Boolean(branding.attributionEnabled),
      attributionLabel:cleanText(branding.attributionLabel||"Creado con EventStudio",80),
      attributionUrl:safeHttpUrl(branding.attributionUrl||"")||SITE_URL,
      attributionOnInvitation:branding.attributionOnInvitation!==false
    }},
    _theme:{
      id:selectedTheme.id||settings.themeId||"romantic-wine",
      layoutFamily:selectedTheme.layoutFamily||"classic",
      motionPreset:selectedTheme.motionPreset||"subtle",
      photoStyle:selectedTheme.photoStyle||"cards",
      motif:selectedTheme.motif||"spark",
      defaultExperience:selectedTheme.defaultExperience||"classic"
    },
    _palette:themeDescriptor(settings).palette,
    _surfaceTexture:themeDescriptor(settings).texture||"none",
    _revision:revision,
    event:{...settings.event,slug:event.slug,eventId:event.id,eventType:event.event_type}
  };
}

app.get("/api/config/:slug",(req,res)=>{
  const event=eventBySlug(req.params.slug);
  if(!event||event.archived)return res.status(404).json({error:"Evento no encontrado."});
  const access=previewAccess(req,event),preview=access.allowed;
  const platformPreview=access.platform,catalogPreview=access.catalog;
  const allowed=eventFeatureDecision(event,"invitation",{role:"public"}).allowed;
  if((!event.published||!allowed)&&!preview)return res.status(404).json({error:"Evento no publicado.",code:"EVENT_NOT_PUBLISHED"});
  res.json(publicConfig(event,{preview,platformPreview,catalogPreview,previewOptions:{themeId:cleanText(req.query.previewTheme||"",80),opening:cleanText(req.query.previewOpening||"",60),gallery:cleanText(req.query.previewGallery||"",60)}}));
});
app.get("/api/config",(req,res)=>{
  const event=eventByHostname(req.hostname)
    || (!IS_PRODUCTION?db.prepare("SELECT * FROM events WHERE COALESCE(archived,0)=0 ORDER BY id LIMIT 1").get():null);
  if(!event)return res.status(404).json({error:"Evento no encontrado."});
  const access=previewAccess(req,event),preview=access.allowed;
  const platformPreview=access.platform,catalogPreview=access.catalog;
  if((!event.published||!eventFeatureDecision(event,"invitation",{role:"public"}).allowed)&&!preview){
    return res.status(404).json({error:"Evento no publicado.",code:"EVENT_NOT_PUBLISHED"});
  }
  res.json(publicConfig(event,{preview,platformPreview,catalogPreview,previewOptions:{themeId:cleanText(req.query.previewTheme||"",80),opening:cleanText(req.query.previewOpening||"",60),gallery:cleanText(req.query.previewGallery||"",60)}}));
});
app.get("/api/invitation/token/:token",(req,res)=>{
  const row=db.prepare(`
    SELECT g.id,g.token,g.family_name,g.phone,g.max_adults,g.max_children,
           g.table_name,g.custom_message,e.id event_id,e.slug,e.settings_json,e.event_type
    FROM guests g JOIN events e ON e.id=g.event_id
    WHERE g.token=? AND COALESCE(e.archived,0)=0
  `).get(req.params.token);
  if(!row)return res.status(404).json({error:"Invitación no encontrada."});
  const invitationEvent=db.prepare("SELECT * FROM events WHERE id=?").get(row.event_id);
  const preview=invitationEvent&&previewAllowed(req,invitationEvent);
  if(!invitationEvent||(!invitationEvent.published&&!preview))return res.status(404).json({error:"Invitación no encontrada."});
  const {settings_json,slug:eventSlug,event_id,event_type,...guest}=row;
  const rsvp=db.prepare("SELECT * FROM rsvps WHERE guest_id=?").get(guest.id);
  const eventSettings=normalizeFeatureSettings(JSON.parse(settings_json));
  const allowed=invitationEvent&&eventFeatureDecision(invitationEvent,"invitation",{role:"public"}).allowed;
  if(!allowed)return res.status(404).json({error:"Invitación no disponible.",code:"FEATURE_UNAVAILABLE"});
  res.json({guest,rsvp:rsvp||null,eventSlug,menus:eventSettings.menus||{}});
});

app.post("/api/rsvp",(req,res)=>{
  const {
    token,attending,adults=0,children=0,attendee_names="",dietary="",
    special_needs="",adult_menu_counts={},child_menu_counts={},message="",
    contact_phone="",accessibility_options=[],accessibility_other="",responsible_name=""
  }=req.body||{};
  const guest=db.prepare(`
    SELECT g.id,g.max_adults,g.max_children,e.id event_id,e.settings_json,e.event_type
    FROM guests g JOIN events e ON e.id=g.event_id
    WHERE g.token=? AND COALESCE(e.archived,0)=0 AND COALESCE(e.published,0)=1
  `).get(String(token||""));
  if(!guest)return res.status(404).json({error:"Invitación inválida."});

  const eventSettings=normalizeFeatureSettings(JSON.parse(guest.settings_json));
  const rsvpEvent=db.prepare("SELECT * FROM events WHERE id=?").get(guest.event_id);
  if(!rsvpEvent||!eventFeatureDecision(rsvpEvent,"rsvp",{role:"public"}).allowed)return res.status(403).json({error:"Las confirmaciones no están habilitadas.",code:"FEATURE_UNAVAILABLE"});
  const closeAt=String(eventSettings.rsvp?.closeAt||"");
  if(closeAt&&new Date(closeAt).getTime()<=Date.now())return res.status(409).json({error:"El periodo de confirmación ha terminado.",code:"RSVP_CLOSED"});
  const existingRsvp=db.prepare("SELECT id FROM rsvps WHERE guest_id=?").get(guest.id);
  if(existingRsvp&&eventSettings.rsvp?.allowChanges===false)return res.status(409).json({error:"Tu confirmación ya fue registrada y no admite cambios. Contacta a los anfitriones.",code:"RSVP_CHANGES_DISABLED"});

  const yes=booleanValue(attending);
  const adultCount=yes?Number(adults):0;
  const childCount=yes?Number(children):0;
  if(!Number.isInteger(adultCount)||adultCount<0||!Number.isInteger(childCount)||childCount<0){
    return res.status(400).json({error:"Las cantidades de asistentes deben ser números enteros positivos."});
  }
  const flexibleComposition=eventSettings.rsvp?.allowFlexibleComposition===true;
  const totalPlaces=Number(guest.max_adults)+Number(guest.max_children);
  if(flexibleComposition&&adultCount+childCount>totalPlaces){
    return res.status(400).json({error:`Esta invitación tiene ${totalPlaces} lugar(es) en total.`});
  }
  if(!flexibleComposition&&adultCount>guest.max_adults){
    return res.status(400).json({error:`Máximo ${guest.max_adults} adulto(s).`});
  }
  if(!flexibleComposition&&childCount>guest.max_children){
    return res.status(400).json({error:`Máximo ${guest.max_children} niño(s).`});
  }
  if(yes&&adultCount+childCount===0){
    return res.status(400).json({error:"Indica al menos un asistente."});
  }

  const menus=eventSettings.features?.menus===false
    ? {...(eventSettings.menus||{}),selectionEnabled:false}
    : (eventSettings.menus||{});
  const guestChoosesMenus=menus.serviceMode==="guest-choice"||menus.selectionEnabled===true;
  const menuCounts=(input,allowed,total,label)=>{
    if(!total)return {};
    if(!guestChoosesMenus)return allowed[0]?{[allowed[0]]:total}:{};
    if(!input||typeof input!=="object"||Array.isArray(input))throw new Error(`La selección de ${label} no es válida.`);
    const unknown=Object.keys(input).find(key=>!allowed.includes(key));
    if(unknown)throw new Error(`La opción de ${label} no es válida.`);
    const normalized={};
    allowed.forEach(option=>{
      const count=Number(input[option]||0);
      if(!Number.isInteger(count)||count<0||count>total)throw new Error(`Las cantidades de ${label} no son válidas.`);
      if(count)normalized[option]=count;
    });
    const sum=Object.values(normalized).reduce((acc,count)=>acc+count,0);
    if(sum!==total)throw new Error(`La distribución de ${label} debe sumar ${total}.`);
    return normalized;
  };

  let adultMenus;
  let childMenus;
  try{
    adultMenus=menuCounts(adult_menu_counts,menus.adultOptions||[],adultCount,"menús de adultos");
    childMenus=menuCounts(child_menu_counts,menus.childOptions||[],childCount,"menús infantiles");
  }catch(error){
    return res.status(400).json({error:error.message});
  }

  const allowedAccessibility=eventSettings.accessibility?.enabled
    ? (eventSettings.accessibility.options||[])
    : [];
  const requestedAccessibility=Array.isArray(accessibility_options)?accessibility_options:[];
  const accessibility=yes
    ? [...new Set(requestedAccessibility.map(value=>cleanText(value,120)).filter(value=>allowedAccessibility.includes(value)))]
    : [];

  const record={
    guest_id:guest.id,
    attending:yes?1:0,
    adults:adultCount,
    children:childCount,
    attendee_names:yes?cleanText(attendee_names,1000):"",
    dietary:yes?cleanText(dietary,1000):"",
    special_needs:yes?cleanText(special_needs,1000):"",
    adult_menu_counts:JSON.stringify(adultMenus),
    child_menu_counts:JSON.stringify(childMenus),
    accessibility_options:JSON.stringify(accessibility),
    accessibility_other:yes?cleanText(accessibility_other,500):"",
    message:cleanText(message,1000),
    contact_phone:cleanText(contact_phone,40),
    responsible_name:cleanText(responsible_name,160)
  };

  db.transaction(()=>{
    db.prepare(`
      INSERT INTO rsvps
        (guest_id,attending,adults,children,attendee_names,dietary,special_needs,
         adult_menu_counts,child_menu_counts,accessibility_options,accessibility_other,
         message,contact_phone,responsible_name,updated_at)
      VALUES
        (@guest_id,@attending,@adults,@children,@attendee_names,@dietary,@special_needs,
         @adult_menu_counts,@child_menu_counts,@accessibility_options,@accessibility_other,
         @message,@contact_phone,@responsible_name,CURRENT_TIMESTAMP)
      ON CONFLICT(guest_id) DO UPDATE SET
        attending=excluded.attending,adults=excluded.adults,children=excluded.children,
        attendee_names=excluded.attendee_names,dietary=excluded.dietary,
        special_needs=excluded.special_needs,adult_menu_counts=excluded.adult_menu_counts,
        child_menu_counts=excluded.child_menu_counts,
        accessibility_options=excluded.accessibility_options,
        accessibility_other=excluded.accessibility_other,message=excluded.message,
        contact_phone=excluded.contact_phone,responsible_name=excluded.responsible_name,updated_at=CURRENT_TIMESTAMP
    `).run(record);
    db.prepare("UPDATE guests SET status=? WHERE id=?").run(yes?"confirmed":"declined",guest.id);
  })();

  audit(req,"rsvp.saved",{eventId:guest.event_id,targetType:"guest",targetId:guest.id,metadata:{attending:yes,adults:adultCount,children:childCount}});
  res.json({ok:true,status:yes?"confirmed":"declined",adults:adultCount,children:childCount});
});
app.post("/api/photos",photoUpload.array("photos",20),(req,res)=>{
  const event=eventBySlug(String(req.body.eventSlug||""));
  if(!event||event.archived||!event.published){
    removeFiles(req.files);
    return res.status(400).json({error:"Evento inválido."});
  }
  const eventSettings=settingsOf(event);
  if(!eventFeatureDecision(event,"guestPhotoUpload",{role:"public"}).allowed){
    removeFiles(req.files);
    return res.status(403).json({error:"La carga de fotografías no está habilitada.",code:"FEATURE_UNAVAILABLE"});
  }
  if(!req.files?.length)return res.status(400).json({error:"No se recibieron fotos."});

  for(const file of req.files){
    const detected=detectedImageMime(file.path);
    if(!detected){removeFiles(req.files);return res.status(400).json({error:`${cleanText(file.originalname,120)} no es una imagen válida.`,code:"INVALID_IMAGE_CONTENT"});}
    try{validateImageStructure(file.path,detected);}
    catch(error){removeFiles(req.files);return res.status(400).json({error:error.message,code:"INVALID_IMAGE_CONTENT"});}
    file.mimetype=detected;
  }

  const tableName=cleanText(req.body.tableName,80);
  const suppliedTableSig=String(req.body.tableSig||"").trim();
  let tableVerified=false;
  if(tableName){
    const tableExists=db.prepare("SELECT 1 FROM event_tables WHERE event_id=? AND name=? UNION SELECT 1 FROM guests WHERE event_id=? AND table_name=? LIMIT 1").get(event.id,tableName,event.id,tableName);
    if(!tableExists){removeFiles(req.files);return res.status(400).json({error:"La mesa no pertenece a este evento.",code:"TABLE_INVALID"});}
    if(suppliedTableSig){
      const expected=tableQrSignature(event,tableName);
      const left=Buffer.from(suppliedTableSig),right=Buffer.from(expected);
      tableVerified=left.length===right.length&&crypto.timingSafeEqual(left,right);
      if(!tableVerified){removeFiles(req.files);return res.status(400).json({error:"El QR de mesa no es válido para este evento.",code:"TABLE_QR_INVALID"});}
    }
  }
  const rawMessage=String(req.body.message||"").trim();
  const messageLimit=Math.max(0,Math.min(2000,Number(eventSettings.photoPolicy?.messageMaxLength||500)));
  if(rawMessage.length>messageLimit){removeFiles(req.files);return res.status(400).json({error:`El mensaje no puede exceder ${messageLimit} caracteres.`,code:"PHOTO_MESSAGE_TOO_LONG"});}
  const suppliedKey=String(req.body.uploadKey||"").trim();
  const clientKey=/^[A-Za-z0-9_-]{8,100}$/.test(suppliedKey)?suppliedKey:crypto.randomUUID();
  const uploadKey=`${event.id}:${clientKey}`;
  const existingBatch=db.prepare("SELECT id FROM photo_batches WHERE upload_key=?").get(uploadKey);
  if(existingBatch){
    removeFiles(req.files);
    const uploaded=db.prepare("SELECT COUNT(*) total FROM photos WHERE batch_id=?").get(existingBatch.id).total;
    return res.json({ok:true,uploaded,duplicate:true,batchId:existingBatch.id});
  }

  let guest=null;
  if(req.body.invitationToken){
    guest=db.prepare("SELECT id,family_name FROM guests WHERE event_id=? AND token=?").get(event.id,String(req.body.invitationToken));
    if(!guest){removeFiles(req.files);return res.status(400).json({error:"La invitación no corresponde al evento.",code:"INVITATION_INVALID"});}
  }

  const incoming=req.files.reduce((sum,file)=>sum+Number(file.size||0),0);
  const capacity=ensureStorageCapacity(event,incoming);
  if(!capacity.allowed){
    removeFiles(req.files);
    const message=settingsOf(event).storagePolicy?.guestMessage
      ||"El álbum está temporalmente en mantenimiento. Intenta nuevamente más tarde.";
    return res.status(413).json({error:message,code:"STORAGE_LIMIT"});
  }

  const insert=db.prepare(`
    INSERT INTO photos
    (event_id,original_name,stored_name,mime_type,size_bytes,uploaded_by,table_name,batch_id)
    VALUES(?,?,?,?,?,?,?,?)
  `);
  const uploadedBy=guest?.family_name||cleanText(req.body.uploadedBy,120);
  const defaultStatus=["pending","approved","hidden"].includes(eventSettings.photoPolicy?.defaultStatus)?eventSettings.photoPolicy.defaultStatus:"pending";
  const batchId=db.transaction(()=>{
    const batch=db.prepare(`INSERT INTO photo_batches(event_id,guest_id,upload_key,table_name,uploaded_by,message,status) VALUES(?,?,?,?,?,?,?)`)
      .run(event.id,guest?.id||null,uploadKey,tableName,uploadedBy,cleanText(rawMessage,messageLimit),defaultStatus);
    req.files.forEach(file=>insert.run(event.id,file.originalname,file.filename,file.mimetype,file.size,uploadedBy,tableName,batch.lastInsertRowid));
    return Number(batch.lastInsertRowid);
  })();
  res.json({ok:true,uploaded:req.files.length,batchId,status:defaultStatus,tableName:tableName||null,tableVerified:Boolean(tableName&&tableVerified)});
});

// Events and themes
app.get("/api/admin/events",authRequired,(req,res)=>{
  const rows=["owner","developer"].includes(req.user.role)
    ? db.prepare(`
        SELECT e.id,e.slug,e.name,e.event_type,e.owner_user_id,e.archived,e.published,e.created_at,e.updated_at,
               u.display_name owner_name,u.email owner_email
        FROM events e
        LEFT JOIN users u ON u.id=e.owner_user_id
        WHERE COALESCE(e.archived,0)=0
        ORDER BY e.updated_at DESC,e.id DESC
      `).all()
    : db.prepare(`
        SELECT e.id,e.slug,e.name,e.event_type,e.owner_user_id,e.archived,e.published,e.created_at,e.updated_at,
               u.display_name owner_name,u.email owner_email
        FROM events e
        JOIN user_events ue ON ue.event_id=e.id
        LEFT JOIN users u ON u.id=e.owner_user_id
        WHERE ue.user_id=? AND COALESCE(e.archived,0)=0
        ORDER BY e.updated_at DESC,e.id DESC
      `).all(req.user.id);
  res.json(rows);
});
app.post("/api/admin/events",authRequired,(req,res)=>{
  const name=String(req.body.name||"").trim();
  if(!name)return res.status(400).json({error:"Nombre obligatorio."});

  const isPlatformUser=["owner","developer"].includes(req.user.role);
  if(!isPlatformUser){
    const entitlement=accountEntitlement(req.user.id);
    if(!subscriptionUsable(entitlement)){
      return res.status(402).json({error:"Necesitas una prueba vigente o un plan activo para crear eventos."});
    }
    const count=db.prepare(`
      SELECT COUNT(*) total FROM user_events ue
      JOIN events e ON e.id=ue.event_id
      WHERE ue.user_id=? AND COALESCE(e.archived,0)=0
    `).get(req.user.id).total;
    const controls=accountCommercialControls(req.user.id);
    const maxEvents=Math.max(0,Number(controls.max_events_override??entitlement.max_events));
    if(count>=maxEvents){
      return res.status(409).json({error:`Tu configuración comercial permite hasta ${maxEvents} evento(s).`,code:"EVENT_LIMIT_REACHED"});
    }
  }

  let slug=slugify(req.body.slug||name);
  if(eventBySlug(slug))slug+=`-${Date.now().toString().slice(-5)}`;
  const requestedEventType=String(req.body.eventType||"custom");
  const eventType=eventTypes.some(item=>item.id===requestedEventType)?requestedEventType:"custom";
  const settings=freshEventSettings(name,eventType);

  const tx=db.transaction(()=>{
    const info=db.prepare(`
      INSERT INTO events(slug,name,settings_json,event_type,owner_user_id,published,protected)
      VALUES(?,?,?,?,?,0,?)
    `).run(slug,name,JSON.stringify(settings),eventType,isPlatformUser?null:req.user.id,0);
    if(!isPlatformUser){
      db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,'manage')")
        .run(req.user.id,info.lastInsertRowid);
    }
    return info.lastInsertRowid;
  });
  const id=tx();
  if(!isPlatformUser)applySubscriptionLifecycle(req.user.id,accountEntitlement(req.user.id)?.ends_at);
  res.json({ok:true,id,slug});
});


app.put("/api/admin/guests/:id",authRequired,eventAllowed,featureRequired("guests"),(req,res)=>{
  const event=currentEvent(req);
  const guestId=Number(req.params.id);
  const existing=db.prepare("SELECT * FROM guests WHERE id=? AND event_id=?").get(guestId,event.id);
  if(!existing)return res.status(404).json({error:"Invitado no encontrado en el evento activo."});

  const {
    code=existing.code,
    family_name=existing.family_name,
    phone=existing.phone||"",
    max_adults=existing.max_adults,
    max_children=existing.max_children,
    table_name=existing.table_name||"",
    custom_message=existing.custom_message||"",
    private_notes=existing.private_notes||""
  }=req.body;

  const adults=Number(max_adults);
  const children=Number(max_children);

  if(!String(family_name).trim()){
    return res.status(400).json({error:"La familia o nombre del invitado es obligatorio."});
  }
  if(!Number.isInteger(adults)||adults<0||!Number.isInteger(children)||children<0){
    return res.status(400).json({error:"Las cantidades de adultos y niños no son válidas."});
  }
  const confirmation=db.prepare("SELECT attending,adults,children FROM rsvps WHERE guest_id=?").get(guestId);
  const flexibleComposition=settingsOf(event).rsvp?.allowFlexibleComposition===true;
  const confirmationExceeds=flexibleComposition
    ?adults+children<Number(confirmation?.adults||0)+Number(confirmation?.children||0)
    :adults<Number(confirmation?.adults||0)||children<Number(confirmation?.children||0);
  if(confirmation?.attending&&confirmationExceeds){
    return res.status(409).json({
      error:flexibleComposition
        ?`La familia ya confirmó ${Number(confirmation.adults)+Number(confirmation.children)} persona(s). Conserva al menos ese total o ajusta primero su confirmación.`
        :`La familia ya confirmó ${confirmation.adults} adulto(s) y ${confirmation.children} niño(s). Ajusta primero su confirmación.`
    });
  }
  const entitlement=eventEntitlement(event);
  if(entitlement&&!existing.is_test){
    const otherReserved=db.prepare(`
      SELECT COALESCE(SUM(max_adults+max_children),0) total
      FROM guests WHERE event_id=? AND id<>? AND COALESCE(is_test,0)=0
    `).get(event.id,guestId).total;
    if(otherReserved+adults+children>entitlement.max_guests){
      return res.status(409).json({error:`El plan ${entitlement.plan_name} permite reservar hasta ${entitlement.max_guests} lugares.`});
    }
  }

  try{
    db.prepare(`
      UPDATE guests
      SET code=?,family_name=?,phone=?,max_adults=?,max_children=?,
          table_name=?,custom_message=?,private_notes=?
      WHERE id=? AND event_id=?
    `).run(
      cleanText(code,80)||existing.code||nextGuestCode(event.id),
      String(family_name).trim(),
      normalizePhone(phone),
      adults,
      children,
      String(table_name).trim(),
      String(custom_message).trim(),
      String(private_notes).trim(),
      guestId,
      event.id
    );
    const seatingChanged=
      String(existing.table_name||"").trim()!==String(table_name||"").trim() ||
      Number(existing.max_adults)!==adults || Number(existing.max_children)!==children;
    const seating=seatingChanged?syncGuestSeatingFromTable(event.id,guestId):null;
    res.json({ok:true,seating});
  }catch(error){
    res.status(400).json({error:"No se pudo modificar. Revisa que el código no esté repetido."});
  }
});

app.delete("/api/admin/guests/:id",authRequired,eventAllowed,featureRequired("guests"),(req,res)=>{
  const event=currentEvent(req);
  const guestId=Number(req.params.id);
  const guest=db.prepare("SELECT id,family_name,is_test FROM guests WHERE id=? AND event_id=?").get(guestId,event.id);
  if(!guest)return res.status(404).json({error:"Invitado no encontrado en el evento activo."});

  db.transaction(()=>{
    db.prepare("DELETE FROM rsvps WHERE guest_id=?").run(guestId);
    db.prepare("DELETE FROM guests WHERE id=? AND event_id=?").run(guestId,event.id);
  })();

  res.json({ok:true,deleted:guest});
});

app.post("/api/admin/guests/delete-batch",authRequired,eventAllowed,featureRequired("guests"),(req,res)=>{
  const ids=Array.isArray(req.body.ids)?req.body.ids.map(Number).filter(Boolean):[];
  if(!ids.length)return res.status(400).json({error:"No seleccionaste invitados."});
  const placeholders=ids.map(()=>"?").join(",");
  const found=db.prepare(`SELECT id FROM guests WHERE event_id=? AND id IN (${placeholders})`).all(req.eventId,...ids);
  if(!found.length)return res.status(404).json({error:"No se encontraron invitados para eliminar."});
  db.prepare(`DELETE FROM guests WHERE event_id=? AND id IN (${placeholders})`).run(req.eventId,...ids);
  res.json({ok:true,deleted:found.length});
});



app.get("/api/admin/whatsapp/status",authRequired,(req,res)=>{
  res.json({...messaging.providerStatus(),policyMode:"opt-in-and-approved-templates",webhookUrl:`${SITE_URL}/api/messaging/webhook`});
});

app.get("/api/admin/messaging/status",authRequired,eventAllowed,featureRequired("whatsappBusiness"),(req,res)=>res.json(messaging.providerStatus()));

app.get("/api/admin/messaging/queue",authRequired,eventAllowed,featureRequired("whatsappBusiness"),(req,res)=>{
  const status=String(req.query.status||"");
  const allowed=["pending","queued","sent","delivered","read","failed","cancelled"];
  const rows=status&&allowed.includes(status)
    ?db.prepare(`SELECT q.id,q.guest_id,q.kind,q.provider,q.status,q.provider_message_id,q.error_code,q.error_message,q.attempts,q.last_attempt_at,q.sent_at,q.delivered_at,q.read_at,q.created_at,g.family_name,g.phone FROM message_queue q JOIN guests g ON g.id=q.guest_id WHERE q.event_id=? AND q.status=? ORDER BY q.created_at DESC LIMIT 500`).all(req.event.id,status)
    :db.prepare(`SELECT q.id,q.guest_id,q.kind,q.provider,q.status,q.provider_message_id,q.error_code,q.error_message,q.attempts,q.last_attempt_at,q.sent_at,q.delivered_at,q.read_at,q.created_at,g.family_name,g.phone FROM message_queue q JOIN guests g ON g.id=q.guest_id WHERE q.event_id=? ORDER BY q.created_at DESC LIMIT 500`).all(req.event.id);
  res.json(rows);
});

app.post("/api/admin/messaging/queue",authRequired,eventAllowed,featureRequired("whatsappBusiness"),(req,res)=>{
  try{
    const result=messaging.queueMessages({
      eventId:req.event.id,guestIds:Array.isArray(req.body.guestIds)?req.body.guestIds:[],all:booleanValue(req.body.all),
      kind:String(req.body.kind||"invitation"),campaignKey:cleanText(req.body.campaignKey||"primary",80),createdBy:req.user.id,
      invitationUrl:token=>invitationUrl(req.event,token)
    });
    audit(req,"messaging.queued",{eventId:req.event.id,targetType:"message_queue",metadata:result});
    res.status(201).json({ok:true,...result});
  }catch(error){res.status(400).json({error:error.message,code:"QUEUE_INVALID"});}
});

app.post("/api/admin/messaging/process",authRequired,eventAllowed,featureRequired("whatsappBusiness"),async(req,res,next)=>{
  try{
    let ids=Array.isArray(req.body.ids)?req.body.ids.map(Number).filter(Boolean):[];
    if(booleanValue(req.body.all))ids=db.prepare("SELECT id FROM message_queue WHERE event_id=? AND status IN ('queued','failed') ORDER BY created_at LIMIT 50").all(req.event.id).map(row=>row.id);
    if(!ids.length)return res.status(400).json({error:"No hay mensajes seleccionados para procesar.",code:"QUEUE_EMPTY"});
    const results=[];
    for(const id of ids){
      try{results.push(await messaging.processQueueItem(id,req.event.id));}
      catch(error){results.push({ok:false,id,error:error.message,code:error.code||"SEND_FAILED"});}
    }
    audit(req,"messaging.processed",{eventId:req.event.id,targetType:"message_queue",metadata:{count:ids.length,failed:results.filter(item=>!item.ok).length}});
    res.json({ok:results.every(item=>item.ok),results});
  }catch(error){next(error);}
});

app.post("/api/admin/messaging/:id/retry",authRequired,eventAllowed,featureRequired("whatsappBusiness"),(req,res,next)=>{
  try{res.json(messaging.retryMessage(req.params.id,req.event.id));}catch(error){next(error);}
});

app.post("/api/admin/messaging/cancel",authRequired,eventAllowed,featureRequired("whatsappBusiness"),(req,res)=>{
  const cancelled=messaging.cancelMessages(Array.isArray(req.body.ids)?req.body.ids:[],req.event.id);
  audit(req,"messaging.cancelled",{eventId:req.event.id,targetType:"message_queue",metadata:{cancelled}});
  res.json({ok:true,cancelled});
});

app.get("/api/messaging/webhook",(req,res)=>{
  const mode=String(req.query["hub.mode"]||"");
  const token=String(req.query["hub.verify_token"]||"");
  const challenge=String(req.query["hub.challenge"]||"");
  if(mode==="subscribe"&&token&&token===messaging.webhookVerifyToken())return res.status(200).send(challenge);
  res.status(403).json({error:"No se pudo verificar el webhook.",code:"WEBHOOK_VERIFICATION_FAILED"});
});

app.post("/api/messaging/webhook",(req,res)=>{
  if(!messaging.validateWebhookSignature(req.rawBody,req.headers["x-hub-signature-256"]))return res.status(401).json({error:"Firma del webhook inválida.",code:"WEBHOOK_SIGNATURE_INVALID"});
  const applied=messaging.applyWebhook(req.body);
  res.json({ok:true,applied:applied.length});
});

app.get("/api/admin/backups",authRequired,ownerOnly,(_req,res)=>res.json(backups.listBackups()));
app.post("/api/admin/backups",authRequired,ownerOnly,async(req,res,next)=>{
  try{
    const backup=await backups.createBackup(req.user.id,{reason:cleanText(req.body.reason||"manual",120)});
    audit(req,"backup.created",{targetType:"backup",targetId:backup.id,metadata:{filename:backup.filename,sizeBytes:backup.size_bytes}});
    res.status(201).json({ok:true,backup});
  }catch(error){next(error);}
});
app.get("/api/admin/backups/:id/download",authRequired,ownerOnly,(req,res)=>{
  const item=backups.backupFile(req.params.id);
  if(!item)return res.status(404).json({error:"Respaldo no encontrado.",code:"BACKUP_NOT_FOUND"});
  res.download(item.file,item.row.filename);
});
app.post("/api/admin/backups/inspect",authRequired,ownerOnly,backupRestoreUpload.single("backup"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"Selecciona un archivo ZIP.",code:"RESTORE_FILE_REQUIRED"});
  try{
    const summary=restore.inspectBackup(req.file.path);
    res.json({ok:true,summary});
  }catch(error){
    res.status(400).json({error:error.message,code:error.code||"RESTORE_INVALID"});
  }finally{try{fs.unlinkSync(req.file.path);}catch{}}
});
app.post("/api/admin/backups/restore",authRequired,ownerOnly,backupRestoreUpload.single("backup"),async(req,res,next)=>{
  if(!req.file)return res.status(400).json({error:"Selecciona un archivo ZIP.",code:"RESTORE_FILE_REQUIRED"});
  if(cleanText(req.body.confirmation,40)!=="RESTAURAR"){
    try{fs.unlinkSync(req.file.path);}catch{}
    return res.status(409).json({error:'Escribe RESTAURAR para confirmar.',code:"RESTORE_CONFIRMATION_REQUIRED"});
  }
  try{
    const rollback=await backups.createBackup(req.user.id,{reason:"pre-restore-automatic"});
    const summary=restore.stageRestore(req.file.path,{rollback:{filename:rollback.filename,sizeBytes:rollback.size_bytes,checksumSha256:rollback.checksum_sha256}});
    audit(req,"backup.restore_scheduled",{targetType:"backup",targetId:rollback.id,metadata:{rollbackFilename:rollback.filename,sourceVersion:summary.appVersion,uploadFiles:summary.uploadFiles}});
    res.status(202).json({ok:true,restartRequired:true,rollback:{id:rollback.id,filename:rollback.filename},summary,message:"Respaldo validado. EventStudio se reiniciará para aplicar la restauración."});
    setTimeout(()=>shutdown("RESTORE_SCHEDULED"),750).unref();
  }catch(error){
    try{fs.unlinkSync(req.file.path);}catch{}
    if(error.code)return res.status(400).json({error:error.message,code:error.code});
    next(error);
  }finally{try{fs.unlinkSync(req.file?.path);}catch{}}
});

app.get("/api/admin/audit",authRequired,ownerOnly,(req,res)=>{
  res.json(db.prepare(`SELECT a.id,a.actor_user_id,u.display_name actor,a.event_id,a.action,a.target_type,a.target_id,a.metadata_json,a.ip_address,a.created_at FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC,a.id DESC LIMIT 1000`).all());
});

app.get("/api/admin/storage/orphans",authRequired,ownerOnly,(_req,res)=>{
  const referenced=new Set();
  for(const event of db.prepare("SELECT * FROM events").all())for(const file of eventMediaPaths(event))referenced.add(path.resolve(file));
  /* Las fotos de invitados viven en tablas propias, no en settings_json.
     Contarlas como huérfanas sería peligroso para cualquier limpieza futura. */
  for(const row of db.prepare("SELECT stored_name FROM photos WHERE stored_name IS NOT NULL AND stored_name<>''").all()){
    referenced.add(path.resolve(guestPhotosDir,String(row.stored_name)));
  }
  const stored=[
    ...fs.readdirSync(siteMediaDir,{withFileTypes:true}).filter(item=>item.isFile()).map(item=>path.join(siteMediaDir,item.name)),
    ...fs.readdirSync(guestPhotosDir,{withFileTypes:true}).filter(item=>item.isFile()).map(item=>path.join(guestPhotosDir,item.name))
  ].map(file=>path.resolve(file));
  const orphans=stored.filter(file=>!referenced.has(file)).map(file=>path.relative(uploadsDir,file));
  const missing=[...referenced].filter(file=>!fs.existsSync(file)).map(file=>path.relative(uploadsDir,file));
  res.json({orphanCount:orphans.length,missingCount:missing.length,orphans,missing,action:"report-only"});
});

app.get("/api/admin/settings",authRequired,eventAllowed,(req,res)=>{
  const event=currentEvent(req);
  if(!event)return res.status(404).json({error:"Evento no encontrado."});

  const settings=settingsOf(event);
  const platformUser=["owner","developer"].includes(req.user.role);

  if(!platformUser){
    const decisions=eventFeatureOverview(event,{role:req.user.role});
    settings.features=Object.fromEntries(decisions.map(item=>[item.key,item.allowed]));
    delete settings.featureStates;
    settings.developer={
      mode:"production",
      showBanner:false,
      ownerOnly:true
    };
  }

  res.json({
    ...settings,
    _event:{
      id:event.id,
      slug:event.slug,
      name:event.name,
      event_type:event.event_type,
      owner_user_id:event.owner_user_id,
      published:event.published
    },
    _permissions:{platformUser},
    _experiences:experienceCatalog.publicCatalog,
    _themePalette:themeDescriptor(settings).palette,
    _designAccess:designAccessForEvent(event,{platform:platformUser}),
    _mediaHealth:eventMediaReferenceReport(event)
  });
});

app.get("/api/admin/features",authRequired,eventAllowed,(req,res)=>{
  const platformUser=["owner","developer"].includes(req.user.role);
  const forceClientView=platformUser&&String(req.query.view||req.headers["x-view-as-client"]||"")==="client";
  const context=commercialFeatureContext(req.event);
  const overview=eventFeatureOverview(req.event,{role:req.user.role,forceClientView});
  res.json({
    role:req.user.role,planCode:context.planCode,view:forceClientView?"client":"platform",
    origins:forceClientView||!platformUser?context.access.origins:[],
    designAccess:designAccessForEvent(req.event,{platform:platformUser&&!forceClientView}),
    features:platformUser&&!forceClientView
      ?overview
      :overview.map(({key,label,group,allowed,reason,minPlan,addonGranted,includedByPlan})=>({key,label,group,allowed,reason,minPlan,addonGranted,includedByPlan}))
  });
});


app.get("/api/publication/status",authRequired,eventAllowed,(req,res)=>{
  const latest=db.prepare(`
    SELECT id,status,requested_at,decided_at,note FROM publication_requests
    WHERE event_id=? AND user_id=? ORDER BY id DESC LIMIT 1
  `).get(req.event.id,req.user.id)||null;
  res.json({event:{id:req.event.id,name:req.event.name,published:Boolean(req.event.published)},access:publicationAccess(req.user,req.event),latest});
});

app.post("/api/publication/request",authRequired,eventAllowed,(req,res)=>{
  if(req.user.role!=="client")return res.status(403).json({error:"Este flujo corresponde a cuentas cliente.",code:"CLIENT_PUBLICATION_ONLY"});
  if(req.event.archived)return res.status(409).json({error:"Restaura el evento antes de publicarlo."});
  if(req.event.published)return res.json({ok:true,published:true,status:"already_published"});
  if(!eventFeatureDecision(req.event,"invitation",{role:"client"}).allowed)return res.status(403).json({error:"Tu cuenta no tiene activa la invitación digital.",code:"INVITATION_REQUIRED"});
  const access=publicationAccess(req.user,req.event);
  if(!access.usable)return res.status(402).json({error:"Necesitas una vigencia activa para publicar.",code:"SUBSCRIPTION_REQUIRED"});
  if(!access.withinLimit)return res.status(409).json({error:`Alcanzaste el límite de ${access.maxPublishedEvents} sitio(s) publicado(s).`,code:"PUBLISHED_EVENT_LIMIT"});
  if(access.policy==="disabled")return res.status(403).json({error:"La publicación está deshabilitada para esta cuenta.",code:"PUBLICATION_DISABLED"});
  const sessionKey=cleanText(req.body.sessionKey||`user-${req.user.id}`,80);
  if(access.auto){
    const id=db.transaction(()=>{
      db.prepare("UPDATE events SET published=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.event.id);
      return Number(db.prepare(`INSERT INTO publication_requests(event_id,user_id,status,decided_at,note) VALUES(?,?,'auto_approved',CURRENT_TIMESTAMP,?)`)
        .run(req.event.id,req.user.id,"Autopublicado por política autorizada del plan y vigencia activa.").lastInsertRowid);
    })();
    recordConversion({sessionKey,userId:req.user.id,eventId:req.event.id,eventName:"published",source:"publication",metadata:{publicationMode:access.mode,planCode:accountEntitlement(req.user.id)?.plan_code||""}});
    audit(req,"publication.auto_approved",{eventId:req.event.id,targetType:"publication_request",targetId:id,metadata:{policy:access.policy}});
    return res.status(201).json({ok:true,published:true,status:"auto_approved",requestId:id});
  }
  const existing=db.prepare("SELECT id FROM publication_requests WHERE event_id=? AND user_id=? AND status='pending' ORDER BY id DESC LIMIT 1").get(req.event.id,req.user.id);
  if(existing)return res.json({ok:true,published:false,status:"pending",requestId:existing.id});
  const info=db.prepare("INSERT INTO publication_requests(event_id,user_id,status,note) VALUES(?,?,'pending',?)")
    .run(req.event.id,req.user.id,cleanText(req.body.note||"Solicitud de publicación del cliente",500));
  recordConversion({sessionKey,userId:req.user.id,eventId:req.event.id,eventName:"publication_requested",source:"publication",metadata:{publicationMode:access.mode,planCode:accountEntitlement(req.user.id)?.plan_code||""}});
  audit(req,"publication.requested",{eventId:req.event.id,targetType:"publication_request",targetId:info.lastInsertRowid});
  res.status(201).json({ok:true,published:false,status:"pending",requestId:Number(info.lastInsertRowid)});
});

app.patch("/api/admin/events/:id/publication",authRequired,eventAllowed,ownerOnly,(req,res)=>{
  if(Number(req.params.id)!==req.event.id)return res.status(400).json({error:"El evento solicitado no coincide con el evento activo.",code:"EVENT_MISMATCH"});
  const published=booleanValue(req.body.published)?1:0;
  db.prepare("UPDATE events SET published=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(published,req.event.id);
  audit(req,published?"event.published":"event.unpublished",{eventId:req.event.id,targetType:"event",targetId:req.event.id});
  res.json({ok:true,published:Boolean(published)});
});

app.put("/api/admin/settings",authRequired,eventAllowed,(req,res)=>{
  const event=currentEvent(req);
  if(!event)return res.status(404).json({error:"Evento no encontrado."});

  const current=settingsOf(event);
  const platformUser=["owner","developer"].includes(req.user.role);
  const can=key=>platformUser||eventFeatureDecision(event,key,{role:req.user.role}).allowed;
  if(!platformUser&&req.body.presentation&&typeof req.body.presentation==="object"){
    const designAccess=designAccessForEvent(event);
    const requestedOpening=req.body.presentation.openingStyle;
    const requestedGallery=req.body.presentation.galleryStyle;
    if(DESIGN_PRODUCT_KEYS.opening[requestedOpening]&&!designAccess.opening[requestedOpening]){
      const productCode=experienceCatalog.openingProductMap[requestedOpening];
      return res.status(403).json({error:"Esta apertura requiere adquirir la experiencia correspondiente en la Store.",code:"DESIGN_PRODUCT_REQUIRED",productCode});
    }
    if(DESIGN_PRODUCT_KEYS.gallery[requestedGallery]&&!designAccess.gallery[requestedGallery]){
      const productCode=experienceCatalog.galleryProductMap[requestedGallery];
      return res.status(403).json({error:"Este estilo de álbum requiere adquirir la experiencia correspondiente.",code:"DESIGN_PRODUCT_REQUIRED",productCode});
    }
  }
  const incomingMedia={...(req.body.media||{})};
  if(!can("music"))for(const key of ["music","musicSource","musicStartSeconds","spotifyUrl","spotifyUri","spotifyTrackName","spotifyArtists","spotifyDurationMs","spotifyStartSeconds"]){incomingMedia[key]=current.media?.[key];}
  if(!can("gallery"))incomingMedia.gallery=current.media?.gallery||[];

  let media;
  try{
    media=normalizeMediaUpdate(current.media,incomingMedia);
  }catch(error){
    return res.status(400).json({error:error.message});
  }

  const requestedTheme=themes.find(theme=>theme.id===req.body.themeId);
  const nextTheme=can("templates")&&requestedTheme&&(
    platformUser||commerce.themeAllowed(requestedTheme,event,eventEntitlement(event))
  )?requestedTheme.id:current.themeId;
  if(req.body.themeId&&requestedTheme&&nextTheme!==requestedTheme.id&&!platformUser){
    return res.status(403).json({error:"Esta plantilla requiere Premium o el complemento de plantillas.",code:"THEME_PLAN_REQUIRED"});
  }

  const next={
    ...current,
    couple:{...(current.couple||{}),...(req.body.couple||{})},
    event:{...(current.event||{}),...(req.body.event||{})},
    venue:can("locations")?{...(current.venue||{}),...(req.body.venue||{})}:{...(current.venue||{})},
    venues:can("locations")?{...(current.venues||{}),...(req.body.venues||{})}:{...(current.venues||{})},
    story:{...(current.story||{}),...(req.body.story||{})},
    dressCode:can("dressCode")
      ? {
          ...(current.dressCode||{}),
          ...(req.body.dressCode||{}),
          referenceImages:Array.isArray(current.dressCode?.referenceImages)?current.dressCode.referenceImages:[]
        }
      : {...(current.dressCode||{})},
    gifts:can("gifts")
      ? {
          ...(current.gifts||{}),
          ...(req.body.gifts||{}),
          link:safeHttpUrl(req.body.gifts?.link??current.gifts?.link)
        }
      : {...(current.gifts||{})},
    menus:can("menus")?{...(current.menus||{}),...(req.body.menus||{})}:{...(current.menus||{})},
    media,
    typography:can("templates")?normalizeTypography(current.typography,req.body.typography):normalizeTypography(current.typography,{}),
    designKit:can("templates")?normalizeDesignKit(current.designKit,req.body.designKit):normalizeDesignKit(current.designKit,{}),
    accessibility:can("rsvp")?{...(current.accessibility||{}),...(req.body.accessibility||{})}:{...(current.accessibility||{})},
    agenda:can("program")?{...(current.agenda||{}),...(req.body.agenda||{})}:{...(current.agenda||{})},
    presentation:can("templates")?normalizePresentation(current.presentation,req.body.presentation):normalizePresentation(current.presentation,{}),
    creativeBrief:can("thematicExperience")
      ?normalizeCreativeBrief(current.creativeBrief,req.body.creativeBrief)
      :normalizeCreativeBrief(current.creativeBrief,{}),
    qrDesign:can("qrCards")
      ?normalizeQrDesign(current.qrDesign,req.body.qrDesign)
      :normalizeQrDesign({},current.qrDesign),
    physicalInvitation:can("physicalInvitations")
      ?normalizePhysicalInvitation(current.physicalInvitation,req.body.physicalInvitation)
      :normalizePhysicalInvitation({},current.physicalInvitation),
    themeId:nextTheme,
    localization:normalizeLocalization(current.localization,req.body.localization),
    storagePolicy:platformUser?{...(current.storagePolicy||{}),...(req.body.storagePolicy||{})}:{...(current.storagePolicy||{})},
    rsvp:can("rsvp")?{...(current.rsvp||{}),...(req.body.rsvp||{})}:{...(current.rsvp||{})},
    photoPolicy:can("guestPhotoMessages")?{...(current.photoPolicy||{}),...(req.body.photoPolicy||{})}:{...(current.photoPolicy||{})},
    lifecycle:platformUser?{...(current.lifecycle||{}),...(req.body.lifecycle||{})}:{...(current.lifecycle||{})},
    /* La disponibilidad comercial de módulos la controla la plataforma. */
    features:platformUser
      ? {...(current.features||{}),...(req.body.features||{})}
      : {...(current.features||{})},
    featureStates:platformUser
      ? {...(current.featureStates||{}),...(req.body.featureStates||{})}
      : {...(current.featureStates||{})},
    /* RC11 obtiene complementos del catálogo y sus concesiones auditables. */
    purchasedFeatures:[...(current.purchasedFeatures||[])],
    developer:platformUser
      ? {...(current.developer||{}),...(req.body.developer||{}),ownerOnly:true}
      : {...(current.developer||{}),ownerOnly:true}
  };

  const normalized=normalizeFeatureSettings(next);
  saveSettings(event.id,normalized);
  audit(req,"settings.updated",{eventId:event.id,targetType:"event",targetId:event.id,metadata:{sections:Object.keys(req.body||{}).slice(0,30)}});

  const displayName=String(next.couple?.displayName||event.name).trim()||event.name;
  db.prepare(`
    UPDATE events SET name=?,event_type=COALESCE(?,event_type),updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(displayName,platformUser||can("templates")?req.body.eventMeta?.eventType||null:null,event.id);
  if(platformUser&&typeof req.body.lifecycle?.protected==="boolean")db.prepare("UPDATE events SET protected=? WHERE id=?").run(req.body.lifecycle.protected?1:0,event.id);

  const responseSettings=platformUser
    ? normalized
    : {...normalized,developer:{mode:"production",showBanner:false,ownerOnly:true}};
  const updatedEvent={...event,settings_json:JSON.stringify(normalized)};
  res.json({ok:true,settings:{...responseSettings,_mediaHealth:eventMediaReferenceReport(updatedEvent)}});
});

/* Reparación explícita para bases restauradas sin su carpeta uploads.
   Sólo elimina referencias locales cuyo archivo físico ya no existe; no borra
   archivos, URLs HTTPS ni contenido válido. Nunca se ejecuta automáticamente. */
app.delete("/api/admin/media/missing",authRequired,eventAllowed,(req,res)=>{
  const event=currentEvent(req);
  if(!event)return res.status(404).json({error:"Evento no encontrado."});
  const settings=settingsOf(event);
  const isMissingLocal=value=>{
    const file=mediaPathFromUrl(value);
    return Boolean(file&&!existingFile(file));
  };
  let removed=0;
  settings.media={...(settings.media||{})};
  if(isMissingLocal(settings.media.heroImage)){settings.media.heroImage="";removed++;}
  if(isMissingLocal(settings.media.music)){
    settings.media.music="";
    if(settings.media.musicSource==="upload")settings.media.musicSource="none";
    removed++;
  }
  if(Array.isArray(settings.media.gallery)){
    const before=settings.media.gallery.length;
    settings.media.gallery=settings.media.gallery.filter(value=>!isMissingLocal(value));
    removed+=before-settings.media.gallery.length;
  }
  settings.dressCode={...(settings.dressCode||{})};
  if(Array.isArray(settings.dressCode.referenceImages)){
    const before=settings.dressCode.referenceImages.length;
    settings.dressCode.referenceImages=settings.dressCode.referenceImages.filter(value=>!isMissingLocal(value));
    removed+=before-settings.dressCode.referenceImages.length;
  }
  if(removed){
    saveSettings(event.id,settings);
    audit(req,"media.missing_references_cleaned",{eventId:event.id,targetType:"event",targetId:event.id,metadata:{removed}});
  }
  const updatedEvent={...event,settings_json:JSON.stringify(settings)};
  res.json({ok:true,removed,settings:{...settings,_mediaHealth:eventMediaReferenceReport(updatedEvent)}});
});

app.get("/api/admin/event-types",authRequired,(_req,res)=>res.json(eventTypes));

app.get("/api/admin/themes",authRequired,eventAllowed,(req,res)=>{
  const platformUser=["owner","developer"].includes(req.user.role);
  const forceClientView=platformUser&&String(req.query.view||"")==="client";
  const products=new Map(commerce.allProducts().map(product=>[product.code,product]));
  res.json(themes
    .filter(theme=>(theme.eventTypes||[]).includes(req.event.event_type)||!(theme.eventTypes||[]).length)
    .filter(theme=>{
      if(platformUser&&!forceClientView)return true;
      const product=products.get(`theme:${theme.id}`);
      if(!product)return false;
      const entitlement=eventEntitlement(req.event),access=commerce.accessForEvent(req.event,entitlement);
      const owned=commerce.productOwnedForEvent(product,req.event,entitlement,access);
      const profileUserId=forceClientView?(eventOwnerId(req.event)||req.user.id):req.user.id;
      const profile=accountCommercialControls(profileUserId);
      return owned||(product.public&&product.commercial_status==="available"&&product.readiness_status==="approved"&&commerce.productVisibleForProfile(product,profile));
    })
    .map(theme=>{
      const product=products.get(`theme:${theme.id}`);
      return {
        ...theme,
        palette:themeDesignFor(themeDesigns,theme.id).palette,
        allowed:(platformUser&&!forceClientView)||commerce.productOwnedForEvent(product,req.event,eventEntitlement(req.event),commerce.accessForEvent(req.event,eventEntitlement(req.event)))||commerce.themeAllowed(theme,req.event,eventEntitlement(req.event)),
        productId:product?.id||null,
        price_cents:Number(product?.price_cents||0),
        commercial_status:product?.commercial_status||"hidden"
      };
    })
  );
});

function adminMediaUploadKey(req){
  const value=String(req.headers["x-upload-key"]||"").trim();
  return /^[A-Za-z0-9:_-]{12,140}$/.test(value)?value:"";
}
function replayAdminMediaUpload(req,res,eventId,kind,files=[]){
  const uploadKey=adminMediaUploadKey(req);
  if(!uploadKey)return false;
  const row=db.prepare(`
    SELECT result_json FROM media_upload_receipts
    WHERE event_id=? AND kind=? AND upload_key=?
      AND datetime(created_at)>=datetime('now','-1 day')
  `).get(eventId,kind,uploadKey);
  if(!row)return false;
  removeFiles(Array.isArray(files)?files:[files].filter(Boolean));
  let payload={ok:true};
  try{payload={...payload,...JSON.parse(row.result_json||"{}")} }catch{}
  res.json({...payload,replayed:true});
  return true;
}
function rememberAdminMediaUpload(req,eventId,kind,payload){
  const uploadKey=adminMediaUploadKey(req);
  if(!uploadKey)return;
  db.prepare(`
    INSERT OR REPLACE INTO media_upload_receipts(event_id,kind,upload_key,result_json,created_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP)
  `).run(eventId,kind,uploadKey,JSON.stringify(payload||{}));
  db.prepare("DELETE FROM media_upload_receipts WHERE datetime(created_at)<datetime('now','-30 days')").run();
}

app.post("/api/admin/media/hero",authRequired,eventAllowed,featureRequired("invitation"),mediaUpload.single("file"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"No se recibió la imagen de portada."});
  try{normalizeUploadedMediaFile(req.file,"image");}catch(error){removeFiles([req.file]);return res.status(400).json({error:error.message,code:"INVALID_IMAGE_CONTENT"});}
  const event=currentEvent(req);
  if(replayAdminMediaUpload(req,res,event.id,"hero",req.file))return;
  const settings=settingsOf(event);
  const previous=settings.media?.heroImage||"";
  const capacity=ensureStorageCapacity(event,Number(req.file.size||0),[previous]);
  if(!capacity.allowed){
    removeFiles([req.file]);
    return res.status(413).json({error:"El evento alcanzó su límite de almacenamiento. Mejora el plan o elimina archivos.",code:"STORAGE_LIMIT"});
  }

  settings.media={...(settings.media||{}),heroImage:`/uploads/site-media/${req.file.filename}`};
  saveSettings(event.id,settings);
  if(previous&&previous!==settings.media.heroImage){
    const previousPath=mediaPathFromUrl(previous);
    if(previousPath)removeFiles([previousPath]);
  }
  const payload={ok:true,url:settings.media.heroImage};
  rememberAdminMediaUpload(req,event.id,"hero",payload);
  res.json(payload);
});

app.post("/api/admin/media/music",authRequired,eventAllowed,featureRequired("music"),mediaUpload.single("file"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"No se recibió el archivo de música."});
  try{normalizeUploadedMediaFile(req.file,"audio");}catch(error){removeFiles([req.file]);return res.status(400).json({error:error.message,code:"INVALID_AUDIO_CONTENT"});}
  const event=currentEvent(req);
  if(replayAdminMediaUpload(req,res,event.id,"music",req.file))return;
  const settings=settingsOf(event);
  const previous=settings.media?.music||"";
  const capacity=ensureStorageCapacity(event,Number(req.file.size||0),[previous]);
  if(!capacity.allowed){
    removeFiles([req.file]);
    return res.status(413).json({error:"El evento alcanzó su límite de almacenamiento. Mejora el plan o elimina archivos.",code:"STORAGE_LIMIT"});
  }

  settings.media={
    ...(settings.media||{}),
    music:`/uploads/site-media/${req.file.filename}`,
    musicSource:"upload"
  };
  saveSettings(event.id,settings);
  if(previous&&previous!==settings.media.music){
    const previousPath=mediaPathFromUrl(previous);
    if(previousPath)removeFiles([previousPath]);
  }
  const payload={ok:true,url:settings.media.music};
  rememberAdminMediaUpload(req,event.id,"music",payload);
  res.json(payload);
});

app.post("/api/admin/media/gallery",authRequired,eventAllowed,featureRequired("gallery"),mediaUpload.array("files",30),(req,res)=>{
  if(!req.files?.length)return res.status(400).json({error:"No se recibieron fotografías."});
  try{req.files.forEach(file=>normalizeUploadedMediaFile(file,"image"));}catch(error){removeFiles(req.files);return res.status(400).json({error:error.message,code:"INVALID_IMAGE_CONTENT"});}
  const event=currentEvent(req);
  if(replayAdminMediaUpload(req,res,event.id,"gallery",req.files))return;
  const incoming=req.files.reduce((sum,file)=>sum+Number(file.size||0),0);
  const capacity=ensureStorageCapacity(event,incoming);
  if(!capacity.allowed){
    removeFiles(req.files);
    return res.status(413).json({error:"El evento alcanzó su límite de almacenamiento. Mejora el plan o elimina archivos.",code:"STORAGE_LIMIT"});
  }

  const settings=settingsOf(event);
  const added=req.files.map(file=>`/uploads/site-media/${file.filename}`);
  settings.media={
    ...(settings.media||{}),
    gallery:[...(settings.media?.gallery||[]),...added]
  };
  saveSettings(event.id,settings);
  const payload={ok:true,gallery:settings.media.gallery};
  rememberAdminMediaUpload(req,event.id,"gallery",payload);
  res.json(payload);
});

app.post("/api/admin/media/dress",authRequired,eventAllowed,featureRequired("dressCode"),mediaUpload.array("files",30),(req,res)=>{
  if(!req.files?.length)return res.status(400).json({error:"No se recibieron imágenes de vestimenta."});
  try{req.files.forEach(file=>normalizeUploadedMediaFile(file,"image"));}catch(error){removeFiles(req.files);return res.status(400).json({error:error.message,code:"INVALID_IMAGE_CONTENT"});}
  const event=currentEvent(req);
  if(replayAdminMediaUpload(req,res,event.id,"dress",req.files))return;
  const incoming=req.files.reduce((sum,file)=>sum+Number(file.size||0),0);
  const capacity=ensureStorageCapacity(event,incoming);
  if(!capacity.allowed){
    removeFiles(req.files);
    return res.status(413).json({error:"El evento alcanzó su límite de almacenamiento. Mejora el plan o elimina archivos.",code:"STORAGE_LIMIT"});
  }

  const settings=settingsOf(event);
  const added=req.files.map(file=>`/uploads/site-media/${file.filename}`);
  settings.dressCode={
    ...(settings.dressCode||{}),
    referenceImages:[...(settings.dressCode?.referenceImages||[]),...added]
  };
  saveSettings(event.id,settings);
  const payload={ok:true,referenceImages:settings.dressCode.referenceImages};
  rememberAdminMediaUpload(req,event.id,"dress",payload);
  res.json(payload);
});

app.delete("/api/admin/media/item",authRequired,eventAllowed,(req,res)=>{
  const event=currentEvent(req);
  const settings=settingsOf(event);
  const url=String(req.body.url||"");
  const type=String(req.body.type||"");
  const key=type==="gallery"?"gallery":type==="dress"?"dressCode":"";
  if(!key)return res.status(400).json({error:"Tipo de multimedia no reconocido."});
  const decision=eventFeatureDecision(event,key,{role:req.user.role});
  if(!decision.allowed)return res.status(403).json({error:"Este módulo no está habilitado.",code:"FEATURE_UNAVAILABLE",feature:key});

  if(type==="gallery"){
    settings.media={
      ...(settings.media||{}),
      gallery:(settings.media?.gallery||[]).filter(item=>item!==url)
    };
  }else if(type==="dress"){
    settings.dressCode={
      ...(settings.dressCode||{}),
      referenceImages:(settings.dressCode?.referenceImages||[]).filter(item=>item!==url)
    };
  }

  saveSettings(event.id,settings);
  const physicalPath=mediaPathFromUrl(url);
  if(physicalPath)removeFiles([physicalPath]);
  res.json({ok:true});
});

app.delete("/api/admin/media/music",authRequired,eventAllowed,featureRequired("music"),(req,res)=>{
  const event=currentEvent(req);
  const settings=settingsOf(event);
  const source=String(req.body.source||"");
  if(!["upload","spotify","all"].includes(source)){
    return res.status(400).json({error:"Origen de música no reconocido."});
  }

  const media={...(settings.media||{})};
  let uploadPath=null;
  if(source==="upload"||source==="all"){
    uploadPath=mediaPathFromUrl(media.music);
    media.music="";
    media.musicStartSeconds=0;
    if(media.musicSource==="upload")media.musicSource="none";
  }
  if(source==="spotify"||source==="all"){
    media.spotifyUrl="";
    media.spotifyEmbed="";
    media.spotifyUri="";
    media.spotifyTrackName="";
    media.spotifyArtists="";
    media.spotifyDurationMs=0;
    media.spotifyStartSeconds=0;
    if(media.musicSource==="spotify")media.musicSource="none";
  }

  settings.media=media;
  saveSettings(event.id,settings);
  if(uploadPath)removeFiles([uploadPath]);
  res.json({ok:true,media});
});



app.get("/api/admin/storage",authRequired,eventAllowed,(req,res)=>{
  const event=currentEvent(req);
  const usage=eventStorageUsage(event);
  const policy=settingsOf(event).storagePolicy||{};
  res.json({
    ...usage,
    warningPercent:Number(policy.warningPercent||80),
    criticalPercent:Number(policy.criticalPercent||95),
    status:usage.percent>=Number(policy.criticalPercent||95)
      ?"critical"
      :usage.percent>=Number(policy.warningPercent||80)
        ?"warning"
        :"ok",
    lifecycle:{
      expiresAt:event.expires_at,
      graceUntil:event.grace_until,
      cleanupAfter:event.cleanup_after,
      cleanupStatus:event.cleanup_status||"active"
    }
  });
});

app.get("/api/admin/dashboard",authRequired,eventAllowed,(req,res)=>{
  const event=currentEvent(req);
  const invitations=db.prepare(`
    SELECT COUNT(*) invitations,
      COALESCE(SUM(status='confirmed'),0) confirmed_families,
      COALESCE(SUM(status='declined'),0) declined_families,
      COALESCE(SUM(status='pending'),0) pending_families
    FROM guests WHERE event_id=? AND COALESCE(is_test,0)=0
  `).get(event.id);
  const people=db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN r.attending=1 THEN r.adults ELSE 0 END),0) adults,
      COALESCE(SUM(CASE WHEN r.attending=1 THEN r.children ELSE 0 END),0) children,
      COALESCE(SUM(CASE WHEN r.attending=1 AND (
        TRIM(COALESCE(r.dietary,''))<>'' OR
        TRIM(COALESCE(r.special_needs,''))<>'' OR
        TRIM(COALESCE(r.accessibility_options,'')) NOT IN ('','[]') OR
        TRIM(COALESCE(r.accessibility_other,''))<>''
      ) THEN 1 ELSE 0 END),0) dietary_records
    FROM rsvps r JOIN guests g ON g.id=r.guest_id
    WHERE g.event_id=? AND COALESCE(g.is_test,0)=0
  `).get(event.id);
  const photos=db.prepare("SELECT COUNT(*) total FROM photos WHERE event_id=?").get(event.id).total;
  res.json({...invitations,...people,photos});
});
app.get("/api/admin/guests",authRequired,eventAllowed,featureRequired("guests"),(req,res)=>{
  const event=currentEvent(req);
  const platformUser=["owner","developer"].includes(req.user.role);
  const rows=db.prepare(`
    SELECT g.*,r.attending,r.adults,r.children,r.attendee_names,r.dietary,r.special_needs,
           r.adult_menu_counts,r.child_menu_counts,r.accessibility_options,
           r.accessibility_other,r.message,r.contact_phone,r.updated_at
    FROM guests g
    LEFT JOIN rsvps r ON r.guest_id=g.id
    WHERE g.event_id=? AND (?=1 OR COALESCE(g.is_test,0)=0)
    ORDER BY g.is_test DESC,g.family_name
  `).all(event.id,platformUser?1:0);
  res.json(rows.map(g=>({
    ...g,
    invitation_url:invitationUrl(event,g.token),
    whatsapp_url:whatsappUrl(event,g)
  })));
});
app.post("/api/admin/guests",authRequired,eventAllowed,featureRequired("guests"),(req,res)=>{
  const event=currentEvent(req);
  const {
    code,family_name,phone="",max_adults=1,max_children=0,table_name="",
    custom_message="",private_notes=""
  }=req.body||{};
  const adults=Number(max_adults);
  const children=Number(max_children);
  if(!cleanText(family_name,180)){
    return res.status(400).json({error:"La familia o nombre del invitado es obligatorio."});
  }
  if(!Number.isInteger(adults)||adults<0||!Number.isInteger(children)||children<0||adults+children===0){
    return res.status(400).json({error:"Indica al menos un lugar con cantidades válidas de adultos y niños."});
  }
  const entitlement=eventEntitlement(event);
  if(entitlement){
    const reserved=db.prepare(`
      SELECT COALESCE(SUM(max_adults+max_children),0) total
      FROM guests WHERE event_id=? AND COALESCE(is_test,0)=0
    `).get(event.id).total;
    if(reserved+adults+children>entitlement.max_guests){
      return res.status(409).json({error:`El plan ${entitlement.plan_name} permite reservar hasta ${entitlement.max_guests} lugares.`});
    }
  }
  try{
    const finalCode=cleanText(code,80)||nextGuestCode(event.id);
    const info=db.prepare(`
      INSERT INTO guests
        (event_id,code,token,family_name,phone,max_adults,max_children,table_name,custom_message,private_notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      event.id,finalCode,makeToken(),cleanText(family_name,180),normalizePhone(phone),
      adults,children,cleanText(table_name,80),cleanText(custom_message,1000),cleanText(private_notes,1000)
    );
    const seating=syncGuestSeatingFromTable(event.id,Number(info.lastInsertRowid));
    res.json({ok:true,id:Number(info.lastInsertRowid),code:finalCode,generatedCode:!cleanText(code,80),seating});
  }catch{
    res.status(400).json({error:"Código repetido o datos inválidos."});
  }
});
function spreadsheetCellValue(cell){
  const value=cell?.value;
  if(value===null||value===undefined)return "";
  if(value instanceof Date)return value;
  if(typeof value!=="object")return value;
  if(Object.prototype.hasOwnProperty.call(value,"result"))return value.result??"";
  if(Array.isArray(value.richText))return value.richText.map(part=>part.text||"").join("");
  if(Object.prototype.hasOwnProperty.call(value,"text"))return value.text||"";
  return String(cell.text||"");
}
async function readSpreadsheetRows(filePath,originalName=""){
  const workbook=new ExcelJS.Workbook();
  const extension=path.extname(originalName||filePath).toLowerCase();
  if(extension===".csv")await workbook.csv.readFile(filePath);
  else{
    validateXlsxArchive(filePath);
    await workbook.xlsx.readFile(filePath);
  }
  const sheet=workbook.worksheets[0];
  if(!sheet)return [];
  const headers=[];
  sheet.getRow(1).eachCell({includeEmpty:true},(cell,column)=>{headers[column]=cleanText(spreadsheetCellValue(cell),120);});
  const rows=[];
  sheet.eachRow({includeEmpty:false},(row,rowNumber)=>{
    if(rowNumber===1)return;
    const item={};
    let hasValue=false;
    headers.forEach((header,column)=>{
      if(!header)return;
      const value=spreadsheetCellValue(row.getCell(column));
      item[header]=value;
      if(String(value??"").trim())hasValue=true;
    });
    if(hasValue)rows.push(item);
  });
  return rows;
}
app.post("/api/admin/import",authRequired,eventAllowed,featureRequired("guests"),excelUpload.single("file"),async(req,res)=>{
  const event=currentEvent(req);
  if(!req.file)return res.status(400).json({error:"Selecciona un archivo Excel o CSV."});
  try{
    const rows=await readSpreadsheetRows(req.file.path,req.file.originalname);
    const find=db.prepare("SELECT * FROM guests WHERE event_id=? AND code=?");
    const findIdentity=db.prepare(`
      SELECT * FROM guests
      WHERE event_id=? AND LOWER(TRIM(family_name))=LOWER(TRIM(?)) AND COALESCE(phone,'')=?
      ORDER BY id
    `);
    const upsert=db.prepare(`
      INSERT INTO guests
        (event_id,code,token,family_name,phone,max_adults,max_children,table_name,custom_message,private_notes)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(event_id,code) DO UPDATE SET
        family_name=excluded.family_name,phone=excluded.phone,
        max_adults=excluded.max_adults,max_children=excluded.max_children,
        table_name=excluded.table_name,custom_message=excluded.custom_message,
        private_notes=excluded.private_notes
    `);
    let inserted=0,updated=0,skipped=0,generatedCodes=0;
    const touchedGuestIds=new Set();
    const errors=[];
    const seen=new Set();
    const entitlement=eventEntitlement(event);
    let reserved=db.prepare(`SELECT COALESCE(SUM(max_adults+max_children),0) total FROM guests WHERE event_id=? AND COALESCE(is_test,0)=0`).get(event.id).total;

    db.transaction(()=>{
      rows.forEach((row,index)=>{
        const line=index+2;
        const family=cleanText(row.FAMILIA||row["FAMILIA O INVITADO"]||row.familia,180);
        const phone=normalizePhone(row.TELEFONO||row.Teléfono||row.telefono);
        const suppliedCode=cleanText(row.CODIGO||row.Código||row.codigo,80);
        const adults=Number(row.ADULTOS??row["ADULTOS PERMITIDOS"]??0);
        const children=Number(row["NIÑOS"]??row.NINOS??row["NIÑOS PERMITIDOS"]??0);
        if(!family){errors.push({row:line,code:"REQUIRED_FIELDS",message:"Falta la familia o nombre del invitado."});return;}
        if(!Number.isInteger(adults)||adults<0||!Number.isInteger(children)||children<0||adults+children===0){
          errors.push({row:line,code:"INVALID_CAPACITY",message:"Adultos y niños deben ser enteros válidos y reservar al menos un lugar."});
          return;
        }
        const identityKey=suppliedCode?`CODE:${suppliedCode.toLocaleUpperCase("es-MX")}`:`AUTO:${family.toLocaleLowerCase("es-MX")}|${phone}`;
        if(seen.has(identityKey)){skipped++;errors.push({row:line,code:"DUPLICATE_IN_FILE",message:"La misma invitación ya apareció en este archivo."});return;}
        seen.add(identityKey);
        let existing=suppliedCode?find.get(event.id,suppliedCode):null;
        if(!existing&&phone){
          const matches=findIdentity.all(event.id,family,phone);
          if(matches.length===1)existing=matches[0];
        }
        const code=suppliedCode||existing?.code||nextGuestCode(event.id);
        if(!suppliedCode&&!existing)generatedCodes++;
        const previousPlaces=existing?Number(existing.max_adults)+Number(existing.max_children):0;
        const projected=reserved-previousPlaces+adults+children;
        if(entitlement&&projected>entitlement.max_guests){
          errors.push({row:line,code:"PLAN_GUEST_LIMIT",message:`La fila excede el máximo de ${entitlement.max_guests} lugares del plan ${entitlement.plan_name}.`});
          return;
        }
        upsert.run(
          event.id,code,existing?.token||makeToken(),family,
          phone,adults,children,
          cleanText(row.MESA,80),cleanText(row["MENSAJE PERSONALIZADO"]||row.MENSAJE,1000),
          cleanText(row["NOTAS PRIVADAS"]||row.NOTAS,1000)
        );
        const touched=db.prepare("SELECT id FROM guests WHERE event_id=? AND code=?").get(event.id,code);
        if(touched?.id)touchedGuestIds.add(Number(touched.id));
        reserved=projected;
        if(existing)updated++;else inserted++;
      });
    })();

    ensureEventTables(event.id);
    initializeLegacySeating(event.id);
    for(const guestId of touchedGuestIds)syncGuestSeatingFromTable(event.id,guestId);

    fs.unlinkSync(req.file.path);
    audit(req,"guests.imported",{eventId:event.id,targetType:"guest",metadata:{inserted,updated,skipped,errorCount:errors.length}});
    res.json({ok:true,inserted,updated,skipped,generatedCodes,errors,processed:rows.length});
  }catch(error){
    if(req.file?.path&&fs.existsSync(req.file.path))fs.unlinkSync(req.file.path);
    res.status(400).json({error:error.message});
  }
});
app.get("/api/admin/guests.xlsx",authRequired,eventAllowed,featureRequired("guests"),async(req,res,next)=>{
  try{
    const event=currentEvent(req);
    const rows=db.prepare(`
      SELECT g.code,g.family_name,g.max_adults,g.max_children,g.phone,g.table_name,g.custom_message,g.private_notes,
        g.delivery_status,g.sent_at,g.status,r.attending,r.adults confirmed_adults,r.children confirmed_children,
        r.attendee_names,r.dietary,r.special_needs,r.message confirmation_message,r.contact_phone,r.updated_at confirmation_updated_at
      FROM guests g LEFT JOIN rsvps r ON r.guest_id=g.id
      WHERE g.event_id=? AND COALESCE(g.is_test,0)=0
      ORDER BY g.family_name,g.id
    `).all(event.id);
    const workbook=new ExcelJS.Workbook();
    workbook.creator="EventStudio";workbook.created=new Date();
    const sheet=workbook.addWorksheet("Invitados",{views:[{state:"frozen",ySplit:1}]});
    sheet.columns=[
      ["CODIGO",16],["FAMILIA",30],["ADULTOS",12],["NIÑOS",12],["TELEFONO",18],["MESA",18],["MENSAJE PERSONALIZADO",42],["NOTAS PRIVADAS",36],
      ["ESTADO ENTREGA",18],["FECHA ENVIO",21],["ESTADO CONFIRMACION",22],["ADULTOS CONFIRMADOS",21],["NIÑOS CONFIRMADOS",21],["NOMBRES ASISTENTES",38],
      ["RESTRICCIONES",34],["NECESIDADES ESPECIALES",34],["MENSAJE CONFIRMACION",38],["TELEFONO CONTACTO",20],["ULTIMA ACTUALIZACION",22]
    ].map(([header,width])=>({header,key:header,width}));
    const statusLabel={pending:"Pendiente",confirmed:"Confirmado",declined:"No asistirá"};
    rows.forEach(row=>sheet.addRow({
      CODIGO:row.code,FAMILIA:row.family_name,ADULTOS:row.max_adults,"NIÑOS":row.max_children,TELEFONO:row.phone||"",MESA:row.table_name||"",
      "MENSAJE PERSONALIZADO":row.custom_message||"","NOTAS PRIVADAS":row.private_notes||"","ESTADO ENTREGA":row.delivery_status||"not_sent","FECHA ENVIO":row.sent_at||"",
      "ESTADO CONFIRMACION":statusLabel[row.status]||row.status||"Pendiente","ADULTOS CONFIRMADOS":row.confirmed_adults??"","NIÑOS CONFIRMADOS":row.confirmed_children??"",
      "NOMBRES ASISTENTES":row.attendee_names||"",RESTRICCIONES:row.dietary||"","NECESIDADES ESPECIALES":row.special_needs||"","MENSAJE CONFIRMACION":row.confirmation_message||"",
      "TELEFONO CONTACTO":row.contact_phone||"","ULTIMA ACTUALIZACION":row.confirmation_updated_at||""
    }));
    sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
    sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF7B2331"}};
    sheet.autoFilter={from:"A1",to:"S1"};
    sheet.eachRow((row,index)=>{if(index>1)row.alignment={vertical:"top",wrapText:true};});
    const help=workbook.addWorksheet("Instrucciones");
    help.addRows([["USO","DETALLE"],["Editar y reimportar","Conserva CODIGO para actualizar la familia sin duplicarla."],["Columnas operativas","Las columnas posteriores a NOTAS PRIVADAS son informativas y se recalculan desde EventStudio."],["Evento",event.name]]);
    help.columns=[{width:26},{width:82}];help.getRow(1).font={bold:true};
    const filename=`invitados-${sanitize(event.slug)||"evento"}.xlsx`;
    res.setHeader("Content-Disposition",`attachment; filename="${filename}"`);
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(Buffer.from(await workbook.xlsx.writeBuffer()));
  }catch(error){next(error);}
});
app.get("/api/admin/template.xlsx",authRequired,eventAllowed,async(_req,res,next)=>{
  try{
    const workbook=new ExcelJS.Workbook();
    const sheet=workbook.addWorksheet("Invitados",{views:[{state:"frozen",ySplit:1}]});
    sheet.columns=[
      ["CODIGO",16],["FAMILIA",30],["ADULTOS",12],["NIÑOS",12],["TELEFONO",18],["MESA",18],
      ["MENSAJE PERSONALIZADO",42],["NOTAS PRIVADAS",36]
    ].map(([header,width])=>({header,key:header,width}));
    sheet.addRow({
      CODIGO:"",
      FAMILIA:"",
      ADULTOS:"",
      "NIÑOS":"",
      TELEFONO:"",
      MESA:"",
      "MENSAJE PERSONALIZADO":"",
      "NOTAS PRIVADAS":""
    });
    sheet.getCell("A1").note="Opcional. Si lo dejas vacío, EventStudio genera un código único automáticamente.";
    const help=workbook.addWorksheet("Instrucciones");
    help.addRows([
      ["CAMPO","USO"],
      ["CODIGO","Opcional. Déjalo vacío para generar FAM-0001, FAM-0002, etc."],
      ["FAMILIA","Obligatorio. Familia o nombre principal de la invitación."],
      ["MESA","Opcional. Si escribes una mesa nueva, se crea automáticamente en el plano."],
      ["ADULTOS / NIÑOS","Lugares reservados; la suma debe ser mayor que cero."]
    ]);
    help.columns=[{width:22},{width:76}];
    help.getRow(1).font={bold:true};
    sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
    sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF7B2331"}};
    sheet.autoFilter={from:"A1",to:"H1"};
    const buffer=await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Disposition","attachment; filename=plantilla_invitados.xlsx");
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(Buffer.from(buffer));
  }catch(error){next(error);}
});
app.get("/api/admin/tables",authRequired,eventAllowed,featureRequired("seating"),(req,res)=>{
  const event=currentEvent(req);
  ensureEventTables(event.id);
  const rows=db.prepare("SELECT name FROM event_tables WHERE event_id=? ORDER BY order_index,id").all(event.id);
  res.json(rows.map(row=>row.name));
});
app.get("/api/admin/seating",authRequired,eventAllowed,featureRequired("seating"),(req,res)=>{
  const event=currentEvent(req);
  res.json(seatingSnapshot(event.id,{confirmedOnly:req.query.mode==="confirmed"}));
});
app.get("/api/admin/seating/layout.pdf",authRequired,eventAllowed,featureRequired("seating"),(req,res)=>{
  const event=currentEvent(req);
  const settings=settingsOf(event);
  const mode=req.query.mode==="confirmed"?"confirmed":"planned";
  const snapshot=seatingSnapshot(event.id,{confirmedOnly:mode==="confirmed"});
  const filename=`plano-mesas-${mode==="confirmed"?"confirmado":"planeado"}-${sanitize(event.slug)||"evento"}.pdf`;
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`attachment; filename="${filename}"`);
  const doc=new PDFDocument({size:"LETTER",layout:"landscape",margin:0,info:{Title:`Plano de mesas - ${presentedName(settings.couple?.displayName||event.name,settings.typography)}`,Subject:seatingModeLabel(mode)}});
  registerPdfFonts(doc);
  doc.pipe(res);
  drawSeatingPlanPdf(doc,{settings,snapshot});
  doc.end();
});
app.put("/api/admin/seating/layout",authRequired,eventAllowed,featureRequired("seating"),(req,res)=>{
  const event=currentEvent(req);
  const tables=Array.isArray(req.body.tables)?req.body.tables:[];
  const zones=Array.isArray(req.body.zones)?req.body.zones:[];
  if(!tables.length||tables.length>80)return res.status(400).json({error:"El plano debe contener entre 1 y 80 mesas."});
  if(zones.length>20)return res.status(400).json({error:"El plano admite hasta 20 áreas especiales."});
  const roundLayoutNumber=value=>Math.round(value*100)/100;
  const number=(value,min,max,label)=>{
    const parsed=Number(value);
    if(!Number.isFinite(parsed)||parsed<min||parsed>max)throw new Error(`${label} no es válido.`);
    return roundLayoutNumber(parsed);
  };
  try{
    const normalizedTables=tables.map((table,index)=>({
      id:Number(table.id)||0,name:cleanText(table.name,80),
      shape:["round","rect"].includes(table.shape)?table.shape:"round",
      capacity:Math.round(number(table.capacity,1,30,"La capacidad")),
      x:number(table.x,0,94,"La posición horizontal"),y:number(table.y,0,94,"La posición vertical"),
      width:number(table.width,6,70,"El ancho de la mesa (6% a 70%)"),height:number(table.height,6,70,"El alto de la mesa (6% a 70%)"),
      rotation:number(table.rotation??0,-180,180,"La rotación"),orderIndex:index
    }));
    if(normalizedTables.some(table=>!table.name))throw new Error("Todas las mesas necesitan un nombre.");
    if(new Set(normalizedTables.map(table=>table.name.toLocaleLowerCase("es-MX"))).size!==normalizedTables.length){
      throw new Error("Los nombres de las mesas no pueden repetirse.");
    }
    const allowedZoneTypes=["dance_floor","stage","entrance","bar","aisle","restrooms","other"];
    const allowedZoneShapes=["rect","rounded","arc"];
    const normalizedZones=zones.map((zone,index)=>({
      id:Number(zone.id)||0,type:allowedZoneTypes.includes(zone.type)?zone.type:"other",
      shape:allowedZoneShapes.includes(zone.shape)?zone.shape:"rect",
      label:cleanText(zone.label,80)||"Área",
      x:number(zone.x,0,94,"La posición horizontal"),y:number(zone.y,0,94,"La posición vertical"),
      width:number(zone.width,6,70,"El ancho"),height:number(zone.height,6,70,"El alto"),
      rotation:number(zone.rotation??0,-180,180,"La rotación"),orderIndex:index
    }));
    const geometryEpsilon=.25;
    [...normalizedTables,...normalizedZones].forEach(item=>{
      if(item.x+item.width<=100+geometryEpsilon)item.x=roundLayoutNumber(Math.min(item.x,100-item.width));
      if(item.y+item.height<=100+geometryEpsilon)item.y=roundLayoutNumber(Math.min(item.y,100-item.height));
    });
    const outside=[...normalizedTables,...normalizedZones].find(item=>item.x+item.width>100+geometryEpsilon||item.y+item.height>100+geometryEpsilon);
    if(outside)throw new Error("Todos los elementos deben quedar dentro del salón.");
    const allItems=[...normalizedTables.map(item=>({...item,kind:"mesa"})),...normalizedZones.map(item=>({...item,kind:"área"}))];
    for(let left=0;left<allItems.length;left++)for(let right=left+1;right<allItems.length;right++){
      const a=allItems[left],b=allItems[right];
      const overlapX=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
      const overlapY=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
      if(overlapX>geometryEpsilon&&overlapY>geometryEpsilon){
        throw new Error(`Corrige el cruce entre ${a.name||a.label} y ${b.name||b.label} antes de guardar.`);
      }
    }
    const currentTableIds=new Set(db.prepare("SELECT id FROM event_tables WHERE event_id=?").all(event.id).map(row=>row.id));
    const currentZoneIds=new Set(db.prepare("SELECT id FROM event_floor_zones WHERE event_id=?").all(event.id).map(row=>row.id));
    if(normalizedTables.some(table=>table.id&&!currentTableIds.has(table.id))||normalizedZones.some(zone=>zone.id&&!currentZoneIds.has(zone.id))){
      throw new Error("El plano contiene elementos que no pertenecen al evento activo.");
    }
    for(const table of normalizedTables.filter(item=>item.id)){
      const maxSeat=db.prepare("SELECT COALESCE(MAX(seat_index),0) seat FROM seating_assignments WHERE event_id=? AND table_id=?").get(event.id,table.id).seat;
      if(maxSeat>table.capacity)throw new Error(`${table.name} conserva un asiento ${maxSeat}; reasigna personas antes de reducir su capacidad a ${table.capacity}.`);
    }
    db.transaction(()=>{
      const keptTableIds=normalizedTables.filter(table=>table.id).map(table=>table.id);
      if(keptTableIds.length){
        db.prepare(`DELETE FROM event_tables WHERE event_id=? AND id NOT IN (${keptTableIds.map(()=>"?").join(",")})`).run(event.id,...keptTableIds);
      }else{
        db.prepare("DELETE FROM event_tables WHERE event_id=?").run(event.id);
      }
      const keptZoneIds=normalizedZones.filter(zone=>zone.id).map(zone=>zone.id);
      if(keptZoneIds.length){
        db.prepare(`DELETE FROM event_floor_zones WHERE event_id=? AND id NOT IN (${keptZoneIds.map(()=>"?").join(",")})`).run(event.id,...keptZoneIds);
      }else{
        db.prepare("DELETE FROM event_floor_zones WHERE event_id=?").run(event.id);
      }
      const updateTable=db.prepare(`UPDATE event_tables SET name=?,shape=?,capacity=?,x=?,y=?,width=?,height=?,rotation=?,order_index=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?`);
      const insertTable=db.prepare(`INSERT INTO event_tables(event_id,name,shape,capacity,x,y,width,height,rotation,order_index) VALUES(?,?,?,?,?,?,?,?,?,?)`);
      normalizedTables.forEach(table=>table.id
        ?updateTable.run(table.name,table.shape,table.capacity,table.x,table.y,table.width,table.height,table.rotation,table.orderIndex,table.id,event.id)
        :insertTable.run(event.id,table.name,table.shape,table.capacity,table.x,table.y,table.width,table.height,table.rotation,table.orderIndex));
      const updateZone=db.prepare(`UPDATE event_floor_zones SET type=?,shape=?,label=?,x=?,y=?,width=?,height=?,rotation=?,order_index=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?`);
      const insertZone=db.prepare(`INSERT INTO event_floor_zones(event_id,type,shape,label,x,y,width,height,rotation,order_index) VALUES(?,?,?,?,?,?,?,?,?,?)`);
      normalizedZones.forEach(zone=>zone.id
        ?updateZone.run(zone.type,zone.shape,zone.label,zone.x,zone.y,zone.width,zone.height,zone.rotation,zone.orderIndex,zone.id,event.id)
        :insertZone.run(event.id,zone.type,zone.shape,zone.label,zone.x,zone.y,zone.width,zone.height,zone.rotation,zone.orderIndex));
    })();
    res.json({ok:true,...seatingSnapshot(event.id,{confirmedOnly:req.body.mode==="confirmed"})});
  }catch(error){
    res.status(400).json({error:error.message});
  }
});
app.put("/api/admin/seating/assignment",authRequired,eventAllowed,featureRequired("seating"),(req,res)=>{
  const event=currentEvent(req);
  const guestId=Number(req.body.guestId);
  const personKey=cleanText(req.body.personKey,80);
  const tableId=req.body.tableId===null||req.body.tableId===""?null:Number(req.body.tableId);
  const person=seatingPeople(event.id).find(item=>item.guestId===guestId&&item.personKey===personKey);
  if(!person)return res.status(404).json({error:"La persona ya no está disponible en el plan del evento."});
  if(tableId===null){
    db.prepare("DELETE FROM seating_assignments WHERE event_id=? AND guest_id=? AND person_key=?").run(event.id,guestId,personKey);
    return res.json({ok:true});
  }
  const table=db.prepare("SELECT * FROM event_tables WHERE id=? AND event_id=?").get(tableId,event.id);
  if(!table)return res.status(404).json({error:"La mesa no pertenece al evento activo."});
  const occupied=new Set(db.prepare(`
    SELECT seat_index FROM seating_assignments
    WHERE event_id=? AND table_id=? AND NOT (guest_id=? AND person_key=?)
  `).all(event.id,tableId,guestId,personKey).map(row=>row.seat_index));
  let seatIndex=Number(req.body.seatIndex)||0;
  if(!seatIndex){
    for(let candidate=1;candidate<=table.capacity;candidate++){
      if(!occupied.has(candidate)){seatIndex=candidate;break;}
    }
  }
  if(seatIndex<1||seatIndex>table.capacity||occupied.has(seatIndex)){
    return res.status(409).json({error:`${table.name} ya no tiene un asiento disponible.`});
  }
  db.prepare(`
    INSERT INTO seating_assignments(event_id,guest_id,person_key,table_id,seat_index,updated_at)
    VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(event_id,guest_id,person_key) DO UPDATE SET
      table_id=excluded.table_id,seat_index=excluded.seat_index,updated_at=CURRENT_TIMESTAMP
  `).run(event.id,guestId,personKey,tableId,seatIndex);
  res.json({ok:true,tableId,seatIndex});
});
app.get("/api/public/photo-messages/:slug",(req,res)=>{
  const event=eventBySlug(req.params.slug);
  if(!event||event.archived)return res.status(404).json({error:"Evento no encontrado."});
  /* Una invitación privada abierta mediante la vista previa autorizada debe
     resolver sus mensajes igual que /api/config, sin producir un 404 repetido. */
  if(!event.published&&!previewAllowed(req,event))return res.status(404).json({error:"Evento no encontrado."});
  const settings=settingsOf(event);
  if(!eventFeatureDecision(event,"guestPhotoMessages",{role:"public"}).allowed||settings.photoPolicy?.publishApprovedMessages===false)return res.json([]);
  res.json(db.prepare(`SELECT uploaded_by,table_name,message,created_at FROM photo_batches WHERE event_id=? AND status='approved' AND TRIM(COALESCE(message,''))<>'' ORDER BY created_at DESC LIMIT 100`).all(event.id));
});

app.get("/api/admin/photos",authRequired,eventAllowed,featureRequired("guestPhotoUpload"),(req,res)=>{
  const statusFilter=String(req.query.status||"");
  const tableFilter=cleanText(req.query.table||"",80);
  const conditions=["p.event_id=?"],params=[req.event.id];
  if(["pending","approved","hidden"].includes(statusFilter)){conditions.push("COALESCE(b.status,'pending')=?");params.push(statusFilter);}
  if(tableFilter){conditions.push("COALESCE(p.table_name,'')=?");params.push(tableFilter);}
  const rows=db.prepare(`
    SELECT p.id,p.original_name,p.mime_type,p.size_bytes,p.uploaded_by,p.table_name,p.created_at,p.batch_id,
           b.message,b.status moderation_status,b.guest_id,b.upload_key
    FROM photos p LEFT JOIN photo_batches b ON b.id=p.batch_id
    WHERE ${conditions.join(" AND ")} ORDER BY p.created_at DESC,p.id DESC
  `).all(...params);
  const counts=db.prepare(`SELECT COALESCE(b.status,'pending') status,COUNT(*) total FROM photos p LEFT JOIN photo_batches b ON b.id=p.batch_id WHERE p.event_id=? GROUP BY COALESCE(b.status,'pending')`).all(req.event.id);
  res.json({items:rows.map(row=>({...row,url:`/api/admin/photos/${row.id}/content?eventId=${req.event.id}`})),counts:Object.fromEntries(counts.map(row=>[row.status,Number(row.total)]))});
});

app.get("/api/admin/photos/:id/content",authRequired,eventAllowed,featureRequired("guestPhotoUpload"),(req,res)=>{
  const photo=db.prepare("SELECT * FROM photos WHERE id=? AND event_id=?").get(Number(req.params.id),req.event.id);
  if(!photo)return res.status(404).json({error:"Fotografía no encontrada.",code:"PHOTO_NOT_FOUND"});
  const file=path.join(guestPhotosDir,path.basename(photo.stored_name));
  if(!fs.existsSync(file))return res.status(410).json({error:"El archivo ya no existe en el almacenamiento.",code:"PHOTO_FILE_MISSING"});
  res.type(photo.mime_type).sendFile(file);
});

app.patch("/api/admin/photo-batches/:id",authRequired,eventAllowed,featureRequired("guestPhotoUpload"),(req,res)=>{
  const status=String(req.body.status||"");
  if(!["pending","approved","hidden"].includes(status))return res.status(400).json({error:"Estado de moderación inválido.",code:"STATUS_INVALID"});
  const info=db.prepare("UPDATE photo_batches SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?").run(status,Number(req.params.id),req.event.id);
  if(!info.changes)return res.status(404).json({error:"Lote no encontrado.",code:"PHOTO_BATCH_NOT_FOUND"});
  audit(req,"photo_batch.moderated",{eventId:req.event.id,targetType:"photo_batch",targetId:req.params.id,metadata:{status}});
  res.json({ok:true,status});
});

app.get("/api/admin/photos-export.zip",authRequired,eventAllowed,featureRequired("guestPhotoUpload"),(req,res,next)=>{
  try{
    const statusFilter=String(req.query.status||"approved"),tableFilter=cleanText(req.query.table||"",80);
    const conditions=["p.event_id=?"],params=[req.event.id];
    if(["pending","approved","hidden","all"].includes(statusFilter)&&statusFilter!=="all"){conditions.push("COALESCE(b.status,'pending')=?");params.push(statusFilter);}
    if(tableFilter){conditions.push("COALESCE(p.table_name,'')=?");params.push(tableFilter);}
    const rows=db.prepare(`SELECT p.* FROM photos p LEFT JOIN photo_batches b ON b.id=p.batch_id WHERE ${conditions.join(" AND ")} ORDER BY p.created_at,p.id`).all(...params);
    const filename=`fotos-${sanitize(req.event.slug||"evento")}-${statusFilter||"approved"}.zip`;
    res.type("application/zip");res.setHeader("Content-Disposition",`attachment; filename="${filename}"`);
    const archive=createZipArchive({zlib:{level:6}});archive.on("error",next);archive.pipe(res);
    const used=new Set();rows.forEach((photo,index)=>{const file=path.join(guestPhotosDir,path.basename(photo.stored_name));if(!fs.existsSync(file))return;let name=sanitize(photo.original_name||`foto-${index+1}.jpg`)||`foto-${index+1}.jpg`;if(used.has(name))name=`${index+1}-${name}`;used.add(name);archive.file(file,{name});});
    archive.finalize();
  }catch(error){next(error);}
});

app.delete("/api/admin/photos/:id",authRequired,eventAllowed,featureRequired("guestPhotoUpload"),(req,res)=>{
  const photo=db.prepare("SELECT * FROM photos WHERE id=? AND event_id=?").get(Number(req.params.id),req.event.id);
  if(!photo)return res.status(404).json({error:"Fotografía no encontrada.",code:"PHOTO_NOT_FOUND"});
  db.prepare("DELETE FROM photos WHERE id=?").run(photo.id);
  removeFiles([path.join(guestPhotosDir,path.basename(photo.stored_name))]);
  if(photo.batch_id&&!db.prepare("SELECT 1 FROM photos WHERE batch_id=? LIMIT 1").get(photo.batch_id))db.prepare("DELETE FROM photo_batches WHERE id=?").run(photo.batch_id);
  audit(req,"photo.deleted",{eventId:req.event.id,targetType:"photo",targetId:photo.id});
  res.json({ok:true});
});

// Developer mode
app.post("/api/admin/developer/test-invitation",authRequired,eventAllowed,ownerOnly,(req,res)=>{
  const e=currentEvent(req); const s=settingsOf(e);
  if((s.developer?.mode||"development")!=="development") return res.status(409).json({error:"Activa el modo desarrollador para generar invitaciones de prueba."});
  const adults=Math.max(0,Number(req.body.adults??2));
  const children=Math.max(0,Number(req.body.children??1));
  const family=String(req.body.family_name||"Familia de prueba").trim();
  let g=db.prepare("SELECT * FROM guests WHERE event_id=? AND is_test=1 LIMIT 1").get(e.id);
  if(g){
    db.prepare("UPDATE guests SET family_name=?,max_adults=?,max_children=?,status='pending' WHERE id=?").run(family,adults,children,g.id);
    db.prepare("DELETE FROM rsvps WHERE guest_id=?").run(g.id);
    g=db.prepare("SELECT * FROM guests WHERE id=?").get(g.id);
  } else {
    const info=db.prepare(`INSERT INTO guests (event_id,code,token,family_name,phone,max_adults,max_children,table_name,custom_message,is_test) VALUES (?,?,?,?,?,?,?,?,?,1)`).run(e.id,"TEST-001",makeToken(),family,"",adults,children,"Mesa demo","Esta es una invitación de prueba; no afecta las estadísticas de producción.");
    g=db.prepare("SELECT * FROM guests WHERE id=?").get(info.lastInsertRowid);
  }
  res.json({ok:true,url:invitationUrl(e,g.token),guest:g});
});

// Reports
function menuTotals(rows,key){const out={};rows.forEach(r=>{let obj={};try{obj=JSON.parse(r[key]||"{}")}catch{}Object.entries(obj).forEach(([k,v])=>out[k]=(out[k]||0)+Number(v||0));});return Object.entries(out).map(([MENU,CANTIDAD])=>({MENU,CANTIDAD}));}
function appendReportSheet(workbook,data,name){
  const safeData=data.length?data:[{SIN_DATOS:"Sin registros"}];
  const headers=Object.keys(safeData[0]);
  const sheet=workbook.addWorksheet(name,{views:[{state:"frozen",ySplit:1}]});
  sheet.columns=headers.map(header=>({
    header,key:header,
    width:Math.min(48,Math.max(12,header.length+2,...safeData.slice(0,200).map(row=>String(row[header]??"").length+2)))
  }));
  sheet.addRows(safeData);
  sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
  sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF7B2331"}};
  sheet.getRow(1).alignment={vertical:"middle"};
  sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
}
app.get("/api/admin/venue-report.xlsx",authRequired,eventAllowed,featureRequired("reports"),async(req,res,next)=>{
 try{
  const event=currentEvent(req);
  const settings=settingsOf(event);
  const rows=db.prepare(`
    SELECT g.family_name FAMILIA,g.table_name MESA,
      r.adults ADULTOS,r.children NINOS,
      r.adult_menu_counts,r.child_menu_counts,
      r.dietary RESTRICCIONES_ALIMENTARIAS,
      r.special_needs NECESIDADES_ESPECIALES,
      r.accessibility_options,r.accessibility_other,
      r.attendee_names ASISTENTES,r.responsible_name RESPONSABLE_CONFIRMACION,
      COALESCE(r.contact_phone,g.phone) TELEFONO
    FROM guests g JOIN rsvps r ON r.guest_id=g.id
    WHERE g.event_id=? AND r.attending=1 AND COALESCE(g.is_test,0)=0
    ORDER BY g.table_name,g.family_name
  `).all(event.id);
  const summary=[{
    FECHA_EVENTO:settings.event.dateLabel,
    LUGAR:settings.venue.name,
    FAMILIAS_CONFIRMADAS:rows.length,
    ADULTOS_CONFIRMADOS:rows.reduce((total,row)=>total+row.ADULTOS,0),
    NINOS_CONFIRMADOS:rows.reduce((total,row)=>total+row.NINOS,0),
    TOTAL_PERSONAS:rows.reduce((total,row)=>total+row.ADULTOS+row.NINOS,0)
  }];
  const detail=rows.map(row=>{
    let accessibility=[];
    try{accessibility=JSON.parse(row.accessibility_options||"[]");}catch{}
    const {
      adult_menu_counts,child_menu_counts,accessibility_options,accessibility_other,...visible
    }=row;
    return {
      ...visible,
      ACCESIBILIDAD:[...accessibility,accessibility_other].filter(Boolean).join(", ")
    };
  });
  const restrictions=detail.filter(row=>
    cleanText(row.RESTRICCIONES_ALIMENTARIAS)||
    cleanText(row.NECESIDADES_ESPECIALES)||
    cleanText(row.ACCESIBILIDAD)
  );
  const menus=[
    ...((settings.menus?.selectionEnabled&&settings.menus?.showAdultSelection!==false)?menuTotals(rows,"adult_menu_counts").map(row=>({TIPO:"Adulto",...row})):[]),
    ...menuTotals(rows,"child_menu_counts").map(row=>({TIPO:"Infantil",...row}))
  ];
  const invitations=db.prepare(`
    SELECT code CODIGO,family_name FAMILIA,phone TELEFONO,max_adults ADULTOS_RESERVADOS,max_children NINOS_RESERVADOS,
           table_name MESA,status ESTADO,delivery_status ENTREGA,sent_at ENVIADA_EN
    FROM guests WHERE event_id=? AND COALESCE(is_test,0)=0 ORDER BY family_name
  `).all(event.id);
  const pending=invitations.filter(row=>row.ESTADO==="pending");
  const declined=invitations.filter(row=>row.ESTADO==="declined");
  const tableRows=db.prepare(`
    SELECT COALESCE(NULLIF(g.table_name,''),'Sin mesa') MESA,
      COUNT(*) FAMILIAS,
      SUM(g.max_adults+g.max_children) LUGARES_PLANEADOS,
      COALESCE(SUM(CASE WHEN r.attending=1 THEN r.adults+r.children ELSE 0 END),0) PERSONAS_CONFIRMADAS
    FROM guests g LEFT JOIN rsvps r ON r.guest_id=g.id
    WHERE g.event_id=? AND COALESCE(g.is_test,0)=0 GROUP BY COALESCE(NULLIF(g.table_name,''),'Sin mesa') ORDER BY MESA
  `).all(event.id);
  const photoMessages=db.prepare(`
    SELECT uploaded_by NOMBRE,table_name MESA,message MENSAJE,status MODERACION,created_at FECHA
    FROM photo_batches WHERE event_id=? AND TRIM(COALESCE(message,''))<>'' ORDER BY created_at DESC
  `).all(event.id);
  const workbook=new ExcelJS.Workbook();
  workbook.creator="EventStudio";
  workbook.created=new Date();
  [[summary,"Resumen"],[invitations,"Invitaciones"],[detail,"Confirmados"],[pending,"Pendientes"],[declined,"No asistirán"],
   [tableRows,"Mesas"],[restrictions,"Restricciones"],[menus,"Menús"],[photoMessages,"Mensajes fotos"]]
    .forEach(([data,name])=>appendReportSheet(workbook,data,name));
  res.setHeader("Content-Disposition","attachment; filename=resumen_operativo_del_evento.xlsx");
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(Buffer.from(await workbook.xlsx.writeBuffer()));
 }catch(error){next(error);}
});
app.get("/api/admin/qr-templates",authRequired,(_req,res)=>res.json(qrTemplates));
app.get("/api/admin/qr",authRequired,eventAllowed,featureRequired("qrCards"),async(req,res)=>{const e=currentEvent(req),table=cleanText(req.query.table,120);const url=albumUrl(e,table),dataUrl=await QRCode.toDataURL(url,{margin:4,width:900,errorCorrectionLevel:"H"});res.json({table,url,dataUrl});});
app.get("/api/admin/qr.png",authRequired,eventAllowed,featureRequired("qrCards"),async(req,res)=>{const e=currentEvent(req),table=cleanText(req.query.table,120);const b=await QRCode.toBuffer(albumUrl(e,table),{type:"png",margin:4,width:1400,errorCorrectionLevel:"H"});res.setHeader("Content-Disposition",`attachment; filename="${table?`qr-${sanitize(table)}`:"qr-general"}.png"`);res.type("png").send(b);});
app.get("/api/admin/qr-card.pdf",authRequired,eventAllowed,featureRequired("qrCards"),async(req,res,next)=>{
  try{
    const event=currentEvent(req);
    const settings=settingsOf(event);
    const design=qrDesignOf(settings);
    const requestedTemplate=String(req.query.template||design.templateId||"classic-holder");
    const templateId=QR_TEMPLATE_IDS.has(requestedTemplate)?requestedTemplate:design.templateId;
    const table=cleanText(req.query.table,120);
    const template=qrTemplates.find(item=>item.id===templateId)||qrTemplates[0];
    const size=qrPageSize(template.format);
    const heroPath=printableImagePathFromUrl(settings.media?.heroImage);
    const url=albumUrl(event,table);
    const qr=await QRCode.toBuffer(url,{width:1200,margin:4,errorCorrectionLevel:"H"});
    const pdf=await renderPdfBuffer({size,margin:0},doc=>{
      drawQrCard(doc,{settings,table:table||"QR general",families:qrFamilies(event.id,table),qr,templateId,pageSize:template.format,heroPath});
    });
    if(req.user.role==="client")commerce.consumeLimitedGrant(event.id,"qrCards");
    res.setHeader("Content-Disposition",`attachment; filename="tarjeta-qr-${sanitize(table||"general")}.pdf"`);
    res.type("pdf").send(pdf);
  }catch(error){next(error);}
});

app.get("/api/admin/physical-invitation.pdf",authRequired,eventAllowed,featureRequired("physicalInvitations"),async(req,res,next)=>{
  try{
    const event=currentEvent(req);
    const guest=db.prepare(`
      SELECT id,family_name,max_adults,max_children,token
      FROM guests WHERE id=? AND event_id=? AND COALESCE(is_test,0)=0
    `).get(Number(req.query.guestId),event.id);
    if(!guest)return res.status(404).json({error:"Selecciona un invitado real del evento activo."});
    const settings=settingsOf(event);
    const requestedTemplate=String(req.query.template||settings.physicalInvitation?.templateId||"auto-theme");
    const templateId=PHYSICAL_TEMPLATE_IDS.has(requestedTemplate)?requestedTemplate:"auto-theme";
    const qr=await QRCode.toBuffer(invitationUrl(event,guest.token),{width:900,margin:3,errorCorrectionLevel:"H"});
    const heroPath=printableImagePathFromUrl(settings.media?.heroImage);
    const pdf=await renderPdfBuffer({
      size:[360,504],
      margin:0,
      info:{Title:`Invitación para ${presentedName(guest.family_name,settings.typography)}`}
    },doc=>drawPhysicalInvitation(doc,{settings,guest,qr,heroPath,templateId}));
    if(req.user.role==="client")commerce.consumeLimitedGrant(event.id,"physicalInvitations");
    res.setHeader("Content-Disposition",`attachment; filename="invitacion-fisica-${sanitize(guest.family_name)||"invitado"}.pdf"`);
    res.type("pdf").send(pdf);
  }catch(error){next(error);}
});

app.get("/api/admin/qr-set.pdf",authRequired,eventAllowed,featureRequired("qrCards"),async(req,res,next)=>{
  try{
    const event=currentEvent(req);
    const settings=settingsOf(event);
    const design=qrDesignOf(settings);
    const requestedTemplate=String(req.query.template||design.templateId||"classic-holder");
    const templateId=QR_TEMPLATE_IDS.has(requestedTemplate)?requestedTemplate:design.templateId;
    const template=qrTemplates.find(item=>item.id===templateId)||qrTemplates[0];
    const heroPath=printableImagePathFromUrl(settings.media?.heroImage);
    ensureEventTables(event.id);
    const tables=db.prepare("SELECT name FROM event_tables WHERE event_id=? ORDER BY order_index,id")
      .all(event.id).map(row=>row.name);
    const list=tables.length?tables:["QR general"];
    const size=qrPageSize(template.format);
    const pdf=await renderPdfBuffer({size,margin:0},async doc=>{
      for(let index=0;index<list.length;index++){
        if(index>0)doc.addPage({size,margin:0});
        const table=list[index];
        const url=albumUrl(event,table==="QR general"?"":table);
        const qr=await QRCode.toBuffer(url,{width:1200,margin:4,errorCorrectionLevel:"H"});
        drawQrCard(doc,{settings,table,families:qrFamilies(event.id,table==="QR general"?"":table),qr,templateId,pageSize:template.format,heroPath});
      }
    });
    if(req.user.role==="client")commerce.consumeLimitedGrant(event.id,"qrCards");
    res.setHeader("Content-Disposition",`attachment; filename="set-qr-${event.slug}-${templateId}.pdf"`);
    res.type("pdf").send(pdf);
  }catch(error){next(error);}
});

app.use((req,res)=>{
  if(req.path.startsWith("/api/"))return res.status(404).json({error:"Ruta de API no encontrada.",code:"API_NOT_FOUND"});
  res.status(404).send("Página no encontrada");
});

app.use((err,req,res,_next)=>{
  const uploadFiles=[...(req.files||[]),...(req.file?[req.file]:[])];
  const aborted=Boolean(req.aborted||err?.code==="ECONNRESET"||/request aborted|aborted|premature close/i.test(String(err?.message||"")));
  if(err instanceof multer.MulterError||aborted)removeFiles(uploadFiles);
  const statusCode=aborted?499:(Number(err.statusCode)||(err instanceof multer.MulterError?400:500));
  const code=String(aborted?"CLIENT_UPLOAD_ABORTED":(err.code||(err instanceof multer.MulterError?"UPLOAD_ERROR":"INTERNAL_ERROR")));
  log(statusCode>=500?"error":"warn","request.failed",{requestId:req.requestId,method:req.method,path:req.path,statusCode,code,message:err.message});
  if(res.headersSent||res.writableEnded)return;
  const message=aborted
    ?"La transferencia se interrumpió antes de terminar. Puedes volver a intentarlo."
    :(statusCode>=500&&IS_PRODUCTION?"Ocurrió un error interno. Conserva el identificador de solicitud.":(err.message||"Error inesperado."));
  res.status(statusCode).json({error:message,code,requestId:req.requestId});
});

try{
  const interrupted=backups.reconcileInterruptedBackups();
  if(interrupted)log("warn","backup.interrupted_reconciled",{count:interrupted});
}catch(error){log("error","backup.reconcile_failed",{message:error.message});}
try{syncExpiredLifecycle();}catch(error){log("error","lifecycle.sync_failed",{message:error.message});}
const lifecycleTimer=setInterval(()=>{
  try{syncExpiredLifecycle();}catch(error){log("error","lifecycle.sync_failed",{message:error.message});}
},6*60*60*1000);
lifecycleTimer.unref();

const server=app.listen(PORT,HOST,()=>log("info","server.started",{host:HOST,port:PORT,siteUrl:SITE_URL,environment:process.env.NODE_ENV||"development"}));
function shutdown(signal){
  log("info","server.shutdown",{signal});
  clearInterval(lifecycleTimer);
  server.close(()=>{try{db.close();}catch{}process.exit(0);});
  setTimeout(()=>process.exit(1),10000).unref();
}
process.once("SIGTERM",()=>shutdown("SIGTERM"));
process.once("SIGINT",()=>shutdown("SIGINT"));
