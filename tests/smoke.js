const packageJson=require('../package.json');
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto=require("node:crypto");
const {execFileSync, spawn} = require("node:child_process");
const {once}=require("node:events");
const ExcelJS=require("exceljs");
const {verifyRuntimeAssets}=require("../scripts/iniciar-local");

const root = path.join(__dirname, "..");
const qrOutputDir = process.env.QR_OUTPUT_DIR ? path.resolve(root, process.env.QR_OUTPUT_DIR) : "";
const port = 3200 + (process.pid % 400);
const base = `http://127.0.0.1:${port}`;
const webhookSecret="smoke-webhook-secret-rc1";
let server;
const testStorage = fs.mkdtempSync(path.join(os.tmpdir(), "event-studio-smoke-"));

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function assertPdfHasUsableFonts(bytes, message){
  const source=bytes.toString("latin1");
  assert.match(source,/\/Type \/Font/,message||"El PDF debe declarar al menos una fuente utilizable.");
  assert.ok(/\/FontFile2/.test(source)||/\/BaseFont \/(?:Helvetica|Times-Roman|Courier)/.test(source),message||"El PDF debe incrustar tipografías locales o usar una fuente PDF estándar portable.");
}

async function request(url, {token, eventId, json, ...options} = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (eventId) headers.set("x-event-id", String(eventId));
  let body = options.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }
  const response = await fetch(`${base}${url}`, {...options, headers, body});
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : await response.arrayBuffer();
  return {response, data};
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const {response} = await request("/api/health");
      if (response.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error("El servidor no inició a tiempo.");
}

