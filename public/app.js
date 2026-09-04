let settings=null,currentGuest=null,currentMenus={},galleryItems=[],galleryIndex=0,rsvpDirty=false,activeLocale='es',gallerySuppressClickUntil=0;
let configRequestUrl='',configRevision='',configRefreshInFlight=false,configReloading=false;
let spotifyPublicApi=null,spotifyPublicController=null;
let spotifyIframePromise=null,spotifyControllerGeneration=0,spotifyPlayRequested=false,spotifyPlaybackStarted=false,spotifyPlaybackTimer=0;
const $=id=>document.getElementById(id);function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
const localeMeta={es:{name:'Español',intl:'es-MX'},en:{name:'English',intl:'en-US'},pt:{name:'Português',intl:'pt-BR'}};
const uiText={
  es:{language:'Idioma',skipAnimation:'Omitir animación',specialFor:'Preparada especialmente para',specialShare:'Tenemos algo especial que compartir contigo',days:'Días',hours:'Horas',minutes:'Minutos',seconds:'Segundos',calendar:'Agregar al calendario',ceremony:'Ceremonia:',celebration:'Celebración:',directions:'Cómo llegar',firstLocation:'Primera ubicación',secondLocation:'Segunda ubicación',time:'Hora:',activity:'Actividad',attire:'Vestimenta:',photoAlt:'Fotografía del evento',adults:'adulto(s)',children:'niño(s)',reservedFlexible:'Hemos reservado {total} lugar(es) en total; pueden distribuirlos entre adultos y niños.',reservedFixed:'Hemos reservado {places} para ustedes.',confirmFamily:'Confirma cuántas personas de {family} asistirán.',table:'Mesa asignada: {table}',closed:'El periodo de confirmación ha terminado. Contacta a los anfitriones si necesitas hacer un cambio.',registered:'Tu confirmación ya fue registrada. Contacta a los anfitriones si necesitas hacer un cambio.',saving:'Guardando…',savedYes:'Confirmación guardada. ¡Nos dará mucho gusto verte!',savedNo:'Respuesta guardada. Gracias por avisarnos.',network:'No pudimos conectar con el servidor. Intenta nuevamente.',giftRegistry:'Ver mesa de regalos',photoMessages:'Mensajes de nuestros invitados',sharedMemories:'Recuerdos compartidos',attendingQuestion:'¿Podrán acompañarnos?',yes:'Sí, asistiremos',no:'No podremos asistir',adultsLabel:'Adultos',childrenLabel:'Niños',names:'Nombres de quienes asistirán',dietaryCheck:'Tengo una alergia o restricción alimentaria',dietaryQuestion:'¿Cuál?',specialCheck:'Necesito que el lugar considere algo especial',specialQuestion:'¿Qué debemos considerar?',phone:'Teléfono',responsible:'Persona responsable',message:'Mensaje',saveRsvp:'Guardar confirmación'},
  en:{language:'Language',skipAnimation:'Skip animation',specialFor:'Prepared especially for',specialShare:'We have something special to share with you',days:'Days',hours:'Hours',minutes:'Minutes',seconds:'Seconds',calendar:'Add to calendar',ceremony:'Ceremony:',celebration:'Celebration:',directions:'Get directions',firstLocation:'First location',secondLocation:'Second location',time:'Time:',activity:'Activity',attire:'Attire:',photoAlt:'Event photograph',adults:'adult(s)',children:'child(ren)',reservedFlexible:'We reserved {total} place(s) in total; you may distribute them between adults and children.',reservedFixed:'We reserved {places} for you.',confirmFamily:'Please confirm how many people from {family} will attend.',table:'Assigned table: {table}',closed:'RSVP is now closed. Please contact the hosts if you need to make a change.',registered:'Your RSVP has already been recorded. Please contact the hosts if you need to make a change.',saving:'Saving…',savedYes:'RSVP saved. We will be delighted to see you!',savedNo:'Response saved. Thank you for letting us know.',network:'We could not connect with the server. Please try again.',giftRegistry:'View gift registry',photoMessages:'Messages from our guests',sharedMemories:'Shared memories',attendingQuestion:'Will you join us?',yes:'Yes, we will attend',no:'We cannot attend',adultsLabel:'Adults',childrenLabel:'Children',names:'Names of attendees',dietaryCheck:'I have a food allergy or dietary restriction',dietaryQuestion:'Please describe it',specialCheck:'The venue should consider a special need',specialQuestion:'What should we consider?',phone:'Phone',responsible:'Contact person',message:'Message',saveRsvp:'Save RSVP'},
  pt:{language:'Idioma',skipAnimation:'Pular animação',specialFor:'Preparado especialmente para',specialShare:'Temos algo especial para compartilhar com você',days:'Dias',hours:'Horas',minutes:'Minutos',seconds:'Segundos',calendar:'Adicionar ao calendário',ceremony:'Cerimônia:',celebration:'Celebração:',directions:'Como chegar',firstLocation:'Primeiro local',secondLocation:'Segundo local',time:'Horário:',activity:'Atividade',attire:'Traje:',photoAlt:'Fotografia do evento',adults:'adulto(s)',children:'criança(s)',reservedFlexible:'Reservamos {total} lugar(es) no total; vocês podem distribuí-los entre adultos e crianças.',reservedFixed:'Reservamos {places} para vocês.',confirmFamily:'Confirme quantas pessoas de {family} estarão presentes.',table:'Mesa designada: {table}',closed:'O período de confirmação terminou. Entre em contato com os anfitriões se precisar alterar algo.',registered:'Sua confirmação já foi registrada. Entre em contato com os anfitriões se precisar alterar algo.',saving:'Salvando…',savedYes:'Confirmação salva. Ficaremos muito felizes em ver você!',savedNo:'Resposta salva. Obrigado por nos avisar.',network:'Não foi possível conectar ao servidor. Tente novamente.',giftRegistry:'Ver lista de presentes',photoMessages:'Mensagens dos nossos convidados',sharedMemories:'Memórias compartilhadas',attendingQuestion:'Vocês poderão nos acompanhar?',yes:'Sim, estaremos presentes',no:'Não poderemos comparecer',adultsLabel:'Adultos',childrenLabel:'Crianças',names:'Nomes de quem estará presente',dietaryCheck:'Tenho alergia ou restrição alimentar',dietaryQuestion:'Qual?',specialCheck:'O local deve considerar alguma necessidade especial',specialQuestion:'O que devemos considerar?',phone:'Telefone',responsible:'Pessoa responsável',message:'Mensagem',saveRsvp:'Salvar confirmação'}
};
const knownPresentation={
  en:{'Nuestra boda':'Our wedding','Evento especial':'Special event','Abrir invitación':'Open invitation','Ver invitación':'View invitation','Una invitación para ti':'An invitation for you','Faltan':'Coming up in','Nuestra historia':'Our story','Acerca del evento':'About the event','Momentos':'Moments','Galería':'Gallery','Código de vestimenta':'Dress code','Vestimenta':'Attire','Confirmación':'RSVP','Confirma tu asistencia':'Please RSVP','Obsequios':'Gifts','Regalos':'Gifts','Programa':'Schedule','Momentos del evento':'Event schedule','Asistencia':'RSVP'},
  pt:{'Nuestra boda':'Nosso casamento','Evento especial':'Evento especial','Abrir invitación':'Abrir convite','Ver invitación':'Ver convite','Una invitación para ti':'Um convite para você','Faltan':'Faltam','Nuestra historia':'Nossa história','Acerca del evento':'Sobre o evento','Momentos':'Momentos','Galería':'Galeria','Código de vestimenta':'Código de vestimenta','Vestimenta':'Traje','Confirmación':'Confirmação','Confirma tu asistencia':'Confirme sua presença','Obsequios':'Presentes','Regalos':'Presentes','Programa':'Programação','Momentos del evento':'Programação do evento','Asistencia':'Confirmação'}
};
function t(key,variables={}){
  let value=(uiText[activeLocale]||uiText.es)[key]??uiText.es[key]??key;
  Object.entries(variables).forEach(([name,replacement])=>{value=value.replaceAll(`{${name}}`,String(replacement));});
  return value;
}
function translateKnown(value){return knownPresentation[activeLocale]?.[String(value||'')]||String(value||'');}
function localeCode(){return localeMeta[activeLocale]?.intl||'es-MX';}
function slug(){const m=location.pathname.match(/^\/e\/([^/]+)/);return m?decodeURIComponent(m[1]):"";}
const fontMap={georgia:'Georgia,"Times New Roman",serif',baskerville:'Baskerville,"Palatino Linotype",serif',garamond:'Garamond,"Times New Roman",serif',didot:'Didot,"Bodoni MT",serif',system:'Inter,system-ui,-apple-system,"Segoe UI",sans-serif',humanist:'Trebuchet MS,Segoe UI,sans-serif',classic:'Palatino Linotype,Book Antiqua,serif','great-vibes':'Great Vibes,Georgia,cursive',cormorant:'Cormorant Garamond,Georgia,serif',playfair:'Playfair Display,Georgia,serif',cinzel:'Cinzel,Georgia,serif',lora:'Lora,Georgia,serif',montserrat:'Montserrat,Inter,system-ui,sans-serif'};
function titleCaseName(value){
  const minorWords=new Set(['y','e','de','del','la','las','los','familia']);let wordIndex=0;
  return String(value||'').trim().toLocaleLowerCase(localeCode()).split(/([\s-]+)/).map(part=>{
    if(!part||/^[\s-]+$/.test(part))return part;
    const current=wordIndex++;if(['xv','xxv'].includes(part))return part.toLocaleUpperCase(localeCode());if(current>0&&minorWords.has(part))return part;
    return part.replace(/^\p{L}/u,letter=>letter.toLocaleUpperCase(localeCode()));
  }).join('');
}
function presentedName(value){
  const mode=settings?.typography?.nameCase||'title';
  if(mode==='uppercase')return String(value||'').toLocaleUpperCase(localeCode());
  if(mode==='title'||mode==='small-caps')return titleCaseName(value);
  return String(value||'');
}
function applyPresentedName(element,value){
  if(!element)return;const mode=settings?.typography?.nameCase||'title';const text=presentedName(value);
  element.textContent=text;element.classList.add('smart-event-name');
  element.classList.toggle('name-case-uppercase',mode==='uppercase');element.classList.toggle('name-case-small-caps',mode==='small-caps');
  element.classList.toggle('long-name',text.length>28);element.classList.toggle('extra-long-name',text.length>46);
}


