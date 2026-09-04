"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const pkg=require("../package.json");
const settings=require("../config/default-settings.json");
const seals=require("../config/seals.json");
const themes=require("../config/themes.json");
const experiences=require("../config/experiences.json");
const {normalizeSeal}=require("../src/seal-config");
const {featureDecision}=require("../src/features");

assert.equal(themes.length,64);
for(const id of ["powder-blue-letter","gala-marquee","celestial-constellation","blush-heart-letter","gran-reserva"])assert.ok(themes.some(theme=>theme.id===id),`Falta ${id}`);
for(const id of ["powder-blue-seal","gala-curtain","constellation-veil","blush-heart-emblem","reserve-uncork"])assert.ok(experiences.openings.some(opening=>opening.id===id),`Falta ${id}`);

assert.equal(seals.defaults.initial1,"");assert.equal(seals.defaults.initial2,"");
assert.ok(seals.materials.some(item=>item.id==="theme"));assert.ok(seals.materials.some(item=>item.id==="custom"));
assert.equal(normalizeSeal({}, {fontSize:999,customColor:"javascript:bad"}).fontSize,170);
assert.equal(normalizeSeal({}, {customColor:"javascript:bad"}).customColor,seals.defaults.customColor);

const renderer=read("public/seal-renderer.js");
const context={window:{}};vm.createContext(context);vm.runInContext(renderer,context);
const api=context.window.EventStudioWaxSeal;assert.ok(api);
const definition={...seals.defaults,autoMonogram:false,initial1:"A",initial2:"F",ornament:"laurel",material:"burgundy"};
const first=api.svgString(definition,{displayName:"Ariana & Francisco",seed:"event-1",idPrefix:"seal-test"},seals);
const second=api.svgString(definition,{displayName:"Ariana & Francisco",seed:"event-1",idPrefix:"seal-test"},seals);
const third=api.svgString(definition,{displayName:"Ariana & Francisco",seed:"event-2",idPrefix:"seal-test"},seals);
assert.equal(first,second,"El mismo evento debe conservar exactamente el mismo sello.");
assert.notEqual(first,third,"Una semilla distinta debe poder producir una irregularidad distinta.");
assert.match(first,/A &amp; F/);assert.doesNotMatch(first,/javascript:/i);

assert.equal(settings.rsvp.enabled,true);
assert.equal(featureDecision(settings,"rsvp",{role:"client",planCode:"starter"}).allowed,true);
assert.equal(featureDecision(settings,"rsvp",{role:"client",planCode:"express"}).allowed,false);
assert.equal(featureDecision(settings,"rsvp",{role:"owner",planCode:"express"}).allowed,true);
assert.equal(featureDecision(settings,"rsvp",{role:"developer",planCode:"express"}).allowed,true);
assert.equal(featureDecision({...settings,features:{...settings.features,rsvp:false}},"rsvp",{role:"public",planCode:"starter"}).allowed,false);
assert.equal(settings.gifts.bankInfoEnabled,false);
assert.equal(settings.gifts.openpay.enabled,false);

const server=read("src/server.js"),app=read("public/app.js"),admin=read("public/admin.js"),adminHtml=read("public/admin.html"),index=read("public/index.html"),openpay=read("src/openpay-gifts.js");
assert.match(server,/eventSettings\.rsvp\?\.enabled===false/);
assert.match(app,/settings\.rsvp\?\.enabled===false\|\|!hasPersonalInvitation/);
assert.match(adminHtml,/id="rsvpEnabled"/);
assert.match(adminHtml,/id="publicEventUrl"/);assert.match(admin,/copyPublicEventUrlBtn/);assert.match(server,/publicInvitationUrl\(event\)/);
assert.match(app,/bankTransfer/);assert.match(index,/id="bankInfoWrap" class="gift-bank-info hidden"/);
assert.match(adminHtml,/id="giftBankInfoEnabled"/);
assert.match(adminHtml,/id="giftOpenpayEnabled"/);assert.match(index,/id="openpayGiftForm"/);
assert.match(openpay,/OPENPAY_PRIVATE_KEY/);assert.doesNotMatch(app,/OPENPAY_PRIVATE_KEY/);assert.doesNotMatch(index,/OPENPAY_PRIVATE_KEY/);
assert.match(server,/tokenId=cleanText/);assert.match(server,/deviceSessionId=cleanText/);
assert.doesNotMatch(server,/card_number|cvv2|expiration_month|expiration_year/);
assert.match(app,/OpenPay\.token\.extractFormAndCreate/);assert.match(app,/OpenPay\.deviceData\.setup/);
assert.ok(index.includes(`seal-renderer.js?v=${pkg.version}`));
assert.doesNotMatch(adminHtml,/\/seal-studio\.html/);
assert.ok(fs.existsSync(path.join(root,"public/stationery-engine.js")));
assert.ok(fs.existsSync(path.join(root,"docs/analysis/ARQUITECTURA_SEAL_RSVP_GIFTS_RC22.md")));

for(const file of ["public/seal-renderer.js","public/stationery-engine.js","src/seal-config.js","src/openpay-gifts.js"]){
  assert.doesNotMatch(read(file),/[😀-🙏🌀-🫿]/u,`${file} no debe incluir emojis en comentarios/código técnico.`);
}
console.log("✓ RC22: sellos modulares, cinco plantillas, RSVP desacoplado, enlace público y regalos opcionales verificados");
