"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");
const {once}=require("node:events");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-mercadopago-"));
const appPort=4900+(process.pid%80);
const providerPort=5000+(process.pid%80);
const base=`http://127.0.0.1:${appPort}`;
const providerBase=`http://127.0.0.1:${providerPort}`;
const webhookSecret="mercadopago-webhook-test-secret";
let appServer,providerServer,lastPreference=null,paymentFixture=null,preferenceSequence=0;

function readBody(req){return new Promise((resolve,reject)=>{const chunks=[];req.on("data",chunk=>chunks.push(chunk));req.on("end",()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"));}catch(error){reject(error);}});req.on("error",reject);});}

async function startProvider(){
  providerServer=http.createServer(async(req,res)=>{
    res.setHeader("Content-Type","application/json");
    if(req.method==="POST"&&req.url==="/checkout/preferences"){
      assert.equal(req.headers.authorization,"Bearer TEST-ACCESS-TOKEN");
      assert.match(String(req.headers["x-idempotency-key"]||""),/^[0-9a-f]{64}$/);
      lastPreference=await readBody(req);preferenceSequence++;
      res.end(JSON.stringify({id:`pref-${preferenceSequence}`,init_point:`https://sandbox.mercadopago.test/checkout/${preferenceSequence}`}));return;
    }
    if(req.method==="GET"&&/^\/v1\/payments\/\d+$/.test(req.url||"")){
      if(!paymentFixture){res.statusCode=404;res.end(JSON.stringify({message:"not found"}));return;}
      res.end(JSON.stringify(paymentFixture));return;
    }
    res.statusCode=404;res.end(JSON.stringify({message:"not found"}));
  });
  providerServer.listen(providerPort,"127.0.0.1");await once(providerServer,"listening");
}

async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});if(token)headers.set("Authorization",`Bearer ${token}`);if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const data=(response.headers.get("content-type")||"").includes("application/json")?await response.json():await response.text();return {response,data};
}

async function waitForApp(){for(let attempt=0;attempt<60;attempt++){try{if((await request("/api/health")).response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,150));}throw new Error("EventStudio no inició para la prueba de pagos.");}

function signedHeaders(dataId,requestId="request-payment-test",ts=String(Math.floor(Date.now()/1000))){
  const manifest=`id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const signature=crypto.createHmac("sha256",webhookSecret).update(manifest).digest("hex");
  return {"x-request-id":requestId,"x-signature":`ts=${ts},v1=${signature}`};
}

async function approve(reference,amountCents,{paymentId=9001,currency="MXN"}={}){
  paymentFixture={id:paymentId,status:"approved",external_reference:reference,transaction_amount:amountCents/100,currency_id:currency};
  return request(`/api/payments/mercadopago/webhook?data.id=${paymentId}`,{method:"POST",headers:signedHeaders(paymentId),json:{type:"payment",data:{id:paymentId}}});
}

async function main(){
  await startProvider();
  const env={...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(appPort),SITE_URL:base,STORAGE_ROOT:storage,ALLOW_PUBLIC_REGISTRATION:"false",PAYMENT_PROVIDER:"mercadopago",ENABLE_DEMO_PAYMENTS:"false",MERCADOPAGO_ACCESS_TOKEN:"TEST-ACCESS-TOKEN",MERCADOPAGO_WEBHOOK_SECRET:webhookSecret,MERCADOPAGO_API_BASE:providerBase};
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  appServer=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});await waitForApp();

  const login=await request("/api/auth/login",{method:"POST",json:{email:"client@eventstudio.local",password:"Cambiar123!"}});
  const owner=await request("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}});
  const token=login.data.token,ownerToken=owner.data.token;
  const event=(await request("/api/admin/events",{token})).data[0];
  const authOptions=await request("/api/public/auth-options");
  assert.equal(authOptions.data.paymentProvider,"mercadopago");

  const planCheckout=await request("/api/billing/checkout",{method:"POST",token,json:{planCode:"premium"}});
  assert.equal(planCheckout.response.status,201,JSON.stringify(planCheckout.data));
  assert.match(planCheckout.data.checkoutUrl,/^https:\/\/sandbox\.mercadopago\.test/);
  assert.equal(lastPreference.external_reference,`eventstudio-plan:${planCheckout.data.paymentId}`);
  assert.equal(lastPreference.notification_url,`${base}/api/payments/mercadopago/webhook`);
  const planAmount=Math.round(lastPreference.items.reduce((sum,item)=>sum+item.quantity*item.unit_price,0)*100);
  const invalid=await request("/api/payments/mercadopago/webhook?data.id=9000",{method:"POST",headers:{"x-request-id":"bad","x-signature":"ts=1,v1="+"0".repeat(64)},json:{data:{id:9000}}});
  assert.equal(invalid.response.status,401);
  const planApproved=await approve(lastPreference.external_reference,planAmount,{paymentId:9002});
  assert.equal(planApproved.response.status,200,JSON.stringify(planApproved.data));
  const billing=await request("/api/billing/me",{token});
  assert.equal(billing.data.payments.find(item=>item.id===planCheckout.data.paymentId).status,"paid");

  const store=await request("/api/store",{token,eventId:event.id});
  assert.equal(store.data.paymentProvider,"mercadopago");
  const storageProduct=store.data.products.find(product=>product.code==="storage:500"&&!product.owned);
  assert.ok(storageProduct);
  const added=await request("/api/store/cart/items",{method:"POST",token,eventId:event.id,json:{productId:storageProduct.id}});
  assert.equal(added.response.status,201,JSON.stringify(added.data));
  const revenueBefore=(await request("/api/admin/owner-summary",{token:ownerToken})).data.revenue_cents;
  const submitted=await request("/api/store/cart/submit",{method:"POST",token,eventId:event.id});
  assert.equal(submitted.response.status,201,JSON.stringify(submitted.data));
  assert.match(submitted.data.checkoutUrl,/^https:\/\/sandbox\.mercadopago\.test/);
  assert.equal(lastPreference.external_reference,`eventstudio-order:${submitted.data.orderId}`);
  assert.equal((await request("/api/admin/owner-summary",{token:ownerToken})).data.revenue_cents,revenueBefore,"Una orden pendiente no es ingreso.");

  paymentFixture={id:9003,status:"approved",external_reference:lastPreference.external_reference,transaction_amount:(submitted.data.subtotal_cents+100)/100,currency_id:"MXN"};
  const mismatch=await request("/api/payments/mercadopago/webhook?data.id=9003",{method:"POST",headers:signedHeaders(9003),json:{data:{id:9003}}});
  assert.equal(mismatch.response.status,409);assert.equal(mismatch.data.code,"PAYMENT_AMOUNT_MISMATCH");
  const approved=await approve(lastPreference.external_reference,submitted.data.subtotal_cents,{paymentId:9004});
  assert.equal(approved.response.status,200,JSON.stringify(approved.data));
  const replay=await request("/api/payments/mercadopago/webhook?data.id=9004",{method:"POST",headers:signedHeaders(9004),json:{data:{id:9004}}});
  assert.equal(replay.response.status,200,"El webhook debe ser idempotente.");
  assert.equal((await request("/api/admin/owner-summary",{token:ownerToken})).data.revenue_cents,revenueBefore+submitted.data.subtotal_cents);
  const storageUsage=await request("/api/admin/storage",{token,eventId:event.id});
  assert.ok(storageUsage.data.limitMb>=Number(store.data.plan?.max_storage_mb||0)+500||storageUsage.data.limitMb>=500);
  console.log("✓ Mercado Pago: preferencia, firma, monto, webhook, idempotencia e ingresos verificados");
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(appServer&&!appServer.killed){appServer.kill("SIGTERM");await once(appServer,"exit").catch(()=>{});}
  if(providerServer?.listening){providerServer.close();await once(providerServer,"close").catch(()=>{});}
  fs.rmSync(storage,{recursive:true,force:true});
});
