"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const pkg=require("../package.json");
const defaults=require("../config/default-settings.json");
const catalog=require("../config/gift-message-presets.json");
const presets=require("../src/gift-message-presets");
const {normalizeBankDetails,normalizeSuggestedAmountCents,normalizeOpenpayOptions,hasBankDetails}=require("../src/gift-settings");

const rcNumber=Number((pkg.version.match(/^6\.14\.2-rc\.(\d+)$/)||[])[1]);
assert.ok(rcNumber>=24,"Las regresiones RC24 deben conservarse en candidatas posteriores.");
assert.equal(defaults.gifts.bankInfoEnabled,false);
assert.equal(defaults.gifts.openpay.enabled,false);
assert.equal(defaults.gifts.openpay.suggestedAmountCents,null,"El monto sugerido debe poder permanecer vacío.");
assert.equal(defaults.gifts.openpay.allowCustomAmount,true);

const bank=normalizeBankDetails({}, {
  bankName:"BBVA",
  accountHolder:"Persona de prueba",
  clabe:"012 345 678 901 234 567",
  accountNumber:"1234567890",
  instructions:"Usar el nombre del invitado como referencia"
});
assert.equal(bank.clabe,"012345678901234567");
assert.equal(hasBankDetails(bank),true);
assert.equal(hasBankDetails(normalizeBankDetails({},{})),false);
assert.equal(normalizeSuggestedAmountCents("",100000),null);
assert.equal(normalizeSuggestedAmountCents(999),1000);
assert.equal(normalizeSuggestedAmountCents(999999999),50000000);
const noSuggestion=normalizeOpenpayOptions({suggestedAmountCents:100000,allowCustomAmount:false},{suggestedAmountCents:null,allowCustomAmount:false});
assert.equal(noSuggestion.suggestedAmountCents,null);
assert.equal(noSuggestion.allowCustomAmount,true,"Sin sugerencia el invitado debe poder capturar un monto.");

assert.ok(Array.isArray(catalog.presets)&&catalog.presets.length>=8);
const ids=new Set(catalog.presets.map(item=>item.id));
assert.equal(ids.size,catalog.presets.length,"Los mensajes sugeridos no pueden duplicar IDs.");
assert.ok(presets.forEventType("wedding").some(item=>item.id==="wedding-choice"));
assert.ok(presets.forEventType("xv").some(item=>item.id==="xv-new-stage"));
assert.ok(presets.forEventType("graduation").some(item=>item.id==="graduation-future"));
for(const type of ["wedding","xv","birthday","baptism","graduation","corporate","custom"]){
  const list=presets.forEventType(type);
  assert.ok(list.length>0&&list.length<=catalog.maxVisible,`Catálogo inválido para ${type}.`);
  for(const item of list){
    assert.ok(item.id&&item.label&&item.text);
    assert.equal(Object.prototype.hasOwnProperty.call(item,"principles"),false,"Los principios internos no deben mostrarse al invitado.");
  }
}

const adminHtml=read("public/admin.html"),admin=read("public/admin.js"),index=read("public/index.html"),app=read("public/app.js"),server=read("src/server.js");
for(const id of ["giftBankInfoEnabled","giftBankName","giftBankHolder","giftBankClabe","giftBankAccount","giftBankInstructions","giftOpenpayEnabled","giftOpenpaySuggestedAmount","giftOpenpayMessageEnabled","giftMessageAdminPreview"]){
  assert.ok(adminHtml.includes(`id="${id}"`),`Falta control ${id}.`);
}
assert.match(adminHtml,/Déjalo vacío para que el invitado escriba el monto/);
assert.match(admin,/suggestedRaw===''/);
assert.match(admin,/suggestedAmountCents=suggestedRaw===''\?null/);
assert.match(admin,/clabe&&clabe\.length!==18/);
assert.match(server,/normalizeBankDetails/);
assert.match(server,/suggestedAmountCents===null\?true/);
assert.match(server,/giftMessagePresets\.forEventType/);
assert.match(index,/id="bankInfoList"/);
assert.match(index,/id="openpayGiftMessageSuggestions"/);
assert.match(app,/function renderGiftBankDetails/);
assert.match(app,/function renderGiftMessageSuggestions/);
assert.match(app,/bankTransfer/);
assert.match(app,/hasSuggested\?String\(cents\/100\):''/);
assert.doesNotMatch(app,/wedding-choice|xv-new-stage|warm-wishes/,"Los textos sugeridos deben venir del catálogo, no estar hardcodeados en el frontend.");
assert.doesNotMatch(admin,/wedding-choice|xv-new-stage|warm-wishes/,"El panel debe consumir el catálogo dinámico.");

for(const file of ["src/gift-settings.js","src/gift-message-presets.js","tests/rc24-gifts.js"]){
  assert.doesNotMatch(read(file),/[\u{1F300}-\u{1FAFF}]/u,`${file} contiene emojis en código o comentarios técnicos.`);
}

console.log("✓ RC24: transferencia bancaria estructurada, Openpay independiente, monto opcional y mensajes sugeridos verificados");
