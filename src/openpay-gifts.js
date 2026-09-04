"use strict";

const crypto=require("crypto");

const merchantId=String(process.env.OPENPAY_MERCHANT_ID||"").trim();
const publicKey=String(process.env.OPENPAY_PUBLIC_KEY||"").trim();
const privateKey=String(process.env.OPENPAY_PRIVATE_KEY||"").trim();
const sandbox=String(process.env.OPENPAY_SANDBOX||"true").toLowerCase()!=="false";
const baseUrl=sandbox?"https://sandbox-api.openpay.mx/v1":"https://api.openpay.mx/v1";

function status(){return {configured:Boolean(merchantId&&publicKey&&privateKey),merchantId,publicKey,sandbox};}
function splitName(value){const words=String(value||"Invitado").trim().split(/\s+/).filter(Boolean);return {name:words[0]||"Invitado",lastName:words.slice(1).join(" ")||"EventStudio"};}
async function charge({event,amountCents,tokenId,deviceSessionId,name,email,phone,message}){
  if(!status().configured){const error=new Error("Openpay no configurado");error.statusCode=503;error.publicMessage="Openpay no está configurado.";throw error;}
  const person=splitName(name),orderId=`gift-${event.id}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const payload={
    source_id:tokenId,method:"card",amount:(amountCents/100).toFixed(2),currency:"MXN",
    description:`Regalo para ${String(event.name||"evento").slice(0,120)}`,
    order_id:orderId,device_session_id:deviceSessionId,
    customer:{name:person.name,last_name:person.lastName,email:String(email||"invitado@eventstudio.local").slice(0,180),phone_number:String(phone||"").slice(0,30)},
    metadata:{event_id:String(event.id),event_slug:String(event.slug||""),message:String(message||"").slice(0,500)}
  };
  const response=await fetch(`${baseUrl}/${encodeURIComponent(merchantId)}/charges`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,"Content-Type":"application/json","User-Agent":"EventStudio/6.14.2-rc.23"},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.description||data.message||`Openpay ${response.status}`);error.statusCode=response.status>=500?502:400;error.publicMessage=data.description||"Openpay rechazó la operación.";throw error;}
  return data;
}
module.exports={status,charge};
