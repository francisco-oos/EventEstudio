const crypto=require("crypto");
const db=require("./db");
const {log}=require("./logger");

const terminalStatuses=new Set(["sent","delivered","read","cancelled"]);

function normalizePhone(value){
  let phone=String(value||"").replace(/\D/g,"");
  if(phone.length===10)phone=`52${phone}`;
  return /^\d{11,15}$/.test(phone)?phone:"";
}

function activeProfile(){
  const value=String(process.env.WHATSAPP_ACTIVE_PROFILE||"").trim().toUpperCase();
  return /^[A-Z0-9_]{1,32}$/.test(value)?value:"";
}

function profileValue(name,fallback=""){
  const profile=activeProfile();
  const profiled=profile?process.env[`WHATSAPP_${profile}_${name}`]:undefined;
  return String(profiled??process.env[`WHATSAPP_${name}`]??fallback).trim();
}

function whatsappConfig(){
  return {
    activeProfile:activeProfile()||"principal",
    provider:profileValue("PROVIDER","manual").toLowerCase(),
    graphVersion:profileValue("GRAPH_VERSION"),
    phoneNumberId:profileValue("PHONE_NUMBER_ID"),
    businessAccountId:profileValue("BUSINESS_ACCOUNT_ID"),
    accessToken:profileValue("ACCESS_TOKEN"),
    appSecret:profileValue("APP_SECRET"),
    verifyToken:profileValue("WEBHOOK_VERIFY_TOKEN"),
    templateName:profileValue("INVITATION_TEMPLATE"),
    templateLanguage:profileValue("TEMPLATE_LANGUAGE","es_MX")
  };
}

function providerName(){
  const value=whatsappConfig().provider;
  return ["manual","simulation","whatsapp-cloud"].includes(value)?value:"manual";
}

function providerStatus(){
  const config=whatsappConfig();
  const provider=providerName();
  const cloudRequired={
    phoneNumberId:Boolean(config.phoneNumberId),
    businessAccountId:Boolean(config.businessAccountId),
    accessToken:Boolean(config.accessToken),
    appSecret:Boolean(config.appSecret),
    verifyToken:Boolean(config.verifyToken),
    templateName:Boolean(config.templateName),
    graphVersion:Boolean(config.graphVersion)
  };
  const configured=provider==="simulation"||(provider==="whatsapp-cloud"&&Object.values(cloudRequired).every(Boolean));
  return {
    provider,activeProfile:config.activeProfile,configured,automatic:provider!=="manual"&&configured,
    cloudRequirements:provider==="whatsapp-cloud"?cloudRequired:{},
    missing:provider==="whatsapp-cloud"?Object.entries(cloudRequired).filter(([,ready])=>!ready).map(([key])=>key):[],
    reason:provider==="manual"?"El envío automático está desactivado; wa.me permanece disponible.":configured?"Proveedor listo.":"Faltan variables o una plantilla aprobada."
  };
}

function idempotencyKey(eventId,guestId,kind,campaignKey){
  return crypto.createHash("sha256").update(`${eventId}:${guestId}:${kind}:${campaignKey}`).digest("hex");
}

function queueMessages({eventId,guestIds=[],all=false,kind="invitation",campaignKey="primary",createdBy,invitationUrl}){
  if(!["invitation","reminder","confirmation"].includes(kind))throw new Error("Tipo de mensaje no permitido.");
  const params=[eventId];
  let where="g.event_id=? AND COALESCE(g.is_test,0)=0";
  if(!all){
    const ids=[...new Set(guestIds.map(Number).filter(Number.isInteger))];
    if(!ids.length)throw new Error("Selecciona al menos un invitado.");
    where+=` AND g.id IN (${ids.map(()=>"?").join(",")})`;
    params.push(...ids);
  }
  const guests=db.prepare(`SELECT id,family_name,phone,token FROM guests g WHERE ${where} ORDER BY family_name`).all(...params);
  const provider=providerName();
  const config=whatsappConfig();
  const insert=db.prepare(`
    INSERT OR IGNORE INTO message_queue
      (event_id,guest_id,kind,provider,idempotency_key,status,payload_json,created_by)
    VALUES(?,?,?,?,?,'queued',?,?)
  `);
  let queued=0,duplicates=0,withoutPhone=0;
  const items=[];
  db.transaction(()=>guests.forEach(guest=>{
    const phone=normalizePhone(guest.phone);
    if(!phone){withoutPhone++;return;}
    const payload={
      phone,familyName:guest.family_name,url:invitationUrl(guest.token),
      templateName:config.templateName
    };
    const key=idempotencyKey(eventId,guest.id,kind,String(campaignKey||"primary").slice(0,80));
    const info=insert.run(eventId,guest.id,kind,provider,key,JSON.stringify(payload),createdBy||null);
    if(info.changes){queued++;items.push(Number(info.lastInsertRowid));}else duplicates++;
  }))();
  return {queued,duplicates,withoutPhone,totalCandidates:guests.length,ids:items,provider};
}