async function main() {
  ["src/server.js", "src/messaging.js", "public/admin.js", "public/app.js", "public/album.js", "public/catalogo.js"].forEach(file => {
    execFileSync(process.execPath, ["--check", path.join(root, file)], {stdio: "inherit"});
  });
  const testEnv = {
    ...process.env,
    NODE_ENV:"test",
    HOST:"127.0.0.1",
    STORAGE_ROOT:testStorage,
    ALLOW_PUBLIC_REGISTRATION:"true",
    PAYMENT_PROVIDER:"disabled",
    ENABLE_DEMO_PAYMENTS:"false"
  };
  execFileSync(process.execPath, [path.join(root, "src/seed.js")], {cwd: root, env: testEnv, stdio: "inherit"});

  const productionStorage=fs.mkdtempSync(path.join(os.tmpdir(),"event-studio-production-empty-"));
  const productionCount=execFileSync(process.execPath,["-e","const db=require('./src/db');process.stdout.write(String(db.prepare('SELECT COUNT(*) total FROM events').get().total));"],{
    cwd:root,env:{...process.env,NODE_ENV:"production",STORAGE_ROOT:productionStorage,TRUST_PROXY:"true"},encoding:"utf8"
  });
  assert.equal(productionCount,"0","Producción no debe crear eventos de demostración.");
  assert.throws(()=>execFileSync(process.execPath,[path.join(root,"src/seed.js")],{
    cwd:root,env:{...process.env,NODE_ENV:"production",STORAGE_ROOT:productionStorage,TRUST_PROXY:"true"},stdio:"pipe"
  }),/Command failed/);
  assert.throws(()=>execFileSync(process.execPath,[path.join(root,"src/server.js")],{
    cwd:root,env:{...process.env,NODE_ENV:"production",SITE_URL:"https://evento.example",STORAGE_ROOT:productionStorage,TRUST_PROXY:"true"},stdio:"pipe",timeout:5000
  }),/Command failed/);
  fs.rmSync(productionStorage,{recursive:true,force:true});

  server = spawn(process.execPath, [path.join(root, "src/server.js")], {
    cwd: root,
    env: {...testEnv, PORT: String(port), SITE_URL: base, WHATSAPP_PROVIDER:"simulation",WHATSAPP_APP_SECRET:webhookSecret,WHATSAPP_WEBHOOK_VERIFY_TOKEN:"smoke-verify-token"},
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer();

  const health = await request("/api/health");
    assert.equal(health.data.version,packageJson.version);
  await verifyRuntimeAssets("127.0.0.1",port);
    const adminPage=await request(`/admin.html?v=${packageJson.version}`);
  assert.equal(adminPage.response.status,200);
  assert.match(adminPage.response.headers.get("content-type")||"",/^text\/html\b/);
  assert.match(adminPage.response.headers.get("cache-control")||"",/no-cache/);
  assert.doesNotMatch(adminPage.response.headers.get("content-security-policy")||"",/upgrade-insecure-requests/i);
  assert.match(Buffer.from(adminPage.data).toString("utf8"),new RegExp(`styles\\.css\\?v=${packageJson.version.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`));
    const publicStyles=await request(`/styles.css?v=${packageJson.version}`);
  assert.equal(publicStyles.response.status,200);
  assert.match(publicStyles.response.headers.get("content-type")||"",/^text\/css\b/);
  assert.ok(Buffer.from(publicStyles.data).length>80000);
    const publicApp=await request(`/app.js?v=${packageJson.version}`);
  assert.equal(publicApp.response.status,200);
  assert.match(publicApp.response.headers.get("content-type")||"",/javascript/);
    const adminApp=await request(`/admin.js?v=${packageJson.version}`);
  assert.equal(adminApp.response.status,200);
  assert.match(adminApp.response.headers.get("content-type")||"",/javascript/);
  const catalogPage=await request(`/catalogo.html?v=${packageJson.version}`);
  assert.equal(catalogPage.response.status,200);
  assert.match(Buffer.from(catalogPage.data).toString("utf8"),/id="catalogThemeGrid"/);
  const catalogApp=await request(`/catalogo.js?v=${packageJson.version}`);
  assert.equal(catalogApp.response.status,200);
  assert.match(catalogApp.response.headers.get("content-type")||"",/javascript/);
  const samplePage=await request("/muestra.html?theme=paw-parade&event=kids-party");
  assert.equal(samplePage.response.status,200);
  assert.match(Buffer.from(samplePage.data).toString("utf8"),/id="samplePhone"/);
  const sampleApp=await request(`/muestra.js?v=${packageJson.version}`);
  assert.equal(sampleApp.response.status,200);
  assert.match(sampleApp.response.headers.get("content-type")||"",/javascript/);
  const missingApi=await request("/api/no-existe");
  assert.equal(missingApi.response.status,404);
  assert.match(missingApi.response.headers.get("content-type")||"",/application\/json/);
  assert.equal(missingApi.data.code,"API_NOT_FOUND");

  const registration=await request("/api/auth/register",{method:"POST",json:{displayName:"Cliente Registro Smoke",email:`registro-${process.pid}@example.test`,password:"RegistroSeguro123!",planCode:"starter",eventType:"baby-shower",themeId:"welcome-clouds",locale:"en",acceptTerms:true}});
  assert.equal(registration.response.status,201,JSON.stringify(registration.data));
  assert.equal(registration.data.user.role,"client");
  assert.equal(registration.data.user.preferred_locale,"en");
  const registeredAccountContext=await request("/api/account/context",{token:registration.data.token});
  assert.equal(registeredAccountContext.data.preferredLocale,"en");
  const updatedAccountLocale=await request("/api/account/locale",{method:"PUT",token:registration.data.token,json:{locale:"pt"}});
  assert.equal(updatedAccountLocale.response.status,200);
  assert.equal(updatedAccountLocale.data.locale,"pt");
  const registeredEvents=await request("/api/admin/events",{token:registration.data.token});
  assert.equal(registeredEvents.response.status,200);
  const registeredEvent=registeredEvents.data.find(item=>item.id===registration.data.eventId&&!item.published);
  assert.equal(registeredEvent.event_type,"baby-shower");
  const registeredSettings=await request("/api/admin/settings",{token:registration.data.token,eventId:registration.data.eventId});
  assert.equal(registeredSettings.data.themeId,"welcome-clouds");
  const privateMessagesHidden=await request(`/api/public/photo-messages/${encodeURIComponent(registeredEvent.slug)}`);
  assert.equal(privateMessagesHidden.response.status,404,"Un evento no publicado no debe exponer mensajes sin autorización.");
  const privateMessagesPreview=await request(`/api/public/photo-messages/${encodeURIComponent(registeredEvent.slug)}?preview=1`,{token:registration.data.token});
  assert.equal(privateMessagesPreview.response.status,200,"La vista previa autorizada debe resolver mensajes sin generar 404 repetidos.");
  assert.deepEqual(privateMessagesPreview.data,[]);
  const starterFeatures=await request("/api/admin/features",{token:registration.data.token,eventId:registration.data.eventId});
  assert.equal(starterFeatures.data.planCode,"trial");
  assert.equal(starterFeatures.data.features.find(item=>item.key==="invitation").allowed,true);
  assert.equal(starterFeatures.data.features.find(item=>item.key==="music").allowed,true);
  assert.equal(starterFeatures.data.features.find(item=>item.key==="gallery").allowed,true);
  assert.equal(starterFeatures.data.features.find(item=>item.key==="premiumTemplates").allowed,true);
  const trialContext=await request("/api/account/context",{token:registration.data.token});
  assert.equal(trialContext.data.entitlement.max_storage_mb,100);

  const ownerLogin = await request("/api/auth/login", {
    method: "POST", json: {email: "owner@eventstudio.local", password: "Cambiar123!"}
  });
  const clientLogin = await request("/api/auth/login", {
    method: "POST", json: {email: "client@eventstudio.local", password: "Cambiar123!"}
  });
  assert.equal(ownerLogin.response.status, 200);
  assert.equal(clientLogin.response.status, 200);
  const wrongLogin=await request("/api/auth/login",{method:"POST",json:{email:"client@eventstudio.local",password:"incorrecta"}});
  assert.equal(wrongLogin.response.status,401);
  assert.equal(wrongLogin.data.ok,false);
  assert.ok(wrongLogin.data.code);
  const ownerToken = ownerLogin.data.token;
  const clientToken = clientLogin.data.token;

  const cookieLogin=await request("/api/auth/login",{method:"POST",json:{email:"owner@eventstudio.local",password:"Cambiar123!"}});
  const cookie=String(cookieLogin.response.headers.get("set-cookie")||"").split(";")[0];
  assert.match(cookie,/^eventstudio_session=/);
  const cookieMe=await request("/api/auth/me",{headers:{Cookie:cookie}});
  assert.equal(cookieMe.response.status,200);
  assert.equal(cookieMe.data.role,"owner");
  const cookieLogout=await request("/api/auth/logout",{method:"POST",headers:{Cookie:cookie,Origin:base}});
  assert.equal(cookieLogout.response.status,200);
  const loggedOutMe=await request("/api/auth/me",{headers:{Cookie:cookie}});
  assert.equal(loggedOutMe.response.status,401);
  const anonymousMe=await request("/api/auth/me");
  assert.equal(anonymousMe.response.status,401,"El contrato protegido de /api/auth/me debe conservarse.");
  const optionalAnonymousMe=await request("/api/auth/me?optional=1");
  assert.equal(optionalAnonymousMe.response.status,200,"La detección opcional de sesión no debe ensuciar la consola con 401.");
  assert.equal(optionalAnonymousMe.data.authenticated,false);

  for(let attempt=0;attempt<5;attempt++)await request("/api/auth/login",{method:"POST",json:{email:"intruso@invalid.local",password:"incorrecta"}});
  const limited=await request("/api/auth/login",{method:"POST",json:{email:"intruso@invalid.local",password:"incorrecta"}});
  assert.equal(limited.response.status,429);

  const eventList = await request("/api/admin/events", {token: ownerToken});
  const event = eventList.data.find(item => item.slug === "boda-demostracion");
  assert.ok(event, "No se encontró el evento de prueba.");
  const eventId = event.id;

  const initialResponse = await request("/api/admin/settings", {token: ownerToken, eventId});
  const {_event, _permissions, ...initialSettings} = initialResponse.data;

  try {
    const plans = await request("/api/public/plans");
    assert.deepEqual(
      Object.fromEntries(plans.data.map(plan => [plan.code, plan.price_cents])),
      {express:19900,starter:29900,basic:49900,premium:99900}
    );
    const catalogResponse=await request("/api/public/catalog");
    assert.equal(catalogResponse.response.status,200);
    assert.equal(catalogResponse.data.capabilities.automaticTranslation,false);
    assert.deepEqual(catalogResponse.data.locales.map(locale=>locale.code),["es","en","pt"]);
    assert.ok(catalogResponse.data.eventTypes.some(type=>type.id==="baby-shower"));
    assert.ok(catalogResponse.data.eventTypes.some(type=>type.id==="gender-reveal"));
    assert.ok(catalogResponse.data.eventTypes.some(type=>type.id==="kids-party"));
    assert.equal(catalogResponse.data.themes.length,64);
    assert.ok(catalogResponse.data.themes.some(theme=>theme.id==="paw-parade"&&theme.layoutFamily==="story-panels"));
    assert.ok(catalogResponse.data.themes.some(theme=>theme.id==="welcome-clouds"&&theme.minPlan==="starter"));
    assert.ok(catalogResponse.data.themes.some(theme=>theme.id==="rose-blue-surprise"));
    assert.ok(catalogResponse.data.addons.some(addon=>addon.key==="themes:tier:premium"));
    assert.ok(!catalogResponse.data.addons.some(addon=>["thematicExperience","music","gallery"].includes(addon.key)));
    assert.ok(!catalogResponse.data.plans.some(plan=>plan.code==="studio"));
    const internalPlans=await request("/api/admin/plans",{token:ownerToken});
    assert.ok(internalPlans.data.some(plan=>plan.code==="studio"));
    const forbiddenInternalPlans=await request("/api/admin/plans",{token:clientToken});
    assert.equal(forbiddenInternalPlans.response.status,403);
    const commerceCatalog=await request("/api/admin/commerce/catalog",{token:ownerToken});
    assert.equal(commerceCatalog.response.status,200);
    assert.ok(commerceCatalog.data.products.length>=80);
    assert.ok(commerceCatalog.data.plans.every(plan=>Array.isArray(plan.products)));
    const premiumCollection=commerceCatalog.data.products.find(product=>product.code==="themes:tier:premium");
    const storageCatalogProduct=commerceCatalog.data.products.find(product=>product.code==="storage:500");
    const basicCommercialPlan=commerceCatalog.data.plans.find(plan=>plan.code==="basic");
    assert.ok(premiumCollection);
    const createdPlan=await request("/api/admin/commerce/plans",{
      method:"POST",token:ownerToken,json:{
        name:"Plan VIP Smoke",code:`vip-smoke-${process.pid}`,priceCents:125000,public:false
      }
    });
    assert.equal(createdPlan.response.status,201,JSON.stringify(createdPlan.data));
    assert.deepEqual(createdPlan.data.plan.products,[]);
    const configuredCreatedPlan=await request(`/api/admin/commerce/plans/${createdPlan.data.plan.id}`,{
      method:"PUT",token:ownerToken,json:{
        name:"Plan VIP Smoke",tagline:"Plan creado desde Mi negocio",priceCents:125000,
        durationDays:120,maxEvents:2,maxGuests:500,maxStorageMb:4096,
        public:false,featured:false,productIds:[premiumCollection.id]
      }
    });
    assert.equal(configuredCreatedPlan.response.status,200,JSON.stringify(configuredCreatedPlan.data));
    assert.equal(configuredCreatedPlan.data.plan.products[0].code,"themes:tier:premium");
    const invalidLowerPlan=await request(`/api/admin/commerce/plans/${basicCommercialPlan.id}`,{
      method:"PUT",token:ownerToken,json:{
        name:basicCommercialPlan.name,tagline:basicCommercialPlan.tagline,
        priceCents:basicCommercialPlan.price_cents,durationDays:basicCommercialPlan.duration_days,
        maxEvents:basicCommercialPlan.max_events,maxGuests:basicCommercialPlan.max_guests,
        maxStorageMb:basicCommercialPlan.max_storage_mb,public:basicCommercialPlan.public,
        featured:basicCommercialPlan.featured,
        productIds:[...basicCommercialPlan.products.map(product=>product.id),storageCatalogProduct.id]
      }
    });
    assert.equal(invalidLowerPlan.response.status,409);
    assert.equal(invalidLowerPlan.data.code,"PLAN_EXCEEDS_PREMIUM");

    const premiumThemeBlocked=await request("/api/admin/settings",{
      method:"PUT",token:registration.data.token,eventId:registration.data.eventId,json:{themeId:"botanical-scroll"}
    });
    assert.equal(premiumThemeBlocked.response.status,200);
    const ignoredLegacyCheckbox=await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId:registration.data.eventId,json:{purchasedFeatures:["premiumTemplates"]}
    });
    assert.equal(ignoredLegacyCheckbox.response.status,200,JSON.stringify(ignoredLegacyCheckbox.data));
    const stillBlockedAfterLegacyCheckbox=await request("/api/admin/settings",{
      method:"PUT",token:registration.data.token,eventId:registration.data.eventId,json:{themeId:"botanical-scroll"}
    });
    assert.equal(stillBlockedAfterLegacyCheckbox.response.status,200,"La prueba completa conserva acceso sin depender de la casilla histórica.");
    const grantedTemplateCourtesy=await request(`/api/admin/events/${registration.data.eventId}/grants`,{
      method:"POST",token:ownerToken,eventId:registration.data.eventId,
      json:{productId:premiumCollection.id,note:"Cortesía de prueba"}
    });
    assert.equal(grantedTemplateCourtesy.response.status,201,JSON.stringify(grantedTemplateCourtesy.data));
    assert.equal(grantedTemplateCourtesy.data.revenue_cents,0);
    assert.equal(grantedTemplateCourtesy.data.complimentary,true);
    const starterThemesWithCourtesy=await request("/api/admin/themes",{token:registration.data.token,eventId:registration.data.eventId});
    assert.equal(starterThemesWithCourtesy.data.find(theme=>theme.id==="botanical-scroll").allowed,true);
    const premiumThemeWithAddon=await request("/api/admin/settings",{
      method:"PUT",token:registration.data.token,eventId:registration.data.eventId,json:{themeId:"botanical-scroll"}
    });
    assert.equal(premiumThemeWithAddon.response.status,200,JSON.stringify(premiumThemeWithAddon.data));
    assert.equal(premiumThemeWithAddon.data.settings.themeId,"botanical-scroll");
    const contextualStore=await request("/api/store",{token:registration.data.token,eventId:registration.data.eventId});
    assert.equal(contextualStore.response.status,200);
    assert.equal(contextualStore.data.event.event_type,"baby-shower");
    assert.ok(contextualStore.data.products.every(product=>product.eventTypes.includes("*")||product.eventTypes.includes("baby-shower")));
    const storageProduct=contextualStore.data.products.find(product=>product.code==="storage:500");
    assert.ok(storageProduct&&!storageProduct.owned,"El almacenamiento adicional debe poder comprarse de forma independiente.");
    const revenueBeforePendingOrder=(await request("/api/admin/owner-summary",{token:ownerToken})).data.revenue_cents;
    const cartItem=await request("/api/store/cart/items",{
      method:"POST",token:registration.data.token,eventId:registration.data.eventId,json:{productId:storageProduct.id}
    });
    assert.equal(cartItem.response.status,201);
    assert.equal(cartItem.data.cart.items.length,1);
    const pendingOrder=await request("/api/store/cart/submit",{
      method:"POST",token:registration.data.token,eventId:registration.data.eventId
    });
    assert.equal(pendingOrder.response.status,201);
    assert.equal(pendingOrder.data.status,"pending_payment");
    const revenueAfterPendingOrder=(await request("/api/admin/owner-summary",{token:ownerToken})).data.revenue_cents;
    assert.equal(revenueAfterPendingOrder,revenueBeforePendingOrder,"Un pedido pendiente no debe contarse como ingreso.");
    const commercialProfile=await request(`/api/admin/clients/${registration.data.user.id}/commercial-profile`,{token:ownerToken});
    assert.equal(commercialProfile.response.status,200);
    assert.ok(commercialProfile.data.orders.some(order=>order.id===pendingOrder.data.orderId&&order.status==="pending_payment"));
    assert.ok(!commercialProfile.data.events[0].origins.some(origin=>origin.origin==="purchase"),"El pedido pendiente no debe conceder derechos.");
    const hideStorageProduct=await request(`/api/admin/commerce/products/${storageProduct.id}`,{
      method:"PUT",token:ownerToken,json:{
        name:storageProduct.name,priceCents:storageProduct.price_cents,
        commercialStatus:"hidden",public:true
      }
    });
    assert.equal(hideStorageProduct.response.status,200);
    const storeWithoutHiddenStorage=await request("/api/store",{token:registration.data.token,eventId:registration.data.eventId});
    assert.ok(!storeWithoutHiddenStorage.data.products.some(product=>product.code==="storage:500"));
    const restoreStorageProduct=await request(`/api/admin/commerce/products/${storageProduct.id}`,{
      method:"PUT",token:ownerToken,json:{
        name:storageProduct.name,priceCents:storageProduct.price_cents,
        commercialStatus:"available",public:true
      }
    });
    assert.equal(restoreStorageProduct.response.status,200);
    const physicalProduct=commerceCatalog.data.products.find(product=>product.code==="bundle:physical");
    const promotion=await request("/api/admin/commerce/promotions",{
      method:"POST",token:ownerToken,json:{
        name:"Cortesía temporal smoke",audiencePlanCode:"trial",eventType:"baby-shower",
        status:"active",productIds:[physicalProduct.id],note:"No genera ingreso"
      }
    });
    assert.equal(promotion.response.status,201);
    const promotedFeatures=await request("/api/admin/features",{token:registration.data.token,eventId:registration.data.eventId});
    assert.equal(promotedFeatures.data.features.find(item=>item.key==="physicalInvitations").allowed,true);
    const pausePromotion=await request(`/api/admin/commerce/promotions/${promotion.data.id}`,{
      method:"PATCH",token:ownerToken,json:{status:"paused"}
    });
    assert.equal(pausePromotion.response.status,200);
    const featuresAfterPromotion=await request("/api/admin/features",{token:registration.data.token,eventId:registration.data.eventId});
    assert.equal(featuresAfterPromotion.data.features.find(item=>item.key==="physicalInvitations").allowed,true,"La prueba completa sigue mostrando la función al pausar la promoción.");

    const clientSettings = await request("/api/admin/settings", {token: clientToken, eventId});
    assert.equal(clientSettings.data._permissions.platformUser, false);
    assert.equal(clientSettings.data.developer.mode, "production");
    assert.equal(clientSettings.data.featureStates,undefined,"El cliente no debe recibir estados internos de módulos.");
    assert.equal(clientSettings.data.features.whatsappBusiness,false,"WhatsApp oculto no debe anunciarse al cliente.");
    const clientFeatureContext=await request("/api/admin/features",{token:clientToken,eventId});
    const hiddenWhatsapp=clientFeatureContext.data.features.find(item=>item.key==="whatsappBusiness");
    assert.equal(hiddenWhatsapp.allowed,false);
    assert.equal(hiddenWhatsapp.label,"WhatsApp Business automático","El cliente necesita etiquetas seguras para construir su menú visual.");
    assert.equal(hiddenWhatsapp.state,undefined,"El estado oculto no debe exponerse al cliente.");

    const thematicSettings=await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId,json:{
        themeId:"paw-parade",
        presentation:{experienceMode:"story",motionLevel:"dynamic"},
        creativeBrief:{
          protagonist:"Protagonista de prueba",
          milestone:"Cumple 6",
          theme:"Aventura de perritos originales",
          tone:"adventurous",
          visualNotes:"Escenario alegre sin franquicias.",
          assetRightsConfirmed:true
        }
      }
    });
    assert.equal(thematicSettings.response.status,200,JSON.stringify(thematicSettings.data));
    assert.equal(thematicSettings.data.settings.creativeBrief.theme,"Aventura de perritos originales");
    assert.equal(thematicSettings.data.settings.creativeBrief.assetRightsConfirmed,true);
    const thematicPublic=await request("/api/config/boda-demostracion");
    assert.equal(thematicPublic.data._theme.id,"paw-parade");
    assert.equal(thematicPublic.data._theme.layoutFamily,"story-panels");
    assert.equal(thematicPublic.data.presentation.experienceMode,"story");
    assert.equal(thematicPublic.data.presentation.motionLevel,"dynamic");
    assert.equal(thematicPublic.data.creativeBrief,undefined,"El contexto creativo interno no debe publicarse.");
    await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId,json:{
        themeId:initialSettings.themeId,
        presentation:initialSettings.presentation,
        creativeBrief:initialSettings.creativeBrief
      }
    });

    const localized=await request("/api/admin/settings",{
      method:"PUT",token:clientToken,eventId,json:{localization:{
        defaultLocale:"en",enabledLocales:["es","en","pt"],
        contentTranslations:{es:{"event.heroMessage":"Mensaje en español"},pt:{"event.heroMessage":"Mensagem em português"}}
      }}
    });
    assert.equal(localized.response.status,200,JSON.stringify(localized.data));
    assert.equal(localized.data.settings.localization.contentTranslations.pt["event.heroMessage"],"Mensagem em português");
    const localizedPublic=await request("/api/config/boda-demostracion");
    assert.equal(localizedPublic.data.localization.defaultLocale,"en");
    assert.equal(localizedPublic.data.localization.contentTranslations.es["event.heroMessage"],"Mensaje en español");
    assert.equal(localizedPublic.data.purchasedFeatures,undefined);

    await request("/api/admin/settings", {
      method: "PUT", token: clientToken, eventId,
      json: {features: {spotify: false}, developer: {mode: "development", showBanner: true}}
    });
    const protectedSettings = await request("/api/admin/settings", {token: ownerToken, eventId});
    assert.deepEqual(protectedSettings.data.features, initialSettings.features);
    assert.deepEqual(protectedSettings.data.developer, initialSettings.developer);

    const protectedMedia=await request("/api/admin/settings",{
      method:"PUT",
      token:clientToken,
      eventId,
      json:{
        media:{
          heroImage:'x" onerror="alert(1)',
          gallery:['x"><svg onload="alert(1)">']
        },
        dressCode:{referenceImages:['x" onerror="alert(1)']},
        gifts:{link:"javascript:alert(1)"}
      }
    });
    assert.deepEqual(protectedMedia.data.settings.media.gallery,initialSettings.media.gallery);
    assert.equal(protectedMedia.data.settings.media.heroImage,initialSettings.media.heroImage);
    assert.deepEqual(protectedMedia.data.settings.dressCode.referenceImages,initialSettings.dressCode.referenceImages);
    assert.equal(protectedMedia.data.settings.gifts.link,"");
    const sanitizedPublicConfig=await request("/api/config/boda-demostracion");
    assert.equal(sanitizedPublicConfig.data.gifts.link,"");
    assert.doesNotMatch(JSON.stringify(sanitizedPublicConfig.data),/onerror|onload|javascript:/i);
    assert.match(sanitizedPublicConfig.response.headers.get("cache-control")||"",/no-store/);
    assert.match(sanitizedPublicConfig.data._revision,/^[a-f0-9]{16}$/);
    const openingBefore=initialSettings.presentation?.openingStyle||"wax-envelope";
    const openingForSync=openingBefore==="minimal-envelope"?"floral-envelope":"minimal-envelope";
    const synchronizedOpening=await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId,json:{presentation:{openingStyle:openingForSync}}
    });
    assert.equal(synchronizedOpening.response.status,200,JSON.stringify(synchronizedOpening.data));
    const refreshedPublicConfig=await request("/api/config/boda-demostracion");
    assert.equal(refreshedPublicConfig.data.presentation.openingStyle,openingForSync);
    assert.notEqual(refreshedPublicConfig.data._revision,sanitizedPublicConfig.data._revision);
    await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId,json:{presentation:{openingStyle:openingBefore}}
    });

    const automaticForbidden=await request("/api/admin/messaging/status",{token:clientToken,eventId});
    assert.equal(automaticForbidden.response.status,403);
    assert.equal(automaticForbidden.data.code,"FEATURE_UNAVAILABLE");

    const supportEvent=await request("/api/admin/events",{method:"POST",token:ownerToken,json:{name:"Evento aislado de soporte",eventType:"custom"}});
    assert.equal(supportEvent.response.status,200);
    const isolated=await request("/api/admin/settings",{token:clientToken,eventId:supportEvent.data.id});
    assert.equal(isolated.response.status,403);
    const transferAccount=await request("/api/admin/users",{
      method:"POST",token:ownerToken,
      json:{email:"transfer-smoke@eventstudio.local",displayName:"Cliente transferencia",role:"client",password:"CambiarTransfer123!",eventIds:[]}
    });
    assert.equal(transferAccount.response.status,201,JSON.stringify(transferAccount.data));
    assert.equal(transferAccount.data.plan.code,"trial");
    const grantedPlan=await request(`/api/admin/users/${transferAccount.data.id}/grant-plan`,{
      method:"POST",token:ownerToken,json:{planCode:"starter",reason:"Prueba de plan de cortesía"}
    });
    assert.equal(grantedPlan.response.status,200,JSON.stringify(grantedPlan.data));
    assert.equal(grantedPlan.data.complimentary,true);
    const transferred=await request(`/api/admin/events/${supportEvent.data.id}/transfer`,{
      method:"POST",token:ownerToken,json:{clientId:transferAccount.data.id}
    });
    assert.equal(transferred.response.status,200,JSON.stringify(transferred.data));
    assert.equal(transferred.data.subscriptionUsable,true);
    const transferLogin=await request("/api/auth/login",{method:"POST",json:{email:"transfer-smoke@eventstudio.local",password:"CambiarTransfer123!"}});
    const transferPassword=await request("/api/auth/password",{method:"PUT",token:transferLogin.data.token,json:{currentPassword:"CambiarTransfer123!",newPassword:"NuevaTransfer123!"}});
    assert.equal(transferPassword.response.status,200);
    const transferredAccess=await request("/api/admin/settings",{token:transferLogin.data.token,eventId:supportEvent.data.id});
    assert.equal(transferredAccess.response.status,200);
    const editedTransferAccount=await request(`/api/admin/users/${transferAccount.data.id}`,{
      method:"PUT",token:ownerToken,
      json:{displayName:"Cliente transferencia editado",email:"transfer-edited@eventstudio.local",role:"client",eventIds:[supportEvent.data.id]}
    });
    assert.equal(editedTransferAccount.response.status,200,JSON.stringify(editedTransferAccount.data));
    const usersAfterEdit=await request("/api/admin/users",{token:ownerToken});
    const editedUser=usersAfterEdit.data.find(item=>item.id===transferAccount.data.id);
    assert.equal(editedUser.email,"transfer-edited@eventstudio.local");
    assert.deepEqual(editedUser.event_ids,[supportEvent.data.id]);
    const clientPlanBeforeReactivation=(await request("/api/admin/clients",{token:ownerToken})).data.find(item=>item.id===transferAccount.data.id)?.plan_code;
    const deactivatedUser=await request(`/api/admin/users/${transferAccount.data.id}?mode=deactivate`,{method:"DELETE",token:ownerToken});
    assert.equal(deactivatedUser.response.status,200);
    const inactiveLogin=await request("/api/auth/login",{method:"POST",json:{email:"transfer-edited@eventstudio.local",password:"NuevaTransfer123!"}});
    assert.equal(inactiveLogin.response.status,401);
    const reactivatedUser=await request(`/api/admin/users/${transferAccount.data.id}/reactivate`,{method:"POST",token:ownerToken});
    assert.equal(reactivatedUser.response.status,200,JSON.stringify(reactivatedUser.data));
    const reactivatedLogin=await request("/api/auth/login",{method:"POST",json:{email:"transfer-edited@eventstudio.local",password:"NuevaTransfer123!"}});
    assert.equal(reactivatedLogin.response.status,200);
    const clientPlanAfterReactivation=(await request("/api/admin/clients",{token:ownerToken})).data.find(item=>item.id===transferAccount.data.id)?.plan_code;
    assert.equal(clientPlanAfterReactivation,clientPlanBeforeReactivation,"Reactivar no debe renovar ni sustituir el plan.");

    const xvEvent=await request("/api/admin/events",{method:"POST",token:ownerToken,json:{name:"XV de prueba",eventType:"xv"}});
    assert.equal(xvEvent.response.status,200);
    const xvSettings=await request("/api/admin/settings",{token:ownerToken,eventId:xvEvent.data.id});
    assert.equal(xvSettings.data.presentation.heroEyebrow,"Mis XV años");
    assert.equal(xvSettings.data.presentation.storyEyebrow,"Una etapa especial");
    assert.equal(xvSettings.data.story.title,"Mi historia");
    assert.doesNotMatch(JSON.stringify(xvSettings.data),/Francisco|Ariana|Nuestra boda/);
    const validTypography=await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId:xvEvent.data.id,
      json:{typography:{heading:"great-vibes",body:"montserrat",nameCase:"uppercase"},presentation:{openingStyle:"cinematic-fold"}}
    });
    assert.equal(validTypography.response.status,200,JSON.stringify(validTypography.data));
    let typographySettings=await request("/api/admin/settings",{token:ownerToken,eventId:xvEvent.data.id});
    assert.deepEqual(typographySettings.data.typography,{
      heading:"great-vibes",body:"montserrat",scale:"comfortable",nameCase:"uppercase"
    });
    assert.equal(typographySettings.data.presentation.openingStyle,"cinematic-fold");
    const rejectedTypography=await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId:xvEvent.data.id,
      json:{typography:{heading:"url(javascript:alert(1))",body:"desconocida",nameCase:"lowercase"},presentation:{openingStyle:"script"}}
    });
    assert.equal(rejectedTypography.response.status,200,JSON.stringify(rejectedTypography.data));
    typographySettings=await request("/api/admin/settings",{token:ownerToken,eventId:xvEvent.data.id});
    assert.equal(typographySettings.data.typography.heading,"great-vibes");
    assert.equal(typographySettings.data.typography.body,"montserrat");
    assert.equal(typographySettings.data.typography.nameCase,"uppercase");
    assert.equal(typographySettings.data.presentation.openingStyle,"cinematic-fold");
    const deletedXv=await request(`/api/admin/events/${xvEvent.data.id}?mode=permanent`,{method:"DELETE",token:ownerToken,json:{}});
    assert.equal(deletedXv.response.status,200);

    const createdGuest=await request("/api/admin/guests",{
      method:"POST",token:clientToken,eventId,
      json:{code:"SMOKE-CRUD",family_name:"Familia CRUD",phone:"(993) 123-4567",max_adults:2,max_children:1,table_name:"Mesa 1"}
    });
    assert.equal(createdGuest.response.status,200,JSON.stringify(createdGuest.data));
    const noPhoneCreated=await request("/api/admin/guests",{
      method:"POST",token:clientToken,eventId,
      json:{code:"SMOKE-NOPHONE",family_name:"Familia sin teléfono",phone:"",max_adults:1,max_children:0}
    });
    assert.equal(noPhoneCreated.response.status,200);
    const automaticCodeGuest=await request("/api/admin/guests",{
      method:"POST",token:clientToken,eventId,
      json:{family_name:"Familia código automático",phone:"9931112233",max_adults:2,max_children:0,table_name:"Mesa Nueva Automática"}
    });
    assert.equal(automaticCodeGuest.response.status,200,JSON.stringify(automaticCodeGuest.data));
    assert.equal(automaticCodeGuest.data.generatedCode,true);
    assert.match(automaticCodeGuest.data.code,/^FAM-\d{4}$/);
    const duplicateGuest=await request("/api/admin/guests",{
      method:"POST",token:clientToken,eventId,
      json:{code:"SMOKE-CRUD",family_name:"Familia duplicada",max_adults:1,max_children:0}
    });
    assert.equal(duplicateGuest.response.status,400);
    const planLimitGuest=await request("/api/admin/guests",{
      method:"POST",token:clientToken,eventId,
      json:{code:"SMOKE-LIMIT",family_name:"Excede plan",max_adults:10000,max_children:0}
    });
    assert.equal(planLimitGuest.response.status,409);
    let guestInventory=await request("/api/admin/guests",{token:clientToken,eventId});
    let crudGuest=guestInventory.data.find(item=>item.code==="SMOKE-CRUD");
    const noPhoneGuest=guestInventory.data.find(item=>item.code==="SMOKE-NOPHONE");
    assert.ok(crudGuest);
    assert.ok(noPhoneGuest);
    assert.equal(crudGuest.phone,"529931234567");
    const updatedGuest=await request(`/api/admin/guests/${crudGuest.id}`,{
      method:"PUT",token:clientToken,eventId,
      json:{...crudGuest,family_name:"Familia CRUD actualizada",max_adults:2,max_children:1}
    });
    assert.equal(updatedGuest.response.status,200);

    const importWorkbook=new ExcelJS.Workbook();
    const importSheet=importWorkbook.addWorksheet("Invitados");
    importSheet.addRow(["CODIGO","FAMILIA","ADULTOS","NIÑOS","TELEFONO","MESA"]);
    importSheet.addRow(["SMOKE-CRUD","Familia actualizada por Excel",2,1,"9931234567","Mesa 1"]);
    importSheet.addRow(["SMOKE-IMPORT","Familia importada",1,1,"9937654321","Mesa 2"]);
    importSheet.addRow(["SMOKE-IMPORT","Duplicada en archivo",1,0,"9937654321","Mesa 2"]);
    importSheet.addRow(["SMOKE-INVALID","",1,0,"",""]);
    importSheet.addRow(["","Familia Excel sin código",1,1,"9934445566","Mesa Excel Automática"]);
    const importForm=new FormData();
    importForm.append("file",new Blob([Buffer.from(await importWorkbook.xlsx.writeBuffer())],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"invitados-smoke.xlsx");
    const imported=await request("/api/admin/import",{method:"POST",token:clientToken,eventId,body:importForm});
    assert.equal(imported.response.status,200,JSON.stringify(imported.data));
    assert.equal(imported.data.inserted,2);
    assert.equal(imported.data.updated,1);
    assert.equal(imported.data.skipped,1);
    assert.equal(imported.data.generatedCodes,1);
    assert.ok(imported.data.errors.some(item=>item.code==="DUPLICATE_IN_FILE"));
    assert.ok(imported.data.errors.some(item=>item.code==="REQUIRED_FIELDS"));
    const templateFile=await request("/api/admin/template.xlsx",{token:clientToken,eventId});
    const templateWorkbook=new ExcelJS.Workbook();
    await templateWorkbook.xlsx.load(Buffer.from(templateFile.data));
    assert.equal(templateWorkbook.worksheets[0].name,"Invitados");
    assert.equal(templateWorkbook.worksheets[0].getCell("A1").value,"CODIGO");
    assert.equal(templateWorkbook.worksheets[0].getCell("A2").value,"");
    assert.equal(templateWorkbook.worksheets[0].getCell("B2").value,"");
    assert.ok(templateWorkbook.getWorksheet("Instrucciones"));
    const currentGuestsFile=await request("/api/admin/guests.xlsx",{token:clientToken,eventId});
    assert.equal(currentGuestsFile.response.status,200);
    const currentGuestsWorkbook=new ExcelJS.Workbook();
    await currentGuestsWorkbook.xlsx.load(Buffer.from(currentGuestsFile.data));
    const currentGuestsSheet=currentGuestsWorkbook.getWorksheet("Invitados");
    assert.equal(currentGuestsSheet.getCell("A1").value,"CODIGO");
    assert.equal(currentGuestsSheet.getCell("I1").value,"ESTADO ENTREGA");
    assert.ok(currentGuestsSheet.getColumn(1).values.includes("SMOKE-CRUD"));
    assert.ok(currentGuestsWorkbook.getWorksheet("Instrucciones"));

    const forbiddenRole = await request("/api/admin/users", {
      method: "POST", token: ownerToken,
      json: {email: "otro-owner@evento.local", displayName: "No permitido", role: "owner", password: "Cambiar123!"}
    });
    assert.equal(forbiddenRole.response.status, 400);

    await request("/api/admin/settings", {
      method: "PUT", token: ownerToken, eventId,
      json: {developer: {mode: "development", showBanner: true}}
    });
    const testInvitation = await request("/api/admin/developer/test-invitation", {
      method: "POST", token: ownerToken, eventId,
      json: {adults: 2, children: 1, family_name: "Prueba funcional 6.9"}
    });
    assert.equal(testInvitation.response.status, 200);
    const invitationToken = testInvitation.data.guest.token;

    await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId,json:{rsvp:{allowFlexibleComposition:true,allowChanges:true}}
    });
    const flexibleRsvp=await request("/api/rsvp",{
      method:"POST",json:{token:invitationToken,attending:true,adults:3,children:0}
    });
    assert.equal(flexibleRsvp.response.status,200,JSON.stringify(flexibleRsvp.data));
    const flexibleOverflow=await request("/api/rsvp",{
      method:"POST",json:{token:invitationToken,attending:true,adults:3,children:1}
    });
    assert.equal(flexibleOverflow.response.status,400);
    await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId,
      json:{menus:{serviceMode:"guest-choice",selectionEnabled:true,adultOptions:["Carne","Vegetariano"],childOptions:["Infantil"]}}
    });
    const excessMenus=await request("/api/rsvp",{
      method:"POST",json:{token:invitationToken,attending:true,adults:2,children:1,adult_menu_counts:{Carne:2,Vegetariano:1},child_menu_counts:{Infantil:1}}
    });
    assert.equal(excessMenus.response.status,400);
    const exactMenus=await request("/api/rsvp",{
      method:"POST",json:{token:invitationToken,attending:true,adults:2,children:1,adult_menu_counts:{Carne:1,Vegetariano:1},child_menu_counts:{Infantil:1}}
    });
    assert.equal(exactMenus.response.status,200,JSON.stringify(exactMenus.data));
    await request("/api/admin/settings",{
      method:"PUT",token:ownerToken,eventId,
      json:{rsvp:{allowFlexibleComposition:false,allowChanges:true},menus:{serviceMode:"fixed",selectionEnabled:false,adultOptions:["Menú adulto"],childOptions:["Menú infantil"]}}
    });

    const overCapacity=await request("/api/rsvp",{
      method:"POST",json:{token:invitationToken,attending:true,adults:3,children:1}
    });
    assert.equal(overCapacity.response.status,400);
    const negativeRsvp=await request("/api/rsvp",{
      method:"POST",json:{token:invitationToken,attending:true,adults:-1,children:0}
    });
    assert.equal(negativeRsvp.response.status,400);

    const rsvp = await request("/api/rsvp", {
      method: "POST",
      json: {
        token: invitationToken,
        attending: true,
        adults: 2,
        children: 1,
        attendee_names: "Ana, Luis y Leo",
        dietary: "Sin nueces",
        special_needs:"Menú infantil sin lácteos",
        responsible_name:"Ana Responsable",
        accessibility_options: ["Silla alta para niño"],
        accessibility_other: "Mesa cerca del acceso"
      }
    });
    assert.equal(rsvp.response.status,200,JSON.stringify(rsvp.data));
    assert.equal(rsvp.data.status, "confirmed");
    const invitationState = await request(`/api/invitation/token/${invitationToken}`);
    assert.equal(invitationState.data.rsvp.accessibility_other, "Mesa cerca del acceso");
    assert.match(invitationState.data.rsvp.accessibility_options, /Silla alta para niño/);
    assert.equal(invitationState.data.rsvp.responsible_name,"Ana Responsable");
    assert.match(invitationState.data.rsvp.adult_menu_counts,/Menú adulto/);
    assert.match(invitationState.data.rsvp.child_menu_counts,/infantil/i);
    assert.equal("private_notes" in invitationState.data.guest, false);
    assert.equal("settings_json" in invitationState.data.guest, false);

    const guests = await request("/api/admin/guests", {token: clientToken, eventId});
    const rejectGuest=guests.data.find(guest=>!guest.is_test&&guest.code==="FAM003");
    const declinedRsvp=await request("/api/rsvp",{method:"POST",json:{token:rejectGuest.token,attending:false,adults:0,children:0,message:"No podremos asistir"}});
    assert.equal(declinedRsvp.response.status,200);
    assert.equal(declinedRsvp.data.status,"declined");
    const realIds = guests.data.filter(guest => !guest.is_test&&guest.phone).slice(0, 2).map(guest => guest.id);
    const queue = await request(`/api/admin/guests/whatsapp-batch?ids=${realIds.join(",")}`, {
      token: clientToken, eventId
    });
    assert.ok(Array.isArray(queue.data));
    assert.ok(queue.data.every(item => item.url.startsWith("https://wa.me/")));

    const automaticQueue=await request("/api/admin/messaging/queue",{
      method:"POST",token:ownerToken,eventId,json:{guestIds:realIds,kind:"invitation",campaignKey:"smoke-rc1"}
    });
    assert.equal(automaticQueue.response.status,201,JSON.stringify(automaticQueue.data));
    assert.ok(automaticQueue.data.queued>=1);
    const duplicateQueue=await request("/api/admin/messaging/queue",{
      method:"POST",token:ownerToken,eventId,json:{guestIds:realIds,kind:"invitation",campaignKey:"smoke-rc1"}
    });
    assert.equal(duplicateQueue.data.queued,0);
    assert.ok(duplicateQueue.data.duplicates>=1);
    const processedQueue=await request("/api/admin/messaging/process",{
      method:"POST",token:ownerToken,eventId,json:{ids:automaticQueue.data.ids}
    });
    assert.equal(processedQueue.response.status,200);
    assert.ok(processedQueue.data.results.every(item=>item.status==="sent"));
    const withoutPhoneQueue=await request("/api/admin/messaging/queue",{
      method:"POST",token:ownerToken,eventId,json:{guestIds:[noPhoneGuest.id],kind:"invitation",campaignKey:"smoke-no-phone"}
    });
    assert.equal(withoutPhoneQueue.data.queued,0);
    assert.equal(withoutPhoneQueue.data.withoutPhone,1);

    const failedMessage=processedQueue.data.results[0];
    const webhookPayload={entry:[{changes:[{value:{statuses:[{id:failedMessage.providerMessageId,status:"failed",timestamp:"1720000000",errors:[{code:131000,title:"Falla simulada de proveedor"}]}]}}]}]};
    const webhookRaw=JSON.stringify(webhookPayload);
    const webhookSignature=`sha256=${crypto.createHmac("sha256",webhookSecret).update(webhookRaw).digest("hex")}`;
    const validWebhook=await request("/api/messaging/webhook",{
      method:"POST",headers:{"Content-Type":"application/json","X-Hub-Signature-256":webhookSignature},body:webhookRaw
    });
    assert.equal(validWebhook.response.status,200,JSON.stringify(validWebhook.data));
    assert.equal(validWebhook.data.applied,1);
    const failedQueue=await request("/api/admin/messaging/queue?status=failed",{token:ownerToken,eventId});
    assert.ok(failedQueue.data.some(item=>item.id===failedMessage.id));
    const retried=await request(`/api/admin/messaging/${failedMessage.id}/retry`,{method:"POST",token:ownerToken,eventId,json:{}});
    assert.equal(retried.response.status,200);
    assert.equal(retried.data.status,"queued");
    const retriedProcess=await request("/api/admin/messaging/process",{method:"POST",token:ownerToken,eventId,json:{ids:[failedMessage.id]}});
    assert.equal(retriedProcess.data.results[0].status,"sent");

    const cancellable=await request("/api/admin/messaging/queue",{
      method:"POST",token:ownerToken,eventId,json:{guestIds:realIds,kind:"reminder",campaignKey:"smoke-cancel"}
    });
    const cancelled=await request("/api/admin/messaging/cancel",{
      method:"POST",token:ownerToken,eventId,json:{ids:cancellable.data.ids}
    });
    assert.equal(cancelled.data.cancelled,cancellable.data.ids.length);
    const unsignedWebhook=await request("/api/messaging/webhook",{method:"POST",json:{entry:[]}});
    assert.equal(unsignedWebhook.response.status,401);
    assert.equal(unsignedWebhook.data.code,"WEBHOOK_SIGNATURE_INVALID");
    const verification=await request("/api/messaging/webhook?hub.mode=subscribe&hub.verify_token=smoke-verify-token&hub.challenge=12345");
    assert.equal(verification.response.status,200);
    assert.equal(Buffer.from(verification.data).toString(),"12345");

    guestInventory=(await request("/api/admin/guests",{token:clientToken,eventId})).data;
    const importedGuest=guestInventory.find(item=>item.code==="SMOKE-IMPORT");
    const individualDelete=await request(`/api/admin/guests/${importedGuest.id}`,{method:"DELETE",token:clientToken,eventId});
    assert.equal(individualDelete.response.status,200);
    crudGuest=guestInventory.find(item=>item.code==="SMOKE-CRUD");
    const batchDelete=await request("/api/admin/guests/delete-batch",{
      method:"POST",token:clientToken,eventId,json:{ids:[crudGuest.id,noPhoneGuest.id]}
    });
    assert.equal(batchDelete.response.status,200);
    assert.equal(batchDelete.data.deleted,2);

    const audio = new FormData();
    audio.append("file", new Blob([Buffer.from("ID3-test")], {type: "audio/mpeg"}), "prueba.mp3");
    const upload = await request("/api/admin/media/music", {
      method: "POST", token: clientToken, eventId, body: audio
    });
    assert.equal(upload.response.status, 200);
    await request("/api/admin/settings", {
      method: "PUT", token: clientToken, eventId,
      json: {media: {musicSource: "upload", musicStartSeconds: 17}}
    });
    const publicUpload = await request("/api/config/boda-demostracion");
    assert.equal(publicUpload.data.media.musicStartSeconds, 17);
    assert.equal("developer" in publicUpload.data, false);
    const deleteUpload = await request("/api/admin/media/music", {
      method: "DELETE", token: clientToken, eventId, json: {source: "upload"}
    });
    assert.equal(deleteUpload.data.media.music, "");

    const spotify = await request("/api/admin/settings", {
      method: "PUT", token: clientToken, eventId,
      json: {media: {
        musicSource: "spotify",
        spotifyUrl: "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv?si=prueba",
        spotifyTrackName: "Bohemian Rhapsody",
        spotifyArtists: "Queen",
        spotifyStartSeconds: 99
      }}
    });
    assert.equal(spotify.data.settings.media.spotifyStartSeconds, 99);
    assert.equal(spotify.data.settings.media.spotifyUrl, "https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv");
    const publicSpotify = await request("/api/config/boda-demostracion");
    assert.equal(publicSpotify.data.media.spotifyStartSeconds, 99);
    const invalidSpotify = await request("/api/admin/settings", {
      method: "PUT", token: clientToken, eventId,
      json: {media: {musicSource: "spotify", spotifyUrl: "https://example.com/no-es-spotify"}}
    });
    assert.equal(invalidSpotify.response.status, 400);
    await request("/api/admin/media/music", {
      method: "DELETE", token: clientToken, eventId, json: {source: "spotify"}
    });

    const persistentAudio=new FormData();
    persistentAudio.append("file",new Blob([Buffer.from("ID3-persistent-smoke")],{type:"audio/mpeg"}),"persistente.mp3");
    const persistentUpload=await request("/api/admin/media/music",{method:"POST",token:clientToken,eventId,body:persistentAudio});
    assert.equal(persistentUpload.response.status,200);
    const persistentMusicUrl=persistentUpload.data.url;
    await request("/api/admin/settings",{
      method:"PUT",token:clientToken,eventId,json:{media:{musicSource:"upload",musicStartSeconds:23}}
    });

    const report = await request("/api/admin/venue-report.xlsx", {token: clientToken, eventId});
    assert.equal(report.response.status, 200);
    assert.match(report.response.headers.get("content-type") || "", /spreadsheet|octet-stream/);
    const reportWorkbook=new ExcelJS.Workbook();
    await reportWorkbook.xlsx.load(Buffer.from(report.data));
    assert.deepEqual(reportWorkbook.worksheets.map(sheet=>sheet.name),["Resumen","Invitaciones","Confirmados","Pendientes","No asistirán","Mesas","Restricciones","Menús","Mensajes fotos"]);
    const confirmedHeaders=reportWorkbook.getWorksheet("Confirmados").getRow(1).values.map(String);
    assert.ok(!confirmedHeaders.includes("adult_menu_counts"));
    assert.ok(!confirmedHeaders.includes("TOKEN"));

    const plannedSeating = await request("/api/admin/seating?mode=planned", {token: clientToken, eventId});
    assert.equal(plannedSeating.response.status, 200);
    assert.ok(plannedSeating.data.tables.length >= 1);
    assert.ok(plannedSeating.data.zones.some(zone => zone.type === "dance_floor"));
    const automaticTable=plannedSeating.data.tables.find(table=>table.name==="Mesa Nueva Automática");
    assert.ok(automaticTable,"La mesa manual debe crearse en el plano.");
    assert.ok(automaticTable.families.includes("Familia código automático"));
    assert.ok(automaticTable.occupied>=2);
    assert.ok(plannedSeating.data.tables.some(table=>table.name==="Mesa Excel Automática"),"La mesa importada debe crearse en el plano.");
    assert.ok(Number.isInteger(plannedSeating.data.summary.availableSeats));
    assert.equal(plannedSeating.data.people.length, plannedSeating.data.summary.people);
    assert.equal(
      plannedSeating.data.summary.assigned + plannedSeating.data.summary.unassigned,
      plannedSeating.data.summary.people
    );
    const savedLayout = await request("/api/admin/seating/layout", {
      method: "PUT", token: clientToken, eventId,
      json: {
        mode: "planned",
        tables: plannedSeating.data.tables,
        zones: plannedSeating.data.zones
      }
    });
    assert.equal(savedLayout.response.status, 200, savedLayout.data.error);
    assert.equal(savedLayout.data.tables.length, plannedSeating.data.tables.length);
    const compactIndexItems=[
      ...plannedSeating.data.tables.slice(1).map((item,index)=>({kind:"table",item,index})),
      ...plannedSeating.data.zones.map((item,index)=>({kind:"zone",item,index}))
    ];
    const compactPosition=new Map(compactIndexItems.map((record,index)=>[
      `${record.kind}:${record.index}`,
      {x:14+(index%12)*7,y:2+Math.floor(index/12)*7,width:6,height:6}
    ]));
    const tallTables=plannedSeating.data.tables.map((item,index)=>index===0
      ?{...item,x:2,y:2,width:8,height:70}
      :{...item,...compactPosition.get(`table:${index-1}`)});
    const compactZones=plannedSeating.data.zones.map((item,index)=>({...item,...compactPosition.get(`zone:${index}`)}));
    const tallTableLayout=await request("/api/admin/seating/layout",{
      method:"PUT",token:clientToken,eventId,
      json:{mode:"planned",tables:tallTables,zones:compactZones}
    });
    assert.equal(tallTableLayout.response.status,200,tallTableLayout.data.error);
    assert.equal(tallTableLayout.data.tables[0].height,70,"Una mesa alta permitida por el editor debe persistirse.");
    const restoredLayout=await request("/api/admin/seating/layout",{
      method:"PUT",token:clientToken,eventId,
      json:{mode:"planned",tables:plannedSeating.data.tables,zones:plannedSeating.data.zones}
    });
    assert.equal(restoredLayout.response.status,200,restoredLayout.data.error);
    if(plannedSeating.data.tables.length>1){
      const crossedTables=plannedSeating.data.tables.map(item=>({...item}));
      crossedTables[1].x=crossedTables[0].x;
      crossedTables[1].y=crossedTables[0].y;
      const crossedLayout=await request("/api/admin/seating/layout",{
        method:"PUT",token:clientToken,eventId,json:{mode:"planned",tables:crossedTables,zones:plannedSeating.data.zones}
      });
      assert.equal(crossedLayout.response.status,400);
      assert.match(crossedLayout.data.error,/cruce/i);
    }
    const assignablePeople=plannedSeating.data.people.slice(0,2);
    assert.equal(assignablePeople.length,2);
    const targetTable=plannedSeating.data.tables[0];
    const firstAssignment=await request("/api/admin/seating/assignment",{
      method:"PUT",token:clientToken,eventId,json:{guestId:assignablePeople[0].guestId,personKey:assignablePeople[0].personKey,tableId:targetTable.id,seatIndex:1}
    });
    assert.equal(firstAssignment.response.status,200,JSON.stringify(firstAssignment.data));
    const occupiedSeat=await request("/api/admin/seating/assignment",{
      method:"PUT",token:clientToken,eventId,json:{guestId:assignablePeople[1].guestId,personKey:assignablePeople[1].personKey,tableId:targetTable.id,seatIndex:1}
    });
    assert.equal(occupiedSeat.response.status,409);

    const confirmedSeating = await request("/api/admin/seating?mode=confirmed", {token: clientToken, eventId});
    assert.equal(confirmedSeating.response.status, 200);
    assert.ok(confirmedSeating.data.people.every(person => person.status === "confirmed"));
    for(const mode of ["planned","confirmed"]){
      const seatingPdf=await request(`/api/admin/seating/layout.pdf?mode=${mode}`,{token:clientToken,eventId});
      const seatingPdfBytes=Buffer.from(seatingPdf.data);
      assert.equal(seatingPdf.response.status,200,`No se generó el plano ${mode}.`);
      assert.ok(seatingPdfBytes.subarray(0,4).equals(Buffer.from("%PDF")));
      assert.ok(seatingPdfBytes.length>5000,`El plano ${mode} está incompleto.`);
      assert.match(seatingPdfBytes.toString("latin1"),/\/MediaBox \[0 0 792 612\]/);
      assert.match(seatingPdfBytes.toString("latin1"),/\/BaseFont\s*\//,"El plano debe declarar una fuente PDF utilizable.");
      if(qrOutputDir){fs.mkdirSync(qrOutputDir,{recursive:true});fs.writeFileSync(path.join(qrOutputDir,`plano-${mode}.pdf`),seatingPdfBytes);}
    }
    const withoutDanceFloor=await request("/api/admin/seating/layout",{
      method:"PUT",token:clientToken,eventId,json:{mode:"confirmed",tables:confirmedSeating.data.tables,zones:[]}
    });
    assert.equal(withoutDanceFloor.response.status,200,JSON.stringify(withoutDanceFloor.data));
    assert.equal(withoutDanceFloor.data.zones.length,0);
    const stillWithoutDanceFloor=await request("/api/admin/seating?mode=planned",{token:clientToken,eventId});
    assert.equal(stillWithoutDanceFloor.data.zones.length,0,"Una pista eliminada no debe reaparecer automáticamente.");

    const photoForm=new FormData();
    const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAK0lEQVR42u3NQQEAQAQAMK6KBPIpfyX4bQWWUx2XXhwTCAQCgUAgEAgEWz5dUQEP/EqsKwAAAABJRU5ErkJggg==","base64");
    photoForm.append("photos",new Blob([png],{type:"image/png"}),"recuerdo.png");
    photoForm.append("eventSlug","boda-demostracion");
    photoForm.append("tableName","Mesa 1");
    photoForm.append("uploadedBy","Familia prueba");
    photoForm.append("message","Gracias por compartir este día con nosotros.");
    photoForm.append("uploadKey","smoke-photo-batch-001");
    const photoUpload=await request("/api/photos",{method:"POST",body:photoForm});
    assert.equal(photoUpload.response.status,200,JSON.stringify(photoUpload.data));
    assert.equal(photoUpload.data.status,"pending");
    const duplicatePhotoForm=new FormData();
    duplicatePhotoForm.append("photos",new Blob([png],{type:"image/png"}),"recuerdo-repetido.png");
    duplicatePhotoForm.append("eventSlug","boda-demostracion");
    duplicatePhotoForm.append("uploadKey","smoke-photo-batch-001");
    const duplicatePhoto=await request("/api/photos",{method:"POST",body:duplicatePhotoForm});
    assert.equal(duplicatePhoto.response.status,200);
    assert.equal(duplicatePhoto.data.duplicate,true);
    assert.equal(duplicatePhoto.data.batchId,photoUpload.data.batchId);

    const emptyMessageForm=new FormData();
    emptyMessageForm.append("photos",new Blob([png],{type:"image/png"}),"sin-mensaje.png");
    emptyMessageForm.append("eventSlug","boda-demostracion");
    emptyMessageForm.append("message","");
    emptyMessageForm.append("uploadKey","smoke-photo-empty-message");
    const emptyMessageUpload=await request("/api/photos",{method:"POST",body:emptyMessageForm});
    assert.equal(emptyMessageUpload.response.status,200);

    const longMessageForm=new FormData();
    longMessageForm.append("photos",new Blob([png],{type:"image/png"}),"mensaje-largo.png");
    longMessageForm.append("eventSlug","boda-demostracion");
    longMessageForm.append("message","x".repeat(501));
    longMessageForm.append("uploadKey","smoke-photo-long-message");
    const longMessageUpload=await request("/api/photos",{method:"POST",body:longMessageForm});
    assert.equal(longMessageUpload.response.status,400);
    assert.equal(longMessageUpload.data.code,"PHOTO_MESSAGE_TOO_LONG");
    const photoRows=await request("/api/admin/photos",{token:clientToken,eventId});
    assert.equal(photoRows.response.status,200,JSON.stringify(photoRows.data));
    const uploadedPhoto=photoRows.data.items.find(item=>item.batch_id===photoUpload.data.batchId);
    assert.ok(uploadedPhoto);
    assert.equal(uploadedPhoto.message,"Gracias por compartir este día con nosotros.");
    assert.match(uploadedPhoto.url,/\/api\/admin\/photos\/\d+\/content/);
    const directPhoto=await request(`/uploads/guest-photos/${encodeURIComponent(uploadedPhoto.original_name)}`);
    assert.equal(directPhoto.response.status,404);
    const moderation=await request(`/api/admin/photo-batches/${photoUpload.data.batchId}`,{
      method:"PATCH",token:clientToken,eventId,json:{status:"approved"}
    });
    assert.equal(moderation.response.status,200);
    const publicMessages=await request("/api/public/photo-messages/boda-demostracion");
    assert.ok(publicMessages.data.some(item=>item.message.includes("Gracias por compartir")));
    const invalidPhotoForm=new FormData();
    invalidPhotoForm.append("photos",new Blob([Buffer.from("no-es-una-foto")],{type:"image/jpeg"}),"falsa.jpg");
    invalidPhotoForm.append("eventSlug","boda-demostracion");
    invalidPhotoForm.append("uploadKey","smoke-photo-invalid-001");
    const invalidPhoto=await request("/api/photos",{method:"POST",body:invalidPhotoForm});
    assert.equal(invalidPhoto.response.status,400);
    assert.equal(invalidPhoto.data.code,"INVALID_IMAGE_CONTENT");
    const corruptPngForm=new FormData();
    const corruptPng=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9WlWQAAAAASUVORK5CYII=","base64");
    corruptPngForm.append("photos",new Blob([corruptPng],{type:"image/png"}),"png-corrupto.png");
    corruptPngForm.append("eventSlug","boda-demostracion");
    corruptPngForm.append("uploadKey","smoke-photo-corrupt-png-001");
    const corruptPhoto=await request("/api/photos",{method:"POST",body:corruptPngForm});
    assert.equal(corruptPhoto.response.status,400);
    assert.equal(corruptPhoto.data.code,"INVALID_IMAGE_CONTENT");
    const tooManyPhotosForm=new FormData();
    for(let index=0;index<21;index++)tooManyPhotosForm.append("photos",new Blob([png],{type:"image/png"}),`foto-${index}.png`);
    tooManyPhotosForm.append("eventSlug","boda-demostracion");
    tooManyPhotosForm.append("uploadKey","smoke-photo-too-many");
    const tooManyPhotos=await request("/api/photos",{method:"POST",body:tooManyPhotosForm});
    assert.equal(tooManyPhotos.response.status,400);
    assert.equal(tooManyPhotos.data.code,"LIMIT_FILE_COUNT");

    for(const physicalTemplate of ["auto-theme","coordinated-arch","editorial-silk","classic-frame"]){
      const physicalInvite = await request(`/api/admin/physical-invitation.pdf?guestId=${realIds[0]}&template=${physicalTemplate}`, {token: clientToken, eventId});
      const physicalBytes = Buffer.from(physicalInvite.data);
      assert.equal(physicalInvite.response.status, 200);
      assert.ok(physicalBytes.subarray(0, 4).equals(Buffer.from("%PDF")));
      assert.match(physicalBytes.toString("latin1"), /\/MediaBox \[0 0 360 504\]/);
      assertPdfHasUsableFonts(physicalBytes,"La invitación física debe incrustar tipografías locales o usar un fallback PDF estándar portable.");
      if (qrOutputDir) {fs.mkdirSync(qrOutputDir, {recursive: true});fs.writeFileSync(path.join(qrOutputDir, `invitacion-fisica-${physicalTemplate}.pdf`), physicalBytes);}
    }
    const heroForm=new FormData();
    heroForm.append("file",new Blob([png],{type:"image/png"}),"portada-matriz.png");
    const uploadedHero=await request("/api/admin/media/hero",{method:"POST",token:clientToken,eventId,body:heroForm});
    assert.equal(uploadedHero.response.status,200,JSON.stringify(uploadedHero.data));
    assert.match(uploadedHero.data.url,/^\/uploads\/site-media\//);

    const normalizedPrintSettings=await request("/api/admin/settings",{
      method:"PUT",token:clientToken,eventId,json:{
        qrDesign:{templateId:"plantilla-inexistente",title:"T".repeat(400),message:"M".repeat(700),instruction:"I".repeat(400)},
        physicalInvitation:{templateId:"plantilla-inexistente"}
      }
    });
    assert.equal(normalizedPrintSettings.response.status,200);
    assert.equal(normalizedPrintSettings.data.settings.qrDesign.templateId,"classic-holder");
    assert.equal(normalizedPrintSettings.data.settings.qrDesign.title.length,120);
    assert.equal(normalizedPrintSettings.data.settings.qrDesign.message.length,360);
    assert.equal(normalizedPrintSettings.data.settings.qrDesign.instruction.length,180);
    assert.equal(normalizedPrintSettings.data.settings.physicalInvitation.templateId,"auto-theme");

    await request("/api/admin/settings", {
      method: "PUT", token: clientToken, eventId,
      json: {qrDesign: {
        ...(initialSettings.qrDesign || {}),
        title: "Comparte con nosotros cada recuerdo de esta celebración tan especial",
        message: "Escanea el código y sube las fotografías que tomes durante la ceremonia, la cena y la celebración. Así podremos reunir todos los momentos en un solo álbum.",
        instruction: "Conserva esta tarjeta sobre la mesa y evita doblar o cubrir el código.",
        showTableName: true,
        showFamilies: true,
        useInvitationColors:true
      }}
    });
    const templates = await request("/api/admin/qr-templates", {token: clientToken, eventId});
    const expectedMediaBoxes = {
      "5x7": "360 504",
      square: "360 360",
      "4x9": "288 648",
      "letter-fold": "612 792"
    };
    const configuredThemes = JSON.parse(fs.readFileSync(path.join(root, "config/themes.json"), "utf8"));
    const visualThemeSamples=new Set(["romantic-wine","paw-parade","cosmic-adventure","photo-scrapbook","celestial-blessing"]);
    for(const theme of configuredThemes){
      const updateTheme=await request("/api/admin/settings",{
        method:"PUT",token:clientToken,eventId,
        json:{themeId:theme.id,physicalInvitation:{templateId:"auto-theme"}}
      });
      assert.equal(updateTheme.response.status,200,`No se pudo aplicar ${theme.id}.`);

      let themedInvite;
      try{
        themedInvite=await request(`/api/admin/physical-invitation.pdf?guestId=${realIds[0]}&template=auto-theme`,{token:clientToken,eventId});
      }catch(error){
        throw new Error(`La conexión falló al generar la invitación física de ${theme.id}: ${error.message}`,{cause:error});
      }
      const themedBytes=Buffer.from(themedInvite.data);
      assert.equal(themedInvite.response.status,200,`No se generó la invitación física de ${theme.id}.`);
      assert.ok(themedBytes.subarray(0,4).equals(Buffer.from("%PDF")));
      assert.ok(themedBytes.length>5000,`La invitación física de ${theme.id} quedó incompleta.`);
      assert.match(themedBytes.toString("latin1"),/\/MediaBox \[0 0 360 504\]/);
      assertPdfHasUsableFonts(themedBytes,"La invitación temática debe declarar fuentes utilizables.");
      if(qrOutputDir&&visualThemeSamples.has(theme.id)){
        fs.mkdirSync(qrOutputDir,{recursive:true});
        fs.writeFileSync(path.join(qrOutputDir,`invitacion-fisica-auto-${theme.id}.pdf`),themedBytes);
      }

      for(const template of templates.data){
        let pdf;
        try{
          pdf=await request(`/api/admin/qr-card.pdf?table=Mesa%201&template=${encodeURIComponent(template.id)}`,{
            token:clientToken,eventId
          });
        }catch(error){
          throw new Error(`La conexión falló en la matriz ${theme.id} + ${template.id}: ${error.message}`,{cause:error});
        }
        const bytes=Buffer.from(pdf.data);
        assert.equal(pdf.response.status,200,`No se generó ${theme.id} + ${template.id}.`);
        assert.ok(bytes.subarray(0,4).equals(Buffer.from("%PDF")),`${theme.id} + ${template.id} no devolvió un PDF.`);
        assert.ok(bytes.length>5000,`${theme.id} + ${template.id} generó un PDF incompleto.`);
        assert.match(bytes.toString("latin1"),new RegExp(`/MediaBox \\[0 0 ${expectedMediaBoxes[template.format]}\\]`));
        assertPdfHasUsableFonts(bytes,`${theme.id} + ${template.id} debe incrustar tipografías locales o usar fallback PDF estándar.`);
        if(qrOutputDir&&visualThemeSamples.has(theme.id)){
          fs.writeFileSync(path.join(qrOutputDir,`${theme.id}--${template.id}.pdf`),bytes);
        }
      }
    }

    const longTable=await request(`/api/admin/qr?table=${"X".repeat(400)}`,{token:clientToken,eventId});
    assert.equal(longTable.response.status,200);
    assert.equal(longTable.data.table.length,120,"Los nombres de mesa del QR deben tener un límite estable.");
    const neutralQrSettings=await request("/api/admin/settings",{
      method:"PUT",token:clientToken,eventId,
      json:{qrDesign:{useInvitationColors:false,templateId:"classic-holder"}}
    });
    assert.equal(neutralQrSettings.response.status,200);
    assert.equal(neutralQrSettings.data.settings.qrDesign.useInvitationColors,false);
    const neutralQr=await request("/api/admin/qr-card.pdf?table=Mesa%201&template=classic-holder",{token:clientToken,eventId});
    assert.equal(neutralQr.response.status,200);
    assert.ok(Buffer.from(neutralQr.data).length>5000);
    await request("/api/admin/settings",{method:"PUT",token:clientToken,eventId,json:{themeId:initialSettings.themeId,qrDesign:initialSettings.qrDesign}});

    const adminHtml = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
    assert.match(adminHtml, /id="restoreDateLabelBtn"/);
    assert.match(adminHtml, /id="deleteUploadedMusicBtn"/);
    assert.match(adminHtml, /id="deleteSpotifyMusicBtn"/);
    assert.match(adminHtml, /id="spotifyStartSeconds"/);
    assert.match(adminHtml, /id="previewSpotifyFromStartBtn"/);
    assert.match(adminHtml, /id="seatingCanvas"/);
    assert.match(adminHtml, /id="seatingSaveStatus"/);
    assert.match(adminHtml, /id="downloadSeatingPdfBtn"/);
    assert.match(adminHtml, /id="physicalGuestSelect"/);
    assert.match(adminHtml, /id="physicalTemplateSelect"/);
    assert.match(adminHtml, /value="auto-theme"/);
    assert.match(adminHtml, /id="openingStyleSelect"/);
    assert.match(adminHtml, /id="adminPhotoViewer"/);
    assert.match(adminHtml, /id="openQrDestinationBtn"/);
    assert.match(adminHtml, /id="whatsappReadinessCard"/);
    assert.match(adminHtml, /id="rsvpFlexibleComposition"/);
    assert.match(adminHtml, /id="applyUniformTablesBtn"/);
    assert.match(adminHtml, /value="great-vibes"/);
    assert.match(adminHtml, /id="mobileMenuBtn"/);
    assert.match(adminHtml, /id="restoreBackupForm"/);
    assert.match(adminHtml, /id="exportGuestsBtn"/);
    assert.match(adminHtml, /id="nameCaseMode"/);
    assert.doesNotMatch(adminHtml, /id="headingFontPreview">Francisco/);
    const adminJs=fs.readFileSync(path.join(root,"public/admin.js"),"utf8");
    assert.match(adminJs,/whatsappReadinessCard.*showWhatsappBusiness/);
    assert.match(adminJs,/typographyCard.*features\.templates/);
    assert.match(adminJs,/workspaceController\?\.abort/);
    assert.match(adminJs,/switchActiveEvent/);
    assert.match(adminJs,/enhanceResponsiveTables/);
    const publicCss=fs.readFileSync(path.join(root,"public/styles.css"),"utf8");
    assert.match(publicCss,/\.seating-canvas\{[^}]*min-width:0[^}]*height:clamp\(520px,65vh,650px\)/);
    assert.doesNotMatch(publicCss,/\.seating-canvas\{[^}]*aspect-ratio:16\/10/);
    assert.match(publicCss,/\.mobile-nav-open \.admin-sidebar/);
    assert.match(publicCss,/content:attr\(data-label\)/);
    const publicHtml=fs.readFileSync(path.join(root,"public/index.html"),"utf8");
    assert.match(publicHtml,/id="invitationOpening"/);
    assert.match(publicHtml,/id="spotifyMusicBtn"/);
    const publicJs=fs.readFileSync(path.join(root,"public/app.js"),"utf8");
    assert.match(publicJs,/requestSpotifyPlayback/);
    assert.match(publicJs,/playback_update/);
    const neutralDefaults=fs.readFileSync(path.join(root,"config/default-settings.json"),"utf8");
    assert.doesNotMatch(neutralDefaults,/Francisco|Ariana|Comalcalco|Nuestra boda/);
    const albumHtml=fs.readFileSync(path.join(root,"public/album.html"),"utf8");
    assert.match(albumHtml,/id="albumEventName"/);
    assert.match(albumHtml,/id="selectedPhotoPreview"/);
    assert.ok(configuredThemes.some(theme => theme.id === "editorial-arch"));
    for(const themeId of ["lavender-couture","cinematic-vows","storybook-seal","botanical-scroll"]){
      assert.ok(configuredThemes.some(theme=>theme.id===themeId),`Falta la plantilla ${themeId}.`);
    }

    const backupCreated=await request("/api/admin/backups",{method:"POST",token:ownerToken,json:{reason:"smoke-rc1"}});
    assert.equal(backupCreated.response.status,201,JSON.stringify(backupCreated.data));
    assert.equal(backupCreated.data.backup.status,"ready");
    assert.match(backupCreated.data.backup.checksum_sha256,/^[a-f0-9]{64}$/);
    const backupDownload=await request(`/api/admin/backups/${backupCreated.data.backup.id}/download`,{token:ownerToken});
    const backupBytes=Buffer.from(backupDownload.data);
    assert.ok(backupBytes.subarray(0,2).equals(Buffer.from("PK")));
    const backupZip=path.join(testStorage,"backup-smoke.zip");
    const backupDb=path.join(testStorage,"backup-smoke.db");
    fs.writeFileSync(backupZip,backupBytes);
    const inspectBackupForm=new FormData();
    inspectBackupForm.append("backup",new Blob([backupBytes],{type:"application/zip"}),"backup-smoke.zip");
    const inspectedBackup=await request("/api/admin/backups/inspect",{method:"POST",token:ownerToken,body:inspectBackupForm});
    assert.equal(inspectedBackup.response.status,200,JSON.stringify(inspectedBackup.data));
    assert.equal(inspectedBackup.data.summary.format,"eventstudio-backup-v2");
    assert.match(inspectedBackup.data.summary.databaseSha256,/^[a-f0-9]{64}$/);
    fs.writeFileSync(backupDb,execFileSync("unzip",["-p",backupZip,"data/wedding.db"]));
    const Database=require("better-sqlite3");
    const snapshot=new Database(backupDb,{readonly:true});
    assert.equal(snapshot.pragma("integrity_check",{simple:true}),"ok");
    assert.ok(snapshot.prepare("SELECT COUNT(*) total FROM events").get().total>=2);
    snapshot.close();

    const demoPayment=await request("/api/billing/checkout",{method:"POST",token:clientToken,json:{planCode:"premium"}});
    assert.equal(demoPayment.response.status,503);

    const interruptedBackupDb=new Database(path.join(testStorage,"data","wedding.db"));
    interruptedBackupDb.prepare("INSERT INTO backup_records(filename,relative_path,status) VALUES(?,?,'creating')").run("interrumpido-smoke.zip","interrumpido-smoke.zip");
    interruptedBackupDb.close();
    server.kill("SIGTERM");
    await once(server,"exit");
    server=spawn(process.execPath,[path.join(root,"src/server.js")],{
      cwd:root,env:{...testEnv,PORT:String(port),SITE_URL:base,WHATSAPP_PROVIDER:"simulation",WHATSAPP_APP_SECRET:webhookSecret,WHATSAPP_WEBHOOK_VERIFY_TOKEN:"smoke-verify-token"},stdio:["ignore","pipe","pipe"]
    });
    await waitForServer();
    const persistedGuests=await request("/api/admin/guests",{token:ownerToken,eventId});
    assert.equal(persistedGuests.response.status,200);
    assert.ok(persistedGuests.data.some(item=>item.family_name==="Prueba funcional 6.9"));
    const persistedMessages=await request("/api/public/photo-messages/boda-demostracion");
    assert.ok(persistedMessages.data.some(item=>item.message.includes("Gracias por compartir")));
    const persistedMusic=await request("/api/config/boda-demostracion");
    assert.equal(persistedMusic.data.media.musicSource,"upload");
    assert.equal(persistedMusic.data.media.musicStartSeconds,23);
    assert.equal(persistedMusic.data.media.music,persistentMusicUrl);
    const persistedAudio=await fetch(`${base}${persistentMusicUrl}`);
    assert.equal(persistedAudio.status,200);
    assert.match(persistedAudio.headers.get("content-type")||"",/audio\/mpeg/);
    const reconciledBackups=await request("/api/admin/backups",{token:ownerToken});
    assert.equal(reconciledBackups.data.find(item=>item.filename==="interrumpido-smoke.zip")?.status,"failed");
  } finally {
    await request("/api/admin/settings", {
      method: "PUT", token: ownerToken, eventId, json: initialSettings
    }).catch(() => {});
  }

  console.log(`✓ Pruebas funcionales ${packageJson.version} completadas`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (server && !server.killed) server.kill();
    fs.rmSync(testStorage, {recursive: true, force: true});
  });
