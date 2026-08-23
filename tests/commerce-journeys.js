const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawn}=require("node:child_process");

const root=path.join(__dirname,"..");
const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-commerce-journeys-"));
const port=4300+(process.pid%300);
const base=`http://127.0.0.1:${port}`;
let server;

async function request(url,{token,eventId,json,...options}={}){
  const headers=new Headers(options.headers||{});
  if(token)headers.set("Authorization",`Bearer ${token}`);
  if(eventId)headers.set("x-event-id",String(eventId));
  let body=options.body;
  if(json!==undefined){headers.set("Content-Type","application/json");body=JSON.stringify(json);}
  const response=await fetch(`${base}${url}`,{...options,headers,body});
  const data=(response.headers.get("content-type")||"").includes("application/json")
    ?await response.json()
    :await response.text();
  return {response,data};
}

async function waitForServer(){
  for(let attempt=0;attempt<60;attempt++){
    try{if((await request("/api/health")).response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw new Error("El servidor de recorridos comerciales no inició.");
}

async function addAndPay({token,eventId,productId,times=1}){
  let cart;
  for(let count=0;count<times;count++){
    const added=await request("/api/store/cart/items",{method:"POST",token,eventId,json:{productId}});
    assert.equal(added.response.status,201,JSON.stringify(added.data));
    cart=added.data.cart;
  }
  const submitted=await request("/api/store/cart/submit",{method:"POST",token,eventId});
  assert.equal(submitted.response.status,201,JSON.stringify(submitted.data));
  assert.equal(submitted.data.demoConfirmationAvailable,true);
  const confirmed=await request(`/api/store/orders/${submitted.data.orderId}/confirm-demo`,{method:"POST",token});
  assert.equal(confirmed.response.status,200,JSON.stringify(confirmed.data));
  assert.equal(confirmed.data.order.status,"paid");
  return {cart,orderId:submitted.data.orderId};
}

async function main(){
  const env={
    ...process.env,NODE_ENV:"test",HOST:"127.0.0.1",PORT:String(port),SITE_URL:base,
    STORAGE_ROOT:storage,ALLOW_PUBLIC_REGISTRATION:"true",PAYMENT_PROVIDER:"demo",
    ENABLE_DEMO_PAYMENTS:"true"
  };
  execFileSync(process.execPath,[path.join(root,"src/seed.js")],{cwd:root,env,stdio:"ignore"});
  server=spawn(process.execPath,[path.join(root,"src/server.js")],{cwd:root,env,stdio:"ignore"});
  await waitForServer();

  const owner=(await request("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}})).data;
  const registration=await request("/api/auth/register",{method:"POST",json:{
    displayName:"Recorrido comercial",email:`journey-${process.pid}@example.test`,
    password:"RecorridoSeguro123!",planCode:"express",eventType:"wedding",locale:"es",acceptTerms:true
  }});
  assert.equal(registration.response.status,201,JSON.stringify(registration.data));
  const token=registration.data.token,eventId=registration.data.eventId;

  const trialContext=(await request("/api/account/context",{token})).data;
  assert.equal(trialContext.entitlement.plan_code,"trial");
  assert.equal(trialContext.entitlement.max_storage_mb,100);
  const trialFeatureResponse=(await request("/api/admin/features",{token,eventId})).data;
  const trialFeatures=trialFeatureResponse.features;
  ["invitation","music","gallery","premiumTemplates","seating","guestPhotoUpload"].forEach(key=>
    assert.equal(trialFeatures.find(feature=>feature.key===key).allowed,true,`${key} debe estar visible durante la prueba`)
  );
  assert.equal(trialFeatureResponse.designAccess.opening["rose-bloom"],true);
  assert.equal(trialFeatureResponse.designAccess.gallery["cinematic-depth"],true);
  const trialExperiences=await request("/api/admin/settings",{method:"PUT",token,eventId,json:{presentation:{openingStyle:"rose-bloom",galleryStyle:"cinematic-depth"}}});
  assert.equal(trialExperiences.response.status,200,JSON.stringify(trialExperiences.data));

  const expressCheckout=await request("/api/billing/checkout",{method:"POST",token,json:{planCode:"express"}});
  assert.equal(expressCheckout.response.status,200,JSON.stringify(expressCheckout.data));

  const expressFeatures=(await request("/api/admin/features",{token,eventId})).data;
  assert.equal(expressFeatures.designAccess.opening["rose-bloom"],false);
  assert.equal(expressFeatures.designAccess.gallery["cinematic-depth"],false);
  const eventSettings=(await request("/api/admin/settings",{token,eventId})).data;
  const degraded=await request(`/api/config/${encodeURIComponent(eventSettings._event.slug)}?preview=1`,{token});
  assert.equal(degraded.response.status,200,JSON.stringify(degraded.data));
  assert.equal(degraded.data.presentation.openingStyle,"wax-envelope","Un derecho vencido no debe publicar la apertura premium.");
  assert.equal(degraded.data.presentation.galleryStyle,"classic","Un derecho vencido no debe publicar el álbum premium.");
  const blockedExperience=await request("/api/admin/settings",{method:"PUT",token,eventId,json:{presentation:{openingStyle:"rose-bloom"}}});
  assert.equal(blockedExperience.response.status,403);
  assert.equal(blockedExperience.data.code,"DESIGN_PRODUCT_REQUIRED");

  const store=(await request("/api/store",{token,eventId})).data;
  const roseExperience=store.products.find(product=>product.code==="experience:rose-bloom");
  const cinematicExperience=store.products.find(product=>product.code==="experience:cinematic-depth");
  const storageProduct=store.products.find(product=>product.code==="storage:500");
  const premiumTemplate=store.products.find(product=>product.kind==="template"&&product.code==="theme:botanical-scroll");
  assert.ok(storageProduct&&!storageProduct.owned);
  assert.ok(premiumTemplate&&!premiumTemplate.owned);
  assert.ok(roseExperience&&!roseExperience.owned);
  assert.ok(cinematicExperience&&!cinematicExperience.owned);

  const roseCourtesy=await request(`/api/admin/events/${eventId}/grants`,{method:"POST",token:owner.token,json:{productId:roseExperience.id,note:"Validación RC13"}});
  assert.equal(roseCourtesy.response.status,201,JSON.stringify(roseCourtesy.data));
  const activatedRose=await request("/api/admin/settings",{method:"PUT",token,eventId,json:{presentation:{openingStyle:"rose-bloom",galleryStyle:"classic"}}});
  assert.equal(activatedRose.response.status,200,JSON.stringify(activatedRose.data));
  const activeRosePublic=await request(`/api/config/${encodeURIComponent(eventSettings._event.slug)}?preview=1`,{token});
  assert.equal(activeRosePublic.data.presentation.openingStyle,"rose-bloom");
  const revokedRose=await request(`/api/admin/events/${eventId}/grants/${roseCourtesy.data.id}`,{method:"DELETE",token:owner.token});
  assert.equal(revokedRose.response.status,200,JSON.stringify(revokedRose.data));
  const revokedRosePublic=await request(`/api/config/${encodeURIComponent(eventSettings._event.slug)}?preview=1`,{token});
  assert.equal(revokedRosePublic.data.presentation.openingStyle,"wax-envelope");

  await addAndPay({token,eventId,productId:cinematicExperience.id});
  const activatedCinematic=await request("/api/admin/settings",{method:"PUT",token,eventId,json:{presentation:{openingStyle:"wax-envelope",galleryStyle:"cinematic-depth"}}});
  assert.equal(activatedCinematic.response.status,200,JSON.stringify(activatedCinematic.data));
  const activeCinematicPublic=await request(`/api/config/${encodeURIComponent(eventSettings._event.slug)}?preview=1`,{token});
  assert.equal(activeCinematicPublic.data.presentation.galleryStyle,"cinematic-depth");

  const storagePurchase=await addAndPay({token,eventId,productId:storageProduct.id,times:2});
  assert.equal(storagePurchase.cart.items.find(item=>item.product_id===storageProduct.id).quantity,2);
  const storageUsage=await request("/api/admin/storage",{token,eventId});
  assert.equal(storageUsage.data.limitMb,2024,"1,024 MB del plan + dos mejoras de 500 MB");

  await addAndPay({token,eventId,productId:premiumTemplate.id});
  const themes=await request("/api/admin/themes",{token,eventId});
  assert.equal(themes.data.find(theme=>theme.id==="botanical-scroll").allowed,true);

  const notifications=await request("/api/account/notifications",{token});
  assert.ok(notifications.data.items.some(item=>item.kind==="purchase"));

  const basicCheckout=await request("/api/billing/checkout",{method:"POST",token,json:{planCode:"basic"}});
  assert.equal(basicCheckout.response.status,200);
  const downgrade=await request("/api/billing/checkout",{method:"POST",token,json:{planCode:"express"}});
  assert.equal(downgrade.response.status,409);
  assert.equal(downgrade.data.code,"PLAN_DOWNGRADE_NOT_ALLOWED");
  const renewal=await request("/api/billing/checkout",{method:"POST",token,json:{planCode:"basic"}});
  assert.equal(renewal.response.status,200);

  const catalog=await request("/api/admin/commerce/catalog",{token:owner.token});
  assert.ok(catalog.data.categories.some(category=>category.code==="animations"));
  assert.ok(catalog.data.profiles.some(profile=>profile.code==="planner"&&Array.isArray(profile.recommendedCategories)));
  assert.ok(catalog.data.authorizedGrants.includes("opening:particle-heart"));
  const animationsCategory=catalog.data.categories.find(category=>category.code==="animations");
  const draftProduct=await request("/api/admin/commerce/products",{method:"POST",token:owner.token,json:{
    code:`custom:journey-heart-${process.pid}`,kind:"bundle",name:"Corazón prueba gobernada",description:"Producto de validación",
    priceCents:2500,commercialStatus:"available",readinessStatus:"draft",presentationSlot:"opening",previewStrategy:"experience",
    grants:["opening:particle-heart"],eventTypes:["wedding"],categoryIds:[animationsCategory.id],public:false
  }});
  assert.equal(draftProduct.response.status,201,JSON.stringify(draftProduct.data));
  const blockedDraft=await request(`/api/admin/commerce/products/${draftProduct.data.product.id}`,{method:"PUT",token:owner.token,json:{public:true,readinessStatus:"draft"}});
  assert.equal(blockedDraft.response.status,409);
  const approvedProduct=await request(`/api/admin/commerce/products/${draftProduct.data.product.id}`,{method:"PUT",token:owner.token,json:{
    name:"Corazón prueba gobernada",description:"Producto de validación",priceCents:2500,commercialStatus:"available",readinessStatus:"approved",
    presentationSlot:"opening",previewStrategy:"experience",grants:["opening:particle-heart"],eventTypes:["wedding"],categoryIds:[animationsCategory.id],public:true
  }});
  assert.equal(approvedProduct.response.status,200,JSON.stringify(approvedProduct.data));
  assert.equal(approvedProduct.data.product.previewManifest.opening,"particle-heart");
  const customStore=await request("/api/store",{token,eventId});
  assert.ok(customStore.data.products.some(product=>product.id===draftProduct.data.product.id),"Un producto aprobado y compatible debe entrar a la Store.");
  const template=catalog.data.products.find(product=>product.kind==="template"&&product.code!=="theme:botanical-scroll");
  assert.ok(template.preview,"El catálogo de plantillas debe incluir una miniatura o símbolo identificable.");
  const hidden=await request(`/api/admin/commerce/products/${template.id}`,{method:"PUT",token:owner.token,json:{
    name:template.name,description:template.description,priceCents:template.price_cents,
    commercialStatus:"hidden",public:true
  }});
  assert.equal(hidden.response.status,200);
  const hiddenStore=await request("/api/store",{token,eventId});
  assert.ok(!hiddenStore.data.products.some(product=>product.id===template.id));

  const designKit=await request("/api/admin/settings",{method:"PUT",token,eventId,json:{designKit:{enabled:true,palette:{bg:"#f4f1ec",paper:"#ffffff",ink:"#24231f",muted:"#77736c",accent:"#65744f",gold:"#c89b42",line:"#d8d2ca"}}}});
  assert.equal(designKit.response.status,200,JSON.stringify(designKit.data));
  assert.equal(designKit.data.settings.designKit.enabled,true);
  const previewLink=await request("/api/admin/preview-links",{method:"POST",token:owner.token,eventId,json:{minutes:15}});
  assert.equal(previewLink.response.status,201,JSON.stringify(previewLink.data));
  const previewUrl=new URL(previewLink.data.url);
  const sharedPreview=await request(`${previewUrl.pathname}${previewUrl.search}`);
  assert.equal(sharedPreview.response.status,200,"El preview temporal debe abrir incluso antes de publicar.");
  const publication=await request("/api/publication/request",{method:"POST",token,eventId,json:{note:"Validación manual RC13"}});
  assert.equal(publication.response.status,201,JSON.stringify(publication.data));
  assert.equal(publication.data.status,"pending");
  const requests=await request("/api/admin/publication-requests",{token:owner.token});
  const pending=requests.data.find(item=>item.id===publication.data.requestId);
  assert.ok(pending);
  const approvedPublication=await request(`/api/admin/publication-requests/${pending.id}`,{method:"PATCH",token:owner.token,json:{action:"approve"}});
  assert.equal(approvedPublication.response.status,200,JSON.stringify(approvedPublication.data));

  const profile=await request(`/api/admin/clients/${registration.data.user.id}/commercial-profile`,{token:owner.token});
  assert.equal(profile.response.status,200);
  assert.equal(profile.data.events[0].storage_limit_mb,3048,"2,048 MB del plan básico + 1,000 MB comprados");
  assert.ok(profile.data.orders.filter(order=>order.status==="paid").length>=2);
  console.log("✓ Recorridos nuevo cliente, comprador y propietario validados");
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{
  server?.kill("SIGTERM");
  fs.rmSync(storage,{recursive:true,force:true});
});
