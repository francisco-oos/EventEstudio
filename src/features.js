const commercial=require("../config/commercial-plans.json");
const FEATURE_STATES=new Set(["available","experimental","hidden","disabled"]);

const catalog=[
  {key:"invitation",label:"Invitación pública",group:"Evento",defaultState:"available",minPlan:"starter"},
  {key:"rsvp",label:"Confirmaciones RSVP",group:"Evento",defaultState:"available",minPlan:"starter"},
  {key:"guests",label:"Invitados e importación",group:"Evento",defaultState:"available",minPlan:"starter"},
  {key:"whatsappManual",label:"Envío manual por WhatsApp",group:"Mensajería",defaultState:"available",minPlan:"starter"},
  {key:"whatsappBusiness",label:"WhatsApp Business automático",group:"Mensajería",defaultState:"hidden",minPlan:"premium"},
  {key:"music",label:"Música y Spotify",group:"Contenido",defaultState:"available",minPlan:"basic"},
  {key:"program",label:"Programa",group:"Contenido",defaultState:"available",minPlan:"basic"},
  {key:"locations",label:"Ubicaciones",group:"Contenido",defaultState:"available",minPlan:"starter"},
  {key:"dressCode",label:"Código de vestimenta",group:"Contenido",defaultState:"available",minPlan:"basic"},
  {key:"gifts",label:"Regalos",group:"Contenido",defaultState:"available",minPlan:"basic"},
  {key:"gallery",label:"Galería de la invitación",group:"Fotografías",defaultState:"available",minPlan:"basic"},
  {key:"guestPhotoUpload",label:"Carga de fotos por invitados",group:"Fotografías",defaultState:"available",minPlan:"premium"},
  {key:"guestPhotoMessages",label:"Mensajes con fotografías",group:"Fotografías",defaultState:"available",minPlan:"premium"},
  {key:"qrCards",label:"QR y material de mesa",group:"Impresión",defaultState:"available",minPlan:"premium"},
  {key:"physicalInvitations",label:"Invitaciones físicas",group:"Impresión",defaultState:"available",minPlan:"premium"},
  {key:"seating",label:"Plano y asignación de mesas",group:"Operación",defaultState:"available",minPlan:"premium"},
  {key:"reports",label:"Reportes operativos",group:"Operación",defaultState:"available",minPlan:"basic"},
  {key:"menus",label:"Menús configurables",group:"Operación",defaultState:"available",minPlan:"premium"},
  {key:"templates",label:"Plantillas y tipografías",group:"Diseño",defaultState:"available",minPlan:"starter"},
  {key:"thematicExperience",label:"Experiencia temática animada",group:"Diseño",defaultState:"available",minPlan:"express"},
  {key:"premiumTemplates",label:"Colección de plantillas Premium",group:"Diseño",defaultState:"available",minPlan:"premium"},
  {key:"billing",label:"Pagos y mejoras",group:"Plataforma",defaultState:"hidden"},
  {key:"customDomains",label:"Dominios personalizados",group:"Plataforma",defaultState:"hidden",minPlan:"premium"},
  {key:"developerTools",label:"Herramientas de desarrollo",group:"Plataforma",defaultState:"hidden"}
];

const legacy={
  invitation:["invitation"],rsvp:["rsvp"],guests:["guests"],
  whatsappBusiness:["whatsappBusiness"],music:["music","spotify"],
  program:["program","agenda"],locations:["locations","agenda"],dressCode:["dressCode"],
  gifts:["gifts"],gallery:["gallery"],guestPhotoUpload:["guestPhotoUpload","photos"],
  guestPhotoMessages:["guestPhotoMessages"],qrCards:["qrCards","qr"],
  physicalInvitations:["physicalInvitations"],seating:["seating","tablesLab"],
  reports:["reports"],menus:["menus"],templates:["templates"],thematicExperience:["thematicExperience"],billing:["billing"],
  customDomains:["customDomains","domains"],developerTools:["developerTools"]
};

function legacyValue(features,key){
  const names=legacy[key]||[key];
  const found=names.find(name=>typeof features?.[name]==="boolean");
  return found?features[found]:undefined;
}

function normalizeFeatureSettings(settings){
  const input=settings&&typeof settings==="object"?settings:{};
  const existingFeatures=input.features&&typeof input.features==="object"?input.features:{};
  const existingStates=input.featureStates&&typeof input.featureStates==="object"?input.featureStates:{};
  const features={...existingFeatures};
  const featureStates={...existingStates};
  for(const item of catalog){
    const previous=legacyValue(existingFeatures,item.key);
    const enabled=previous===undefined?item.defaultState!=="disabled":previous;
    features[item.key]=enabled;
    const proposed=existingStates[item.key];
    featureStates[item.key]=FEATURE_STATES.has(proposed)
      ?proposed
      :(enabled?item.defaultState:"disabled");
  }
  const known=new Set(catalog.map(item=>item.key));
  const purchasedFeatures=Array.isArray(input.purchasedFeatures)
    ?[...new Set(input.purchasedFeatures.filter(key=>known.has(key)))]
    :[];
  return {...input,features,featureStates,purchasedFeatures};
}

function featureDecision(settings,key,{
  role="public",planCode="studio",includedFeatures=null,grantedFeatures=null,
  globalStates=null,forceClientView=false
}={}){
  const normalized=normalizeFeatureSettings(settings);
  const item=catalog.find(feature=>feature.key===key);
  if(!item)return {key,state:"disabled",allowed:false,blockedByPlan:false,reason:"unknown"};
  const state=globalStates?.[key]||normalized.featureStates[key]||item.defaultState;
  const commerceControlled=Array.isArray(includedFeatures)||Array.isArray(grantedFeatures);
  const enabled=commerceControlled?true:normalized.features[key]!==false;
  const platformUser=["owner","developer"].includes(role)&&!forceClientView;
  const plan=commercial.plans.find(candidate=>candidate.code===planCode);
  const addonGranted=Array.isArray(grantedFeatures)
    ?grantedFeatures.includes(key)
    :normalized.purchasedFeatures.includes(key);
  const grantsAll=Boolean(plan?.includesAllAvailable);
  const includedByPlan=Array.isArray(includedFeatures)
    ?includedFeatures.includes(key)
    :(grantsAll||Boolean(plan?.included?.includes(key)));
  const blockedByPlan=!platformUser&&!addonGranted&&!includedByPlan;
  const allowed=platformUser
    ?state!=="disabled"
    :(enabled&&state==="available"&&!blockedByPlan);
  return {
    key,state,allowed,enabled,blockedByPlan,minPlan:item.minPlan||null,addonGranted,includedByPlan,
    reason:allowed?"available":state!=="available"?state:"plan"
  };
}

function featureOverview(settings,context={}){
  return catalog.map(item=>({...item,...featureDecision(settings,item.key,context)}));
}

module.exports={catalog,normalizeFeatureSettings,featureDecision,featureOverview,FEATURE_STATES};
