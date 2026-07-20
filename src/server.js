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
const db=require("./db");
const themes=require("../config/themes.json");
const qrTemplates=require("../config/qr-templates.json");
const eventTypes=require("../config/event-types.json");
const defaultSettings=require("../config/default-settings.json");
const {normalizeFeatureSettings,featureDecision,featureOverview}=require("./features");
const {log,audit}=require("./logger");
const messaging=require("./messaging");
const backups=require("./backup");

const app=express();
const PORT=Number(process.env.PORT||3000);
const IS_PRODUCTION=process.env.NODE_ENV==="production";
const SESSION_SECRET=String(process.env.SESSION_SECRET||(IS_PRODUCTION?"":"eventstudio-local-development-only-secret"));
const SESSION_HOURS=Math.max(1,Number(process.env.SESSION_HOURS||12));
const SESSION_COOKIE=String(process.env.SESSION_COOKIE||"eventstudio_session");
const SITE_URL=(process.env.SITE_URL||`http://localhost:${PORT}`).replace(/\/$/,"");
const MAX_UPLOAD_MB=Number(process.env.MAX_UPLOAD_MB||25);
const PAYMENT_PROVIDER=process.env.PAYMENT_PROVIDER||"disabled";
const GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID||"";
const TRIAL_DAYS=Number(process.env.TRIAL_DAYS||7);
const ALLOW_PUBLIC_REGISTRATION=String(process.env.ALLOW_PUBLIC_REGISTRATION||(!IS_PRODUCTION)).toLowerCase()==="true";
const ENABLE_DEMO_PAYMENTS=!IS_PRODUCTION&&String(process.env.ENABLE_DEMO_PAYMENTS||"false").toLowerCase()==="true";
const ENABLE_AUTOMATIC_PURGE=String(process.env.ENABLE_AUTOMATIC_PURGE||"false").toLowerCase()==="true";
const root=path.join(__dirname,"..");
const publicDir=path.join(root,"public");
const storageRoot=process.env.STORAGE_ROOT?path.resolve(process.env.STORAGE_ROOT):root;
const uploadsDir=process.env.UPLOADS_DIR?path.resolve(process.env.UPLOADS_DIR):path.join(storageRoot,"uploads");
const guestPhotosDir=path.join(uploadsDir,"guest-photos");
const siteMediaDir=path.join(uploadsDir,"site-media");
const tempDir=path.join(storageRoot,"data","temp");
[guestPhotosDir,siteMediaDir,tempDir].forEach(d=>fs.mkdirSync(d,{recursive:true}));