function loadSpotifyIframeApi(){
  if(spotifyPublicApi)return Promise.resolve(spotifyPublicApi);
  if(spotifyIframePromise)return spotifyIframePromise;
  spotifyIframePromise=new Promise((resolve,reject)=>{
    let settled=false;
    let timeout=0;
    const finish=(callback,value)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timeout);
      callback(value);
    };
    window.onSpotifyIframeApiReady=api=>{
      spotifyPublicApi=api;
      if(settled){
        spotifyIframePromise=Promise.resolve(api);
        if(settings)renderSpotify();
        return;
      }
      finish(resolve,api);
    };
    const script=document.createElement('script');
    script.src='https://open.spotify.com/embed/iframe-api/v1';
    script.async=true;
    script.onerror=()=>finish(reject,new Error('No se pudo conectar con Spotify.'));
    document.head.appendChild(script);
    timeout=setTimeout(()=>finish(reject,new Error('Spotify tardó demasiado en responder.')),12000);
  });
  return spotifyIframePromise;
}

function safeExternalUrl(value){
  try{
    const url=new URL(String(value||"").trim(),location.origin);
    return ["http:","https:"].includes(url.protocol)?url.href:"";
  }catch{
    return "";
  }
}
function configureExternalLink(element,value){
  if(!element)return;
  const url=safeExternalUrl(value);
  if(!url){
    element.classList.add("hidden");
    element.removeAttribute("href");
    return;
  }
  element.href=url;
  element.target="_blank";
  element.rel="noopener noreferrer";
  element.classList.remove("hidden");
}
function configureLocale(){
  const localization=settings?.localization||{};
  const enabled=(Array.isArray(localization.enabledLocales)?localization.enabledLocales:['es']).filter(locale=>localeMeta[locale]);
  const requested=new URLSearchParams(location.search).get('lang');
  activeLocale=enabled.includes(requested)?requested:(enabled.includes(localization.defaultLocale)?localization.defaultLocale:enabled[0]||'es');
  document.documentElement.lang=activeLocale;
  const switcher=$('languageSwitcher');
  const select=$('publicLanguageSelect');
  if(!switcher||!select)return;
  select.innerHTML=enabled.map(locale=>`<option value="${locale}" ${locale===activeLocale?'selected':''}>${esc(localeMeta[locale].name)}</option>`).join('');
  switcher.querySelector('span').textContent=t('language');
  switcher.classList.toggle('hidden',enabled.length<2);
  select.onchange=()=>{
    const url=new URL(location.href);
    url.searchParams.set('lang',select.value);
    location.assign(url);
  };
}
function localizedContent(path,fallback=''){
  if(activeLocale===(settings?.localization?.defaultLocale||'es'))return fallback;
  return settings?.localization?.contentTranslations?.[activeLocale]?.[path]||fallback;
}
function localizedDateLabel(){
  const configured=settings?.event?.dateLabel||'';
  if(activeLocale==='es'||!settings?.event?.dateTime)return configured;
  const date=new Date(settings.event.dateTime);
  if(Number.isNaN(date.getTime()))return configured;
  return new Intl.DateTimeFormat(localeCode(),{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);
}
function wazeUrl(address){
  const value=String(address||'').trim();
  return value?`https://waze.com/ul?q=${encodeURIComponent(value)}&navigate=yes`:'';
}
function calendarUrl(){
  const raw=settings?.event?.dateTime;
  if(!raw)return '';
  const start=new Date(raw);
  if(Number.isNaN(start.getTime()))return '';
  const end=new Date(start.getTime()+4*60*60*1000);
  const stamp=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const title=presentedName(settings?.couple?.displayName||settings?.event?.title||'EventStudio');
  const location=settings?.venue?.address||settings?.venues?.ceremony?.address||'';
  const url=new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action','TEMPLATE');
  url.searchParams.set('text',title);
  url.searchParams.set('dates',`${stamp(start)}/${stamp(end)}`);
  if(location)url.searchParams.set('location',location);
  return url.toString();
}
function setLeadingText(element,text){
  if(!element)return;
  const node=[...element.childNodes].find(item=>item.nodeType===3&&item.textContent.trim());
  if(node)node.textContent=`${text} `;
}
function localizeStaticUi(){
  const countLabels=document.querySelectorAll('.countdown span');
  [t('days'),t('hours'),t('minutes'),t('seconds')].forEach((label,index)=>{if(countLabels[index])countLabels[index].textContent=label;});
  $('ceremonyLabel').textContent=t('ceremony');
  $('receptionLabel').textContent=t('celebration');
  $('venueMaps').textContent=t('directions');
  $('calendarLink').textContent=t('calendar');
  $('personalWelcomeEyebrow').textContent=activeLocale==='en'?'With love':activeLocale==='pt'?'Com carinho':'Con mucho cariño';
  const photoEyebrow=$('photoMessagesSection')?.querySelector('.eyebrow');
  const photoTitle=$('photoMessagesSection')?.querySelector('h2');
  if(photoEyebrow)photoEyebrow.textContent=t('sharedMemories');
  if(photoTitle)photoTitle.textContent=t('photoMessages');
  setLeadingText($('attending')?.closest('label'),t('attendingQuestion'));
  setLeadingText($('adultCountField'),t('adultsLabel'));
  setLeadingText($('childCountField'),t('childrenLabel'));
  setLeadingText($('attendeeNames')?.closest('label'),t('names'));
  setLeadingText($('hasDietary')?.closest('label'),t('dietaryCheck'));
  setLeadingText($('dietaryField'),t('dietaryQuestion'));
  setLeadingText($('hasSpecialNeeds')?.closest('label'),t('specialCheck'));
  setLeadingText($('specialNeedsField'),t('specialQuestion'));
  setLeadingText($('contactPhone')?.closest('label'),t('phone'));
  setLeadingText($('responsibleName')?.closest('label'),t('responsible'));
  setLeadingText($('message')?.closest('label'),t('message'));
  const options=$('attending')?.options;
  if(options?.[0])options[0].text=t('yes');
  if(options?.[1])options[1].text=t('no');
  if($('rsvpSubmitBtn'))$('rsvpSubmitBtn').textContent=t('saveRsvp');
}
function presentation(){
  return {
    heroEyebrow:"Evento especial",
    openButton:"Abrir invitación",
    countdownEyebrow:"Faltan",
    storyEyebrow:"Acerca del evento",
    galleryEyebrow:"Momentos",
    galleryTitle:"Galería",
    dressEyebrow:"Código de vestimenta",
    rsvpEyebrow:"Confirmación",
    rsvpTitle:"Confirma tu asistencia",
    giftEyebrow:"Obsequios",
    agendaEyebrow:"Programa",
    agendaTitle:"Momentos del evento",
    ...(settings.presentation||{})
  };
}
function setupThemeExperience(){
  const theme=settings?._theme||{};
  const presentationSettings=settings?.presentation||{};
  const allowedLayouts=new Set(['classic','editorial','portrait','cinematic','storybook','botanical','watercolor','layered','reveal','story-panels','poster','split','scrapbook','postcard','carousel','pixel','celestial','minimal','passport','bloom','timeline','family-tree']);
  const allowedExperiences=new Set(['classic','story','poster','gallery']);
  const allowedMotion=new Set(['still','subtle','balanced','dynamic']);
  const allowedPhotos=new Set([
    'cards','arches','portrait','fullscreen','keepsake','organic','clouds','watercolor','polaroid','postcard','frames','collage','reveal',
    'split','stickers','cutout','orbit','bubbles','badge','speed-cards','round-frames','tiles','floating','burst','polaroids','postcards','filmstrip','cover','halo','linen',
    'passport','bloom','depth','timeline','family-tree'
  ]);
  const layout=allowedLayouts.has(theme.layoutFamily)?theme.layoutFamily:'classic';
  const requested=presentationSettings.experienceMode==='auto'?theme.defaultExperience:presentationSettings.experienceMode;
  const experience=allowedExperiences.has(requested)?requested:'classic';
  const motion=allowedMotion.has(presentationSettings.motionLevel)?presentationSettings.motionLevel:'balanced';
  const photoStyle=allowedPhotos.has(theme.photoStyle)?theme.photoStyle:'cards';
  document.body.dataset.layout=layout;
  document.body.dataset.experience=experience;
  document.body.dataset.motion=motion;
  document.body.dataset.photoStyle=photoStyle;
  document.body.dataset.motif=String(theme.motif||'spark').replace(/[^a-z-]/g,'').slice(0,24)||'spark';

  const atmosphere=$('themeAtmosphere');
  if(!atmosphere)return;
  const motifs={
    paw:['●','●','●','●','●','●'],star:['✦','·','✧','✦','·','✧'],bubble:['○','◌','○','◌','○'],
    confetti:['◆','●','▲','■','◆','●'],leaf:['❧','⌁','❧','⌁','❧'],block:['■','●','▲','■','●'],
    flag:['◆','◇','◆','◇','◆'],light:['✦','◦','✦','◦','✦'],pixel:['▦','▪','▫','▦','▪'],
    paper:['◻','⌁','◻','⌁'],stamp:['◎','◌','◎','◌'],frame:['□','◇','□','◇'],
    spark:['✦','·','✦','·','✦'],cloud:['☁','◦','☁','◦'],moon:['☾','✦','·','☾'],
    dino:['▲','●','▲','●'],rocket:['✦','△','✦','△'],wave:['◌','≈','◌','≈'],
    rainbow:['⌒','◦','⌒','◦'],wheel:['○','◉','○','◉'],tent:['△','◆','△','◆'],
    butterfly:['◇','✦','◇','✦'],teddy:['●','○','●','○'],stork:['⌁','◦','⌁','◦'],
    garden:['❀','❧','❀','❧'],daisy:['✿','❁','✿','❁','·'],camera:['□','●','□','●'],cross:['✧','·','✧','·'],
    sun:['◉','·','◉','·'],plane:['✈','·','⌁','✈'],rose:['❀','◇','❀','◇'],
    petal:['◇','❧','◇','❧'],milestone:['◆','·','◆','·'],branch:['⌁','❧','⌁','❧']
  };
  atmosphere.replaceChildren();
  (motifs[document.body.dataset.motif]||motifs.spark).slice(0,motion==='dynamic'?8:5).forEach((symbol,index)=>{
    const item=document.createElement('span');
    item.textContent=symbol;
    item.style.setProperty('--motif-index',String(index));
    atmosphere.appendChild(item);
  });
}

function setupTemplateMotion(){
  const motion=document.body.dataset.motion||'still';
  if(motion==='still'||!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  document.body.classList.add('template-motion');
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    entry.target.classList.add('reveal-visible');
    observer.unobserve(entry.target);
  }),{threshold:.08,rootMargin:'0px 0px -6%'});
  document.querySelectorAll('main .section:not(.hidden)').forEach(section=>observer.observe(section));
}

