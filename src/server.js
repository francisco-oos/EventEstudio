require("dotenv").config();
const express=require("express");
const helmet=require("helmet");
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const crypto=require("crypto");
const bcrypt=require("bcryptjs");
const sanitize=require("sanitize-filename");
const QRCode=require("qrcode");
const XLSX=require("xlsx");
const PDFDocument=require("pdfkit");
const db=require("./db");
const themes=require("../config/themes.json");
const defaultSettings=require("../config/default-settings.json");

const app=express();
const PORT=Number(process.env.PORT||3000);
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||"cambia-esta-clave";
const SITE_URL=(process.env.SITE_URL||`http://localhost:${PORT}`).replace(/\/$/,"");
const MAX_UPLOAD_MB=Number(process.env.MAX_UPLOAD_MB||25);
const PAYMENT_PROVIDER=process.env.PAYMENT_PROVIDER||"demo";
const GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID||"";
const TRIAL_DAYS=Number(process.env.TRIAL_DAYS||7);
const root=path.join(__dirname,"..");
const publicDir=path.join(root,"public");
const uploadsDir=path.join(root,"uploads");
const guestPhotosDir=path.join(uploadsDir,"guest-photos");
const siteMediaDir=path.join(uploadsDir,"site-media");
const tempDir=path.join(root,"data","temp");
[guestPhotosDir,siteMediaDir,tempDir].forEach(d=>fs.mkdirSync(d,{recursive:true}));

app.use(helmet({crossOriginResourcePolicy:{policy:"cross-origin"},contentSecurityPolicy:false}));
app.use(express.json({limit:"4mb"}));
app.use(express.urlencoded({extended:true}));
app.use("/uploads",express.static(uploadsDir));
app.use(express.static(publicDir));

