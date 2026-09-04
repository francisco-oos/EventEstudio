"use strict";

function clean(value,maxLength=1000){return String(value??"").trim().slice(0,maxLength);}
function digits(value,maxLength){return String(value??"").replace(/\D/g,"").slice(0,maxLength);}
function booleanValue(value,fallback=false){
  if(value===undefined||value===null)return fallback;
  if(value===true||value===1||value==="1"||value==="true"||value==="yes")return true;
  if(value===false||value===0||value==="0"||value==="false"||value==="no")return false;
  return fallback;
}

function legacyMethodsFromMode(mode){
  switch(clean(mode,40)){
    case "registry":return {cashEnvelopes:false,registry:true,bankTransfer:false};
    case "bank-transfer":return {cashEnvelopes:false,registry:false,bankTransfer:true};
    case "mixed":return {cashEnvelopes:false,registry:true,bankTransfer:true};
    case "no-gifts":return {cashEnvelopes:false,registry:false,bankTransfer:false};
    case "cash-envelopes":
    default:return {cashEnvelopes:true,registry:false,bankTransfer:false};
  }
}

function methodEnabled(value,fallback){
  if(value&&typeof value==="object"&&Object.prototype.hasOwnProperty.call(value,"enabled"))return booleanValue(value.enabled,fallback);
  return booleanValue(value,fallback);
}

function normalizeGiftMethods(currentGifts={},incomingGifts={}){
  const current=currentGifts&&typeof currentGifts==="object"?currentGifts:{};
  const incoming=incomingGifts&&typeof incomingGifts==="object"?incomingGifts:{};
  if(current.enabled===false&&!current.methods&&!current.mode&&!incoming.methods&&!incoming.mode){
    return {cashEnvelopes:{enabled:false,instructions:""},registry:{enabled:false},bankTransfer:{enabled:false}};
  }
  const legacyCurrent=legacyMethodsFromMode(current.mode);
  const legacyIncoming=Object.prototype.hasOwnProperty.call(incoming,"mode")?legacyMethodsFromMode(incoming.mode):null;
  const currentMethods=current.methods&&typeof current.methods==="object"?current.methods:{};
  const incomingMethods=incoming.methods&&typeof incoming.methods==="object"?incoming.methods:{};

  const currentCash=methodEnabled(currentMethods.cashEnvelopes,legacyCurrent.cashEnvelopes);
  const currentRegistry=methodEnabled(currentMethods.registry,legacyCurrent.registry);
  const currentBank=methodEnabled(currentMethods.bankTransfer,
    Object.prototype.hasOwnProperty.call(current,"bankInfoEnabled")?booleanValue(current.bankInfoEnabled,false):legacyCurrent.bankTransfer);

  const cashEnabled=Object.prototype.hasOwnProperty.call(incomingMethods,"cashEnvelopes")
    ?methodEnabled(incomingMethods.cashEnvelopes,currentCash)
    :legacyIncoming?legacyIncoming.cashEnvelopes:currentCash;
  const registryEnabled=Object.prototype.hasOwnProperty.call(incomingMethods,"registry")
    ?methodEnabled(incomingMethods.registry,currentRegistry)
    :legacyIncoming?legacyIncoming.registry:currentRegistry;
  const bankEnabled=Object.prototype.hasOwnProperty.call(incomingMethods,"bankTransfer")
    ?methodEnabled(incomingMethods.bankTransfer,currentBank)
    :Object.prototype.hasOwnProperty.call(incoming,"bankInfoEnabled")
      ?booleanValue(incoming.bankInfoEnabled,currentBank)
      :legacyIncoming?legacyIncoming.bankTransfer:currentBank;

  const currentCashInstructions=clean(currentMethods.cashEnvelopes?.instructions??current.cashEnvelopeInstructions??current.description,700);
  const incomingCashInstructions=clean(incomingMethods.cashEnvelopes?.instructions??incoming.cashEnvelopeInstructions??currentCashInstructions,700);

  return {
    cashEnvelopes:{enabled:cashEnabled,instructions:incomingCashInstructions},
    registry:{enabled:registryEnabled},
    bankTransfer:{enabled:bankEnabled}
  };
}

function legacyModeFromMethods(methods={},openpayEnabled=false){
  const active=[];
  if(methods.cashEnvelopes?.enabled===true)active.push("cash-envelopes");
  if(methods.registry?.enabled===true)active.push("registry");
  if(methods.bankTransfer?.enabled===true)active.push("bank-transfer");
  if(active.length===0)return openpayEnabled?"mixed":"no-gifts";
  if(active.length===1)return active[0];
  return "mixed";
}