if(IS_PRODUCTION){
  if(SESSION_SECRET.length<32)throw new Error("SESSION_SECRET debe tener al menos 32 caracteres en producción.");
  if(!SITE_URL.startsWith("https://"))throw new Error("SITE_URL debe usar HTTPS en producción.");
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
  `).run(email,bcrypt.hashSync(password,12),cleanText(process.env.INITIAL_OWNER_NAME||"Propietario Event Studio",120),email);
  log("info","initial_owner_created",{email});
}
ensureInitialOwner();

if(String(process.env.TRUST_PROXY||"").toLowerCase()==="true")app.set("trust proxy",1);
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
  crossOriginResourcePolicy:{policy:"same-site"},
  contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"],scriptSrc:["'self'","https://open.spotify.com"],styleSrc:["'self'","'unsafe-inline'"],
    imgSrc:["'self'","data:","blob:","https:"],mediaSrc:["'self'","blob:"],
    connectSrc:["'self'","https://api.spotify.com","https://accounts.spotify.com"],
    frameSrc:["'self'","https://open.spotify.com"],fontSrc:["'self'","data:"],objectSrc:["'none'"],
    baseUri:["'self'"],formAction:["'self'"],frameAncestors:["'self'"]
  }}
}));
app.use(compression());
app.use(express.json({limit:"4mb",verify:(req,_res,buffer)=>{req.rawBody=Buffer.from(buffer);}}));
app.use(express.urlencoded({extended:true}));
app.use((req,res,next)=>{
  if(req.path.startsWith("/api/auth/")||req.path.startsWith("/api/admin/")||req.path.startsWith("/api/invitation/"))res.setHeader("Cache-Control","no-store");
  next();
});
app.use("/uploads/site-media",express.static(siteMediaDir,{immutable:true,maxAge:"1d",fallthrough:false}));
app.use(express.static(publicDir,{etag:true,maxAge:IS_PRODUCTION?"1h":0}));

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
  settings.couple={partner1:"",partner2:"",displayName:name};
  settings.event={dateTime:"",dateLabel:"Fecha por confirmar",heroMessage:"",closingMessage:""};
  settings.story={...(settings.story||{}),text:""};
  settings.venue={title:"Lugar del evento",name:"",ceremonyTime:"",receptionTime:"",address:"",mapsUrl:"",notes:""};
  settings.venues={
    samePlace:true,
    ceremony:{title:"Ceremonia",name:"",time:"",address:"",mapsUrl:"",lat:"",lng:"",notes:""},
    reception:{title:"Celebración",name:"",time:"",address:"",mapsUrl:"",lat:"",lng:"",notes:""}
  };
  settings.agenda={enabled:true,sameLocation:true,items:[]};
  settings.media={...(settings.media||{}),heroImage:"",music:"",gallery:[],spotifyUrl:"",spotifyUri:"",spotifyTrackName:"",spotifyArtists:"",spotifyDurationMs:0,spotifyStartSeconds:0,musicSource:"none",musicStartSeconds:0};
  settings.event.eventType=eventType;
  settings.developer={mode:"production",showBanner:false,ownerOnly:true};
  return settings;
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
    /* La ruta del archivo sólo puede cambiar mediante el endpoint de carga. */
    music:current.music||"",
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

function mediaPathFromUrl(url){
  const raw=String(url||"");
  if(!raw.startsWith("/uploads/"))return null;
  const relative=raw.slice("/uploads/".length);
  const resolved=path.resolve(uploadsDir,relative);
  const uploadsRoot=path.resolve(uploadsDir);
  return resolved===uploadsRoot||resolved.startsWith(`${uploadsRoot}${path.sep}`)?resolved:null;
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
  const limitMb=entitlement?.max_storage_mb||2048;
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
  const graceDays=15;
  const expired=db.prepare(`
    SELECT DISTINCT e.id,s.ends_at
    FROM events e
    JOIN user_events ue ON ue.event_id=e.id
    JOIN subscriptions s ON s.user_id=ue.user_id
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
  expired.forEach(row=>mark.run(row.ends_at,row.ends_at,graceDays,row.ends_at,graceDays,row.id));

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

function normalizePhone(v){ let p=String(v||"").replace(/\D/g,""); if(p.length===10)p="52"+p; return p; }
function invitationUrl(event,token){ return `${SITE_URL}/e/${event.slug}?i=${encodeURIComponent(token)}`; }
function albumUrl(event,table=""){ return `${SITE_URL}/album.html?e=${encodeURIComponent(event.slug)}${table?`&mesa=${encodeURIComponent(table)}`:""}`; }

function attendeeNameList(value){
  return String(value||"")
    .split(/\r?\n|,|;|\s+y\s+/i)
    .map(name=>cleanText(name,120))
    .filter(Boolean);
}

function seatingPeople(eventId,{confirmedOnly=false}={}){
  const rows=db.prepare(`
    SELECT g.id guest_id,g.family_name,g.status,g.max_adults,g.max_children,g.table_name,
           r.attending,r.adults,r.children,r.attendee_names
    FROM guests g
    LEFT JOIN rsvps r ON r.guest_id=g.id
    WHERE g.event_id=? AND COALESCE(g.is_test,0)=0
    ORDER BY g.family_name,g.id
  `).all(eventId);
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
        legacyTable:row.table_name||""
      });
    }
    for(let index=0;index<children;index++){
      people.push({
        guestId:row.guest_id,personKey:`child-${index+1}`,
        name:names[adults+index]||`${row.family_name} · Niño ${index+1}`,
        family:row.family_name,type:"child",status:confirmedOnly?"confirmed":planStatus,
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
  const people=[...seatingPeople(eventId),...seatingPeople(eventId,{confirmedOnly:true})]
    .filter((person,index,list)=>list.findIndex(item=>item.guestId===person.guestId&&item.personKey===person.personKey)===index);
  const tables=db.prepare("SELECT * FROM event_tables WHERE event_id=? ORDER BY order_index,id").all(eventId);
  const byName=new Map(tables.map(table=>[String(table.name).trim().toLowerCase(),table]));
  const assignedKeys=new Set();
  const occupiedByTable=new Map(tables.map(table=>[table.id,new Set()]));
  db.prepare("SELECT guest_id,person_key,table_id,seat_index FROM seating_assignments WHERE event_id=?").all(eventId).forEach(row=>{
    assignedKeys.add(`${row.guest_id}:${row.person_key}`);
    if(occupiedByTable.has(row.table_id))occupiedByTable.get(row.table_id).add(row.seat_index);
  });
  const insert=db.prepare(`
    INSERT OR IGNORE INTO seating_assignments(event_id,guest_id,person_key,table_id,seat_index)
    VALUES(?,?,?,?,?)
  `);
  db.transaction(()=>people.forEach(person=>{
    if(assignedKeys.has(`${person.guestId}:${person.personKey}`))return;
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

const THEME_PALETTES={
  "romantic-wine":{bg:"#fffaf4",paper:"#fffdf9",ink:"#302824",accent:"#7b2331",gold:"#b59464",muted:"#766a62"},
  "botanical-ivory":{bg:"#f4f5ef",paper:"#fffef9",ink:"#26352d",accent:"#4f705a",gold:"#ad9467",muted:"#68746c"},
  "midnight-gold":{bg:"#111827",paper:"#182235",ink:"#f7f0df",accent:"#c8a65a",gold:"#e4c77f",muted:"#c9c0ad"},
  "terracotta-sunset":{bg:"#f4e6dc",paper:"#fff8f2",ink:"#4b2e25",accent:"#b85f44",gold:"#c69b61",muted:"#82675d"},
  "minimal-pearl":{bg:"#f4f4f2",paper:"#ffffff",ink:"#292929",accent:"#69655f",gold:"#aaa18f",muted:"#707070"},
  "mayan-elegance":{bg:"#e8e2d6",paper:"#f7f2e8",ink:"#25392f",accent:"#2f6652",gold:"#9d7f45",muted:"#667168"},
  "rose-garden":{bg:"#f8ecec",paper:"#fffafa",ink:"#4a2c32",accent:"#a95466",gold:"#c1a06d",muted:"#806870"},
  "ocean-silk":{bg:"#e8f0f0",paper:"#fafdff",ink:"#203f46",accent:"#2d6870",gold:"#b79a68",muted:"#657b7f"},
  "lavender-dream":{bg:"#f0ebf6",paper:"#fdfbff",ink:"#403549",accent:"#80669a",gold:"#b8a071",muted:"#756c7d"},
  "black-tie":{bg:"#111111",paper:"#f9f6ef",ink:"#171717",accent:"#111111",gold:"#c7a96b",muted:"#66615b"},
  "mexican-bougainvillea":{bg:"#f8e8e5",paper:"#fff9f3",ink:"#4c2934",accent:"#a82f63",gold:"#c28b55",muted:"#82636c"},
  "forest-candlelight":{bg:"#17251f",paper:"#f6f0e4",ink:"#26362e",accent:"#365c47",gold:"#c49551",muted:"#70766f"}
  ,"editorial-arch":{bg:"#eee8db",paper:"#fffdf8",ink:"#302d26",accent:"#a77c12",gold:"#c8a551",muted:"#766f63"},
  "lavender-couture":{bg:"#f2edf8",paper:"#fffaff",ink:"#44364f",accent:"#8a62a8",gold:"#b99a72",muted:"#776b80"},
  "cinematic-vows":{bg:"#161412",paper:"#f8f3ea",ink:"#25201b",accent:"#8d6928",gold:"#d1ad62",muted:"#756d65"},
  "storybook-seal":{bg:"#efe4d2",paper:"#fffaf0",ink:"#453126",accent:"#8b3540",gold:"#b38a4e",muted:"#77685c"},
  "botanical-scroll":{bg:"#edf1e8",paper:"#fffdf6",ink:"#2d3c31",accent:"#55725b",gold:"#ad9464",muted:"#6d786e"}
};

function qrPalette(settings){
  return THEME_PALETTES[settings.themeId]||THEME_PALETTES["romantic-wine"];
}

function qrDesignOf(settings){
  return {
    templateId:"classic-holder",
    title:"Captura nuestros recuerdos",
    message:"Escanea el código y comparte las fotografías que tomes durante la celebración.",
    instruction:"No necesitas instalar ninguna aplicación.",
    showTableName:true,
    useInvitationColors:true,
    ...(settings.qrDesign||{})
  };
}

function qrFamilies(eventId,table){
  if(!String(table||"").trim())return [];
  return db.prepare(`
    SELECT family_name FROM guests
    WHERE event_id=? AND COALESCE(is_test,0)=0 AND LOWER(TRIM(COALESCE(table_name,'')))=LOWER(TRIM(?))
    ORDER BY family_name LIMIT 12
  `).all(eventId,table).map(row=>row.family_name);
}

function drawDecorativeCorners(doc,palette,x,y,w,h,templateId){
  doc.save();
  doc.lineWidth(1);
  if(templateId==="botanical-card"||templateId==="classic-holder"||templateId==="photo-frame"){
    doc.strokeColor(palette.gold).moveTo(x+16,y+42).bezierCurveTo(x+28,y+14,x+52,y+18,x+68,y+8).stroke();
    doc.fillColor(palette.accent).circle(x+25,y+28,3).fill();
    doc.fillColor(palette.gold).circle(x+44,y+20,2.5).fill();
    doc.strokeColor(palette.gold).moveTo(x+w-16,y+h-42).bezierCurveTo(x+w-28,y+h-14,x+w-52,y+h-18,x+w-68,y+h-8).stroke();
  }else if(templateId==="mayan-frame"){
    doc.strokeColor(palette.gold).lineWidth(2);
    doc.rect(x+12,y+12,18,18).stroke();
    doc.rect(x+w-30,y+12,18,18).stroke();
    doc.rect(x+12,y+h-30,18,18).stroke();
    doc.rect(x+w-30,y+h-30,18,18).stroke();
  }
  doc.restore();
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

function registerPdfFonts(doc){
  doc.registerFont("EventSans",path.join(publicDir,"fonts","montserrat-400.ttf"));
  doc.registerFont("EventSansBold",path.join(publicDir,"fonts","montserrat-600.ttf"));
  doc.registerFont("EventSerif",path.join(publicDir,"fonts","cormorant-garamond-400.ttf"));
  doc.registerFont("EventSerifBold",path.join(publicDir,"fonts","cormorant-garamond-600.ttf"));
}

function pdfFont(font){
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

function drawStandardQrCard(doc,{settings,table,families=[],qr,templateId,pageSize,palette,bg,ink,darkBackground}){
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
  drawDecorativeCorners(doc,palette,frame.x,frame.y,frame.w,frame.h,templateId);

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
  drawBoundedText(doc,settings.couple?.displayName||"Nuestro evento",{
    x:frame.x+24,y:layout.couple.y+familyCoupleOffset,width:frame.w-48,height:layout.couple.h,
    font:"Times-Bold",size:layout.couple.size,minSize:8,color:ink
  });
  drawBoundedText(doc,settings.event?.dateLabel||"",{
    x:frame.x+24,y:layout.date.y+familyDateOffset,width:frame.w-48,height:layout.date.h,
    font:"Helvetica",size:layout.date.size,minSize:6,color:darkBackground?"#f1e9dc":palette.muted
  });
}

function drawFoldPanel(doc,{settings,table,families=[],qr,palette,ink,darkBackground,x,y,w,h}){
  const design=qrDesignOf(settings);
  const leftX=x+28;
  const leftW=w-235;
  const qrSize=148;
  const qrX=x+w-28-qrSize;
  const qrY=y+61;

  doc.roundedRect(x,y,w,h,16).lineWidth(1.25).strokeColor(palette.gold).stroke();
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
  drawBoundedText(doc,settings.couple?.displayName||"Nuestro evento",{
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

function drawQrCard(doc,{settings,table,families=[],qr,templateId,pageSize}){
  const palette=qrPalette(settings);
  const pageW=doc.page.width;
  const pageH=doc.page.height;
  const darkBackground=templateId==="double-sided-premium"||settings.themeId==="midnight-gold";
  const bg=templateId==="double-sided-premium"?palette.accent:(darkBackground?palette.bg:palette.paper);
  const ink=darkBackground?"#ffffff":palette.ink;
  if(pageSize!=="letter-fold"){
    drawStandardQrCard(doc,{settings,table,families,qr,templateId,pageSize,palette,bg,ink,darkBackground});
    return;
  }

  doc.rect(0,0,pageW,pageH).fill(bg);
  const panel={x:36,w:pageW-72,h:342};
  doc.save();
  doc.rotate(180,{origin:[pageW/2,pageH/4]});
  drawFoldPanel(doc,{settings,table,families,qr,palette,ink,darkBackground,...panel,y:27});
  doc.restore();
  drawFoldPanel(doc,{settings,table,families,qr,palette,ink,darkBackground,...panel,y:423});
  doc.save().dash(5,{space:5}).strokeColor(darkBackground?"#ffffff":palette.muted).strokeOpacity(darkBackground?0.5:1)
    .moveTo(30,pageH/2).lineTo(pageW-30,pageH/2).stroke().undash().restore();
  drawBoundedText(doc,"DOBLAR",{
    x:pageW-78,y:pageH/2-5,width:45,height:10,font:"Helvetica-Bold",size:6,minSize:6,
    color:darkBackground?"#ffffff":palette.muted,align:"right"
  });
}

function physicalThemeFamily(themeId){
  if(["cinematic-vows","midnight-gold","black-tie"].includes(themeId))return "cinematic";
  if(["botanical-scroll","forest-candlelight","botanical-cream","rose-garden","mexican-bougainvillea"].includes(themeId))return "botanical";
  if(["storybook-seal","romantic-wine","mayan-cenote"].includes(themeId))return "storybook";
  if(["lavender-couture","lavender-dream"].includes(themeId))return "lavender";
  return "editorial";
}

function drawAutoPhysicalMotif(doc,{family,palette,pageW,pageH}){
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
  }else{
    doc.moveTo(26,20).bezierCurveTo(110,3,pageW-110,3,pageW-26,20).lineWidth(.7).strokeColor(palette.gold).stroke();
  }
  doc.restore();
}

function drawPhysicalInvitation(doc,{settings,guest,qr,heroPath,templateId="auto-theme"}){
  const palette=qrPalette(settings);
  const autoFamily=templateId==="auto-theme"?physicalThemeFamily(settings.themeId):"";
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
  if(templateId==="auto-theme")drawAutoPhysicalMotif(doc,{family:autoFamily,palette,pageW,pageH});

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
  drawBoundedText(doc,settings.couple?.displayName||"Nuestro evento",{
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
  drawBoundedText(doc,guest.family_name,{
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
  drawBoundedText(doc,settings.venue?.title||"CEREMONIA Y CELEBRACIÓN",{
    x:35,y:365,width:185,height:12,font:"Helvetica-Bold",size:6.5,minSize:5.8,color:palette.gold,
    align:"left",characterSpacing:.8
  });
  drawBoundedText(doc,settings.venue?.name||"Lugar por confirmar",{
    x:35,y:384,width:185,height:35,font:"Times-Bold",size:12,minSize:8.5,color:palette.ink,align:"left",lineGap:1
  });
  drawBoundedText(doc,settings.venue?.address||"",{
    x:35,y:424,width:185,height:28,font:"Helvetica",size:7.2,minSize:6,color:palette.muted,align:"left",lineGap:1
  });
  drawBoundedText(doc,"Esta tarjeta acompaña la versión digital personalizada.",{
    x:35,y:462,width:185,height:18,font:"Helvetica-Oblique",size:6.2,minSize:5.8,color:palette.muted,align:"left"
  });
}

const SEATING_ZONE_LABELS={
  dance_floor:"Pista de baile",stage:"Escenario",entrance:"Entrada",bar:"Bar",
  aisle:"Pasillo",restrooms:"Sanitarios",other:"Área especial"
};

function seatingModeLabel(mode){return mode==="confirmed"?"Sólo personas confirmadas":"Todos los lugares planeados";}

function drawSeatingPdfPageHeader(doc,{settings,snapshot,palette,title="Plano y distribución de mesas",subtitle=""}){
  const pageW=doc.page.width;
  doc.rect(0,0,pageW,72).fill(palette.accent);
  drawBoundedText(doc,settings.couple?.displayName||settings._event?.name||"Evento",{
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
  doc.font("EventSans").fontSize(1).fillColor("#ffffff").text(`EVENTSTUDIO_SEATING_${snapshot.mode.toUpperCase()}`,1,pageH-2,{lineBreak:false});
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
      doc.font("EventSans").fontSize(7.5);
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
    doc.font("EventSans").fontSize(7.5);
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

function whatsappUrl(event,g){ const s=settingsOf(event); const p=normalizePhone(g.phone); const places=[g.max_adults?`${g.max_adults} adulto(s)`:"",g.max_children?`${g.max_children} niño(s)`:""].filter(Boolean).join(" y "); const text=[`Hola, ${g.family_name} ❤️`,"",`Con mucha emoción queremos compartirles la invitación a ${s.couple.displayName}.`,places?`Hemos reservado ${places} para ustedes.`:"",g.custom_message||"","","Aquí pueden consultar los detalles y confirmar su asistencia:",invitationUrl(event,g.token)].filter(Boolean).join("\n"); return p?`https://wa.me/${p}?text=${encodeURIComponent(text)}`:""; }
function safeName(n){ const ext=path.extname(n).toLowerCase(); const base=sanitize(path.basename(n,ext))||"archivo"; return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${base}${ext}`; }

const photoUpload=multer({storage:multer.diskStorage({destination:guestPhotosDir,filename:(_r,f,cb)=>cb(null,safeName(f.originalname))}),limits:{fileSize:MAX_UPLOAD_MB*1024*1024,files:20},fileFilter:(_r,f,cb)=>{const ok=["image/jpeg","image/png","image/webp","image/heic","image/heif"].includes(f.mimetype);cb(ok?null:new Error("Sólo fotografías."),ok);}});
const mediaUpload=multer({storage:multer.diskStorage({destination:siteMediaDir,filename:(_r,f,cb)=>cb(null,safeName(f.originalname))}),limits:{fileSize:70*1024*1024,files:30},fileFilter:(_r,f,cb)=>{const ok=f.mimetype.startsWith("image/")||f.mimetype.startsWith("audio/");cb(ok?null:new Error("Sólo imágenes o audio."),ok);}});
const excelUpload=multer({dest:tempDir,limits:{fileSize:8*1024*1024,files:1},fileFilter:(_r,f,cb)=>{const ok=/\.(xlsx|csv)$/i.test(f.originalname);cb(ok?null:new Error("Usa un archivo .xlsx o .csv."),ok);}});

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
  const extension={"image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/heic":".heic","audio/mpeg":".mp3","audio/ogg":".ogg","audio/wav":".wav","audio/flac":".flac","audio/mp4":".m4a"}[mime];
  const base=path.basename(file.filename,path.extname(file.filename));
  const nextName=`${base}${extension}`;
  const nextPath=path.join(path.dirname(file.path),nextName);
  if(nextPath!==file.path)fs.renameSync(file.path,nextPath);
  file.filename=nextName;file.path=nextPath;file.mimetype=mime;
  return file;
}


let spotifyTokenCache={token:"",expiresAt:0};

async function spotifyAccessToken(){
  const clientId=String(process.env.SPOTIFY_CLIENT_ID||"").trim();
  const clientSecret=String(process.env.SPOTIFY_CLIENT_SECRET||"").trim();
  if(!clientId||!clientSecret)return null;
  if(spotifyTokenCache.token&&spotifyTokenCache.expiresAt>Date.now()+60000){
    return spotifyTokenCache.token;
  }

  const auth=Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response=await fetch("https://accounts.spotify.com/api/token",{
    method:"POST",
    headers:{
      "Authorization":`Basic ${auth}`,
      "Content-Type":"application/x-www-form-urlencoded"
    },
    body:"grant_type=client_credentials"
  });
  if(!response.ok)throw new Error(`Spotify token ${response.status}`);
  const data=await response.json();
  spotifyTokenCache={
    token:data.access_token,
    expiresAt:Date.now()+Number(data.expires_in||3600)*1000
  };
  return spotifyTokenCache.token;
}

function spotifyTrackResult(track){
  return {
    id:track.id,
    name:track.name,
    artists:(track.artists||[]).map(artist=>artist.name).join(", "),
    album:track.album?.name||"",
    image:track.album?.images?.[1]?.url||track.album?.images?.[0]?.url||"",
    durationMs:track.duration_ms||0,
    url:track.external_urls?.spotify||"",
    uri:track.uri||""
  };
}

// Public event routes
app.get("/e/:slug",(req,res)=>{
  const event=eventBySlug(req.params.slug);
  if(!event||event.archived)return res.status(404).send("Evento no encontrado");
  const preview=req.query.preview==="1"&&userCanAccessEvent(currentUser(req),event.id);
  const invitationAllowed=featureDecision(settingsOf(event),"invitation",{role:"public",planCode:eventEntitlement(event)?.plan_code||"studio"}).allowed;
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
    SELECT u.id,u.email,u.phone,u.display_name,u.role,u.active,u.auth_provider,u.company_name,u.must_change_password
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
           p.id plan_id,p.code plan_code,p.name plan_name,p.max_events,p.max_guests,p.max_storage_mb
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
    const entitlement=eventEntitlement(req.event);
    const decision=featureDecision(settingsOf(req.event),key,{role:req.user.role,planCode:entitlement?.plan_code||"studio"});
    if(!decision.allowed)return res.status(403).json({error:"Este módulo no está habilitado para el evento o plan actual.",code:"FEATURE_UNAVAILABLE",feature:key,reason:decision.reason});
    req.featureDecision=decision;
    next();
  };
}

app.use((req,res,next)=>{
  if(!["POST","PUT","PATCH","DELETE"].includes(req.method))return next();
  if(req.path==="/api/messaging/webhook")return next();
  const usesCookie=Boolean(cookiesOf(req)[SESSION_COOKIE])&&!req.headers.authorization;
  const origin=req.headers.origin;
  if(!usesCookie||!origin)return next();
  let expected="";try{expected=new URL(SITE_URL).origin;}catch{}
  if(origin!==expected)return res.status(403).json({error:"Origen de solicitud no permitido.",code:"CSRF_ORIGIN"});
  next();
});


app.get("/api/public/auth-options",(_req,res)=>{
  res.json({googleEnabled:Boolean(GOOGLE_CLIENT_ID),paymentProvider:ENABLE_DEMO_PAYMENTS?"demo":"disabled",trialDays:TRIAL_DAYS,registrationEnabled:ALLOW_PUBLIC_REGISTRATION});
});

app.get("/api/public/plans",(_req,res)=>{
  if(!ALLOW_PUBLIC_REGISTRATION)return res.status(404).json({error:"Registro público deshabilitado.",code:"REGISTRATION_DISABLED"});
  res.json(db.prepare("SELECT id,code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb FROM plans WHERE active=1 ORDER BY price_cents").all());
});

const registrationAttempts=new Map();
function registrationRateStatus(req){
  const key=String(req.ip||"unknown");const now=Date.now();const windowMs=60*60*1000;const previous=registrationAttempts.get(key);
  if(!previous||now-previous.startedAt>windowMs){const fresh={count:0,startedAt:now};registrationAttempts.set(key,fresh);return fresh;}
  return previous;
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
  if(!displayName || (!rawEmail && !phone) || password.length<12 || req.body.acceptTerms!==true){
    return res.status(400).json({error:"Escribe tu nombre, correo o teléfono, una contraseña de al menos 12 caracteres y acepta iniciar la prueba."});
  }
  const identifier=rawEmail||phone;
  const email=rawEmail||`phone-${phone}@local.invalid`;
  if(db.prepare("SELECT id FROM users WHERE lower(email)=? OR phone=? OR login_identifier=?").get(email,phone,identifier)){
    return res.status(409).json({error:"Ya existe una cuenta con esos datos."});
  }
  const plan=db.prepare("SELECT * FROM plans WHERE code=? AND active=1").get(planCode) || db.prepare("SELECT * FROM plans WHERE code='basic'").get();
  const settings=JSON.parse(JSON.stringify(defaultSettings));
  settings.couple.displayName=`Evento de ${displayName}`;
  const tx=db.transaction(()=>{
    const userInfo=db.prepare("INSERT INTO users(email,phone,login_identifier,password_hash,display_name,role,auth_provider) VALUES(?,?,?,?,?,'client','local')")
      .run(email,phone||null,identifier,bcrypt.hashSync(password,12),displayName);
    const slug=`evento-${slugify(displayName)}-${Date.now().toString().slice(-5)}`;
    const eventInfo=db.prepare(`
      INSERT INTO events(slug,name,settings_json,event_type,owner_user_id,published,protected)
      VALUES(?,?,?,?,?,0,0)
    `).run(slug,`Evento de ${displayName}`,JSON.stringify(settings),"custom",userInfo.lastInsertRowid);
    db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,'manage')").run(userInfo.lastInsertRowid,eventInfo.lastInsertRowid);
    db.prepare("INSERT INTO subscriptions(user_id,plan_id,status,ends_at) VALUES(?,?, 'trial', datetime('now', ?))")
      .run(userInfo.lastInsertRowid,plan.id,`+${TRIAL_DAYS} days`);
    return {userId:userInfo.lastInsertRowid,eventId:eventInfo.lastInsertRowid};
  });
  const created=tx();
  const token=createSession(created.userId);
  setSessionCookie(res,token);
  audit(req,"auth.register",{targetType:"user",targetId:created.userId,metadata:{eventId:created.eventId}});
  res.status(201).json({ok:true,...(!IS_PRODUCTION?{token}:{}),user:{id:created.userId,email:rawEmail,phone,displayName,role:'client'},eventId:created.eventId,billing:{status:'trial',paid:false}});
});

app.post("/api/auth/google",(_req,res)=>{
  if(!GOOGLE_CLIENT_ID)return res.status(503).json({error:"El acceso con Google aún no está configurado. Agrega GOOGLE_CLIENT_ID y el flujo OAuth antes de producción."});
  res.status(501).json({error:"El endpoint OAuth está preparado, pero requiere configurar las credenciales y callback del dominio definitivo."});
});

const loginAttempts=new Map();
function loginRateKey(req,identifier){return `${req.ip}:${String(identifier).slice(0,120)}`;}
function loginRateStatus(key){
  const now=Date.now();const windowMs=15*60*1000;const row=loginAttempts.get(key);
  if(!row||now-row.startedAt>windowMs){const fresh={count:0,startedAt:now};loginAttempts.set(key,fresh);return fresh;}
  return row;
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
  res.json({...(!IS_PRODUCTION?{token}:{}),user:{id:user.id,email:user.email,displayName:user.display_name,role:user.role,mustChangePassword:Boolean(user.must_change_password)}});
});

app.post("/api/auth/logout",authRequired,(req,res)=>{
  db.prepare("DELETE FROM sessions WHERE token=?").run(req.user._sessionDigest);
  clearSessionCookie(res);
  audit(req,"auth.logout",{targetType:"user",targetId:req.user.id});
  res.json({ok:true});
});

app.get("/api/auth/me",authRequired,(req,res)=>res.json(req.user));

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
  const revenue=db.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM payments WHERE status='paid'").get().total;
  const trials=db.prepare("SELECT COUNT(*) total FROM subscriptions WHERE status='trial' AND datetime(ends_at)>datetime('now')").get().total;
  res.json({...totals,events,revenue_cents:revenue,active_trials:trials});
});

app.get("/api/admin/clients",authRequired,ownerOnly,(_req,res)=>{
  res.json(db.prepare(`
    SELECT u.id,u.display_name,u.email,u.phone,u.active,u.last_login_at,u.created_at,
      p.code plan_code,p.name plan_name,s.status subscription_status,s.ends_at,
      COUNT(DISTINCT ue.event_id) event_count,
      COALESCE(SUM(CASE WHEN pay.status='paid' THEN pay.amount_cents ELSE 0 END),0) paid_cents
    FROM users u
    LEFT JOIN user_events ue ON ue.user_id=u.id
    LEFT JOIN subscriptions s ON s.id=(SELECT s2.id FROM subscriptions s2 WHERE s2.user_id=u.id ORDER BY s2.id DESC LIMIT 1)
    LEFT JOIN plans p ON p.id=s.plan_id
    LEFT JOIN payments pay ON pay.user_id=u.id
    WHERE u.role='client'
    GROUP BY u.id ORDER BY u.created_at DESC
  `).all());
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
    return Number(info.lastInsertRowid);
  })();
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
  res.json({
    role:req.user.role,
    isPlatformUser:["owner","developer"].includes(req.user.role),
    entitlement,
    subscriptionUsable:subscriptionUsable(entitlement),
    eventCount,
    canCreateEvent:["owner","developer"].includes(req.user.role) ||
      (subscriptionUsable(entitlement) && eventCount<(entitlement?.max_events||0))
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
  const subscription=db.prepare(`SELECT s.*,p.code,p.name,p.price_cents,p.currency,p.duration_days,p.max_events,p.max_guests,p.max_storage_mb FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.id DESC LIMIT 1`).get(req.user.id);
  const payments=db.prepare("SELECT id,provider,provider_reference,amount_cents,currency,status,paid_at,created_at FROM payments WHERE user_id=? ORDER BY id DESC").all(req.user.id);
  const plans=db.prepare("SELECT id,code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb FROM plans WHERE active=1 ORDER BY price_cents").all();
  res.json({subscription,payments,plans,provider:ENABLE_DEMO_PAYMENTS?PAYMENT_PROVIDER:"disabled"});
});

app.post("/api/billing/checkout",authRequired,(req,res)=>{
  const plan=db.prepare("SELECT * FROM plans WHERE code=? AND active=1").get(String(req.body.planCode||'basic'));
  if(!plan)return res.status(404).json({error:"Plan no encontrado."});
  if(PAYMENT_PROVIDER!=="demo"||!ENABLE_DEMO_PAYMENTS)return res.status(503).json({error:"No hay un proveedor de pago real habilitado. El modo demo nunca acredita pagos en producción.",code:"PAYMENT_PROVIDER_DISABLED"});
  const ref=`DEMO-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const tx=db.transaction(()=>{
    db.prepare("INSERT INTO payments(user_id,plan_id,provider,provider_reference,amount_cents,currency,status,paid_at) VALUES(?,?, 'demo', ?, ?, ?, 'paid', CURRENT_TIMESTAMP)")
      .run(req.user.id,plan.id,ref,plan.price_cents,plan.currency);
    db.prepare("UPDATE subscriptions SET status='expired' WHERE user_id=? AND status IN ('trial','active')").run(req.user.id);
    db.prepare("INSERT INTO subscriptions(user_id,plan_id,status,starts_at,ends_at) VALUES(?,?, 'active', CURRENT_TIMESTAMP, datetime('now', ?))")
      .run(req.user.id,plan.id,`+${plan.duration_days} days`);
  });tx();
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
    audit(req,"event.deleted_permanently",{eventId,targetType:"event",targetId:eventId,metadata:{name:event.name}});
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
  res.json(db.prepare("SELECT id,email,phone,display_name,role,active,auth_provider,must_change_password,last_login_at,created_at FROM users ORDER BY display_name").all());
});

app.post("/api/admin/users",authRequired,ownerOnly,(req,res)=>{
  const {email,displayName,role="client",password,eventIds=[]}=req.body;
  if(!email||!displayName||!password)return res.status(400).json({error:"Faltan datos obligatorios."});
  if(!["client","developer"].includes(role))return res.status(400).json({error:"Rol no permitido."});
  if(String(password).length<12)return res.status(400).json({error:"La contraseña debe tener al menos 12 caracteres."});
  const hash=bcrypt.hashSync(String(password),12);
  try{
    const info=db.prepare("INSERT INTO users(email,password_hash,display_name,role,must_change_password) VALUES(?,?,?,?,1)")
      .run(String(email).trim().toLowerCase(),hash,String(displayName).trim(),role);
    const link=db.prepare("INSERT OR IGNORE INTO user_events(user_id,event_id,permission) VALUES(?,?,?)");
    eventIds.forEach(id=>link.run(info.lastInsertRowid,Number(id),"manage"));
    res.json({ok:true,id:info.lastInsertRowid});
  }catch(e){res.status(400).json({error:"No se pudo crear el usuario. Revisa que el correo no exista."});}
});

app.put("/api/admin/users/:id",authRequired,ownerOnly,(req,res)=>{
  const {displayName,role,active,password,eventIds=[]}=req.body;
  const userId=Number(req.params.id);
  const existing=db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  if(!existing)return res.status(404).json({error:"Usuario no encontrado."});
  if(existing.role==="owner")return res.status(403).json({error:"La cuenta propietaria no puede modificarse desde esta vista."});
  if(!["client","developer"].includes(role))return res.status(400).json({error:"Rol no permitido."});
  if(password&&String(password).length<12)return res.status(400).json({error:"La contraseña debe tener al menos 12 caracteres."});
  db.prepare("UPDATE users SET display_name=?,role=?,active=? WHERE id=?")
    .run(cleanText(displayName,120),role,active?1:0,userId);
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
  eventIds.forEach(id=>link.run(userId,Number(id)));
  res.json({ok:true});
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

function publicConfig(event,{preview=false}={}){
  const settings=settingsOf(event);
  const planCode=eventEntitlement(event)?.plan_code||"studio";
  const publicFeatures=Object.fromEntries(featureOverview(settings,{role:"public",planCode}).map(item=>[item.key,item.allowed]));
  settings.features=publicFeatures;
  delete settings.featureStates;
  if(!publicFeatures.music)settings.media={...(settings.media||{}),music:"",spotifyUrl:"",spotifyUri:"",musicSource:"none"};
  if(!publicFeatures.gallery&&settings.media)settings.media.gallery=[];
  if(!publicFeatures.program)settings.agenda={enabled:false,items:[]};
  if(!publicFeatures.locations){settings.venue={};settings.venues={samePlace:true,ceremony:{},reception:{}};}
  if(!publicFeatures.dressCode)settings.dressCode={enabled:false};
  if(!publicFeatures.gifts)settings.gifts={enabled:false,items:[]};
  if(settings.venue)settings.venue.mapsUrl=safeHttpUrl(settings.venue.mapsUrl);
  if(settings.venues){
    if(settings.venues.ceremony)settings.venues.ceremony.mapsUrl=safeHttpUrl(settings.venues.ceremony.mapsUrl);
    if(settings.venues.reception)settings.venues.reception.mapsUrl=safeHttpUrl(settings.venues.reception.mapsUrl);
  }
  if(settings.agenda?.items){
    settings.agenda.items=settings.agenda.items.map(item=>({...item,mapsUrl:safeHttpUrl(item.mapsUrl)}));
  }
  if(!preview)delete settings.developer;
  return {...settings,event:{...settings.event,slug:event.slug,eventId:event.id,eventType:event.event_type}};
}

app.get("/api/config/:slug",(req,res)=>{
  const event=eventBySlug(req.params.slug);
  if(!event||event.archived)return res.status(404).json({error:"Evento no encontrado."});
  const preview=req.query.preview==="1"&&userCanAccessEvent(currentUser(req),event.id);
  const allowed=featureDecision(settingsOf(event),"invitation",{role:"public",planCode:eventEntitlement(event)?.plan_code||"studio"}).allowed;
  if((!event.published||!allowed)&&!preview)return res.status(404).json({error:"Evento no publicado.",code:"EVENT_NOT_PUBLISHED"});
  res.json(publicConfig(event,{preview}));
});
app.get("/api/config",(req,res)=>{
  const event=eventByHostname(req.hostname)
    || (!IS_PRODUCTION?db.prepare("SELECT * FROM events WHERE COALESCE(archived,0)=0 ORDER BY id LIMIT 1").get():null);
  if(!event)return res.status(404).json({error:"Evento no encontrado."});
  const preview=req.query.preview==="1"&&userCanAccessEvent(currentUser(req),event.id);
  if((!event.published||!featureDecision(settingsOf(event),"invitation",{role:"public",planCode:eventEntitlement(event)?.plan_code||"studio"}).allowed)&&!preview){
    return res.status(404).json({error:"Evento no publicado.",code:"EVENT_NOT_PUBLISHED"});
  }
  res.json(publicConfig(event,{preview}));
});
app.get("/api/invitation/token/:token",(req,res)=>{
  const row=db.prepare(`
    SELECT g.id,g.token,g.family_name,g.phone,g.max_adults,g.max_children,
           g.table_name,g.custom_message,e.id event_id,e.slug,e.settings_json,e.event_type
    FROM guests g JOIN events e ON e.id=g.event_id
    WHERE g.token=? AND COALESCE(e.archived,0)=0 AND COALESCE(e.published,0)=1
  `).get(req.params.token);
  if(!row)return res.status(404).json({error:"Invitación no encontrada."});
  const {settings_json,slug:eventSlug,event_id,event_type,...guest}=row;
  const rsvp=db.prepare("SELECT * FROM rsvps WHERE guest_id=?").get(guest.id);
  const eventSettings=normalizeFeatureSettings(JSON.parse(settings_json));
  const allowed=featureDecision(eventSettings,"invitation",{role:"public",planCode:"studio"}).allowed;
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
  if(!featureDecision(eventSettings,"rsvp",{role:"public",planCode:"studio"}).allowed)return res.status(403).json({error:"Las confirmaciones no están habilitadas.",code:"FEATURE_UNAVAILABLE"});
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
  if(!featureDecision(eventSettings,"guestPhotoUpload",{role:"public",planCode:eventEntitlement(event)?.plan_code||"studio"}).allowed){
    removeFiles(req.files);
    return res.status(403).json({error:"La carga de fotografías no está habilitada.",code:"FEATURE_UNAVAILABLE"});
  }
  if(!req.files?.length)return res.status(400).json({error:"No se recibieron fotos."});

  for(const file of req.files){
    const detected=detectedImageMime(file.path);
    if(!detected){removeFiles(req.files);return res.status(400).json({error:`${cleanText(file.originalname,120)} no es una imagen válida.`,code:"INVALID_IMAGE_CONTENT"});}
    file.mimetype=detected;
  }

  const tableName=cleanText(req.body.tableName,80);
  if(tableName){
    const tableExists=db.prepare("SELECT 1 FROM event_tables WHERE event_id=? AND name=? UNION SELECT 1 FROM guests WHERE event_id=? AND table_name=? LIMIT 1").get(event.id,tableName,event.id,tableName);
    if(!tableExists){removeFiles(req.files);return res.status(400).json({error:"La mesa no pertenece a este evento.",code:"TABLE_INVALID"});}
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
  res.json({ok:true,uploaded:req.files.length,batchId,status:defaultStatus});
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
    if(count>=entitlement.max_events){
      return res.status(409).json({error:`Tu plan ${entitlement.plan_name} permite hasta ${entitlement.max_events} evento(s).`});
    }
  }

  let slug=slugify(req.body.slug||name);
  if(eventBySlug(slug))slug+=`-${Date.now().toString().slice(-5)}`;
  const eventType=String(req.body.eventType||"wedding");
  const settings=freshEventSettings(name,eventType);

  const tx=db.transaction(()=>{
    const info=db.prepare(`
      INSERT INTO events(slug,name,settings_json,event_type,owner_user_id,published,protected)
      VALUES(?,?,?,?,?,0,?)
    `).run(slug,name,JSON.stringify(settings),eventType,isPlatformUser?null:req.user.id,eventType==="wedding"?1:0);
    if(!isPlatformUser){
      db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,'manage')")
        .run(req.user.id,info.lastInsertRowid);
    }
    return info.lastInsertRowid;
  });
  const id=tx();
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
    ensureEventTables(event.id);
    initializeLegacySeating(event.id);
    res.json({ok:true});
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



app.get("/api/admin/spotify/status",authRequired,eventAllowed,featureRequired("music"),(req,res)=>{
  res.json({
    searchConfigured:!!(process.env.SPOTIFY_CLIENT_ID&&process.env.SPOTIFY_CLIENT_SECRET),
    embedAvailable:true
  });
});

app.get("/api/admin/spotify/search",authRequired,eventAllowed,featureRequired("music"),async(req,res)=>{
  const query=String(req.query.q||"").trim();
  if(query.length<2)return res.status(400).json({error:"Escribe al menos dos caracteres."});
  try{
    const token=await spotifyAccessToken();
    if(!token){
      return res.status(503).json({
        error:"La búsqueda integrada todavía no está configurada. Pega un enlace de Spotify o agrega SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET."
      });
    }
    const url=new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q",query);
    url.searchParams.set("type","track");
    url.searchParams.set("limit","10");
    const response=await fetch(url,{
      headers:{"Authorization":`Bearer ${token}`}
    });
    if(!response.ok){
      const body=await response.text();
      console.error("Spotify search:",response.status,body);
      return res.status(response.status).json({error:"Spotify no pudo completar la búsqueda."});
    }
    const data=await response.json();
    res.json((data.tracks?.items||[]).map(spotifyTrackResult));
  }catch(error){
    console.error("Spotify:",error);
    res.status(502).json({error:"No se pudo conectar con Spotify."});
  }
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

app.get("/api/admin/audit",authRequired,ownerOnly,(req,res)=>{
  res.json(db.prepare(`SELECT a.id,a.actor_user_id,u.display_name actor,a.event_id,a.action,a.target_type,a.target_id,a.metadata_json,a.ip_address,a.created_at FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC,a.id DESC LIMIT 1000`).all());
});

app.get("/api/admin/storage/orphans",authRequired,ownerOnly,(_req,res)=>{
  const referenced=new Set();
  for(const event of db.prepare("SELECT * FROM events").all())for(const file of eventMediaPaths(event))referenced.add(path.resolve(file));
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
    const planCode=eventEntitlement(event)?.plan_code||"studio";
    const decisions=featureOverview(settings,{role:req.user.role,planCode});
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
    _permissions:{platformUser}
  });
});

app.get("/api/admin/features",authRequired,eventAllowed,(req,res)=>{
  const settings=settingsOf(req.event);
  const entitlement=eventEntitlement(req.event);
  const overview=featureOverview(settings,{role:req.user.role,planCode:entitlement?.plan_code||"studio"});
  const platformUser=["owner","developer"].includes(req.user.role);
  res.json({
    role:req.user.role,planCode:entitlement?.plan_code||"studio",
    features:platformUser?overview:overview.map(({key,allowed})=>({key,allowed}))
  });
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
  const planCode=eventEntitlement(event)?.plan_code||"studio";
  const can=key=>platformUser||featureDecision(current,key,{role:req.user.role,planCode}).allowed;
  const incomingMedia={...(req.body.media||{})};
  if(!can("music"))for(const key of ["music","musicSource","musicStartSeconds","spotifyUrl","spotifyUri","spotifyTrackName","spotifyArtists","spotifyDurationMs","spotifyStartSeconds"]){incomingMedia[key]=current.media?.[key];}
  if(!can("gallery"))incomingMedia.gallery=current.media?.gallery||[];

  let media;
  try{
    media=normalizeMediaUpdate(current.media,incomingMedia);
  }catch(error){
    return res.status(400).json({error:error.message});
  }

  const next={
    ...current,
    couple:{...(current.couple||{}),...(req.body.couple||{})},
    event:{...(current.event||{}),...(req.body.event||{})},
    venue:can("locations")?{...(current.venue||{}),...(req.body.venue||{})}:{...(current.venue||{})},
    venues:can("locations")?{...(current.venues||{}),...(req.body.venues||{})}:{...(current.venues||{})},
    story:{...(current.story||{}),...(req.body.story||{})},
    dressCode:can("dressCode")?{...(current.dressCode||{}),...(req.body.dressCode||{})}:{...(current.dressCode||{})},
    gifts:can("gifts")?{...(current.gifts||{}),...(req.body.gifts||{})}:{...(current.gifts||{})},
    menus:can("menus")?{...(current.menus||{}),...(req.body.menus||{})}:{...(current.menus||{})},
    media,
    typography:can("templates")?{...(current.typography||{}),...(req.body.typography||{})}:{...(current.typography||{})},
    accessibility:can("rsvp")?{...(current.accessibility||{}),...(req.body.accessibility||{})}:{...(current.accessibility||{})},
    agenda:can("program")?{...(current.agenda||{}),...(req.body.agenda||{})}:{...(current.agenda||{})},
    presentation:can("templates")?{...(current.presentation||{}),...(req.body.presentation||{})}:{...(current.presentation||{})},
    qrDesign:can("qrCards")?{...(current.qrDesign||{}),...(req.body.qrDesign||{})}:{...(current.qrDesign||{})},
    physicalInvitation:can("physicalInvitations")?{...(current.physicalInvitation||{}),...(req.body.physicalInvitation||{})}:{...(current.physicalInvitation||{})},
    themeId:can("templates")&&themes.some(theme=>theme.id===req.body.themeId)?req.body.themeId:current.themeId,
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
  res.json({ok:true,settings:responseSettings});
});

app.get("/api/admin/event-types",authRequired,(_req,res)=>res.json(eventTypes));

app.get("/api/admin/themes",authRequired,(req,res)=>{
  res.json(require("../config/themes.json"));
});

app.post("/api/admin/media/hero",authRequired,eventAllowed,featureRequired("invitation"),mediaUpload.single("file"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"No se recibió la imagen de portada."});
  try{normalizeUploadedMediaFile(req.file,"image");}catch(error){removeFiles([req.file]);return res.status(400).json({error:error.message,code:"INVALID_IMAGE_CONTENT"});}
  const event=currentEvent(req);
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
  res.json({ok:true,url:settings.media.heroImage});
});

app.post("/api/admin/media/music",authRequired,eventAllowed,featureRequired("music"),mediaUpload.single("file"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"No se recibió el archivo de música."});
  try{normalizeUploadedMediaFile(req.file,"audio");}catch(error){removeFiles([req.file]);return res.status(400).json({error:error.message,code:"INVALID_AUDIO_CONTENT"});}
  const event=currentEvent(req);
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
  res.json({ok:true,url:settings.media.music});
});

app.post("/api/admin/media/gallery",authRequired,eventAllowed,featureRequired("gallery"),mediaUpload.array("files",30),(req,res)=>{
  if(!req.files?.length)return res.status(400).json({error:"No se recibieron fotografías."});
  try{req.files.forEach(file=>normalizeUploadedMediaFile(file,"image"));}catch(error){removeFiles(req.files);return res.status(400).json({error:error.message,code:"INVALID_IMAGE_CONTENT"});}
  const event=currentEvent(req);
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
  res.json({ok:true,gallery:settings.media.gallery});
});

app.post("/api/admin/media/dress",authRequired,eventAllowed,featureRequired("dressCode"),mediaUpload.array("files",30),(req,res)=>{
  if(!req.files?.length)return res.status(400).json({error:"No se recibieron imágenes de vestimenta."});
  try{req.files.forEach(file=>normalizeUploadedMediaFile(file,"image"));}catch(error){removeFiles(req.files);return res.status(400).json({error:error.message,code:"INVALID_IMAGE_CONTENT"});}
  const event=currentEvent(req);
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
  res.json({ok:true,referenceImages:settings.dressCode.referenceImages});
});

app.delete("/api/admin/media/item",authRequired,eventAllowed,(req,res)=>{
  const event=currentEvent(req);
  const settings=settingsOf(event);
  const url=String(req.body.url||"");
  const type=String(req.body.type||"");
  const key=type==="gallery"?"gallery":type==="dress"?"dressCode":"";
  if(!key)return res.status(400).json({error:"Tipo de multimedia no reconocido."});
  const decision=featureDecision(settings,key,{role:req.user.role,planCode:eventEntitlement(event)?.plan_code||"studio"});
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
    ensureEventTables(event.id);
    initializeLegacySeating(event.id);
    res.json({ok:true,id:Number(info.lastInsertRowid),code:finalCode,generatedCode:!cleanText(code,80)});
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
  else await workbook.xlsx.readFile(filePath);
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
        reserved=projected;
        if(existing)updated++;else inserted++;
      });
    })();

    ensureEventTables(event.id);
    initializeLegacySeating(event.id);

    fs.unlinkSync(req.file.path);
    audit(req,"guests.imported",{eventId:event.id,targetType:"guest",metadata:{inserted,updated,skipped,errorCount:errors.length}});
    res.json({ok:true,inserted,updated,skipped,generatedCodes,errors,processed:rows.length});
  }catch(error){
    if(req.file?.path&&fs.existsSync(req.file.path))fs.unlinkSync(req.file.path);
    res.status(400).json({error:error.message});
  }
});
app.get("/api/admin/template.xlsx",authRequired,eventAllowed,async(_req,res,next)=>{
  try{
    const workbook=new ExcelJS.Workbook();
    const sheet=workbook.addWorksheet("Invitados",{views:[{state:"frozen",ySplit:1}]});
    sheet.columns=[
      ["CODIGO",16],["FAMILIA",30],["ADULTOS",12],["NIÑOS",12],["TELEFONO",18],["MESA",18],
      ["MENSAJE PERSONALIZADO",42],["NOTAS PRIVADAS",36]
    ].map(([header,width])=>({header,key:header,width}));
    sheet.addRow({CODIGO:"",FAMILIA:"Familia Hernández",ADULTOS:2,"NIÑOS":2,TELEFONO:"9930000000",MESA:"Mesa 1","MENSAJE PERSONALIZADO":"Nos dará mucha alegría compartir este día con ustedes.","NOTAS PRIVADAS":""});
    sheet.getCell("A1").note="Opcional. Si lo dejas vacío, Event Studio genera un código único automáticamente.";
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
  const doc=new PDFDocument({size:"LETTER",layout:"landscape",margin:0,info:{Title:`Plano de mesas - ${settings.couple?.displayName||event.name}`,Subject:seatingModeLabel(mode)}});
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
  if(!event||event.archived||!event.published)return res.status(404).json({error:"Evento no encontrado."});
  const settings=settingsOf(event);
  if(!featureDecision(settings,"guestPhotoMessages",{role:"public",planCode:eventEntitlement(event)?.plan_code||"studio"}).allowed||settings.photoPolicy?.publishApprovedMessages===false)return res.json([]);
  res.json(db.prepare(`SELECT uploaded_by,table_name,message,created_at FROM photo_batches WHERE event_id=? AND status='approved' AND TRIM(COALESCE(message,''))<>'' ORDER BY created_at DESC LIMIT 100`).all(event.id));
});

app.get("/api/admin/photos",authRequired,eventAllowed,featureRequired("guestPhotoUpload"),(req,res)=>{
  const rows=db.prepare(`
    SELECT p.id,p.original_name,p.mime_type,p.size_bytes,p.uploaded_by,p.table_name,p.created_at,p.batch_id,
           b.message,b.status moderation_status,b.guest_id,b.upload_key
    FROM photos p LEFT JOIN photo_batches b ON b.id=p.batch_id
    WHERE p.event_id=? ORDER BY p.created_at DESC,p.id DESC
  `).all(req.event.id);
  res.json(rows.map(row=>({...row,url:`/api/admin/photos/${row.id}/content?eventId=${req.event.id}`})));
});

app.get("/api/admin/photos/:id/content",authRequired,eventAllowed,featureRequired("guestPhotoUpload"),(req,res)=>{
  const photo=db.prepare("SELECT * FROM photos WHERE id=? AND event_id=?").get(Number(req.params.id),req.event.id);
  if(!photo)return res.status(404).json({error:"Fotografía no encontrada.",code:"PHOTO_NOT_FOUND"});
  const file=path.join(guestPhotosDir,path.basename(photo.stored_name));
  if(!fs.existsSync(file))return res.status(410).json({error:"El archivo ya no existe en el almacenamiento.",code:"PHOTO_FILE_MISSING"});
  res.type(photo.mime_type).sendFile(file);
});

app.patch("/api/admin/photo-batches/:id",authRequired,eventAllowed,featureRequired("guestPhotoMessages"),(req,res)=>{
  const status=String(req.body.status||"");
  if(!["pending","approved","hidden"].includes(status))return res.status(400).json({error:"Estado de moderación inválido.",code:"STATUS_INVALID"});
  const info=db.prepare("UPDATE photo_batches SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND event_id=?").run(status,Number(req.params.id),req.event.id);
  if(!info.changes)return res.status(404).json({error:"Lote no encontrado.",code:"PHOTO_BATCH_NOT_FOUND"});
  audit(req,"photo_batch.moderated",{eventId:req.event.id,targetType:"photo_batch",targetId:req.params.id,metadata:{status}});
  res.json({ok:true,status});
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
app.get("/api/admin/qr",authRequired,eventAllowed,featureRequired("qrCards"),async(req,res)=>{const e=currentEvent(req),table=String(req.query.table||"");const url=albumUrl(e,table),dataUrl=await QRCode.toDataURL(url,{margin:4,width:900,errorCorrectionLevel:"H"});res.json({table,url,dataUrl});});
app.get("/api/admin/qr.png",authRequired,eventAllowed,featureRequired("qrCards"),async(req,res)=>{const e=currentEvent(req),table=String(req.query.table||"");const b=await QRCode.toBuffer(albumUrl(e,table),{type:"png",margin:4,width:1400,errorCorrectionLevel:"H"});res.setHeader("Content-Disposition",`attachment; filename="${table?`qr-${sanitize(table)}`:"qr-general"}.png"`);res.type("png").send(b);});
app.get("/api/admin/qr-card.pdf",authRequired,eventAllowed,featureRequired("qrCards"),async(req,res)=>{
  const event=currentEvent(req);
  const settings=settingsOf(event);
  const design=qrDesignOf(settings);
  const templateId=String(req.query.template||design.templateId||"classic-holder");
  const table=String(req.query.table||"");
  const template=qrTemplates.find(item=>item.id===templateId)||qrTemplates[0];
  const size=qrPageSize(template.format);

  const url=albumUrl(event,table);
  const qr=await QRCode.toBuffer(url,{width:1200,margin:4,errorCorrectionLevel:"H"});

  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`attachment; filename="tarjeta-qr-${sanitize(table||"general")}.pdf"`);

  const doc=new PDFDocument({size,margin:0});
  registerPdfFonts(doc);
  doc.pipe(res);
  drawQrCard(doc,{settings,table:table||"QR general",families:qrFamilies(event.id,table),qr,templateId,pageSize:template.format});
  doc.end();
});

app.get("/api/admin/physical-invitation.pdf",authRequired,eventAllowed,featureRequired("physicalInvitations"),async(req,res)=>{
  const event=currentEvent(req);
  const guest=db.prepare(`
    SELECT id,family_name,max_adults,max_children,token
    FROM guests WHERE id=? AND event_id=? AND COALESCE(is_test,0)=0
  `).get(Number(req.query.guestId),event.id);
  if(!guest)return res.status(404).json({error:"Selecciona un invitado real del evento activo."});
  const settings=settingsOf(event);
  const templateId=["auto-theme","coordinated-arch","editorial-silk","classic-frame"].includes(String(req.query.template))
    ?String(req.query.template)
    :(settings.physicalInvitation?.templateId||"auto-theme");
  const qr=await QRCode.toBuffer(invitationUrl(event,guest.token),{width:900,margin:3,errorCorrectionLevel:"H"});
  const heroPath=mediaPathFromUrl(settings.media?.heroImage);
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`attachment; filename="invitacion-fisica-${sanitize(guest.family_name)||"invitado"}.pdf"`);
  const doc=new PDFDocument({size:[360,504],margin:0,info:{Title:`Invitación para ${guest.family_name}`}});
  registerPdfFonts(doc);
  doc.pipe(res);
  drawPhysicalInvitation(doc,{settings,guest,qr,heroPath,templateId});
  doc.end();
});

app.get("/api/admin/qr-set.pdf",authRequired,eventAllowed,featureRequired("qrCards"),async(req,res)=>{
  const event=currentEvent(req);
  const settings=settingsOf(event);
  const design=qrDesignOf(settings);
  const templateId=String(req.query.template||design.templateId||"classic-holder");
  const template=qrTemplates.find(item=>item.id===templateId)||qrTemplates[0];
  ensureEventTables(event.id);
  const tables=db.prepare("SELECT name FROM event_tables WHERE event_id=? ORDER BY order_index,id")
    .all(event.id).map(row=>row.name);
  const list=tables.length?tables:["QR general"];
  const size=qrPageSize(template.format);

  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`attachment; filename="set-qr-${event.slug}-${templateId}.pdf"`);

  const doc=new PDFDocument({size,margin:0});
  registerPdfFonts(doc);
  doc.pipe(res);

  for(let index=0;index<list.length;index++){
    if(index>0)doc.addPage({size,margin:0});
    const table=list[index];
    const url=albumUrl(event,table==="QR general"?"":table);
    const qr=await QRCode.toBuffer(url,{width:1200,margin:4,errorCorrectionLevel:"H"});
    drawQrCard(doc,{settings,table,families:qrFamilies(event.id,table==="QR general"?"":table),qr,templateId,pageSize:template.format});
  }

  doc.end();
});

app.use((req,res)=>{
  if(req.path.startsWith("/api/"))return res.status(404).json({error:"Ruta de API no encontrada.",code:"API_NOT_FOUND"});
  res.status(404).send("Página no encontrada");
});

app.use((err,req,res,_next)=>{
  if(err instanceof multer.MulterError)removeFiles([...(req.files||[]),...(req.file?[req.file]:[])]);
  const statusCode=Number(err.statusCode)||(err instanceof multer.MulterError?400:500);
  const code=String(err.code||(err instanceof multer.MulterError?"UPLOAD_ERROR":"INTERNAL_ERROR"));
  log(statusCode>=500?"error":"warn","request.failed",{requestId:req.requestId,method:req.method,path:req.path,statusCode,code,message:err.message});
  const message=statusCode>=500&&IS_PRODUCTION?"Ocurrió un error interno. Conserva el identificador de solicitud.":(err.message||"Error inesperado.");
  res.status(statusCode).json({error:message,code,requestId:req.requestId});
});

try{syncExpiredLifecycle();}catch(error){log("error","lifecycle.sync_failed",{message:error.message});}
const lifecycleTimer=setInterval(()=>{
  try{syncExpiredLifecycle();}catch(error){log("error","lifecycle.sync_failed",{message:error.message});}
},6*60*60*1000);
lifecycleTimer.unref();

const server=app.listen(PORT,()=>log("info","server.started",{port:PORT,siteUrl:SITE_URL,environment:process.env.NODE_ENV||"development"}));
function shutdown(signal){
  log("info","server.shutdown",{signal});
  clearInterval(lifecycleTimer);
  server.close(()=>{try{db.close();}catch{}process.exit(0);});
  setTimeout(()=>process.exit(1),10000).unref();
}
process.once("SIGTERM",()=>shutdown("SIGTERM"));
process.once("SIGINT",()=>shutdown("SIGINT"));