function adminOnly(req,res,next){ if(req.headers["x-admin-password"]!==ADMIN_PASSWORD)return res.status(401).json({error:"Contraseña administrativa incorrecta."}); next(); }
function currentEvent(req){ const id=Number(req.headers["x-event-id"]||req.query.eventId||0); return id?db.prepare("SELECT * FROM events WHERE id=?").get(id):db.prepare("SELECT * FROM events ORDER BY id LIMIT 1").get(); }
function eventBySlug(slug){ return db.prepare("SELECT * FROM events WHERE slug=?").get(slug); }
function settingsOf(event){ return JSON.parse(event.settings_json); }
function saveSettings(eventId,settings){ db.prepare("UPDATE events SET settings_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(settings),eventId); }
function makeToken(){ return crypto.randomBytes(16).toString("hex"); }
function slugify(v){ return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||`evento-${Date.now()}`; }
function normalizePhone(v){ let p=String(v||"").replace(/\D/g,""); if(p.length===10)p="52"+p; return p; }
function invitationUrl(event,token){ return `${SITE_URL}/e/${event.slug}?i=${encodeURIComponent(token)}`; }
function albumUrl(event,table=""){ return `${SITE_URL}/album.html?e=${encodeURIComponent(event.slug)}${table?`&mesa=${encodeURIComponent(table)}`:""}`; }
function whatsappUrl(event,g){ const s=settingsOf(event); const p=normalizePhone(g.phone); const places=[g.max_adults?`${g.max_adults} adulto(s)`:"",g.max_children?`${g.max_children} niño(s)`:""].filter(Boolean).join(" y "); const text=[`Hola, ${g.family_name} ❤️`,"",`Con mucha emoción queremos compartirles la invitación a ${s.couple.displayName}.`,places?`Hemos reservado ${places} para ustedes.`:"",g.custom_message||"","","Aquí pueden consultar los detalles y confirmar su asistencia:",invitationUrl(event,g.token)].filter(Boolean).join("\n"); return p?`https://wa.me/${p}?text=${encodeURIComponent(text)}`:""; }
function safeName(n){ const ext=path.extname(n).toLowerCase(); const base=sanitize(path.basename(n,ext))||"archivo"; return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${base}${ext}`; }

const photoUpload=multer({storage:multer.diskStorage({destination:guestPhotosDir,filename:(_r,f,cb)=>cb(null,safeName(f.originalname))}),limits:{fileSize:MAX_UPLOAD_MB*1024*1024,files:20},fileFilter:(_r,f,cb)=>{const ok=["image/jpeg","image/png","image/webp","image/heic","image/heif"].includes(f.mimetype);cb(ok?null:new Error("Sólo fotografías."),ok);}});
const mediaUpload=multer({storage:multer.diskStorage({destination:siteMediaDir,filename:(_r,f,cb)=>cb(null,safeName(f.originalname))}),limits:{fileSize:70*1024*1024,files:30},fileFilter:(_r,f,cb)=>{const ok=f.mimetype.startsWith("image/")||f.mimetype.startsWith("audio/");cb(ok?null:new Error("Sólo imágenes o audio."),ok);}});
const excelUpload=multer({dest:tempDir,limits:{fileSize:8*1024*1024,files:1},fileFilter:(_r,f,cb)=>{const ok=/\.(xlsx|xls|csv)$/i.test(f.originalname);cb(ok?null:new Error("Debe ser Excel o CSV."),ok);}});

// Public event routes
app.get("/e/:slug",(req,res)=>{ if(!eventBySlug(req.params.slug))return res.status(404).send("Evento no encontrado"); res.sendFile(path.join(publicDir,"index.html")); });

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)").run(token,userId,expires);
  return token;
}

function currentUser(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i,"");
  if (!token) return null;
  return db.prepare(`
    SELECT u.id,u.email,u.phone,u.display_name,u.role,u.active,u.auth_provider,u.company_name
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token=? AND s.expires_at>CURRENT_TIMESTAMP AND u.active=1
  `).get(token);
}

function authRequired(req,res,next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({error:"Sesión no válida o vencida."});
  req.user = user;
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

function eventAllowed(req,res,next) {
  const eventId = Number(req.headers["x-event-id"] || req.query.eventId || req.body?.eventId || 0);
  if (!eventId) return res.status(400).json({error:"Evento no seleccionado."});
  if (["owner","developer"].includes(req.user.role)) {
    req.eventId = eventId; return next();
  }
  const access = db.prepare("SELECT 1 FROM user_events WHERE user_id=? AND event_id=?").get(req.user.id,eventId);
  if (!access) return res.status(403).json({error:"No tienes acceso a este evento."});
  req.eventId = eventId;
  next();
}


app.get("/api/public/auth-options",(_req,res)=>{
  res.json({googleEnabled:Boolean(GOOGLE_CLIENT_ID),paymentProvider:PAYMENT_PROVIDER,trialDays:TRIAL_DAYS});
});

app.get("/api/public/plans",(_req,res)=>{
  res.json(db.prepare("SELECT id,code,name,price_cents,currency,duration_days,max_events,max_guests,max_storage_mb FROM plans WHERE active=1 ORDER BY price_cents").all());
});

app.post("/api/auth/register",(req,res)=>{
  const displayName=String(req.body.displayName||"").trim();
  const rawEmail=String(req.body.email||"").trim().toLowerCase();
  const phone=normalizePhone(req.body.phone||"");
  const password=String(req.body.password||"");
  const planCode=String(req.body.planCode||"basic");
  if(!displayName || (!rawEmail && !phone) || password.length<8){
    return res.status(400).json({error:"Escribe tu nombre, correo o teléfono y una contraseña de al menos 8 caracteres."});
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
    const eventInfo=db.prepare("INSERT INTO events(slug,name,settings_json) VALUES(?,?,?)").run(slug,`Evento de ${displayName}`,JSON.stringify(settings));
    db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,'manage')").run(userInfo.lastInsertRowid,eventInfo.lastInsertRowid);
    db.prepare("INSERT INTO subscriptions(user_id,plan_id,status,ends_at) VALUES(?,?, 'trial', datetime('now', ?))")
      .run(userInfo.lastInsertRowid,plan.id,`+${TRIAL_DAYS} days`);
    return {userId:userInfo.lastInsertRowid,eventId:eventInfo.lastInsertRowid};
  });
  const created=tx();
  const token=createSession(created.userId);
  res.status(201).json({ok:true,token,user:{id:created.userId,email:rawEmail,phone,displayName,role:'client'},eventId:created.eventId,billing:{status:'trial',paid:false}});
});

app.post("/api/auth/google",(_req,res)=>{
  if(!GOOGLE_CLIENT_ID)return res.status(503).json({error:"El acceso con Google aún no está configurado. Agrega GOOGLE_CLIENT_ID y el flujo OAuth antes de producción."});
  res.status(501).json({error:"El endpoint OAuth está preparado, pero requiere configurar las credenciales y callback del dominio definitivo."});
});

app.post("/api/auth/login",(req,res)=>{
  const identifier=String(req.body.email||req.body.identifier||"").trim().toLowerCase();
  const normalizedPhone=normalizePhone(identifier);
  const password=String(req.body.password||"");
  const user=db.prepare("SELECT * FROM users WHERE active=1 AND (lower(email)=? OR login_identifier=? OR phone=?)").get(identifier,identifier,normalizedPhone);
  if(!user || !bcrypt.compareSync(password,user.password_hash)){
    return res.status(401).json({error:"Correo o contraseña incorrectos."});
  }
  db.prepare("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?").run(user.id);
  const token=createSession(user.id);
  res.json({token,user:{id:user.id,email:user.email,displayName:user.display_name,role:user.role}});
});

app.post("/api/auth/logout",authRequired,(req,res)=>{
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  db.prepare("DELETE FROM sessions WHERE token=?").run(token);
  res.json({ok:true});
});

app.get("/api/auth/me",authRequired,(req,res)=>res.json(req.user));


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
      p.name plan_name,s.status subscription_status,s.ends_at,
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

app.get("/api/billing/me",authRequired,(req,res)=>{
  const subscription=db.prepare(`SELECT s.*,p.code,p.name,p.price_cents,p.currency,p.duration_days,p.max_events,p.max_guests,p.max_storage_mb FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.id DESC LIMIT 1`).get(req.user.id);
  const payments=db.prepare("SELECT id,provider,provider_reference,amount_cents,currency,status,paid_at,created_at FROM payments WHERE user_id=? ORDER BY id DESC").all(req.user.id);
  res.json({subscription,payments,provider:PAYMENT_PROVIDER});
});

app.post("/api/billing/checkout",authRequired,(req,res)=>{
  const plan=db.prepare("SELECT * FROM plans WHERE code=? AND active=1").get(String(req.body.planCode||'basic'));
  if(!plan)return res.status(404).json({error:"Plan no encontrado."});
  if(PAYMENT_PROVIDER!=="demo")return res.status(501).json({error:"El proveedor de pagos real todavía requiere credenciales y webhooks."});
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

app.get("/api/admin/users",authRequired,ownerOnly,(_req,res)=>{
  res.json(db.prepare("SELECT id,email,phone,display_name,role,active,auth_provider,last_login_at,created_at FROM users ORDER BY display_name").all());
});

app.post("/api/admin/users",authRequired,ownerOnly,(req,res)=>{
  const {email,displayName,role="client",password,eventIds=[]}=req.body;
  if(!email||!displayName||!password)return res.status(400).json({error:"Faltan datos obligatorios."});
  const hash=bcrypt.hashSync(String(password),12);
  try{
    const info=db.prepare("INSERT INTO users(email,password_hash,display_name,role) VALUES(?,?,?,?)")
      .run(String(email).trim().toLowerCase(),hash,String(displayName).trim(),role);
    const link=db.prepare("INSERT OR IGNORE INTO user_events(user_id,event_id,permission) VALUES(?,?,?)");
    eventIds.forEach(id=>link.run(info.lastInsertRowid,Number(id),"manage"));
    res.json({ok:true,id:info.lastInsertRowid});
  }catch(e){res.status(400).json({error:"No se pudo crear el usuario. Revisa que el correo no exista."});}
});

app.put("/api/admin/users/:id",authRequired,ownerOnly,(req,res)=>{
  const {displayName,role,active,password,eventIds=[]}=req.body;
  db.prepare("UPDATE users SET display_name=?,role=?,active=? WHERE id=?")
    .run(displayName,role,active?1:0,Number(req.params.id));
  if(password)db.prepare("UPDATE users SET password_hash=? WHERE id=?")
    .run(bcrypt.hashSync(String(password),12),Number(req.params.id));
  db.prepare("DELETE FROM user_events WHERE user_id=?").run(Number(req.params.id));
  const link=db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,?)");
  eventIds.forEach(id=>link.run(Number(req.params.id),Number(id),"manage"));
  res.json({ok:true});
});

app.post("/api/admin/guests/mark-sent",authRequired,eventAllowed,(req,res)=>{
  const ids=Array.isArray(req.body.ids)?req.body.ids.map(Number):[];
  if(!ids.length)return res.status(400).json({error:"No seleccionaste invitados."});
  const q=ids.map(()=>"?").join(",");
  db.prepare(`UPDATE guests SET delivery_status='sent',sent_at=CURRENT_TIMESTAMP,last_delivery_at=CURRENT_TIMESTAMP
              WHERE event_id=? AND id IN (${q})`).run(req.eventId,...ids);
  res.json({ok:true,updated:ids.length});
});

app.get("/api/admin/guests/whatsapp-batch",authRequired,eventAllowed,(req,res)=>{
  const ids=String(req.query.ids||"").split(",").map(Number).filter(Boolean);
  if(!ids.length)return res.json([]);
  const q=ids.map(()=>"?").join(",");
  const rows=db.prepare(`SELECT * FROM guests WHERE event_id=? AND id IN (${q}) ORDER BY family_name`)
    .all(req.eventId,...ids);
  res.json(rows.map(g=>({id:g.id,family:g.family_name,phone:g.phone,url:whatsappUrl(g)})));
});

app.get("/api/config/:slug",(req,res)=>{ const e=eventBySlug(req.params.slug); if(!e)return res.status(404).json({error:"Evento no encontrado."}); res.json({...settingsOf(e),event:{...settingsOf(e).event,slug:e.slug,eventId:e.id}}); });
app.get("/api/config",(_req,res)=>{ const e=db.prepare("SELECT * FROM events ORDER BY id LIMIT 1").get(); res.json({...settingsOf(e),event:{...settingsOf(e).event,slug:e.slug,eventId:e.id}}); });
app.get("/api/invitation/token/:token",(req,res)=>{ const g=db.prepare(`SELECT g.*,e.slug,e.settings_json FROM guests g JOIN events e ON e.id=g.event_id WHERE g.token=?`).get(req.params.token); if(!g)return res.status(404).json({error:"Invitación no encontrada."}); const r=db.prepare("SELECT * FROM rsvps WHERE guest_id=?").get(g.id); res.json({guest:g,rsvp:r||null,eventSlug:g.slug,menus:JSON.parse(g.settings_json).menus}); });
app.post("/api/rsvp",(req,res)=>{ const {token,attending,adults=0,children=0,attendee_names="",dietary="",special_needs="",adult_menu_counts={},child_menu_counts={},message="",contact_phone=""}=req.body; const g=db.prepare(`SELECT g.*,e.settings_json FROM guests g JOIN events e ON e.id=g.event_id WHERE g.token=?`).get(token); if(!g)return res.status(404).json({error:"Invitación inválida."}); const a=Number(adults),c=Number(children),yes=Boolean(attending); if(!Number.isInteger(a)||a<0||a>g.max_adults)return res.status(400).json({error:`Máximo ${g.max_adults} adulto(s).`}); if(!Number.isInteger(c)||c<0||c>g.max_children)return res.status(400).json({error:`Máximo ${g.max_children} niño(s).`}); if(yes&&a+c===0)return res.status(400).json({error:"Indica al menos un asistente."}); const s=JSON.parse(g.settings_json); const menus=s.menus||{}; let am=adult_menu_counts||{},cm=child_menu_counts||{}; if(!menus.selectionEnabled){ am=a&&menus.adultOptions?.[0]?{[menus.adultOptions[0]]:a}:{}; cm=c&&menus.childOptions?.[0]?{[menus.childOptions[0]]:c}:{}; } else { const sum=o=>Object.values(o||{}).reduce((x,v)=>x+Number(v||0),0); if(sum(am)!==a)return res.status(400).json({error:"La distribución de menús de adultos debe sumar el número de adultos."}); if(sum(cm)!==c)return res.status(400).json({error:"La distribución de menús infantiles debe sumar el número de niños."}); }
 db.transaction(()=>{ db.prepare(`INSERT INTO rsvps (guest_id,attending,adults,children,attendee_names,dietary,special_needs,adult_menu_counts,child_menu_counts,message,contact_phone,updated_at) VALUES (@guest_id,@attending,@adults,@children,@attendee_names,@dietary,@special_needs,@adult_menu_counts,@child_menu_counts,@message,@contact_phone,CURRENT_TIMESTAMP) ON CONFLICT(guest_id) DO UPDATE SET attending=excluded.attending,adults=excluded.adults,children=excluded.children,attendee_names=excluded.attendee_names,dietary=excluded.dietary,special_needs=excluded.special_needs,adult_menu_counts=excluded.adult_menu_counts,child_menu_counts=excluded.child_menu_counts,message=excluded.message,contact_phone=excluded.contact_phone,updated_at=CURRENT_TIMESTAMP`).run({guest_id:g.id,attending:yes?1:0,adults:yes?a:0,children:yes?c:0,attendee_names,dietary,special_needs,adult_menu_counts:JSON.stringify(yes?am:{}),child_menu_counts:JSON.stringify(yes?cm:{}),message,contact_phone}); db.prepare("UPDATE guests SET status=? WHERE id=?").run(yes?"confirmed":"declined",g.id); })(); res.json({ok:true}); });
app.post("/api/photos",photoUpload.array("photos",20),(req,res)=>{ const e=eventBySlug(String(req.body.eventSlug||"")); if(!e)return res.status(400).json({error:"Evento inválido."}); if(!req.files?.length)return res.status(400).json({error:"No se recibieron fotos."}); const ins=db.prepare("INSERT INTO photos (event_id,original_name,stored_name,mime_type,size_bytes,uploaded_by,table_name) VALUES (?,?,?,?,?,?,?)"); db.transaction(()=>req.files.forEach(f=>ins.run(e.id,f.originalname,f.filename,f.mimetype,f.size,String(req.body.uploadedBy||"").slice(0,120),String(req.body.tableName||"").slice(0,80))))(); res.json({ok:true,uploaded:req.files.length}); });

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
  const settings=JSON.parse(JSON.stringify(defaultSettings));
  settings.couple.displayName=name;
  settings.developer={mode:"production",showBanner:false,ownerOnly:true};

  const tx=db.transaction(()=>{
    const info=db.prepare(`
      INSERT INTO events(slug,name,settings_json,event_type,owner_user_id,published)
      VALUES(?,?,?,?,?,0)
    `).run(slug,name,JSON.stringify(settings),String(req.body.eventType||"wedding"),isPlatformUser?null:req.user.id);
    if(!isPlatformUser){
      db.prepare("INSERT INTO user_events(user_id,event_id,permission) VALUES(?,?,'manage')")
        .run(req.user.id,info.lastInsertRowid);
    }
    return info.lastInsertRowid;
  });
  const id=tx();
  res.json({ok:true,id,slug});
});

app.post("/api/admin/guests/delete-batch",authRequired,eventAllowed,(req,res)=>{
  const ids=Array.isArray(req.body.ids)?req.body.ids.map(Number).filter(Boolean):[];
  if(!ids.length)return res.status(400).json({error:"No seleccionaste invitados."});
  const placeholders=ids.map(()=>"?").join(",");
  const found=db.prepare(`SELECT id FROM guests WHERE event_id=? AND id IN (${placeholders})`).all(req.eventId,...ids);
  if(!found.length)return res.status(404).json({error:"No se encontraron invitados para eliminar."});
  db.prepare(`DELETE FROM guests WHERE event_id=? AND id IN (${placeholders})`).run(req.eventId,...ids);
  res.json({ok:true,deleted:found.length});
});


app.get("/api/admin/settings",authRequired,eventAllowed,(req,res)=>{
  const event=currentEvent(req);
  if(!event)return res.status(404).json({error:"Evento no encontrado."});

  const settings=settingsOf(event);
  const platformUser=["owner","developer"].includes(req.user.role);

  if(!platformUser){
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

app.put("/api/admin/settings",authRequired,eventAllowed,(req,res)=>{
  const event=currentEvent(req);
  if(!event)return res.status(404).json({error:"Evento no encontrado."});

  const current=settingsOf(event);
  const platformUser=["owner","developer"].includes(req.user.role);

  const next={
    ...current,
    ...req.body,
    couple:{...(current.couple||{}),...(req.body.couple||{})},
    event:{...(current.event||{}),...(req.body.event||{})},
    venue:{...(current.venue||{}),...(req.body.venue||{})},
    venues:{...(current.venues||{}),...(req.body.venues||{})},
    story:{...(current.story||{}),...(req.body.story||{})},
    dressCode:{...(current.dressCode||{}),...(req.body.dressCode||{})},
    gifts:{...(current.gifts||{}),...(req.body.gifts||{})},
    menus:{...(current.menus||{}),...(req.body.menus||{})},
    media:{...(current.media||{}),...(req.body.media||{})},
    typography:{...(current.typography||{}),...(req.body.typography||{})},
    accessibility:{...(current.accessibility||{}),...(req.body.accessibility||{})},
    developer:platformUser
      ? {...(current.developer||{}),...(req.body.developer||{})}
      : {...(current.developer||{}),ownerOnly:true}
  };

  saveSettings(event.id,next);

  const displayName=String(next.couple?.displayName||event.name).trim()||event.name;
  db.prepare("UPDATE events SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(displayName,event.id);

  res.json({ok:true,settings:next});
});

app.get("/api/admin/themes",authRequired,(req,res)=>{
  res.json(require("../config/themes.json"));
});

app.post("/api/admin/media/hero",authRequired,eventAllowed,mediaUpload.single("file"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"No se recibió la imagen de portada."});
  const event=currentEvent(req);
  const settings=settingsOf(event);
  settings.media={...(settings.media||{}),heroImage:`/uploads/site-media/${req.file.filename}`};
  saveSettings(event.id,settings);
  res.json({ok:true,url:settings.media.heroImage});
});

app.post("/api/admin/media/music",authRequired,eventAllowed,mediaUpload.single("file"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"No se recibió el archivo de música."});
  const event=currentEvent(req);
  const settings=settingsOf(event);
  settings.media={...(settings.media||{}),music:`/uploads/site-media/${req.file.filename}`};
  saveSettings(event.id,settings);
  res.json({ok:true,url:settings.media.music});
});

app.post("/api/admin/media/gallery",authRequired,eventAllowed,mediaUpload.array("files",30),(req,res)=>{
  if(!req.files?.length)return res.status(400).json({error:"No se recibieron fotografías."});
  const event=currentEvent(req);
  const settings=settingsOf(event);
  const added=req.files.map(file=>`/uploads/site-media/${file.filename}`);
  settings.media={
    ...(settings.media||{}),
    gallery:[...(settings.media?.gallery||[]),...added]
  };
  saveSettings(event.id,settings);
  res.json({ok:true,gallery:settings.media.gallery});
});

app.post("/api/admin/media/dress",authRequired,eventAllowed,mediaUpload.array("files",30),(req,res)=>{
  if(!req.files?.length)return res.status(400).json({error:"No se recibieron imágenes de vestimenta."});
  const event=currentEvent(req);
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
  }else{
    return res.status(400).json({error:"Tipo de multimedia no reconocido."});
  }

  saveSettings(event.id,settings);
  res.json({ok:true});
});


app.get("/api/admin/dashboard",authRequired,eventAllowed,(req,res)=>{ const e=currentEvent(req); const inv=db.prepare(`SELECT COUNT(*) invitations,SUM(status='confirmed') confirmed_families,SUM(status='declined') declined_families,SUM(status='pending') pending_families FROM guests WHERE event_id=? AND COALESCE(is_test,0)=0`).get(e.id); const people=db.prepare(`SELECT COALESCE(SUM(CASE WHEN r.attending=1 THEN r.adults ELSE 0 END),0) adults,COALESCE(SUM(CASE WHEN r.attending=1 THEN r.children ELSE 0 END),0) children,COALESCE(SUM(CASE WHEN r.attending=1 AND TRIM(COALESCE(r.dietary,''))<>'' THEN 1 ELSE 0 END),0) dietary_records FROM rsvps r JOIN guests g ON g.id=r.guest_id WHERE g.event_id=? AND COALESCE(g.is_test,0)=0`).get(e.id); const photos=db.prepare("SELECT COUNT(*) total FROM photos WHERE event_id=?").get(e.id).total; res.json({...inv,...people,photos}); });
app.get("/api/admin/guests",authRequired,eventAllowed,(req,res)=>{ const e=currentEvent(req); const rows=db.prepare(`SELECT g.*,r.attending,r.adults,r.children,r.attendee_names,r.dietary,r.special_needs,r.adult_menu_counts,r.child_menu_counts,r.message,r.contact_phone,r.updated_at FROM guests g LEFT JOIN rsvps r ON r.guest_id=g.id WHERE g.event_id=? ORDER BY g.is_test DESC,g.family_name`).all(e.id); res.json(rows.map(g=>({...g,invitation_url:invitationUrl(e,g.token),whatsapp_url:whatsappUrl(e,g)}))); });
app.post("/api/admin/guests",authRequired,eventAllowed,(req,res)=>{ const e=currentEvent(req); const {code,family_name,phone="",max_adults=1,max_children=0,table_name="",custom_message="",private_notes=""}=req.body; if(!String(code||"").trim()||!String(family_name||"").trim())return res.status(400).json({error:"Código y familia obligatorios."}); try{db.prepare(`INSERT INTO guests (event_id,code,token,family_name,phone,max_adults,max_children,table_name,custom_message,private_notes) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(e.id,String(code).trim(),makeToken(),String(family_name).trim(),normalizePhone(phone),Number(max_adults),Number(max_children),String(table_name).trim(),String(custom_message).trim(),String(private_notes).trim());res.json({ok:true});}catch{res.status(400).json({error:"Código repetido o datos inválidos."});} });
app.post("/api/admin/import",authRequired,eventAllowed,excelUpload.single("file"),(req,res)=>{ const e=currentEvent(req); try{const wb=XLSX.readFile(req.file.path),sh=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sh,{defval:""}),find=db.prepare("SELECT token FROM guests WHERE event_id=? AND code=?"),up=db.prepare(`INSERT INTO guests (event_id,code,token,family_name,phone,max_adults,max_children,table_name,custom_message,private_notes) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id,code) DO UPDATE SET family_name=excluded.family_name,phone=excluded.phone,max_adults=excluded.max_adults,max_children=excluded.max_children,table_name=excluded.table_name,custom_message=excluded.custom_message,private_notes=excluded.private_notes`);let imported=0;const errors=[];db.transaction(()=>rows.forEach((r,i)=>{const code=String(r.CODIGO||r.Código||r.codigo||"").trim(),fam=String(r.FAMILIA||r["FAMILIA O INVITADO"]||r.familia||"").trim();if(!code||!fam){errors.push(`Fila ${i+2}: falta código o familia.`);return;}const ex=find.get(e.id,code);up.run(e.id,code,ex?.token||makeToken(),fam,normalizePhone(r.TELEFONO||r.Teléfono||r.telefono),Number(r.ADULTOS??r["ADULTOS PERMITIDOS"]??0),Number(r["NIÑOS"]??r.NINOS??r["NIÑOS PERMITIDOS"]??0),String(r.MESA||"").trim(),String(r["MENSAJE PERSONALIZADO"]||r.MENSAJE||"").trim(),String(r["NOTAS PRIVADAS"]||r.NOTAS||"").trim());imported++;}))();fs.unlinkSync(req.file.path);res.json({ok:true,imported,errors});}catch(err){if(req.file?.path&&fs.existsSync(req.file.path))fs.unlinkSync(req.file.path);res.status(400).json({error:err.message});} });
app.get("/api/admin/template.xlsx",authRequired,eventAllowed,(_req,res)=>{const rows=[{CODIGO:"FAM001",FAMILIA:"Familia Hernández",ADULTOS:2,"NIÑOS":2,TELEFONO:"9930000000",MESA:"Mesa 1","MENSAJE PERSONALIZADO":"Nos dará mucha alegría compartir este día con ustedes.","NOTAS PRIVADAS":""}],ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Invitados");const b=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});res.setHeader("Content-Disposition","attachment; filename=plantilla_invitados.xlsx");res.send(b);});
app.get("/api/admin/tables",authRequired,eventAllowed,(req,res)=>{const e=currentEvent(req);res.json(db.prepare(`SELECT DISTINCT table_name FROM guests WHERE event_id=? AND TRIM(COALESCE(table_name,''))<>'' ORDER BY table_name`).all(e.id).map(x=>x.table_name));});
app.get("/api/admin/photos",authRequired,eventAllowed,(req,res)=>{const e=currentEvent(req);res.json(db.prepare("SELECT * FROM photos WHERE event_id=? ORDER BY created_at DESC").all(e.id).map(x=>({...x,url:`/uploads/guest-photos/${x.stored_name}`})));});

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
app.get("/api/admin/venue-report.xlsx",authRequired,eventAllowed,(req,res)=>{const e=currentEvent(req),s=settingsOf(e);const rows=db.prepare(`SELECT g.family_name FAMILIA,g.table_name MESA,r.adults ADULTOS,r.children NINOS,r.adult_menu_counts,r.child_menu_counts,r.dietary RESTRICCIONES_ALIMENTARIAS,r.special_needs NECESIDADES_ESPECIALES,r.attendee_names ASISTENTES,COALESCE(r.contact_phone,g.phone) TELEFONO FROM guests g JOIN rsvps r ON r.guest_id=g.id WHERE g.event_id=? AND r.attending=1 ORDER BY g.table_name,g.family_name`).all(e.id);const summary=[{FECHA_EVENTO:s.event.dateLabel,LUGAR:s.venue.name,ADULTOS_CONFIRMADOS:rows.reduce((a,r)=>a+r.ADULTOS,0),NINOS_CONFIRMADOS:rows.reduce((a,r)=>a+r.NINOS,0),TOTAL_PERSONAS:rows.reduce((a,r)=>a+r.ADULTOS+r.NINOS,0)}];const detail=rows.map(({adult_menu_counts,child_menu_counts,...r})=>r);const restrictions=detail.filter(r=>String(r.RESTRICCIONES_ALIMENTARIAS||"").trim()||String(r.NECESIDADES_ESPECIALES||"").trim());const menus=[...menuTotals(rows,"adult_menu_counts"),...menuTotals(rows,"child_menu_counts")];const wb=XLSX.utils.book_new();[[summary,"Resumen"],[detail,"Asistentes"],[restrictions,"Restricciones"],[menus,"Menus"]].forEach(([data,name])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),name));res.setHeader("Content-Disposition","attachment; filename=reporte_para_el_lugar.xlsx");res.send(XLSX.write(wb,{type:"buffer",bookType:"xlsx"}));});
app.get("/api/admin/qr",authRequired,eventAllowed,async(req,res)=>{const e=currentEvent(req),table=String(req.query.table||"");const url=albumUrl(e,table),dataUrl=await QRCode.toDataURL(url,{margin:2,width:900,errorCorrectionLevel:"H"});res.json({table,url,dataUrl});});
app.get("/api/admin/qr.png",authRequired,eventAllowed,async(req,res)=>{const e=currentEvent(req),table=String(req.query.table||"");const b=await QRCode.toBuffer(albumUrl(e,table),{type:"png",margin:2,width:1400,errorCorrectionLevel:"H"});res.setHeader("Content-Disposition",`attachment; filename="${table?`qr-${sanitize(table)}`:"qr-general"}.png"`);res.type("png").send(b);});
app.get("/api/admin/qr-set.pdf",authRequired,eventAllowed,async(req,res)=>{const e=currentEvent(req),s=settingsOf(e),tables=db.prepare(`SELECT DISTINCT table_name FROM guests WHERE event_id=? AND TRIM(COALESCE(table_name,''))<>'' ORDER BY table_name`).all(e.id).map(x=>x.table_name);const list=tables.length?tables:["QR general"];res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`attachment; filename="set-qr-${e.slug}.pdf"`);const doc=new PDFDocument({size:"LETTER",margin:36});doc.pipe(res);for(let i=0;i<list.length;i++){if(i>0)doc.addPage();const table=list[i],url=albumUrl(e,table==="QR general"?"":table),qr=await QRCode.toBuffer(url,{width:900,margin:1,errorCorrectionLevel:"H"});doc.rect(24,24,564,744).lineWidth(1.2).stroke("#b59464");doc.font("Times-Bold").fontSize(30).fillColor("#7b2331").text(s.couple.displayName,50,70,{align:"center",width:512});doc.font("Helvetica").fontSize(11).fillColor("#7a6d65").text(s.event.dateLabel,50,112,{align:"center",width:512});doc.font("Times-Bold").fontSize(23).fillColor("#302824").text("Ayúdanos a guardar este día",50,165,{align:"center",width:512});doc.font("Helvetica").fontSize(13).fillColor("#5e534d").text("Escanea el código y comparte las fotografías que tomes durante la celebración. No necesitas instalar ninguna aplicación.",75,208,{align:"center",width:462,lineGap:4});doc.image(qr,166,300,{width:280});doc.roundedRect(190,602,232,40,20).fill("#f1e6dc");doc.font("Helvetica-Bold").fontSize(16).fillColor("#7b2331").text(table,190,613,{align:"center",width:232});doc.font("Helvetica").fontSize(9).fillColor("#8a7b71").text(s.venue.name,60,690,{align:"center",width:492});}doc.end();});

app.use((err,_req,res,_next)=>{console.error(err);res.status(400).json({error:err.message||"Error inesperado."});});
app.listen(PORT,()=>console.log(`Panel: ${SITE_URL}/admin.html`));