function normalizeBankDetails(current={},incoming={}){
  const sourceCurrent=current&&typeof current==="object"?current:{};
  const sourceIncoming=incoming&&typeof incoming==="object"?incoming:{};
  return {
    bankName:clean(sourceIncoming.bankName??sourceCurrent.bankName,120),
    accountHolder:clean(sourceIncoming.accountHolder??sourceCurrent.accountHolder,160),
    clabe:digits(sourceIncoming.clabe??sourceCurrent.clabe,18),
    accountNumber:clean(sourceIncoming.accountNumber??sourceCurrent.accountNumber,60),
    referenceConcept:clean(sourceIncoming.referenceConcept??sourceCurrent.referenceConcept,160),
    instructions:clean(sourceIncoming.instructions??sourceCurrent.instructions,500),
    persuasionPresetId:clean(sourceIncoming.persuasionPresetId??sourceCurrent.persuasionPresetId,80),
    persuasionCustomText:clean(sourceIncoming.persuasionCustomText??sourceCurrent.persuasionCustomText,700)
  };
}

function normalizeSuggestedAmountCents(value,currentValue=null){
  const source=value===undefined?currentValue:value;
  if(source===null||source==="")return null;
  const number=Number(source);
  if(!Number.isFinite(number))return null;
  return Math.max(1000,Math.min(50000000,Math.round(number)));
}

function normalizeOpenpayOptions(current={},incoming={}){
  const sourceCurrent=current&&typeof current==="object"?current:{};
  const sourceIncoming=incoming&&typeof incoming==="object"?incoming:{};
  const suggestedAmountCents=normalizeSuggestedAmountCents(
    Object.prototype.hasOwnProperty.call(sourceIncoming,"suggestedAmountCents")?sourceIncoming.suggestedAmountCents:undefined,
    sourceCurrent.suggestedAmountCents??null
  );
  const enabled=booleanValue(sourceIncoming.enabled,booleanValue(sourceCurrent.enabled,false));
  let allowCustomAmount=booleanValue(sourceIncoming.allowCustomAmount,sourceCurrent.allowCustomAmount!==false);
  if(suggestedAmountCents===null)allowCustomAmount=true;
  return {
    ...sourceCurrent,
    ...sourceIncoming,
    enabled,
    suggestedAmountCents,
    allowCustomAmount,
    messageEnabled:booleanValue(sourceIncoming.messageEnabled,sourceCurrent.messageEnabled!==false)
  };
}


function publicGiftProjection(gifts={},options={}){
  const source=gifts&&typeof gifts==="object"?gifts:{};
  const methods=normalizeGiftMethods(source,{});
  const cashEnabled=methods.cashEnvelopes.enabled===true;
  const bankEnabled=methods.bankTransfer.enabled===true;
  const resolvedBank=options.resolvedBank&&typeof options.resolvedBank==="object"?options.resolvedBank:{};
  const motivationalMessage=clean(options.motivationalMessage,700);
  const registryLink=methods.registry.enabled===true?clean(options.registryLink??source.link,2048):"";
  const publicBank=bankEnabled
    ?{
        bankName:clean(resolvedBank.bankName,120),
        accountHolder:clean(resolvedBank.accountHolder,160),
        clabe:digits(resolvedBank.clabe,18),
        accountNumber:clean(resolvedBank.accountNumber,60),
        referenceConcept:clean(resolvedBank.referenceConcept,160),
        instructions:clean(resolvedBank.instructions,500),
        motivationalMessage
      }
    :{bankName:"",accountHolder:"",clabe:"",accountNumber:"",referenceConcept:"",instructions:"",motivationalMessage:""};
  return {
    ...source,
    methods:{
      cashEnvelopes:{...methods.cashEnvelopes,instructions:cashEnabled?methods.cashEnvelopes.instructions:""},
      registry:{...methods.registry},
      bankTransfer:{...methods.bankTransfer}
    },
    mode:legacyModeFromMethods(methods,source.openpay?.enabled===true),
    bankInfoEnabled:bankEnabled,
    bankInfo:bankEnabled?clean(source.bankInfo,1000):"",
    link:registryLink,
    bank:publicBank
  };
}

function hasBankDetails(bank={}){
  return [bank.bankName,bank.accountHolder,bank.clabe,bank.accountNumber,bank.referenceConcept,bank.instructions]
    .some(value=>clean(value,500));
}

function hasActiveGiftMethod(gifts={}){
  const methods=normalizeGiftMethods(gifts,{});
  return methods.cashEnvelopes.enabled||methods.registry.enabled||methods.bankTransfer.enabled||gifts.openpay?.enabled===true;
}

module.exports={
  normalizeBankDetails,
  normalizeSuggestedAmountCents,
  normalizeOpenpayOptions,
  normalizeGiftMethods,
  legacyModeFromMethods,
  legacyMethodsFromMode,
  hasBankDetails,
  hasActiveGiftMethod,
  publicGiftProjection
};
