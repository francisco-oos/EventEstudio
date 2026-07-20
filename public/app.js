let settings=null,currentGuest=null,currentMenus={},galleryItems=[],galleryIndex=0;
let spotifyPublicApi=null,spotifyPublicController=null;
let spotifyIframePromise=null,spotifyControllerGeneration=0,spotifyPlayRequested=false;
const $=id=>document.getElementById(id);function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function slug(){const m=location.pathname.match(/^\/e\/([^/]+)/);return m?decodeURIComponent(m[1]):"";}
const fontMap={georgia:'Georgia,"Times New Roman",serif',baskerville:'Baskerville,"Palatino Linotype",serif',garamond:'Garamond,"Times New Roman",serif',didot:'Didot,"Bodoni MT",serif',system:'Inter,system-ui,-apple-system,"Segoe UI",sans-serif',humanist:'Trebuchet MS,Segoe UI,sans-serif',classic:'Palatino Linotype,Book Antiqua,serif','great-vibes':'Great Vibes,Georgia,cursive',cormorant:'Cormorant Garamond,Georgia,serif',playfair:'Playfair Display,Georgia,serif',cinzel:'Cinzel,Georgia,serif',lora:'Lora,Georgia,serif',montserrat:'Montserrat,Inter,system-ui,sans-serif'};


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
function presentation(){
  return {
    heroEyebrow:"Evento especial",
    openButton:"Abrir invitación",
    countdownEyebrow:"Faltan",
    storyEyebrow:"Nuestra historia",
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
function setupTemplateMotion(){
  const animatedThemes=new Set(['lavender-couture','cinematic-vows','storybook-seal','botanical-scroll']);
  if(!animatedThemes.has(settings?.themeId)||!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  document.body.classList.add('template-motion');
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    entry.target.classList.add('reveal-visible');
    observer.unobserve(entry.target);
  }),{threshold:.08,rootMargin:'0px 0px -6%'});
  document.querySelectorAll('main .section:not(.hidden)').forEach(section=>observer.observe(section));
}
function setupInvitationOpening(){
  const allowed=new Set(['wax-envelope','floral-envelope','minimal-envelope','cinematic-fold']);
  const style=String(settings?.presentation?.openingStyle||'wax-envelope');
  const opening=$('invitationOpening');
  if(!opening||style==='none'||!allowed.has(style))return;
  opening.className=`invitation-opening opening-${style}`;
  $('openingEyebrow').textContent=settings.presentation?.openingEyebrow||'Una invitación para ti';
  $('openingCouple').textContent=settings.couple?.displayName||settings.event?.title||'Nuestro evento';
  $('openingDate').textContent=settings.event?.dateLabel||'';
  $('openingGuest').textContent=currentGuest?.family_name?`Preparada especialmente para ${currentGuest.family_name}`:'Tenemos algo especial que compartir contigo';
  opening.classList.remove('hidden');
  document.body.classList.add('opening-visible','no-scroll');
  const open=async()=>{
    if(opening.classList.contains('is-opening'))return;
    opening.classList.add('is-opening');
    try{
      if(settings.media?.musicSource==='upload')await playUploadedMusic();
      if(settings.media?.musicSource==='spotify'){spotifyPlayRequested=true;spotifyPublicController?.play?.();}
    }catch{}
    window.setTimeout(()=>{opening.classList.add('hidden');document.body.classList.remove('opening-visible','no-scroll');$('openInvitationBtn')?.focus();},1050);
  };
  $('openingEnvelopeButton').onclick=open;
  opening.onkeydown=event=>{if(event.key==='Escape')open();};
  $('openingEnvelopeButton').focus({preventScroll:true});
}
async function load(){
  const eventSlug=slug();
  const preview=new URLSearchParams(location.search).get('preview')==='1';
  const configPath=eventSlug?`/api/config/${encodeURIComponent(eventSlug)}`:"/api/config";
  const response=await fetch(`${configPath}${preview?'?preview=1':''}`);
  if(!response.ok){
    document.body.innerHTML='<main class="section centered"><h1>Evento no disponible</h1><p>El enlace no existe o el evento ya no se encuentra publicado.</p></main>';
    return;
  }
  settings=await response.json();
  const labels=presentation();

  document.title=settings.couple?.displayName||settings.event?.title||"Invitación";
  document.body.className=`theme-${settings.themeId||"romantic-wine"}`;
  document.documentElement.style.setProperty('--font-heading',fontMap[settings.typography?.heading]||fontMap.georgia);
  document.documentElement.style.setProperty('--font-body',fontMap[settings.typography?.body]||fontMap.system);

  if(preview
    &&settings.developer?.mode==='development'
    &&settings.developer?.showBanner!==false){
    $('devBanner').classList.remove('hidden');
  }

  $('heroEyebrow').textContent=labels.heroEyebrow;
  $('openInvitationText').textContent=labels.openButton;
  $('countdownEyebrow').textContent=labels.countdownEyebrow;
  $('storyEyebrow').textContent=labels.storyEyebrow;
  $('galleryEyebrow').textContent=labels.galleryEyebrow;
  $('galleryTitle').textContent=labels.galleryTitle;
  $('dressEyebrow').textContent=labels.dressEyebrow;
  $('rsvpEyebrow').textContent=labels.rsvpEyebrow;
  $('rsvpTitle').textContent=labels.rsvpTitle;
  $('giftEyebrow').textContent=labels.giftEyebrow;
  $('agendaEyebrow').textContent=labels.agendaEyebrow;
  $('agendaTitle').textContent=labels.agendaTitle;

  $('coupleName').textContent=settings.couple?.displayName||"";
  $('footerCouple').textContent=settings.couple?.displayName||"";
  $('dateLabel').textContent=settings.event?.dateLabel||"";
  $('heroMessage').textContent=settings.event?.heroMessage||"";
  $('closingMessage').textContent=settings.event?.closingMessage||"";
  $('storyTitle').textContent=settings.story?.title||"";
  $('storyText').textContent=settings.story?.text||"";

  $('venueTitle').textContent=settings.venue?.title||"";
  $('venueName').textContent=settings.venue?.name||"";
  $('ceremonyTime').textContent=settings.venue?.ceremonyTime||"";
  $('receptionTime').textContent=settings.venue?.receptionTime||"";
  $('venueAddress').textContent=settings.venue?.address||"";
  $('venueNotes').textContent=settings.venue?.notes||"";
  configureExternalLink($('venueMaps'),settings.venue?.mapsUrl);

  const agendaRendered=renderAgenda();
  if(!agendaRendered)renderVenues();
  else $('venuesSection')?.classList.add('hidden');

  renderAccessibility();
  if(settings.features?.music!==false)renderSpotify();

  $('dressTitle').textContent=settings.dressCode?.title||"";
  $('dressDescription').textContent=settings.dressCode?.description||"";
  $('dressGallery').innerHTML=(settings.dressCode?.referenceImages||[])
    .map(url=>`<img src="${esc(url)}" alt="Referencia de vestimenta">`).join('');

  if(settings.features?.gifts===false)$('giftSection')?.classList.add('hidden');
  else renderGift();
  if(settings.features?.dressCode===false)$('dressSection')?.classList.add('hidden');
  if(settings.features?.rsvp===false)$('rsvpSection')?.classList.add('hidden');

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
  setupInvitationOpening();
  await loadPhotoMessages(eventSlug);
  setupTemplateMotion();
}

