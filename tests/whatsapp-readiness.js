"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const storage=fs.mkdtempSync(path.join(os.tmpdir(),"eventstudio-whatsapp-ready-"));
Object.assign(process.env,{
  NODE_ENV:"test",STORAGE_ROOT:storage,WHATSAPP_PROVIDER:"whatsapp-cloud",
  WHATSAPP_GRAPH_VERSION:"v23.0",WHATSAPP_PHONE_NUMBER_ID:"1234567890",
  WHATSAPP_BUSINESS_ACCOUNT_ID:"9876543210",WHATSAPP_ACCESS_TOKEN:"token-de-prueba-no-real",
  WHATSAPP_APP_SECRET:"secreto-de-prueba-no-real",WHATSAPP_WEBHOOK_VERIFY_TOKEN:"verificacion-prueba",
  WHATSAPP_INVITATION_TEMPLATE:"invitacion_evento",WHATSAPP_TEMPLATE_LANGUAGE:"es_MX"
});

const db=require("../src/db");
const messaging=require("../src/messaging");
try{
  const ready=messaging.providerStatus();
  assert.equal(ready.provider,"whatsapp-cloud");assert.equal(ready.configured,true);assert.equal(ready.automatic,true);assert.deepEqual(ready.missing,[]);
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  const incomplete=messaging.providerStatus();
  assert.equal(incomplete.configured,false);assert.ok(incomplete.missing.includes("phoneNumberId"));
  console.log("✓ WhatsApp Cloud queda listo al colocar las siete variables y bloquea configuración incompleta");
}finally{db.close();fs.rmSync(storage,{recursive:true,force:true});}
