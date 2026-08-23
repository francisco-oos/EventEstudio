const db=require("./db");

const forbidden=/password|secret|token|cookie|authorization|bank|access[_-]?token/i;

function safeMetadata(value,depth=0){
  if(depth>3)return "[truncated]";
  if(value===null||value===undefined)return value;
  if(Array.isArray(value))return value.slice(0,30).map(item=>safeMetadata(item,depth+1));
  if(typeof value!=="object")return typeof value==="string"?value.slice(0,500):value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key])=>!forbidden.test(key))
    .slice(0,40)
    .map(([key,item])=>[key,safeMetadata(item,depth+1)]));
}

function log(level,event,metadata={}){
  const entry={timestamp:new Date().toISOString(),level,event,...safeMetadata(metadata)};
  const line=JSON.stringify(entry);
  if(level==="error")console.error(line);
  else if(level==="warn")console.warn(line);
  else console.log(line);
}

function audit(req,action,{eventId=null,targetType=null,targetId=null,metadata={}}={}){
  const safe=safeMetadata(metadata);
  try{
    db.prepare(`
      INSERT INTO audit_logs(actor_user_id,event_id,action,target_type,target_id,metadata_json,ip_address)
      VALUES(?,?,?,?,?,?,?)
    `).run(req?.user?.id||null,eventId||req?.eventId||null,action,targetType,targetId===null?null:String(targetId),JSON.stringify(safe),String(req?.ip||"").slice(0,80));
  }catch(error){
    log("error","audit.write_failed",{action,error:error.message});
  }
  log("info",`audit.${action}`,{actorUserId:req?.user?.id||null,eventId:eventId||req?.eventId||null,targetType,targetId,...safe});
}

module.exports={log,audit,safeMetadata};
