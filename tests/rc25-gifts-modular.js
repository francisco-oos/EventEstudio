"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const pkg=require("../package.json");
const defaults=require("../config/default-settings.json");
const persuasionCatalog=require("../config/gift-persuasion-presets.json");
const persuasion=require("../src/gift-persuasion-presets");
const {
  normalizeBankDetails,
  normalizeGiftMethods,
  legacyModeFromMethods,
  legacyMethodsFromMode,
  hasActiveGiftMethod,
  publicGiftProjection
}=require("../src/gift-settings");

const rcNumber=Number((pkg.version.match(/^6\.14\.2-rc\.(\d+)$/)||[])[1]);
assert.ok(rcNumber>=25,"RC25 y candidatas posteriores deben conservar la arquitectura modular de regalos.");

assert.equal(defaults.gifts.methods.cashEnvelopes.enabled,true);
assert.equal(defaults.gifts.methods.registry.enabled,false);
assert.equal(defaults.gifts.methods.bankTransfer.enabled,false);
assert.equal(defaults.gifts.openpay.enabled,false);
assert.equal(defaults.gifts.openpay.suggestedAmountCents,null);

assert.deepEqual(legacyMethodsFromMode("cash-envelopes"),{cashEnvelopes:true,registry:false,bankTransfer:false});
assert.deepEqual(legacyMethodsFromMode("mixed"),{cashEnvelopes:false,registry:true,bankTransfer:true});
assert.deepEqual(legacyMethodsFromMode("no-gifts"),{cashEnvelopes:false,registry:false,bankTransfer:false});

const allEnabled=normalizeGiftMethods(defaults.gifts,{
  methods:{
    cashEnvelopes:{enabled:true,instructions:"Buzón junto a la mesa principal"},
    registry:{enabled:true},
    bankTransfer:{enabled:true}
  }
});
assert.equal(allEnabled.cashEnvelopes.enabled,true);
assert.equal(allEnabled.registry.enabled,true);
assert.equal(allEnabled.bankTransfer.enabled,true);
assert.equal(allEnabled.cashEnvelopes.instructions,"Buzón junto a la mesa principal");
assert.equal(legacyModeFromMethods(allEnabled,false),"mixed");
assert.equal(hasActiveGiftMethod({methods:allEnabled,openpay:{enabled:false}}),true);

const bankOff=normalizeGiftMethods({methods:allEnabled},{methods:{bankTransfer:{enabled:false}}});
assert.equal(bankOff.cashEnvelopes.enabled,true,"Alternar transferencia no debe borrar lluvia de sobres.");
assert.equal(bankOff.registry.enabled,true,"Alternar transferencia no debe borrar mesa de regalos.");
assert.equal(bankOff.bankTransfer.enabled,false);

const none=normalizeGiftMethods({mode:"no-gifts"},{methods:{cashEnvelopes:{enabled:false},registry:{enabled:false},bankTransfer:{enabled:false}}});
assert.equal(hasActiveGiftMethod({methods:none,openpay:{enabled:false}}),false);
assert.equal(legacyModeFromMethods(none,false),"no-gifts");
assert.equal(legacyModeFromMethods(none,true),"mixed","Openpay puede ser la única modalidad activa sin reactivar otros métodos.");

const bank=normalizeBankDetails({}, {
  bankName:"BBVA",
  accountHolder:"Ariana y Francisco",
  clabe:"012 345 678 901 234 567",
  accountNumber:"99887766",
  referenceConcept:"Regalo de boda - Familia Pérez",
  instructions:"Usar el apellido como referencia",
  persuasionPresetId:"memory-fund",
  persuasionCustomText:"Texto que no debe prevalecer mientras exista un preset."
});
assert.equal(bank.clabe,"012345678901234567");
assert.equal(bank.referenceConcept,"Regalo de boda - Familia Pérez");
assert.equal(bank.persuasionPresetId,"memory-fund");

assert.equal(persuasionCatalog.presets.length,4,"El catálogo RC25 debe conservar los cuatro enfoques solicitados.");
const ids=new Set(persuasionCatalog.presets.map(item=>item.id));
for(const id of ["memory-fund","comfort-normalization","elevated-reciprocity","shared-future"])assert.ok(ids.has(id),`Falta ${id}.`);
assert.equal(ids.size,persuasionCatalog.presets.length);
assert.match(persuasion.resolve({persuasionPresetId:"memory-fund"}),/coleccionar memorias/i);
assert.match(persuasion.resolve({persuasionPresetId:"comfort-normalization"}),/comodidad/i);
assert.match(persuasion.resolve({persuasionPresetId:"elevated-reciprocity"}),/regalo más valioso/i);
assert.match(persuasion.resolve({persuasionPresetId:"shared-future"}),/cimentar nuestras metas/i);
assert.equal(persuasion.resolve({persuasionPresetId:"custom",persuasionCustomText:"Nuestro mensaje personalizado"}),"Nuestro mensaje personalizado");
assert.equal(persuasion.resolve({persuasionPresetId:"desconocido"}),"");
assert.equal(persuasion.normalizeBank({persuasionPresetId:"desconocido"}).persuasionPresetId,"");

