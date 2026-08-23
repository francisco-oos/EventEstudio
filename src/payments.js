"use strict";

const crypto=require("node:crypto");

const provider=String(process.env.PAYMENT_PROVIDER||"disabled").trim().toLowerCase();
const accessToken=String(process.env.MERCADOPAGO_ACCESS_TOKEN||"").trim();
const webhookSecret=String(process.env.MERCADOPAGO_WEBHOOK_SECRET||"").trim();
const apiBase=String(process.env.MERCADOPAGO_API_BASE||"https://api.mercadopago.com").replace(/\/$/,"");
const timeoutMs=Math.max(3000,Math.min(30000,Number(process.env.PAYMENT_TIMEOUT_MS)||12000));

function status(){
  const missing=[];
  if(provider==="mercadopago"){
    if(!accessToken)missing.push("MERCADOPAGO_ACCESS_TOKEN");
    if(!webhookSecret)missing.push("MERCADOPAGO_WEBHOOK_SECRET");
  }
  return {provider,configured:provider==="mercadopago"&&!missing.length,missing};
}

function assertConfigured(){
  const current=status();
  if(current.provider!=="mercadopago"||!current.configured){
    const error=new Error(current.missing.length?`Falta configurar ${current.missing.join(", ")}.`:"Mercado Pago no está habilitado.");
    error.code="PAYMENT_PROVIDER_DISABLED";
    throw error;
  }
  if(!/^https:\/\//i.test(apiBase)&&!(process.env.NODE_ENV==="test"&&/^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(apiBase))){
    const error=new Error("MERCADOPAGO_API_BASE debe usar HTTPS.");error.code="PAYMENT_API_INVALID";throw error;
  }
}

async function api(path,{method="GET",body,idempotencyKey}={}){
  assertConfigured();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const headers={Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"};
    if(idempotencyKey)headers["X-Idempotency-Key"]=idempotencyKey;
    const response=await fetch(`${apiBase}${path}`,{
      method,headers,signal:controller.signal,...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(payload.message||payload.error||`Mercado Pago respondió ${response.status}.`);
      error.code="PAYMENT_PROVIDER_ERROR";error.status=response.status;throw error;
    }
    return payload;
  }catch(error){
    if(error.name==="AbortError"){
      const timeout=new Error("Mercado Pago no respondió a tiempo.");timeout.code="PAYMENT_PROVIDER_TIMEOUT";throw timeout;
    }
    throw error;
  }finally{clearTimeout(timer);}
}

function cleanSiteUrl(value){
  const url=new URL(String(value||""));
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return "";
  return url.origin;
}

async function createPreference({reference,items,payerEmail,siteUrl}){
  const origin=cleanSiteUrl(siteUrl);
  if(!origin)throw Object.assign(new Error("SITE_URL no es válido para el retorno de pago."),{code:"PAYMENT_RETURN_URL_INVALID"});
  const normalizedItems=(items||[]).map(item=>({
    id:String(item.id),title:String(item.title||"Producto EventStudio").slice(0,120),
    quantity:Math.max(1,Number(item.quantity)||1),currency_id:String(item.currency||"MXN"),
    unit_price:Number((Number(item.unitPriceCents||0)/100).toFixed(2))
  })).filter(item=>item.unit_price>0);
  if(!normalizedItems.length)throw Object.assign(new Error("La preferencia requiere al menos un concepto con importe."),{code:"PAYMENT_ITEMS_INVALID"});
  const payload=await api("/checkout/preferences",{
    method:"POST",idempotencyKey:crypto.createHash("sha256").update(`eventstudio:${reference}`).digest("hex"),
    body:{
      items:normalizedItems,
      ...(payerEmail?{payer:{email:String(payerEmail).slice(0,150)}}:{}),
      external_reference:String(reference),
      notification_url:`${origin}/api/payments/mercadopago/webhook`,
      back_urls:{
        success:`${origin}/admin.html?payment=success`,
        pending:`${origin}/admin.html?payment=pending`,
        failure:`${origin}/admin.html?payment=failure`
      },
      auto_return:"approved"
    }
  });
  const checkoutUrl=String(payload.init_point||payload.sandbox_init_point||"");
  if(!payload.id||!/^https:\/\//i.test(checkoutUrl))throw Object.assign(new Error("Mercado Pago no devolvió una URL de checkout válida."),{code:"PAYMENT_CHECKOUT_INVALID"});
  return {id:String(payload.id),checkoutUrl};
}

function secureEqualHex(a,b){
  if(!/^[0-9a-f]{64}$/i.test(String(a||""))||!/^[0-9a-f]{64}$/i.test(String(b||"")))return false;
  return crypto.timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
}

function verifyWebhookSignature({signature,requestId,dataId}){
  assertConfigured();
  const parts=Object.fromEntries(String(signature||"").split(",").map(part=>part.trim().split("=",2)).filter(([key,value])=>key&&value));
  if(!parts.ts||!parts.v1||!requestId||!dataId)return false;
  const manifest=`id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected=crypto.createHmac("sha256",webhookSecret).update(manifest).digest("hex");
  return secureEqualHex(parts.v1,expected);
}

async function getPayment(paymentId){
  if(!/^\d+$/.test(String(paymentId||"")))throw Object.assign(new Error("Identificador de pago inválido."),{code:"PAYMENT_ID_INVALID"});
  return api(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

module.exports={status,createPreference,verifyWebhookSignature,getPayment};