async function sendCloud(payload){
  const config=whatsappConfig();
  const version=config.graphVersion;
  const phoneNumberId=config.phoneNumberId;
  const token=config.accessToken;
  const templateName=config.templateName;
  const language=config.templateLanguage;
  if(!version||!phoneNumberId||!token||!templateName)throw new Error("WhatsApp Cloud no está configurado completamente.");
  const response=await fetch(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneNumberId)}/messages`,{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      messaging_product:"whatsapp",to:payload.phone,type:"template",
      template:{
        name:templateName,language:{code:language},components:[{
          type:"body",parameters:[
            {type:"text",text:payload.familyName},
            {type:"text",text:payload.url}
          ]
        }]
      }
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.error?.message||`WhatsApp respondió ${response.status}.`),{code:data.error?.code||`HTTP_${response.status}`});
  const messageId=data.messages?.[0]?.id;
  if(!messageId)throw new Error("WhatsApp no devolvió message_id.");
  return {messageId,status:"sent",raw:{contacts:data.contacts?.length||0}};
}

async function sendSimulation(row){
  return {messageId:`sim-${row.id}-${crypto.randomBytes(5).toString("hex")}`,status:"sent",raw:{simulation:true}};
}

async function processQueueItem(queueId,eventId){
  const row=db.prepare("SELECT * FROM message_queue WHERE id=? AND event_id=?").get(Number(queueId),Number(eventId));
  if(!row)throw Object.assign(new Error("Mensaje de cola no encontrado."),{statusCode:404});
  if(terminalStatuses.has(row.status))return {ok:true,unchanged:true,status:row.status,id:row.id};
  if(Number(row.attempts)>=5)throw Object.assign(new Error("Se alcanzó el máximo de cinco intentos."),{statusCode:409});
  const status=providerStatus();
  if(!status.automatic)throw Object.assign(new Error(status.reason),{statusCode:409});
  let payload={};try{payload=JSON.parse(row.payload_json||"{}");}catch{}
  db.prepare("UPDATE message_queue SET status='pending',attempts=attempts+1,last_attempt_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
  try{
    const result=status.provider==="simulation"?await sendSimulation(row):await sendCloud(payload);
    db.prepare(`
      UPDATE message_queue SET status=?,provider_message_id=?,error_code=NULL,error_message=NULL,
        sent_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(result.status,result.messageId,row.id);
    const eventKey=crypto.createHash("sha256").update(`${result.messageId}:sent`).digest("hex");
    db.prepare(`INSERT OR IGNORE INTO message_events(queue_id,event_id,provider_message_id,status,event_key,payload_json) VALUES(?,?,?,?,?,?)`)
      .run(row.id,row.event_id,result.messageId,"sent",eventKey,JSON.stringify(result.raw||{}));
    return {ok:true,id:row.id,status:result.status,providerMessageId:result.messageId};
  }catch(error){
    db.prepare(`UPDATE message_queue SET status='failed',error_code=?,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(String(error.code||"SEND_FAILED").slice(0,80),String(error.message||"Error de envío").slice(0,500),row.id);
    log("error","messaging.send_failed",{queueId:row.id,eventId:row.event_id,code:error.code||"SEND_FAILED",message:error.message});
    throw Object.assign(new Error(error.message),{statusCode:502,code:error.code||"SEND_FAILED"});
  }
}

function retryMessage(queueId,eventId){
  const row=db.prepare("SELECT * FROM message_queue WHERE id=? AND event_id=?").get(Number(queueId),Number(eventId));
  if(!row)throw Object.assign(new Error("Mensaje no encontrado."),{statusCode:404});
  if(row.status!=="failed")throw Object.assign(new Error("Sólo se pueden reintentar mensajes fallidos."),{statusCode:409});
  if(row.attempts>=5)throw Object.assign(new Error("Se alcanzó el máximo de intentos."),{statusCode:409});
  db.prepare("UPDATE message_queue SET status='queued',error_code=NULL,error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
  return {ok:true,id:row.id,status:"queued"};
}

function cancelMessages(ids,eventId){
  const valid=[...new Set(ids.map(Number).filter(Number.isInteger))];
  if(!valid.length)return 0;
  const placeholders=valid.map(()=>"?").join(",");
  return db.prepare(`UPDATE message_queue SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE event_id=? AND id IN (${placeholders}) AND status IN ('pending','queued','failed')`).run(eventId,...valid).changes;
}

function validateWebhookSignature(rawBody,header){
  const secret=whatsappConfig().appSecret;
  if(!secret||!rawBody||!header)return false;
  const expected=`sha256=${crypto.createHmac("sha256",secret).update(rawBody).digest("hex")}`;
  const actual=String(header);
  return actual.length===expected.length&&crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
}

function webhookVerifyToken(){return whatsappConfig().verifyToken;}

function applyWebhook(body){
  const statuses=[];
  for(const entry of body?.entry||[])for(const change of entry?.changes||[])for(const status of change?.value?.statuses||[]){
    const providerMessageId=String(status.id||"");
    const value=String(status.status||"");
    if(!providerMessageId||!["sent","delivered","read","failed"].includes(value))continue;
    const queue=db.prepare("SELECT * FROM message_queue WHERE provider_message_id=?").get(providerMessageId);
    if(!queue)continue;
    const timestamp=String(status.timestamp||"");
    const eventKey=crypto.createHash("sha256").update(`${providerMessageId}:${value}:${timestamp}`).digest("hex");
    const raw=JSON.stringify(status).slice(0,12000);
    const inserted=db.prepare(`INSERT OR IGNORE INTO message_events(queue_id,event_id,provider_message_id,status,event_key,payload_json) VALUES(?,?,?,?,?,?)`)
      .run(queue.id,queue.event_id,providerMessageId,value,eventKey,raw).changes;
    if(!inserted)continue;
    const field=value==="delivered"?"delivered_at":value==="read"?"read_at":value==="sent"?"sent_at":null;
    if(field)db.prepare(`UPDATE message_queue SET status=?,${field}=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(value,queue.id);
    else db.prepare(`UPDATE message_queue SET status='failed',error_code='PROVIDER_FAILED',error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(JSON.stringify(status.errors||[]).slice(0,500),queue.id);
    statuses.push({queueId:queue.id,status:value});
  }
  return statuses;
}

module.exports={normalizePhone,providerStatus,webhookVerifyToken,queueMessages,processQueueItem,retryMessage,cancelMessages,validateWebhookSignature,applyWebhook};