const storedGiftState={
  title:"Regalos",
  mode:"mixed",
  bankInfo:"dato legado sensible",
  link:"https://example.com/mesa",
  methods:{
    cashEnvelopes:{enabled:false,instructions:"Buzón que no debe exponerse"},
    registry:{enabled:false},
    bankTransfer:{enabled:false}
  },
  bank:{bankName:"BBVA",accountHolder:"Privado",clabe:"012345678901234567",referenceConcept:"Regalo",instructions:"Privado"},
  openpay:{enabled:false}
};
const publicOff=publicGiftProjection(storedGiftState,{
  resolvedBank:storedGiftState.bank,
  motivationalMessage:"Mensaje que no debe exponerse",
  registryLink:"https://example.com/mesa"
});
assert.equal(publicOff.bankInfo,"");
assert.equal(publicOff.link,"");
assert.equal(publicOff.methods.cashEnvelopes.instructions,"");
assert.deepEqual(publicOff.bank,{bankName:"",accountHolder:"",clabe:"",accountNumber:"",referenceConcept:"",instructions:"",motivationalMessage:""});

const publicOn=publicGiftProjection({
  ...storedGiftState,
  methods:{cashEnvelopes:{enabled:true,instructions:"Buzón junto a la mesa principal"},registry:{enabled:true},bankTransfer:{enabled:true}}
},{resolvedBank:storedGiftState.bank,motivationalMessage:"Mensaje visible",registryLink:"https://example.com/mesa"});
assert.equal(publicOn.methods.cashEnvelopes.instructions,"Buzón junto a la mesa principal");
assert.equal(publicOn.link,"https://example.com/mesa");
assert.equal(publicOn.bank.bankName,"BBVA");
assert.equal(publicOn.bank.motivationalMessage,"Mensaje visible");

const adminHtml=read("public/admin.html");
const admin=read("public/admin.js");
const index=read("public/index.html");
const app=read("public/app.js");
const server=read("src/server.js");

for(const id of [
  "giftCashEnabled","giftCashInstructions","giftRegistryEnabled","giftBankInfoEnabled",
  "giftBankName","giftBankHolder","giftBankClabe","giftBankAccount","giftBankReferenceConcept",
  "giftBankPersuasionPreset","giftBankPersuasionCustom","giftOpenpayEnabled","giftOpenpaySuggestedAmount",
  "giftOpenpayMessageEnabled"
]) assert.ok(adminHtml.includes(`id="${id}"`),`Falta el control modular ${id}.`);
assert.doesNotMatch(adminHtml,/id="giftMode"/,"RC25 no debe volver a un selector excluyente de modalidad.");
assert.match(adminHtml,/Puede convivir con transferencia, mesa de regalos y Openpay/);
assert.match(adminHtml,/Este texto se mostrará antes de los datos bancarios/);
assert.match(adminHtml,/Este campo pertenece al invitado/);

assert.match(admin,/methods:\{[\s\S]*cashEnvelopes:[\s\S]*registry:[\s\S]*bankTransfer:/);
assert.match(admin,/persuasionPresetId:\$\('giftBankPersuasionPreset'\)/);
assert.match(admin,/persuasionCustomText:\$\('giftBankPersuasionCustom'\)/);
assert.match(admin,/giftCashEnabled/);
assert.match(admin,/giftRegistryEnabled/);

for(const id of ["cashEnvelopeWrap","giftRegistryWrap","bankInfoWrap","bankPersuasionMessage","openpayGiftMessage"]){
  assert.ok(index.includes(`id="${id}"`),`Falta el bloque público ${id}.`);
}
assert.match(app,/function giftMethodState/);
assert.match(app,/function renderCashEnvelope/);
assert.match(app,/methods\.cashEnvelopes/);
assert.match(app,/methods\.registry/);
assert.match(app,/methods\.bankTransfer/);
assert.match(app,/bank\.motivationalMessage/);
assert.match(app,/openpayGiftMessage/,'La dedicatoria del invitado debe conservarse.');
assert.doesNotMatch(app,/coleccionar memorias|cimentar nuestras metas|comodidad de quienes nos han preguntado/i,"Los mensajes del anfitrión deben venir del catálogo/servidor, no estar hardcodeados en app.js.");
assert.doesNotMatch(admin,/coleccionar memorias|cimentar nuestras metas|comodidad de quienes nos han preguntado/i,"El panel debe consumir el catálogo dinámico.");

assert.match(server,/normalizeGiftMethods/);
assert.match(server,/legacyModeFromMethods/);
assert.match(server,/giftPersuasionPresets\.normalizeBank/);
assert.match(server,/giftPersuasionPresets\.resolve/);
assert.match(server,/motivationalMessage/);
assert.match(server,/delete settings\.gifts\.bank\.persuasionPresetId/);
assert.match(server,/_giftPersuasionPresets:giftPersuasionPresets\.publicCatalog\(\)/);

// Privacidad pública: el servidor debe proyectar únicamente métodos activos.
assert.match(server,/publicGiftProjection\(settings\.gifts/);

for(const file of [
  "src/gift-settings.js","src/gift-persuasion-presets.js","tests/rc25-gifts-modular.js"
]) assert.doesNotMatch(read(file),/[\u{1F300}-\u{1FAFF}]/u,`${file} contiene emojis en código o comentarios técnicos.`);

console.log("✓ RC25: métodos de regalo combinables, mensaje motivador del anfitrión y dedicatoria del invitado verificados");