async function loadPhotoMessages(eventSlug){
  if(!eventSlug||settings.features?.guestPhotoMessages===false)return;
  try{
    const response=await fetch(`/api/public/photo-messages/${encodeURIComponent(eventSlug)}`);
    if(!response.ok)return;
    const messages=await response.json();
    if(!messages.length)return;
    $('photoMessages').innerHTML=messages.map(item=>`<blockquote class="event-card"><p>${esc(item.message)}</p><footer>${esc(item.uploaded_by||'Invitado')}${item.table_name?` · ${esc(item.table_name)}`:''}</footer></blockquote>`).join('');
    $('photoMessagesSection').classList.remove('hidden');
  }catch{}
}

function renderVenues(){
  const venues=settings.venues;
  if(!venues)return;
  const ceremony=venues.ceremony||{};
  const reception=venues.reception||{};

  if(venues.samePlace){
    $('venueTitle').textContent=settings.venue?.title||'Ubicación del evento';
    $('venueName').textContent=ceremony.name||settings.venue?.name||'';
    $('ceremonyTime').textContent=ceremony.time||settings.venue?.ceremonyTime||'';
    $('receptionTime').textContent=reception.time||settings.venue?.receptionTime||'';
    $('venueAddress').textContent=ceremony.address||settings.venue?.address||'';
    configureExternalLink($('venueMaps'),ceremony.mapsUrl||settings.venue?.mapsUrl);
    return;
  }

  $('venuesContainer').innerHTML=[ceremony,reception].filter(item=>item.name||item.address).map((item,index)=>{
    const map=safeExternalUrl(item.mapsUrl);
    return `<article class="event-card centered">
      <p class="eyebrow">${esc(item.title||(index===0?'Primera ubicación':'Segunda ubicación'))}</p>
      <h2>${esc(item.name||'')}</h2>
      ${item.time?`<p><strong>Hora:</strong> ${esc(item.time)}</p>`:''}
      <p>${esc(item.address||'')}</p>
      <p class="muted">${esc(item.notes||'')}</p>
      ${map?`<a class="secondary-btn" href="${esc(map)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>`:''}
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
        <h3>${esc(effective.title||'Actividad')}</h3>
        ${effective.venue?`<strong>${esc(effective.venue)}</strong>`:''}
        ${effective.address?`<p>${esc(effective.address)}</p>`:''}
        ${effective.notes?`<p class="muted">${esc(effective.notes)}</p>`:''}
        ${effective.dressCode?`<p><strong>Vestimenta:</strong> ${esc(effective.dressCode)}</p>`:''}
        ${map?`<a class="secondary-btn" href="${esc(map)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>`:''}
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
function renderSpotify(){
  if(!settings||(settings.media?.musicSource||'')!=='spotify'||settings.features?.music===false)return;
  const url=settings.media?.spotifyUrl||'';
  const entity=spotifyEntity(url);
  if(!entity)return;

  $('spotifySection').classList.remove('hidden');
  const generation=++spotifyControllerGeneration;
  const start=entity.type==='track'?Math.max(0,Number(settings.media?.spotifyStartSeconds||0)):0;
  spotifyPublicController?.destroy?.();
  spotifyPublicController=null;
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
          if(spotifyPlayRequested)controller.play?.();
        });
        controller.loadEntity?.(entity.uri,false,start);
      }
    );
  }).catch(error=>{
    if(generation!==spotifyControllerGeneration)return;
    $('spotifyPlayer').innerHTML=spotifyFallbackMarkup(url);
    $('spotifyPublicStatus').textContent=`${error.message} Usa el reproductor básico o abre la canción en Spotify.`;
  });
}