function openingDefinition(style){return (settings?._experiences?.openings||[]).find(item=>item.id===String(style||''))||null;}
function openingSupportsSeal(style){return openingDefinition(style)?.seal?.compatible===true;}
function openingSealContentMode(style){return openingDefinition(style)?.seal?.contentMode||'monogram';}
function themeSupportsFinalSeal(themeId){return /(storybook-seal|olive-nectar|olive-universe|powder-blue-letter|romantic-wine|enchanted-letter|reserve|gran-reserva)/.test(String(themeId||''));}
function activeStationerySealColor(){
  const unified=settings?.presentation?.openingStyle===settings?._stationeryCatalog?.openingId;
  const candidates=unified
    ?[settings?.stationery?.sealColor,settings?._palette?.accent,settings?._palette?.gold]
    :[settings?._palette?.accent,settings?._palette?.gold];
  const value=candidates.map(item=>String(item||'')).find(item=>/^#[0-9a-f]{6}$/i.test(item));
  return value||'';
}
function sealDateParts(){
  const source=settings?.event?.dateTime||settings?.event?.date||settings?.event?.dateAt||settings?._event?.date||'';
  const date=source?new Date(source):null;
  if(!date||Number.isNaN(date.getTime()))return null;
  const locale=activeLocale||document.documentElement.lang||'es';
  return {day:new Intl.DateTimeFormat(locale,{day:'numeric'}).format(date),month:new Intl.DateTimeFormat(locale,{month:'long'}).format(date).toUpperCase(),year:new Intl.DateTimeFormat(locale,{year:'numeric'}).format(date)};
}
function finalHeroSealDefinition(style){
  const seal=sealDefinitionForOpening(style);
  const themeId=String(settings?._theme?.id||settings?.themeId||'');
  if(/powder-blue|blue-aurora|frost|ice/.test(`${style||''} ${themeId}`))seal.material=seal.material&&seal.material!=='theme'?seal.material:'silver';
  if(/olive|nectar|reserve|wine|storybook/.test(`${style||''} ${themeId}`)&&(!seal.ornament||seal.ornament==='none'))seal.ornament='laurel';
  return seal;
}
function renderFinalHeroSeal(style){
  const host=$('heroWaxSeal');
  if(!host)return;
  const themeId=String(settings?._theme?.id||settings?.themeId||'');
  const visible=settings?.seal?.enabled!==false&&(openingSupportsSeal(style)||themeSupportsFinalSeal(themeId));
  host.classList.toggle('hidden',!visible);
  $('heroContent')?.classList.toggle('has-template-seal',visible);
  if(!visible){host.innerHTML='';return;}
  const renderer=window.EventStudioWaxSeal;
  if(!renderer?.renderInto)return;
  renderer.renderInto(host,finalHeroSealDefinition(style),{displayName:settings?.couple?.displayName||settings?.event?.title||'Nuestro evento',eventTitle:settings?.event?.title||'',themeColor:activeStationerySealColor(),seed:`final-seal:${settings?.event?.slug||settings?.event?.eventId||'eventstudio'}:${style||themeId}`,idPrefix:`final-seal-${String(style||themeId||'default').replace(/[^a-z0-9-]/gi,'')}`},settings?._sealCatalog||{});
}
function sealDefinitionForOpening(style){
  const base={...(settings?.seal||{})};
  /* Un sello diseñado por el usuario es la fuente de verdad. Las sugerencias
     temáticas sólo completan sellos que nunca han sido personalizados. */
  if(base.customized===true)return base;
  if(style===settings?._stationeryCatalog?.openingId){
    const recipe=(settings?._stationeryCatalog?.presets||[]).find(item=>item.id===settings?.stationery?.presetId);
    if(recipe?.seal)Object.assign(base,recipe.seal);
  }
  const themeId=String(settings?._theme?.id||'');
  const id=`${style||''} ${themeId}`;
  if(base.material==='theme'||!base.material){
    if(/powder-blue|blue-aurora|frost|ice/.test(id))base.material='silver';
    else if(/gala-curtain|gala-marquee|reserve|gran-reserva|wine/.test(id))base.material='gold';
    else if(/constellation|celestial|cosmos|night/.test(id))base.material='midnight-blue';
    else if(/blush-heart|heart|romantic|rose/.test(id))base.material='burgundy';
    else base.material='theme';
  }
  if(base.ornament==='none'||!base.ornament){
    if(/constellation|celestial|cosmos/.test(id))base.ornament='stars';
    else if(/reserve|gran-reserva|wine/.test(id))base.ornament='laurel';
  }
  return base;
}
function renderOpeningSeal(opening,style){
  const seal=opening?.querySelector('.opening-seal');
  if(!seal||settings?.seal?.enabled===false)return;
  const renderer=window.EventStudioWaxSeal;
  if(!renderer?.renderInto)return;
  const displayName=settings?.couple?.displayName||settings?.event?.title||'EventStudio';
  let definition=sealDefinitionForOpening(style);
  if(openingSealContentMode(style)==='date'){
    const dateParts=sealDateParts();
    if(dateParts)definition={...definition,autoMonogram:false,initial1:dateParts.day,initial2:'',connector:'none',topText:dateParts.month,bottomText:dateParts.year,fontSize:definition.fontSize||90,kerning:1};
  }
  renderer.renderInto(seal,definition,{
    displayName,eventTitle:settings?.event?.title||'',themeColor:activeStationerySealColor(),
    seed:`${settings?.event?.eventId||settings?.event?.slug||displayName}:${style}`,idPrefix:`opening-seal-${String(style||'default').replace(/[^a-z0-9-]/gi,'')}`
  },settings?._sealCatalog||{});
}
function renderUnifiedEnvelope(opening,style){
  const mount=$('stationeryOpeningMount');
  const unified=style==='unified-envelope';
  opening?.classList.toggle('uses-unified-envelope',unified);
  if(!mount)return;
  mount.hidden=!unified;
  if(!unified){mount.replaceChildren();return;}
  const renderer=window.EventStudioStationery;
  if(!renderer?.renderInto)return;
  const displayName=presentedName(settings?.couple?.displayName||settings?.event?.title||'');
  renderer.renderInto(mount,settings?.stationery||{}, {
    openingStyle:style,
    displayName,
    eventTitle:settings?.event?.title||'',
    dateLabel:localizedDateLabel(),
    headingFont:fontMap[settings?.typography?.heading]||fontMap.georgia,
    seed:`${settings?.event?.eventId||settings?.event?.slug||displayName}:stationery`,
    idPrefix:`stationery-${String(settings?.event?.eventId||settings?.event?.slug||'event').replace(/[^a-z0-9-]/gi,'')}`,
    sealCatalog:settings?._sealCatalog||{}
  },settings?._stationeryCatalog||{},sealDefinitionForOpening(style));
}
function setupInvitationOpening(){
  const allowed=new Set((settings?._experiences?.openings||[]).map(item=>item.id).filter(id=>id!=='none'));
  const style=String(settings?.presentation?.openingStyle||'unified-envelope');
  const opening=$('invitationOpening');
  const forceMotion=forceMotionRequested();
  document.body.classList.toggle('force-motion-preview',forceMotion);
  if(!opening||style==='none'||!allowed.has(style)){document.body.classList.remove('force-motion-preview');return;}
  document.body.dataset.openingUsed='true';
  $('openInvitationBtn')?.classList.add('hidden');
  opening.className=`invitation-opening opening-${style}`;
  renderUnifiedEnvelope(opening,style);
  if(style!=='unified-envelope')renderOpeningSeal(opening,style);
  $('openingEyebrow').textContent=translateKnown(settings.presentation?.openingEyebrow||'Una invitación para ti');
  applyPresentedName($('openingCouple'),settings.couple?.displayName||settings.event?.title||'Nuestro evento');
  $('openingDate').textContent=localizedDateLabel();
  $('openingDate').classList.toggle('hidden',style==='particle-heart');
  $('openingGuest').textContent=currentGuest?.family_name?`${t('specialFor')} ${presentedName(currentGuest.family_name)}`:t('specialShare');
  const openingAction=translateKnown(settings.presentation?.openButton||'Abrir invitación');
  const openingButton=$('openingEnvelopeButton');
  if(openingButton){
    openingButton.disabled=false;
    openingButton.removeAttribute('aria-hidden');
    openingButton.classList.remove('opening-action-consumed');
    const openingActionLabel=$('openingActionLabel');
    if(openingActionLabel)openingActionLabel.textContent=openingAction;
    openingButton.setAttribute('aria-label',openingAction);
  }
  opening.classList.remove('hidden','is-opening','rose-bloom-playing');
  delete opening.dataset.roseBloomStarted;delete opening.dataset.bloomStarted;
  if(style==='particle-heart'&&window.EventStudioExperiences?.ParticleTraceScene){opening._particleScene?.destroy?.();opening._particleScene=new window.EventStudioExperiences.ParticleTraceScene($('particleOpeningCanvas'),{preset:'heart',forceMotion,motionLevel:settings.presentation?.motionLevel||'balanced'});opening._particleScene.start();}
  if(style==='rose-bloom'&&window.EventStudioExperiences?.RoseBloomScene){opening._roseScene?.destroy?.();opening._roseScene=new window.EventStudioExperiences.RoseBloomScene(opening,{petalColor:settings.presentation?.rosePetalColor||'',forceMotion,motionLevel:settings.presentation?.motionLevel||'balanced'});opening._roseScene.start({autoplay:false});}
  if(style==='daisy-bloom'&&window.EventStudioExperiences?.DaisyBloomScene){opening._daisyScene?.destroy?.();opening._daisyScene=new window.EventStudioExperiences.DaisyBloomScene(opening,{petalColor:settings.presentation?.floralPetalColor||'#f7f3de',centerColor:settings.presentation?.floralCenterColor||'#d8ad61',forceMotion,motionLevel:settings.presentation?.motionLevel||'balanced'});opening._daisyScene.start({autoplay:false});}
  if(style==='luminous-garden'&&window.EventStudioExperiences?.LuminousGardenScene){opening._gardenScene?.destroy?.();opening._gardenScene=new window.EventStudioExperiences.LuminousGardenScene(opening,{petalColor:settings.presentation?.floralPetalColor||'#8fe8de',centerColor:settings.presentation?.floralCenterColor||'#f6d85d',forceMotion,motionLevel:settings.presentation?.motionLevel||'balanced'});opening._gardenScene.start({autoplay:false});}
  if(style==='night-flower-original'&&window.EventStudioExperiences?.OriginalNightFlowerScene){opening._originalFlowerScene?.destroy?.();opening._originalFlowerScene=new window.EventStudioExperiences.OriginalNightFlowerScene(opening,{petalColor:settings.presentation?.floralPetalColor||'#5de6db',centerColor:settings.presentation?.floralCenterColor||'#f4f7df',forceMotion,motionLevel:settings.presentation?.motionLevel||'balanced'});opening._originalFlowerScene.start({autoplay:false});}
  document.body.classList.add('opening-visible','no-scroll');
  let openingAutoOpenTimer=0;
  const playOpeningMusic=async()=>{try{if(settings.media?.musicSource==='upload')await playUploadedMusic();if(settings.media?.musicSource==='spotify')requestSpotifyPlayback();}catch{}};
  const envelopeTiming={
    'unified-envelope':{replay:4600,normal:4300},
    /* Add-on de plantillas: sólo se agregan tiempos de salida. El controlador,
       listeners y flujo de reproducción quedan exactamente en RC21. */
    'newspaper-fold':{replay:4700,normal:4400},
    'vintage-parchment':{replay:4900,normal:4600},
    'olive-universe-orbit':{replay:5000,normal:4700},
    'blue-aurora-reveal':{replay:4800,normal:4500},
    'botanical-cosmos-orbit':{replay:5100,normal:4800},
    'gala-curtain':{replay:4850,normal:4550},
    'constellation-veil':{replay:5050,normal:4750},
    'reserve-uncork':{replay:4950,normal:4650},
    'particle-heart':{replay:4100,normal:3800}
  };
  const defaultFinishDelay=()=>{
    /* Sin movimiento se conserva una salida breve y accesible. Una vista
       previa forzada, incluso si el evento está en still, usa el recorrido
       humano completo para poder inspeccionarlo. */
    if(!forceMotion&&(settings.presentation?.motionLevel==='still'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))return 520;
    const timing=envelopeTiming[style]||{replay:4100,normal:3800};
    return replayOpeningRequested()?timing.replay:timing.normal;
  };
  const finishOpen=(delay=defaultFinishDelay())=>{
    if(opening.classList.contains('is-opening'))return;
    opening.classList.add('is-opening');
    window.clearTimeout(openingAutoOpenTimer);
    window.setTimeout(()=>{opening._particleScene?.destroy?.();opening._roseScene?.destroy?.();opening._daisyScene?.destroy?.();opening._gardenScene?.destroy?.();opening._originalFlowerScene?.destroy?.();opening.classList.add('hidden');document.body.classList.remove('opening-visible','no-scroll','force-motion-preview');document.body.classList.add('invitation-open');$('invitation')?.setAttribute('tabindex','-1');$('invitation')?.focus?.({preventScroll:true});},delay);
  };
  const startBloom=async({playMusic=true}={})=>{
    const scene=style==='rose-bloom'?opening._roseScene:style==='daisy-bloom'?opening._daisyScene:style==='luminous-garden'?opening._gardenScene:style==='night-flower-original'?opening._originalFlowerScene:null;
    if(!scene||opening.dataset.bloomStarted)return false;
    opening.dataset.bloomStarted='1';
    if(playMusic)void playOpeningMusic();
    scene.bloom?.();
    opening.classList.add('bloom-playing');
    if(style==='rose-bloom')opening.classList.add('rose-bloom-playing');
    if(openingButton){openingButton.disabled=true;openingButton.setAttribute('aria-hidden','true');openingButton.classList.add('opening-action-consumed');}
    const timing={
      'rose-bloom':{replay:6500,normal:5900},
      'daisy-bloom':{replay:4700,normal:4300},
      'luminous-garden':{replay:6100,normal:5600},
      'night-flower-original':{replay:6800,normal:6200}
    }[style]||{replay:4300,normal:3900};
    const delay=scene.runtime?.animated===false?900:(replayOpeningRequested()?timing.replay:timing.normal);
    openingAutoOpenTimer=window.setTimeout(()=>finishOpen(scene.runtime?.animated===false?180:700),delay);
    return true;
  };
  const open=async({playMusic=true}={})=>{
    if(opening.classList.contains('is-opening'))return;
    if(await startBloom({playMusic}))return;
    if(playMusic)void playOpeningMusic();
    if(openingButton){openingButton.disabled=true;openingButton.setAttribute('aria-hidden','true');openingButton.classList.add('opening-action-consumed');}
    finishOpen();
  };
  const skipButton=$('skipOpeningButton');
  if(skipButton){skipButton.textContent=t('skipAnimation');skipButton.classList.remove('hidden');skipButton.onclick=()=>finishOpen(forceMotion?420:180);}
  $('openingEnvelopeButton').onclick=()=>open({playMusic:true});
  opening.onkeydown=event=>{if(event.key==='Escape')finishOpen(forceMotion?420:180);};
  if(replayOpeningRequested()){
    if(openingButton){openingButton.disabled=true;openingButton.setAttribute('aria-hidden','true');openingButton.classList.add('opening-action-consumed');}
    if(style==='rose-bloom'||style==='daisy-bloom'||style==='luminous-garden'||style==='night-flower-original'){
      window.setTimeout(()=>{void startBloom({playMusic:false});},450);
      window.setTimeout(()=>{if(!opening.dataset.bloomStarted)void startBloom({playMusic:false});},1200);
    }else{
      /* "Reproducir" en las vistas de prueba debe reproducir la experiencia y
         continuar a la invitación; no pedir un segundo clic redundante. */
      window.setTimeout(()=>{void open({playMusic:false});},style==='particle-heart'?3000:650);
    }
  }else $('openingEnvelopeButton').focus({preventScroll:true});

}
function replayOpeningRequested(){
  return new URLSearchParams(location.search).get('opening')==='1';
}
function forceMotionRequested(){
  return new URLSearchParams(location.search).get('forceMotion')==='1'&&new URLSearchParams(location.search).get('preview')==='1';
}
async function refreshConfigIfChanged(){
  if(!configRequestUrl||!configRevision||configRefreshInFlight||configReloading||document.visibilityState==='hidden')return false;
  configRefreshInFlight=true;
  try{
    const response=await fetch(configRequestUrl,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok)return false;
    const nextSettings=await response.json();
    const nextRevision=String(nextSettings._revision||'');
    if(nextRevision&&nextRevision!==configRevision){
      if(rsvpDirty)return false;
      configReloading=true;
      location.reload();
      return true;
    }
  }catch{}
  finally{configRefreshInFlight=false;}
  return false;
}
window.addEventListener('pageshow',async event=>{
  const changed=await refreshConfigIfChanged();
  if(!changed&&event.persisted&&settings&&replayOpeningRequested())setupInvitationOpening();
});
window.addEventListener('focus',()=>{void refreshConfigIfChanged();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshConfigIfChanged();});
window.setInterval(()=>{if(document.visibilityState==='visible')void refreshConfigIfChanged();},15000);
async function load(){
  const eventSlug=slug();
  const search=new URLSearchParams(location.search);
  const preview=search.get('preview')==='1';
  const previewToken=search.get('previewToken')||'';
  const configPath=eventSlug?`/api/config/${encodeURIComponent(eventSlug)}`:"/api/config";
  const configQuery=new URLSearchParams();
  if(preview)configQuery.set('preview','1');
  if(previewToken)configQuery.set('previewToken',previewToken);
  /* Mantener las variantes de preview al pedir /api/config. RC13 las dejaba
     en la URL de la página, pero no las reenviaba al servidor; por eso una
     plantilla/apertura probada podía mostrar la configuración anterior. */
  ['previewTheme','previewOpening','previewGallery'].forEach(key=>{
    const value=search.get(key);if(value)configQuery.set(key,value);
  });
  const configQueryString=configQuery.toString();
  configRequestUrl=`${configPath}${configQueryString?`?${configQueryString}`:''}`;
  const response=await fetch(configRequestUrl,{cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok){
    document.body.innerHTML='<main class="section centered"><h1>Evento no disponible</h1><p>El enlace no existe o el evento ya no se encuentra publicado.</p></main>';
    return;
  }
  settings=await response.json();
  configureLocale();
  localizeStaticUi();
  configRevision=String(settings._revision||'');
  const labels=presentation();

  document.title=presentedName(settings.couple?.displayName||settings.event?.title||"Invitación");
  document.body.className=`theme-${settings.themeId||"romantic-wine"}`;
  const effectivePalette=settings._palette||settings.designKit?.palette||{};
  ['bg','paper','ink','muted','accent','accentText','gold','line','accentContrast'].forEach(key=>{
    const value=effectivePalette[key];
    if(/^#[0-9a-f]{6}$/i.test(String(value||'')))document.body.style.setProperty(`--${key==='accentContrast'?'accent-contrast':key==='accentText'?'accent-text':key}`,value);
  });
  document.body.dataset.surfaceTexture=String(settings._surfaceTexture||settings.designKit?.texture||'none');
  setupThemeExperience();
  document.documentElement.style.setProperty('--font-heading',fontMap[settings.typography?.heading]||fontMap.georgia);
  document.documentElement.style.setProperty('--font-body',fontMap[settings.typography?.body]||fontMap.system);

  if(preview
    &&settings.developer?.mode==='development'
    &&settings.developer?.showBanner!==false){
    $('devBanner').classList.remove('hidden');
  }

  $('heroEyebrow').textContent=translateKnown(labels.heroEyebrow);
  $('openInvitationText').textContent=translateKnown(labels.openButton);
  $('countdownEyebrow').textContent=translateKnown(labels.countdownEyebrow);
  $('storyEyebrow').textContent=translateKnown(labels.storyEyebrow);
  $('galleryEyebrow').textContent=translateKnown(labels.galleryEyebrow);
  $('galleryTitle').textContent=translateKnown(labels.galleryTitle);
  $('dressEyebrow').textContent=translateKnown(labels.dressEyebrow);
  $('rsvpEyebrow').textContent=translateKnown(labels.rsvpEyebrow);
  $('rsvpTitle').textContent=translateKnown(labels.rsvpTitle);
  $('giftEyebrow').textContent=translateKnown(labels.giftEyebrow);
  $('agendaEyebrow').textContent=translateKnown(labels.agendaEyebrow);
  $('agendaTitle').textContent=translateKnown(labels.agendaTitle);

  applyPresentedName($('coupleName'),settings.couple?.displayName||"");
  applyPresentedName($('footerCouple'),settings.couple?.displayName||"");
  $('dateLabel').textContent=localizedDateLabel();
  $('heroMessage').textContent=localizedContent('event.heroMessage',settings.event?.heroMessage||"");
  $('closingMessage').textContent=localizedContent('event.closingMessage',settings.event?.closingMessage||"");
  const attribution=$('eventStudioAttribution');const branding=settings._platform?.branding||{};if(attribution){attribution.classList.toggle('hidden',!(branding.attributionEnabled&&branding.attributionOnInvitation!==false));attribution.textContent=branding.attributionLabel||'Creado con EventStudio';attribution.href=branding.attributionUrl||'/catalogo.html';}
  $('storyTitle').textContent=localizedContent('story.title',settings.story?.title||"");
  $('storyText').textContent=localizedContent('story.text',settings.story?.text||"");

  $('venueTitle').textContent=localizedContent('venue.title',settings.venue?.title||"");
  $('venueName').textContent=settings.venue?.name||"";
  $('ceremonyTime').textContent=settings.venue?.ceremonyTime||"";
  $('receptionTime').textContent=settings.venue?.receptionTime||"";
  $('venueAddress').textContent=settings.venue?.address||"";
  $('venueNotes').textContent=localizedContent('venue.notes',settings.venue?.notes||"");
  configureExternalLink($('venueMaps'),settings.venue?.mapsUrl);
  configureExternalLink($('venueWaze'),wazeUrl(settings.venue?.address||settings.venues?.ceremony?.address));
  const addToCalendar=calendarUrl();
  if(addToCalendar){$('calendarLink').href=addToCalendar;$('calendarLink').classList.remove('hidden');}

  const agendaRendered=renderAgenda();
  if(!agendaRendered)renderVenues();
  else $('venuesSection')?.classList.add('hidden');

  renderAccessibility();

  $('dressTitle').textContent=localizedContent('dressCode.title',settings.dressCode?.title||"");
  $('dressDescription').textContent=localizedContent('dressCode.description',settings.dressCode?.description||"");
  $('dressGallery').innerHTML=(settings.dressCode?.referenceImages||[])
    .map(url=>`<img src="${esc(url)}" alt="Referencia de vestimenta">`).join('');

  if(settings.features?.gifts===false)$('giftSection')?.classList.add('hidden');
  else renderGift();
  if(settings.features?.dressCode===false)$('dressSection')?.classList.add('hidden');
  const hasPersonalInvitation=Boolean(new URLSearchParams(location.search).get('i'));
  if(settings.features?.rsvp===false||settings.rsvp?.enabled===false||!hasPersonalInvitation)$('rsvpSection')?.classList.add('hidden');

  if(settings.media?.heroImage){
    $('hero').style.backgroundImage=`linear-gradient(rgba(0,0,0,.33),rgba(0,0,0,.33)),url('${settings.media.heroImage}')`;
  }
  const musicSource=settings.media?.musicSource
    ||(settings.media?.spotifyUrl?'spotify':settings.media?.music?'upload':'none');
  if(musicSource==='upload'&&settings.media?.music){
    const audio=$('backgroundMusic');
    audio.src=settings.media.music;
    audio.dataset.start=String(Math.max(0,Number(settings.media?.musicStartSeconds||0)));
    audio.loop=false;
    $('musicBtn').classList.remove('hidden');
  }else{
    $('musicBtn').classList.add('hidden');
  }
  if(musicSource==='spotify'&&settings.features?.music!==false)renderSpotify();

  galleryItems=settings.media?.gallery||[];
  if(galleryItems.length){
    $('gallerySection').classList.remove('hidden');
    renderGallery();
  }

  countdown();
  await invite();
  renderFinalHeroSeal(String(settings?.presentation?.openingStyle||'unified-envelope'));
  setupInvitationOpening();
  await loadPhotoMessages(eventSlug);
  setupTemplateMotion();
}

async function loadPhotoMessages(eventSlug){
  if(!eventSlug||settings.features?.guestPhotoMessages===false)return;
  try{
    const pageQuery=new URLSearchParams(location.search);
    const query=new URLSearchParams();
    if(pageQuery.get('preview')==='1')query.set('preview','1');
    if(pageQuery.get('previewToken'))query.set('previewToken',pageQuery.get('previewToken'));
    const queryString=query.toString();
    const response=await fetch(`/api/public/photo-messages/${encodeURIComponent(eventSlug)}${queryString?`?${queryString}`:''}`,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok)return;
    const messages=await response.json();
    if(!messages.length)return;
    $('photoMessages').innerHTML=messages.map(item=>`<blockquote class="event-card"><p>${esc(item.message)}</p><footer>${esc(item.uploaded_by||(activeLocale==='en'?'Guest':activeLocale==='pt'?'Convidado':'Invitado'))}${item.table_name?` · ${esc(item.table_name)}`:''}</footer></blockquote>`).join('');
    $('photoMessagesSection').classList.remove('hidden');
  }catch{}
}

function renderVenues(){
  const venues=settings.venues;
  if(!venues)return;
  const ceremony=venues.ceremony||{};
  const reception=venues.reception||{};

  if(venues.samePlace){
    $('venueTitle').textContent=localizedContent('venue.title',translateKnown(settings.venue?.title||'Ubicación del evento'));
    $('venueName').textContent=ceremony.name||settings.venue?.name||'';
    $('ceremonyTime').textContent=ceremony.time||settings.venue?.ceremonyTime||'';
    $('receptionTime').textContent=reception.time||settings.venue?.receptionTime||'';
    $('venueAddress').textContent=ceremony.address||settings.venue?.address||'';
    configureExternalLink($('venueMaps'),ceremony.mapsUrl||settings.venue?.mapsUrl);
    configureExternalLink($('venueWaze'),wazeUrl(ceremony.address||settings.venue?.address));
    return;
  }

  $('venuesContainer').innerHTML=[ceremony,reception].filter(item=>item.name||item.address).map((item,index)=>{
    const map=safeExternalUrl(item.mapsUrl);
    return `<article class="event-card centered">
      <p class="eyebrow">${esc(item.title||(index===0?t('firstLocation'):t('secondLocation')))}</p>
      <h2>${esc(item.name||'')}</h2>
      ${item.time?`<p><strong>${esc(t('time'))}</strong> ${esc(item.time)}</p>`:''}
      <p>${esc(item.address||'')}</p>
      <p class="muted">${esc(item.notes||'')}</p>
      <div class="location-actions">
        ${map?`<a class="secondary-btn" href="${esc(map)}" target="_blank" rel="noopener noreferrer">${esc(t('directions'))}</a>`:''}
        ${item.address?`<a class="secondary-btn" href="${esc(wazeUrl(item.address))}" target="_blank" rel="noopener noreferrer">Waze</a>`:''}
      </div>
    </article>`;
  }).join('');
}

function renderAgenda(){
  const agenda=settings.agenda||{};
  const items=(agenda.items||[]).filter(item=>item.enabled);
  if(!agenda.enabled||!items.length)return false;

  const first=items[0]||{};
  $('agendaSection').classList.remove('hidden');
  $('agendaPublicGrid').innerHTML=items.map((item,index)=>{
    const effective=agenda.sameLocation&&index>0
      ? {...item,venue:first.venue,address:first.address,mapsUrl:first.mapsUrl}
      : item;
    const map=safeExternalUrl(effective.mapsUrl);
    return `<article class="agenda-public-card">
      <div class="agenda-public-time">${esc(effective.time||'')}</div>
      <div>
        <p class="eyebrow">${esc(effective.date||'')}</p>
        <h3>${esc(effective.title||t('activity'))}</h3>
        ${effective.venue?`<strong>${esc(effective.venue)}</strong>`:''}
        ${effective.address?`<p>${esc(effective.address)}</p>`:''}
        ${effective.notes?`<p class="muted">${esc(effective.notes)}</p>`:''}
        ${effective.dressCode?`<p><strong>${esc(t('attire'))}</strong> ${esc(effective.dressCode)}</p>`:''}
        <div class="location-actions">
          ${map?`<a class="secondary-btn" href="${esc(map)}" target="_blank" rel="noopener noreferrer">${esc(t('directions'))}</a>`:''}
          ${effective.address?`<a class="secondary-btn" href="${esc(wazeUrl(effective.address))}" target="_blank" rel="noopener noreferrer">Waze</a>`:''}
        </div>
      </div>
    </article>`;
  }).join('');
  return true;
}

function renderAccessibility(){
  const a=settings.accessibility||{};
  const options=a.options||[];
  if(!a.enabled||!options.length)return;
  $('accessibilityField').dataset.enabled='true';
  $('accessibilityField').classList.remove('hidden');
  $('accessibilityOptions').innerHTML=options.map((o,i)=>`
    <label class="choice-card"><input type="checkbox" name="accessibility" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('');
  if(a.helpText)$('accessibilityField').insertAdjacentHTML('afterbegin',`<p class="muted">${esc(a.helpText)}</p>`);
}
function spotifyEntity(url){
  const match=String(url||'').match(/open\.spotify\.com\/(track|playlist|album)\/([A-Za-z0-9]+)/);
  return match?{type:match[1],id:match[2],uri:`spotify:${match[1]}:${match[2]}`} : null;
}
function spotifyEmbedUrl(url){
  const entity=spotifyEntity(url);
  return entity?`https://open.spotify.com/embed/${entity.type}/${entity.id}?utm_source=generator`:'';
}
function formatSeconds(value){
  const seconds=Math.max(0,Math.floor(Number(value)||0));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
function spotifyFallbackMarkup(url){
  return `<iframe title="Reproductor de Spotify" style="border-radius:16px" src="${spotifyEmbedUrl(url)}" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager"></iframe>
    <a class="spotify-open-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir en Spotify</a>`;
}
function showMusicPlaybackStatus(message,{persistent=false}={}){
  const element=$('musicPlaybackStatus');if(!element)return;
  clearTimeout(Number(element.dataset.timer||0));element.textContent=message;element.classList.toggle('hidden',!message);
  if(message&&!persistent)element.dataset.timer=String(window.setTimeout(()=>element.classList.add('hidden'),5000));
}
function setSpotifyPlaying(playing){
  spotifyPlaybackStarted=Boolean(playing);
  for(const id of ['spotifyMusicBtn','spotifyPlayInlineBtn']){
    const button=$(id);if(!button)continue;
    button.textContent=playing?'❚❚':(id==='spotifyMusicBtn'?'♫':'Reproducir selección');
    button.setAttribute('aria-label',playing?'Pausar música de Spotify':'Reproducir música de Spotify');
  }
}
function playSpotifyController(){
  const play=spotifyPublicController?.play||spotifyPublicController?.resume;
  if(typeof play!=="function")return false;
  try{play.call(spotifyPublicController);return true;}catch{return false;}
}
function requestSpotifyPlayback(){
  spotifyPlayRequested=true;clearTimeout(spotifyPlaybackTimer);
  if(spotifyPublicController&&(spotifyPublicController.play||spotifyPublicController.resume)){
    showMusicPlaybackStatus('Iniciando Spotify…');
    playSpotifyController();
  }else{
    showMusicPlaybackStatus('Preparando Spotify… Si el navegador lo solicita, toca ♫ para reproducir.',{persistent:true});
  }
  spotifyPlaybackTimer=window.setTimeout(()=>{
    if(spotifyPlaybackStarted)return;
    showMusicPlaybackStatus('Spotify necesita un toque adicional en este navegador. Pulsa ♫ o el reproductor oficial.',{persistent:true});
    $('spotifyPublicStatus').textContent='El navegador bloqueó el inicio automático. Pulsa “Reproducir selección” o usa el reproductor oficial.';
  },2800);
}
function renderSpotify(){
  if(!settings||(settings.media?.musicSource||'')!=='spotify'||settings.features?.music===false)return;
  const url=settings.media?.spotifyUrl||'';
  const entity=spotifyEntity(url);
  if(!entity)return;

  $('spotifySection').classList.remove('hidden');
  const generation=++spotifyControllerGeneration;
  const start=entity.type==='track'?Math.max(0,Number(settings.media?.spotifyStartSeconds||0)):0;
  spotifyPlaybackStarted=false;
  spotifyPublicController?.destroy?.();
  spotifyPublicController=null;
  $('spotifyMusicBtn').classList.remove('hidden');
  $('spotifyPlayInlineBtn').classList.remove('hidden');
  setSpotifyPlaying(false);
  $('spotifyPlayer').innerHTML=spotifyFallbackMarkup(url);
  $('spotifyPublicStatus').textContent='Conectando con Spotify…';

  loadSpotifyIframeApi().then(api=>{
    if(generation!==spotifyControllerGeneration)return;
    $('spotifyPlayer').innerHTML='<div id="spotifyPublicTarget"></div>';
    api.createController(
      $('spotifyPublicTarget'),
      {uri:entity.uri,width:'100%',height:152},
      controller=>{
        if(generation!==spotifyControllerGeneration){controller.destroy?.();return;}
        spotifyPublicController=controller;
        controller.addListener?.('ready',()=>{
          $('spotifyPublicStatus').textContent=start
            ?`Selección lista para comenzar desde ${formatSeconds(start)}. Pulsa reproducir si el navegador no la inicia automáticamente.`
            :'Pulsa reproducir si el navegador no inicia la música automáticamente.';
          if(spotifyPlayRequested)playSpotifyController();
        });
        controller.addListener?.('playback_update',event=>{
          const state=event?.data||event||{};
          if(typeof state.isPaused!=='boolean')return;
          setSpotifyPlaying(!state.isPaused);
          if(!state.isPaused){
            clearTimeout(spotifyPlaybackTimer);showMusicPlaybackStatus('Spotify se está reproduciendo.');
            $('spotifyPublicStatus').textContent=start?`Reproduciendo desde ${formatSeconds(start)}.`:'Reproduciendo la selección del evento.';
          }
        });
        controller.addListener?.('playback_error',()=>{
          setSpotifyPlaying(false);showMusicPlaybackStatus('Spotify no pudo iniciar. Usa el reproductor oficial o abre la canción.',{persistent:true});
        });
        controller.loadEntity?.(entity.uri,false,start);
      }
    );
  }).catch(error=>{
    if(generation!==spotifyControllerGeneration)return;
    $('spotifyPlayer').innerHTML=spotifyFallbackMarkup(url);
    $('spotifyPublicStatus').textContent=`${error.message} Usa el reproductor básico o abre la canción en Spotify.`;
    showMusicPlaybackStatus('No se pudo conectar con Spotify. Usa el reproductor oficial.',{persistent:true});
  });
}

function giftMethodState(g){
  if(g?.enabled===false)return {cashEnvelopes:false,registry:false,bankTransfer:false};
  const methods=g?.methods&&typeof g.methods==='object'?g.methods:{};
  const mode=g?.mode||'cash-envelopes';
  return {
    cashEnvelopes:methods.cashEnvelopes?.enabled??(mode==='cash-envelopes'),
    registry:methods.registry?.enabled??(mode==='registry'||mode==='mixed'),
    bankTransfer:methods.bankTransfer?.enabled??(g?.bankInfoEnabled===true||mode==='bank-transfer'||mode==='mixed')
  };
}

function renderCashEnvelope(g,methods){
  const wrap=$('cashEnvelopeWrap'),text=$('cashEnvelopeInstructions');
  const instructions=String(g?.methods?.cashEnvelopes?.instructions||g?.cashEnvelopeInstructions||((g?.mode==='cash-envelopes')?g?.description:'')||'').trim();
  const show=methods.cashEnvelopes===true;
  if(text)text.textContent=instructions;
  wrap?.classList.toggle('hidden',!show);
}

function renderGiftBankDetails(g,methods){
  const bank=g.bank&&typeof g.bank==='object'?g.bank:{};
  const rows=[
    ['Banco',bank.bankName],
    ['Titular',bank.accountHolder],
    ['CLABE',bank.clabe],
    ['Número de cuenta',bank.accountNumber],
    ['Concepto sugerido',bank.referenceConcept],
    ['Indicaciones',bank.instructions]
  ].filter(([,value])=>String(value||'').trim());
  const legacy=String(g.bankInfo||'').trim();
  const showBank=methods.bankTransfer===true&&(rows.length>0||legacy);
  const motivational=String(bank.motivationalMessage||'').trim();
  const persuasion=$('bankPersuasionMessage');
  if(persuasion){persuasion.textContent=motivational;persuasion.classList.toggle('hidden',!showBank||!motivational);}
  const list=$('bankInfoList');
  if(list){
    list.replaceChildren();
    for(const [label,value] of rows){
      const dt=document.createElement('dt');dt.textContent=label;
      const dd=document.createElement('dd');dd.textContent=String(value);
      list.append(dt,dd);
    }
  }
  const legacyNode=$('bankInfoLegacy');
  if(legacyNode){
    legacyNode.textContent=rows.length?'' : legacy;
    legacyNode.classList.toggle('hidden',!showBank||rows.length>0||!legacy);
  }
  $('bankInfoWrap')?.classList.toggle('hidden',!showBank);
  return showBank;
}

function renderGiftMessageSuggestions(presets){
  const container=$('openpayGiftMessageSuggestions');
  if(!container)return;
  container.replaceChildren();
  const items=Array.isArray(presets)?presets:[];
  for(const item of items){
    if(!item?.text)continue;
    const button=document.createElement('button');
    button.type='button';button.className='gift-message-suggestion';button.textContent=item.label||'Usar mensaje sugerido';
    button.addEventListener('click',()=>{const field=$('openpayGiftMessage');if(field){field.value=String(item.text).slice(0,500);field.focus();}});
    container.appendChild(button);
  }
  if(items.length){
    const custom=document.createElement('button');custom.type='button';custom.className='gift-message-suggestion custom';custom.textContent='Escribir mi propio mensaje';
    custom.addEventListener('click',()=>{const field=$('openpayGiftMessage');if(field){field.value='';field.focus();}});
    container.appendChild(custom);
  }
  container.classList.toggle('hidden',container.childElementCount===0);
}

function renderGift(){
  const g=settings.gifts||{},methods=giftMethodState(g);
  $('giftTitle').textContent=localizedContent('gifts.title',translateKnown(g.title||'Regalos'));
  $('giftMessage').textContent=localizedContent('gifts.message',g.message||'');
  $('giftDescription').textContent=localizedContent('gifts.description',g.description||'');
  renderCashEnvelope(g,methods);
  const showBank=renderGiftBankDetails(g,methods);

  const giftUrl=safeExternalUrl(g.link);
  const showRegistry=methods.registry===true&&Boolean(giftUrl);
  const registryWrap=$('giftRegistryWrap');
  registryWrap?.classList.toggle('hidden',!showRegistry);
  if(showRegistry){configureExternalLink($('giftLink'),giftUrl);$('giftLink').textContent=g.linkLabel||t('giftRegistry');$('giftLink').classList.remove('hidden');}
  else $('giftLink')?.classList.add('hidden');

  const showOpenpay=g.openpay?.enabled===true;
  $('openpayGiftWrap')?.classList.toggle('hidden',!showOpenpay);
  if(showOpenpay){
    const amountInput=$('openpayGiftAmount');
    const cents=Number(g.openpay?.suggestedAmountCents);
    const hasSuggested=Number.isFinite(cents)&&cents>=1000;
    if(amountInput){
      amountInput.value=hasSuggested?String(cents/100):'';
      amountInput.readOnly=hasSuggested&&g.openpay?.allowCustomAmount===false;
      amountInput.placeholder=hasSuggested?'Monto sugerido':'Escribe el monto que deseas regalar';
    }
    const messageEnabled=g.openpay?.messageEnabled!==false;
    $('openpayGiftMessageField')?.classList.toggle('hidden',!messageEnabled);
    renderGiftMessageSuggestions(messageEnabled?settings._giftMessagePresets:[]);
  }else renderGiftMessageSuggestions([]);

  const anyMethod=methods.cashEnvelopes||showRegistry||showBank||showOpenpay;
  $('giftSection')?.classList.toggle('hidden',!anyMethod);
  $('giftSection')?.classList.toggle('no-gifts',!anyMethod);
}

let openpayClientConfig=null,openpayScriptsPromise=null,openpayDeviceSessionId='';
function loadExternalScript(src,id){
  const existing=document.getElementById(id);if(existing)return existing.dataset.loaded==='true'?Promise.resolve():new Promise((resolve,reject)=>{existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});});
  return new Promise((resolve,reject)=>{const script=document.createElement('script');script.id=id;script.src=src;script.async=true;script.addEventListener('load',()=>{script.dataset.loaded='true';resolve();},{once:true});script.addEventListener('error',()=>reject(new Error('No se pudo cargar Openpay.')),{once:true});document.head.appendChild(script);});
}
async function ensureOpenpayClient(){
  if(openpayClientConfig&&window.OpenPay)return openpayClientConfig;
  const slug=settings?.event?.slug;if(!slug)throw new Error('Evento sin enlace público.');
  const response=await fetch(`/api/gifts/openpay/config/${encodeURIComponent(slug)}`,{cache:'no-store'});const config=await response.json().catch(()=>({}));if(!response.ok)throw new Error(config.error||'Openpay no está disponible.');
  if(!openpayScriptsPromise)openpayScriptsPromise=(async()=>{await loadExternalScript('https://resources.openpay.mx/lib/openpay-js/1.2.38/openpay.v1.min.js','openpay-client-sdk');await loadExternalScript('https://resources.openpay.mx/lib/openpay-data-js/1.2.38/openpay-data.v1.min.js','openpay-device-sdk');})();
  await openpayScriptsPromise;if(!window.OpenPay)throw new Error('Openpay no pudo inicializarse.');
  window.OpenPay.setId(config.merchantId);window.OpenPay.setApiKey(config.publicKey);window.OpenPay.setSandboxMode(Boolean(config.sandbox));
  openpayClientConfig=config;
  if(config.messageEnabled!==false&&Array.isArray(config.messagePresets))renderGiftMessageSuggestions(config.messagePresets);
  const amountInput=$('openpayGiftAmount');
  if(amountInput){
    const cents=Number(config.suggestedAmountCents),hasSuggested=Number.isFinite(cents)&&cents>=1000;
    amountInput.value=hasSuggested?String(cents/100):'';
    amountInput.readOnly=hasSuggested&&config.allowCustomAmount===false;
    amountInput.placeholder=hasSuggested?'Monto sugerido':'Escribe el monto que deseas regalar';
  }
  return config;
}
function openpayTokenFromForm(form){return new Promise((resolve,reject)=>window.OpenPay.token.extractFormAndCreate(form,response=>resolve(response.data),response=>reject(new Error(response?.data?.description||response?.message||'No se pudo tokenizar la tarjeta.'))));}
$('openpayGiftStartBtn')?.addEventListener('click',async()=>{
  const form=$('openpayGiftForm'),statusEl=$('openpayGiftStatus');
  try{if(statusEl)statusEl.textContent='Preparando pago seguro…';await ensureOpenpayClient();openpayDeviceSessionId=window.OpenPay.deviceData.setup('openpayGiftForm','openpayDeviceSessionId');form?.classList.remove('hidden');$('openpayGiftStartBtn')?.classList.add('hidden');if(statusEl)statusEl.textContent='';}
  catch(error){if(statusEl)statusEl.textContent=error.message;}
});
$('openpayGiftForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const button=$('openpayGiftSubmitBtn'),statusEl=$('openpayGiftStatus');if(button)button.disabled=true;
  try{
    await ensureOpenpayClient();if(!openpayDeviceSessionId)openpayDeviceSessionId=window.OpenPay.deviceData.setup('openpayGiftForm','openpayDeviceSessionId');
    if(statusEl)statusEl.textContent='Protegiendo datos de tarjeta…';const token=await openpayTokenFromForm(event.currentTarget);
    const amountCents=Math.round(Number($('openpayGiftAmount')?.value||0)*100);
    const response=await fetch('/api/gifts/openpay/charge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventSlug:settings.event.slug,tokenId:token.id,deviceSessionId:openpayDeviceSessionId,amountCents,name:$('openpayGiftName')?.value||'',email:$('openpayGiftEmail')?.value||'',message:$('openpayGiftMessage')?.value||''})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'No se pudo procesar el regalo.');
    event.currentTarget.reset();renderGift();event.currentTarget.classList.add('hidden');$('openpayGiftStartBtn')?.classList.remove('hidden');if(statusEl)statusEl.textContent='Regalo recibido. Gracias por tu mensaje y tu detalle.';
  }catch(error){if(statusEl)statusEl.textContent=error.message;}finally{if(button)button.disabled=false;}
});
function renderGallery(){
  const ordered=[...galleryItems.slice(galleryIndex),...galleryItems.slice(0,galleryIndex)];
  const gallery=$('gallery');
  const galleryStyles=new Set((settings?._experiences?.galleries||[]).map(item=>item.id));
  const requested=settings.presentation?.galleryStyle||'classic';
  const style=galleryStyles.has(requested)?requested:'classic';
  gallery.dataset.galleryStyle=style;
  /* Los estilos con profundidad sólo necesitan unas pocas tarjetas visibles.
     Evitar decenas/cientos de nodos animados reduce layout, decodificación y GPU. */
  const interactiveDepth=new Set(['coverflow','stack','cinematic-depth','focus-strip','memories-orbit']);
  const visible=style==='memories-orbit'?ordered.slice(0,Math.min(12,ordered.length)):interactiveDepth.has(style)?ordered.slice(0,Math.min(7,ordered.length)):ordered;
  gallery.innerHTML=visible.map((u,i)=>{
    const depth=Math.min(i,5);
    return `<button class="gallery-item ${i===0?'featured':''}" style="--stack-index:${depth};--depth-index:${depth};--depth-z:${-depth*70}px;--depth-angle:${-depth*5}deg;--depth-opacity:${Math.max(.45,1-depth*.11).toFixed(2)}" data-original-index="${(galleryIndex+i)%galleryItems.length}"><img src="${esc(u)}" alt="${esc(t('photoAlt'))}" loading="lazy" decoding="async"></button>`;
  }).join('');
  gallery.querySelectorAll('.gallery-item').forEach(b=>b.onclick=()=>{if(Date.now()<gallerySuppressClickUntil)return;openLightbox(Number(b.dataset.originalIndex));});
}
function moveGallery(step){galleryIndex=(galleryIndex+step+galleryItems.length)%galleryItems.length;renderGallery();}
function openLightbox(i){galleryIndex=i;$('lightboxImage').src=galleryItems[i];$('lightbox').classList.remove('hidden');document.body.classList.add('no-scroll');}
function closeLightbox(){$('lightbox').classList.add('hidden');document.body.classList.remove('no-scroll');}
function countdown(){const target=new Date(settings.event.dateTime).getTime();const tick=()=>{const d=Math.max(0,target-Date.now());$('days').textContent=Math.floor(d/86400000);$('hours').textContent=Math.floor(d/3600000)%24;$('minutes').textContent=Math.floor(d/60000)%60;$('seconds').textContent=Math.floor(d/1000)%60;};tick();setInterval(tick,1000);}
async function invite(){
  const token=new URLSearchParams(location.search).get('i');
  if(!token)return;
  const previewToken=new URLSearchParams(location.search).get('previewToken')||'';
  const response=await fetch(`/api/invitation/token/${encodeURIComponent(token)}${previewToken?`?previewToken=${encodeURIComponent(previewToken)}`:''}`);
  const data=await response.json();
  if(!response.ok){$('guestGreeting').textContent=data.error;return;}

  currentGuest=data.guest;
  $('personalWelcome').classList.remove('hidden');
  $('guestName').textContent=presentedName(data.guest.family_name);
  const reserved=[];
  if(data.guest.max_adults)reserved.push(`${data.guest.max_adults} ${t('adults')}`);
  if(data.guest.max_children)reserved.push(`${data.guest.max_children} ${t('children')}`);
  const flexibleComposition=settings.rsvp?.allowFlexibleComposition===true;
  const totalPlaces=Number(data.guest.max_adults)+Number(data.guest.max_children);
  $('reservedPlaces').textContent=flexibleComposition
    ?t('reservedFlexible',{total:totalPlaces})
    :t('reservedFixed',{places:reserved.join(activeLocale==='en'?' and ':activeLocale==='pt'?' e ':' y ')});
  if(data.guest.table_name){
    $('guestTable').textContent=t('table',{table:data.guest.table_name});
    $('guestTable').classList.remove('hidden');
  }
  $('customMessage').textContent=data.guest.custom_message||'';
  $('guestGreeting').textContent=t('confirmFamily',{family:presentedName(data.guest.family_name)});

  const hasAdults=flexibleComposition?totalPlaces>0:data.guest.max_adults>0;
  const hasChildren=flexibleComposition?totalPlaces>0:data.guest.max_children>0;
  $('adults').max=flexibleComposition?totalPlaces:data.guest.max_adults;
  $('children').max=flexibleComposition?totalPlaces:data.guest.max_children;
  $('adults').value=hasAdults?(data.rsvp?.adults??Math.min(1,data.guest.max_adults)):0;
  $('children').value=hasChildren?(data.rsvp?.children??0):0;
  $('attendeeNames').value=data.rsvp?.attendee_names||'';
  $('dietary').value=data.rsvp?.dietary||'';
  $('specialNeeds').value=data.rsvp?.special_needs||'';
  $('hasDietary').checked=!!String(data.rsvp?.dietary||'').trim();
  $('hasSpecialNeeds').checked=!!(String(data.rsvp?.special_needs||'').trim()||String(data.rsvp?.accessibility_other||'').trim()||data.rsvp?.accessibility_options&&data.rsvp.accessibility_options!=='[]');
  $('contactPhone').value=data.rsvp?.contact_phone||data.guest.phone||'';
  $('responsibleName').value=data.rsvp?.responsible_name||'';
  $('message').value=data.rsvp?.message||'';
  $('accessibilityOther').value=data.rsvp?.accessibility_other||'';
  $('attending').value=data.rsvp?.attending===0?'no':'yes';

  let accessibility=[];
  try{accessibility=JSON.parse(data.rsvp?.accessibility_options||'[]');}catch{}
  const selectedAccessibility=new Set(accessibility);
  document.querySelectorAll('input[name="accessibility"]').forEach(input=>{
    input.checked=selectedAccessibility.has(input.value);
  });

  const closeAt=settings.rsvp?.closeAt?new Date(settings.rsvp.closeAt).getTime():0;
  if(closeAt&&closeAt<=Date.now()){
    $('guestGreeting').textContent=t('closed');
    return;
  }
  if(data.rsvp&&settings.rsvp?.allowChanges===false){
    $('guestGreeting').textContent=t('registered');
    return;
  }

  currentMenus=data.menus||{};
  buildMenus(currentMenus,data.rsvp,hasAdults,hasChildren);
  $('rsvpForm').classList.remove('hidden');
  updateAttendanceFields();
}

function buildMenus(menus,rsvp,hasAdults,hasChildren){
  $('menuInfo').textContent=settings.features?.menus===false?'':(menus.instructions||'');
  const guestChoice=menus.serviceMode==='guest-choice'||menus.selectionEnabled===true;
  if(settings.features?.menus===false||!guestChoice){
    $('adultMenuFields').innerHTML='';
    $('childMenuFields').innerHTML='';
    return;
  }
  let adultCounts={};
  let childCounts={};
  try{adultCounts=JSON.parse(rsvp?.adult_menu_counts||'{}');}catch{}
  try{childCounts=JSON.parse(rsvp?.child_menu_counts||'{}');}catch{}
  const fields=(options,prefix,counts,title)=>options?.length
    ?`<h3>${title}</h3>${options.map(option=>`<label>${esc(option)}<input type="number" min="0" value="${Number(counts[option]||0)}" data-menu="${prefix}" data-name="${esc(option)}"></label>`).join('')}<small class="menu-count-summary" data-menu-summary="${prefix}"></small>`
    :'';
  $('adultMenuFields').innerHTML=hasAdults?fields(menus.adultOptions,'adult',adultCounts,'Menús para adultos'):'';
  $('childMenuFields').innerHTML=hasChildren?fields(menus.childOptions,'child',childCounts,'Menús infantiles'):'';
  document.querySelectorAll('[data-menu]').forEach(input=>input.addEventListener('input',updateMenuLimits));
  updateMenuLimits();
}

function updateConditionalRsvpFields(){
  const attending=$('attending').value==='yes';
  $('dietaryField')?.classList.toggle('hidden',!attending||!$('hasDietary')?.checked);
  $('specialNeedsField')?.classList.toggle('hidden',!attending||!$('hasSpecialNeeds')?.checked);
  const accessibility=$('accessibilityField');
  if(accessibility)accessibility.classList.toggle('hidden',!attending||!$('hasSpecialNeeds')?.checked||accessibility.dataset.enabled!=='true');
}
function updateMenuLimits(){
  for(const type of ['adult','child']){
    const total=Number($(type==='adult'?'adults':'children')?.value||0);
    const inputs=[...document.querySelectorAll(`[data-menu="${type}"]`)];
    inputs.forEach(input=>input.max=String(total));
    const used=inputs.reduce((sum,input)=>sum+Number(input.value||0),0);
    const summary=document.querySelector(`[data-menu-summary="${type}"]`);
    if(summary){summary.textContent=`Asignados ${used} de ${total}`;summary.classList.toggle('error',used!==total);}
  }
}

function validateRsvpCounts({announce=true}={}){
  if(!$('adults')||!$('children')||!currentGuest)return {valid:true,message:''};
  if($('attending').value!=='yes'){
    ['adults','children'].forEach(id=>{$(id).setCustomValidity('');$(id).removeAttribute('aria-invalid');});
    if($('rsvpCountValidation'))$('rsvpCountValidation').textContent='';
    return {valid:true,message:''};
  }
  const adults=Number($('adults').value),children=Number($('children').value);
  const maxAdults=Number(currentGuest.max_adults||0),maxChildren=Number(currentGuest.max_children||0);
  const flexible=settings.rsvp?.allowFlexibleComposition===true;
  const totalPlaces=maxAdults+maxChildren;
  let message='';
  if(!Number.isInteger(adults)||adults<0||!Number.isInteger(children)||children<0)message='Las cantidades no pueden ser negativas y deben ser números enteros.';
  else if(adults+children<1)message='Indica al menos una persona que asistirá.';
  else if(flexible&&adults+children>totalPlaces)message=`Esta invitación permite hasta ${totalPlaces} persona(s) en total.`;
  else if(!flexible&&adults>maxAdults)message=`Esta invitación permite hasta ${maxAdults} adulto(s).`;
  else if(!flexible&&children>maxChildren)message=`Esta invitación permite hasta ${maxChildren} niño(s).`;
  ['adults','children'].forEach(id=>{
    $(id).setCustomValidity(message);
    if(message)$(id).setAttribute('aria-invalid','true');else $(id).removeAttribute('aria-invalid');
  });
  if(announce&&$('rsvpCountValidation'))$('rsvpCountValidation').textContent=message;
  return {valid:!message,message};
}

function renderSavedRsvpSummary(result){
  const summary=$('rsvpSavedSummary');if(!summary)return;
  if(result.status==='declined'){
    summary.innerHTML='<strong>Respuesta actual</strong><span>No asistirán. Gracias por avisar a los anfitriones.</span>';
  }else{
    summary.innerHTML=`<strong>Confirmación actual</strong><span>${Number(result.adults||0)} adulto(s) · ${Number(result.children||0)} niño(s)</span>`;
  }
  summary.classList.remove('hidden');
  if(currentGuest)currentGuest.status=result.status;
  if(settings.rsvp?.allowChanges===false){
    $('rsvpForm')?.classList.add('hidden');
    $('guestGreeting').textContent=t('registered');
  }else{
    $('guestGreeting').textContent=result.status==='declined'?'Tu respuesta quedó actualizada. Puedes modificarla mientras el periodo de confirmación siga abierto.':'Tu asistencia quedó actualizada. Puedes modificarla mientras el periodo de confirmación siga abierto.';
    if($('rsvpSubmitBtn'))$('rsvpSubmitBtn').textContent='Actualizar confirmación';
  }
}

function updateAttendanceFields(){
  const attending=$('attending').value==='yes';
  document.querySelectorAll('.attendance-details').forEach(element=>{
    const disabledByFeature=element.id==='accessibilityField'&&element.dataset.enabled!=='true';
    element.classList.toggle('hidden',!attending||disabledByFeature);
  });
  $('adultCountField').classList.toggle('hidden',!attending||!currentGuest?.max_adults);
  $('childCountField').classList.toggle('hidden',!attending||!currentGuest?.max_children);
  if(settings.rsvp?.allowFlexibleComposition===true){
    $('adultCountField').classList.toggle('hidden',!attending);
    $('childCountField').classList.toggle('hidden',!attending);
  }
  updateConditionalRsvpFields();updateMenuLimits();
}
function menuCounts(type){const o={};document.querySelectorAll(`[data-menu="${type}"]`).forEach(i=>o[i.dataset.name]=Number(i.value||0));return o;}
(()=>{const gallery=$('gallery');if(!gallery)return;let gesture=null;
  gallery.addEventListener('pointerdown',event=>{gesture={id:event.pointerId,x:event.clientX,y:event.clientY,pointerType:event.pointerType};gallery.setPointerCapture?.(event.pointerId);},{passive:true});
  gallery.addEventListener('pointerup',event=>{if(!gesture||event.pointerId!==gesture.id)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture=null;if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.15){gallerySuppressClickUntil=Date.now()+450;moveGallery(dx<0?1:-1);}},{passive:true});
  gallery.addEventListener('pointercancel',()=>{gesture=null;},{passive:true});
})();
$('galleryPrev').onclick=()=>moveGallery(-1);$('galleryNext').onclick=()=>moveGallery(1);$('lightboxClose').onclick=closeLightbox;$('lightboxPrev').onclick=()=>openLightbox((galleryIndex-1+galleryItems.length)%galleryItems.length);$('lightboxNext').onclick=()=>openLightbox((galleryIndex+1)%galleryItems.length);$('lightbox').onclick=e=>{if(e.target===$('lightbox'))closeLightbox();};
function uploadedMusicStart(){return Math.max(0,Number($('backgroundMusic').dataset.start||0));}
function resetUploadedMusicPosition(){
  const audio=$('backgroundMusic');
  const start=uploadedMusicStart();
  if(Number.isFinite(audio.duration)&&start<audio.duration)audio.currentTime=start;
}
async function playUploadedMusic(){
  const audio=$('backgroundMusic');
  if(!audio.src)return;
  if(audio.currentTime<uploadedMusicStart()||audio.ended)resetUploadedMusicPosition();
  await audio.play();
  $('musicBtn').textContent='❚❚';
  $('musicBtn').setAttribute('aria-label','Pausar música');
  showMusicPlaybackStatus('Música reproduciéndose.');
}

$('backgroundMusic').addEventListener('loadedmetadata',resetUploadedMusicPosition);
$('backgroundMusic').addEventListener('ended',async()=>{
  resetUploadedMusicPosition();
  try{await $('backgroundMusic').play();}catch{}
});
$('backgroundMusic').addEventListener('pause',()=>{
  if(!$('backgroundMusic').ended){
    $('musicBtn').textContent='♫';
    $('musicBtn').setAttribute('aria-label','Reproducir música');
  }
});

$('openInvitationBtn').onclick=async()=>{
  document.body.classList.add('invitation-open');
  $('invitation').scrollIntoView({behavior:'smooth'});
  try{
    if(settings.media?.musicSource==='upload')await playUploadedMusic();
    if(settings.media?.musicSource==='spotify')requestSpotifyPlayback();
  }catch{}
};
$('musicBtn').onclick=async()=>{
  const audio=$('backgroundMusic');
  if(audio.paused){
    try{await playUploadedMusic();}catch{}
  }else audio.pause();
};
async function toggleSpotifyPlayback(){
  if(spotifyPlaybackStarted&&spotifyPublicController?.pause){
    try{spotifyPublicController.pause();setSpotifyPlaying(false);showMusicPlaybackStatus('Música en pausa.');}catch{}
    return;
  }
  requestSpotifyPlayback();
}
$('spotifyMusicBtn')?.addEventListener('click',toggleSpotifyPlayback);
$('spotifyPlayInlineBtn')?.addEventListener('click',toggleSpotifyPlayback);

$('attending').addEventListener('change',()=>{updateAttendanceFields();validateRsvpCounts();});
$('rsvpForm')?.addEventListener('input',()=>{rsvpDirty=true;});
$('rsvpForm')?.addEventListener('change',()=>{rsvpDirty=true;});
$('hasDietary')?.addEventListener('change',()=>{if(!$('hasDietary').checked)$('dietary').value='';updateConditionalRsvpFields();});
$('hasSpecialNeeds')?.addEventListener('change',()=>{if(!$('hasSpecialNeeds').checked){$('specialNeeds').value='';$('accessibilityOther').value='';document.querySelectorAll('input[name="accessibility"]').forEach(input=>input.checked=false);}updateConditionalRsvpFields();});
['adults','children'].forEach(id=>$(id)?.addEventListener('input',()=>{validateRsvpCounts();updateMenuLimits();}));
$('rsvpForm').onsubmit=async event=>{
  event.preventDefault();
  const countValidation=validateRsvpCounts();
  if(!countValidation.valid){$('adults')?.reportValidity?.();return;}
  const button=event.submitter||$('rsvpSubmitBtn');
  const originalText=button?.textContent;
  if(button){button.disabled=true;button.textContent=t('saving');}
  $('rsvpStatus').textContent='';
  $('rsvpStatus').className='';
  const payload={
    token:currentGuest.token,
    attending:$('attending').value==='yes',
    adults:Number($('adults').value||0),
    children:Number($('children').value||0),
    attendee_names:$('attendeeNames').value,
    dietary:$('dietary').value,
    special_needs:$('specialNeeds').value,
    adult_menu_counts:menuCounts('adult'),
    child_menu_counts:menuCounts('child'),
    message:$('message').value,
    contact_phone:$('contactPhone').value,
    responsible_name:$('responsibleName').value,
    accessibility_options:[...document.querySelectorAll('input[name="accessibility"]:checked')].map(input=>input.value),
    accessibility_other:$('accessibilityOther')?.value||''
  };
  if(payload.attending){
    const guestChoice=currentMenus.serviceMode==='guest-choice'||currentMenus.selectionEnabled===true;
    if(guestChoice){
      const adultSum=Object.values(payload.adult_menu_counts).reduce((sum,value)=>sum+Number(value||0),0);
      const childSum=Object.values(payload.child_menu_counts).reduce((sum,value)=>sum+Number(value||0),0);
      if(adultSum!==payload.adults||childSum!==payload.children){
        $('rsvpStatus').textContent=`Distribuye exactamente ${payload.adults} menú(s) adulto y ${payload.children} infantil(es).`;
        $('rsvpStatus').className='rsvp-error';if(button){button.disabled=false;button.textContent=originalText;}return;
      }
    }
  }
  try{
    const response=await fetch('/api/rsvp',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    const data=await response.json();
    $('rsvpStatus').textContent=response.ok
      ?(data.status==='declined'?t('savedNo'):t('savedYes'))
      :(data.error||'No se pudo guardar la confirmación.');
    $('rsvpStatus').className=response.ok?'rsvp-success':'rsvp-error';
    if(response.ok){
      rsvpDirty=false;
      $('adults').value=String(Number(data.adults||0));$('children').value=String(Number(data.children||0));
      $('attending').value=data.status==='declined'?'no':'yes';
      renderSavedRsvpSummary(data);updateAttendanceFields();validateRsvpCounts({announce:false});
    }
  }catch{
    $('rsvpStatus').textContent=t('network');
    $('rsvpStatus').className='rsvp-error';
  }finally{
    if(button){button.disabled=false;button.textContent=originalText;}
  }
};

load().catch(error=>{
  console.error(error);
  document.body.innerHTML='<main class="section centered"><h1>No pudimos abrir la invitación</h1><p>Actualiza la página o inténtalo nuevamente.</p></main>';
});
