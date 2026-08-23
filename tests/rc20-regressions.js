"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const pkg=require("../package.json");
assert.ok(["6.14.2-rc.20","6.14.2-rc.21"].includes(pkg.version),"La regresión RC20 debe seguir ejecutándose en RC21.");

for(const file of ["public/admin.html","public/index.html","public/album.html","public/catalogo.html","public/muestra.html","public/showcase.html","public/sandbox.html"]){
  assert.ok(read(file).includes(`styles.css?v=${pkg.version}`),`${file} debe invalidar la caché CSS de la versión actual.`);
}
const admin=read("public/admin.js"),adminHtml=read("public/admin.html"),app=read("public/app.js"),styles=read("public/styles.css"),renderer=read("public/experience-renderers.js"),server=read("src/server.js"),payments=read("src/payments.js"),env=read(".env.example");
assert.match(admin,/supportClientView=false/);
assert.doesNotMatch(adminHtml,/id="supportClientView"[^>]*checked/);
assert.match(adminHtml,/Simular vista cliente/);
assert.match(renderer,/forceMotion&&this\.motionLevel==='still'\?'balanced'/);
assert.match(app,/'minimal-envelope':\{replay:4300,normal:4000\}/);
assert.match(app,/'ivory-seal':\{replay:4600,normal:4300\}/);
assert.match(styles,/body\[data-motion="still"\]:not\(\.force-motion-preview\) \.opening-ivory-seal/);
assert.match(server,/paymentGateway\.verifyWebhookSignature/);
assert.match(server,/paymentGateway\.getPayment\(dataId\)/);
assert.match(server,/PAYMENT_AMOUNT_MISMATCH/);
assert.match(server,/eventstudio-(?:order|plan)/);
assert.match(payments,/https:\/\/api\.mercadopago\.com/);
assert.match(payments,/timingSafeEqual/);
assert.match(env,/MERCADOPAGO_ACCESS_TOKEN=/);
assert.match(env,/MERCADOPAGO_WEBHOOK_SECRET=/);
for(const source of [admin,app,server,payments,renderer]){
  assert.doesNotMatch(source,/APP_USR-[A-Za-z0-9_-]+/);
  assert.doesNotMatch(source,/chrome-extension:\/\//);
  assert.doesNotMatch(source,/addEventListener\(['"]unload['"]/);
}
assert.equal((styles.match(/\{/g)||[]).length,(styles.match(/\}/g)||[]).length,"CSS debe conservar balance de llaves.");
console.log("✓ Regresiones específicas 6.14.2-rc.20 verificadas");