function renderGift(){const g=settings.gifts||{};$('giftTitle').textContent=g.title||'Regalos';$('giftMessage').textContent=g.message||'';$('giftDescription').textContent=g.description||'';$('bankInfo').textContent=g.mode==='bank-transfer'||g.mode==='mixed'?(g.bankInfo||''):'';if(g.link&&(g.mode==='registry'||g.mode==='mixed')){$('giftLink').href=g.link;$('giftLink').textContent=g.linkLabel||'Ver mesa de regalos';$('giftLink').classList.remove('hidden');}else $('giftLink').classList.add('hidden');if(g.mode==='no-gifts')$('giftSection').classList.add('no-gifts');}
function renderGallery(){const ordered=[...galleryItems.slice(galleryIndex),...galleryItems.slice(0,galleryIndex)];$('gallery').innerHTML=ordered.map((u,i)=>`<button class="gallery-item ${i===0?'featured':''}" data-original-index="${(galleryIndex+i)%galleryItems.length}"><img src="${u}" alt="Fotografía de la pareja"></button>`).join('');document.querySelectorAll('.gallery-item').forEach(b=>b.onclick=()=>openLightbox(Number(b.dataset.originalIndex)));}
function moveGallery(step){galleryIndex=(galleryIndex+step+galleryItems.length)%galleryItems.length;renderGallery();}
function openLightbox(i){galleryIndex=i;$('lightboxImage').src=galleryItems[i];$('lightbox').classList.remove('hidden');document.body.classList.add('no-scroll');}
function closeLightbox(){$('lightbox').classList.add('hidden');document.body.classList.remove('no-scroll');}
function countdown(){const target=new Date(settings.event.dateTime).getTime();const tick=()=>{const d=Math.max(0,target-Date.now());$('days').textContent=Math.floor(d/86400000);$('hours').textContent=Math.floor(d/3600000)%24;$('minutes').textContent=Math.floor(d/60000)%60;$('seconds').textContent=Math.floor(d/1000)%60;};tick();setInterval(tick,1000);}
async function invite(){
  const token=new URLSearchParams(location.search).get('i');
  if(!token)return;
  const response=await fetch(`/api/invitation/token/${encodeURIComponent(token)}`);
  const data=await response.json();
  if(!response.ok){$('guestGreeting').textContent=data.error;return;}

  currentGuest=data.guest;
  $('personalWelcome').classList.remove('hidden');
  $('guestName').textContent=data.guest.family_name;
  const reserved=[];
  if(data.guest.max_adults)reserved.push(`${data.guest.max_adults} adulto(s)`);
  if(data.guest.max_children)reserved.push(`${data.guest.max_children} niño(s)`);
  const flexibleComposition=settings.rsvp?.allowFlexibleComposition===true;
  const totalPlaces=Number(data.guest.max_adults)+Number(data.guest.max_children);
  $('reservedPlaces').textContent=flexibleComposition
    ?`Hemos reservado ${totalPlaces} lugar(es) en total; pueden distribuirlos entre adultos y niños.`
    :`Hemos reservado ${reserved.join(' y ')} para ustedes.`;
  $('customMessage').textContent=data.guest.custom_message||'';
  $('guestGreeting').textContent=`Confirma cuántas personas de ${data.guest.family_name} asistirán.`;

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
    $('guestGreeting').textContent='El periodo de confirmación ha terminado. Contacta a los anfitriones si necesitas hacer un cambio.';
    return;
  }
  if(data.rsvp&&settings.rsvp?.allowChanges===false){
    $('guestGreeting').textContent='Tu confirmación ya fue registrada. Contacta a los anfitriones si necesitas hacer un cambio.';
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
    if(settings.media?.musicSource==='spotify'){
      spotifyPlayRequested=true;
      spotifyPublicController?.play?.();
    }
  }catch{}
};
$('musicBtn').onclick=async()=>{
  const audio=$('backgroundMusic');
  if(audio.paused){
    try{await playUploadedMusic();}catch{}
  }else audio.pause();
};

$('attending').addEventListener('change',updateAttendanceFields);
$('hasDietary')?.addEventListener('change',()=>{if(!$('hasDietary').checked)$('dietary').value='';updateConditionalRsvpFields();});
$('hasSpecialNeeds')?.addEventListener('change',()=>{if(!$('hasSpecialNeeds').checked){$('specialNeeds').value='';$('accessibilityOther').value='';document.querySelectorAll('input[name="accessibility"]').forEach(input=>input.checked=false);}updateConditionalRsvpFields();});
['adults','children'].forEach(id=>$(id)?.addEventListener('input',()=>{updateMenuLimits();}));
$('rsvpForm').onsubmit=async event=>{
  event.preventDefault();
  const button=event.submitter||$('rsvpSubmitBtn');
  const originalText=button?.textContent;
  if(button){button.disabled=true;button.textContent='Guardando…';}
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
    const total=payload.adults+payload.children;
    const allowed=Number(currentGuest.max_adults)+Number(currentGuest.max_children);
    if(total<1||settings.rsvp?.allowFlexibleComposition===true&&total>allowed){
      $('rsvpStatus').textContent=total<1?'Indica al menos una persona.':`Esta invitación tiene ${allowed} lugar(es) en total.`;
      $('rsvpStatus').className='rsvp-error';if(button){button.disabled=false;button.textContent=originalText;}return;
    }
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
      ?(data.status==='declined'?'Respuesta guardada. Gracias por avisarnos.':'Confirmación guardada. ¡Nos dará mucho gusto verte!')
      :(data.error||'No se pudo guardar la confirmación.');
    $('rsvpStatus').className=response.ok?'rsvp-success':'rsvp-error';
  }catch{
    $('rsvpStatus').textContent='No pudimos conectar con el servidor. Intenta nuevamente.';
    $('rsvpStatus').className='rsvp-error';
  }finally{
    if(button){button.disabled=false;button.textContent=originalText;}
  }
};

load().catch(error=>{
  console.error(error);
  document.body.innerHTML='<main class="section centered"><h1>No pudimos abrir la invitación</h1><p>Actualiza la página o inténtalo nuevamente.</p></main>';
});
