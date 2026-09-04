let authToken='',currentUser=null,eventId=0,events=[],settings={},guests=[],photos=[],themes=[],qrTemplates=[],eventTypes=[],featureAccess={},featureContext=[],designAccess={opening:{},gallery:{}},currentPlanCode='studio',publicCatalog=null,lastGeneratedDateLabel='',seatingState=null,selectedFloorItem=null,seatingLayoutDirty=false,ownerClients=[],ownerPlans=[],ownerUsers=[],workspaceRevision=0,workspaceController=null,mobileMenuScrollY=0,commerceData=null,storeData=null,activeStoreCategory='',storeSearchTerm='',storePreviewProductId=0,storePreviewUrl='',storeComposerEnabledIds=new Set(),previewLinkCache=new Map(),activeClientProfile=null,supportClientView=false,clientPage=1,planDraftProductIds=new Set(),storePreviewDeviceMode='phone',accountNotifications=[],photoCounts={},photosLoadedForEvent=0,guestsLoadedForEvent=0,tableNamesLoadedForEvent=0,tableNames=[];const CLIENT_PAGE_SIZE=20;const $=id=>document.getElementById(id);async function api(url,opt={}){
  const requestEventId=opt.eventId??eventId;
  const requestOptions={...opt};
  delete requestOptions.eventId;
  requestOptions.headers={...(requestOptions.headers||{}),'x-event-id':String(requestEventId||'')};
  if(authToken)requestOptions.headers.Authorization=`Bearer ${authToken}`;
  requestOptions.credentials='same-origin';
  return fetch(url,requestOptions);
}

async function readJson(response,label='Solicitud'){
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('application/json')){
    const text=await response.text();
    throw new Error(`${label}: el servidor respondió ${response.status} con contenido no JSON.`);
  }
  const data=await response.json();
  if(!response.ok){
    throw new Error(data.error||`${label}: error ${response.status}.`);
  }
  return data;
}function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}function status(m,ok=true){$('adminStatus').textContent=m;$('adminStatus').className=`status-message ${ok?'success':'error'}`;}
const deferredTimers=new Map();
function scheduleDeferredTask(key,task,delay=0){
  if(deferredTimers.has(key))window.clearTimeout(deferredTimers.get(key));
  const timer=window.setTimeout(async()=>{
    deferredTimers.delete(key);
    try{await task();}catch(error){console.error(error);}
  },delay);
  deferredTimers.set(key,timer);
}

function setMobileNavigation(open){
  const active=Boolean(open);
  const wasActive=document.body.classList.contains('mobile-nav-open');
  if(active&&!wasActive){
    mobileMenuScrollY=Math.max(0,window.scrollY||document.documentElement.scrollTop||0);
    document.body.style.setProperty('--mobile-menu-scroll-offset',`-${mobileMenuScrollY}px`);
  }
  document.body.classList.toggle('mobile-nav-open',active);
  document.documentElement.classList.toggle('mobile-nav-open',active);
  $('mobileMenuBtn')?.setAttribute('aria-expanded',String(active));
  if($('mobileMenuBtn')){
    $('mobileMenuBtn').innerHTML=active?'× <span>Cerrar</span>':'☰ <span>Menú</span>';
    $('mobileMenuBtn').setAttribute('aria-label',active?'Cerrar menú de administración':'Abrir menú de administración');
  }
  if($('mobileNavBackdrop'))$('mobileNavBackdrop').hidden=!active;
  if(!active&&wasActive){
    document.body.style.removeProperty('--mobile-menu-scroll-offset');
    window.scrollTo(0,mobileMenuScrollY);
  }
}
function tab(n){
  const panel=$(`tab-${n}`);const button=document.querySelector(`[data-tab="${n}"]`);
  if(!panel||!button)return;
  document.querySelectorAll('.tab-panel').forEach(x=>x.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  panel.classList.remove('hidden');button.classList.add('active');setMobileNavigation(false);
  if(n==='photos')void ensurePhotosLoaded();
}
function enhanceResponsiveTables(root=document){
  root.querySelectorAll('.table-wrap table').forEach(table=>{
    const labels=[...table.querySelectorAll('thead th')].map(cell=>cell.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,index)=>{
      if(cell.tagName==='TD'&&!cell.dataset.label)cell.dataset.label=labels[index]||`Campo ${index+1}`;
    }));
  });
}
function showDialog(dialog){
  if(!dialog?.showModal)return;
  dialog.showModal();
  document.body.classList.add('dialog-open');
}
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.addEventListener('close',()=>{
    if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');
  });
});
document.querySelectorAll('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog')?.close()));
document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$('mobileMenuBtn')?.addEventListener('click',()=>setMobileNavigation(!document.body.classList.contains('mobile-nav-open')));
$('mobileNavBackdrop')?.addEventListener('click',()=>setMobileNavigation(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMobileNavigation(false);});
window.addEventListener('pageshow',()=>setMobileNavigation(false));
window.addEventListener('orientationchange',()=>setMobileNavigation(false));
window.addEventListener('resize',()=>{
  if(!window.matchMedia('(max-width:760px), (hover:none) and (pointer:coarse) and (max-width:1100px)').matches){
    setMobileNavigation(false);
  }
});
const giftPresets=[
 {mode:'cash-envelopes',name:'Sobres y buzón',icon:'✉',title:'Lluvia de sobres',message:'Su presencia es lo más importante para nosotros.',description:'Si desean tener un detalle con nosotros, encontrarán sobres en las mesas y un buzón especial para depositarlos.'},
 {mode:'registry',name:'Mesa de regalos',icon:'🎁',title:'Mesa de regalos',message:'Su compañía es nuestro mejor regalo.',description:'Para quienes deseen obsequiarnos algo, hemos preparado una mesa de regalos.',linkLabel:'Ver mesa de regalos'},
 {mode:'bank-transfer',name:'Transferencia',icon:'◇',title:'Regalo en efectivo',message:'Gracias por acompañarnos en esta nueva etapa.',description:'Para quienes prefieran hacerlo por transferencia, compartimos los datos a continuación.'},
 {mode:'mixed',name:'Opciones combinadas',icon:'✦',title:'Detalles y regalos',message:'Lo más importante es compartir este día con ustedes.',description:'Pueden elegir la opción que les resulte más cómoda: mesa de regalos, transferencia o sobre durante la celebración.'},
 {mode:'no-gifts',name:'Sin regalos',icon:'♡',title:'El mejor regalo es su presencia',message:'No esperamos ningún obsequio.',description:'Celebrar este momento junto a ustedes es más que suficiente.'}
];
async function login(){
      const loginPassword=$('adminPassword').value;
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('loginEmail').value,password:$('adminPassword').value})});
      let data;
      try{
        data=await readJson(r,'Inicio de sesión');
      }catch(error){
        $('loginStatus').textContent=error.message;
        return;
      }
      authToken=data.token||'';currentUser=data.user;localStorage.removeItem('authToken');
      if(currentUser.mustChangePassword&&!(await forcePasswordChange(loginPassword)))return;
      const er=await api('/api/admin/events');events=await er.json();const savedEventId=Number(localStorage.getItem('eventId'));eventId=events.some(e=>e.id===savedEventId)?savedEventId:events[0]?.id;localStorage.setItem('eventId',String(eventId||''));
      renderEvents();
      applyRoleUI();
      $('loginScreen').classList.add('hidden');
      $('adminApp').classList.remove('hidden');
      await load();
    }
    async function forcePasswordChange(currentPassword=''){
      const current=currentPassword||prompt('Tu contraseña es temporal. Escríbela nuevamente para cambiarla.');if(!current)return false;
      const next=prompt('Escribe una contraseña nueva de al menos 12 caracteres.');if(!next)return false;
      const confirmation=prompt('Repite la contraseña nueva.');if(next!==confirmation){$('loginStatus').textContent='Las contraseñas nuevas no coinciden.';return false;}
      const headers={'Content-Type':'application/json'};if(authToken)headers.Authorization=`Bearer ${authToken}`;
      const response=await fetch('/api/auth/password',{method:'PUT',credentials:'same-origin',headers,body:JSON.stringify({currentPassword:current,newPassword:next})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){$('loginStatus').textContent=data.error||'No se pudo cambiar la contraseña.';return false;}
      currentUser.mustChangePassword=false;currentUser.must_change_password=0;return true;
    }
function applyRoleUI(){
  const platformUser=['owner','developer'].includes(currentUser?.role);
  $('usersTabBtn')?.classList.toggle('hidden',!platformUser);
  $('developerNavGroup')?.classList.toggle('hidden',!platformUser);
  $('accountNavGroup')?.classList.remove('hidden');
  $('ownerTabBtn')?.classList.toggle('hidden',!platformUser);
  $('testInviteBtn')?.classList.toggle('hidden',!platformUser);
  $('developerModeContainer')?.classList.toggle('hidden',!platformUser);
  $('developerSettingsCard')?.classList.toggle('hidden',!platformUser);
  $('supportClientViewControl')?.classList.toggle('hidden',!platformUser);
  if($('supportClientView'))$('supportClientView').checked=supportClientView;
  $('modeBadge')?.classList.toggle('hidden',!platformUser);
  if($('workspaceLabel'))$('workspaceLabel').textContent=platformUser?'Consola de propietario':'Administración de mi evento';
  if($('buildCreativePromptBtn'))$('buildCreativePromptBtn').textContent=platformUser?'Preparar instrucción interna':'Preparar solicitud visual';
  if($('copyCreativePromptBtn'))$('copyCreativePromptBtn').classList.toggle('hidden',!platformUser);
  if($('creativePromptField'))$('creativePromptField').classList.toggle('owner-only-output',!platformUser);
  document.body.classList.toggle('platform-workspace',platformUser);
  document.body.classList.toggle('client-workspace',!platformUser);
}
function renderEvents(){
  const platformUser=['owner','developer'].includes(currentUser?.role);
  const typeLabels={wedding:'Boda',xv:'XV años',birthday:'Cumpleaños','baby-shower':'Baby shower','gender-reveal':'Revelación de género',corporate:'Empresarial',graduation:'Graduación',custom:'Personalizado'};
  $('eventSelect').innerHTML=events.map(e=>{
    const type=typeLabels[e.event_type]||e.event_type||'Evento';
    const owner=platformUser&&e.owner_name?` · Cliente: ${e.owner_name}`:'';
    return `<option value="${e.id}" ${e.id===eventId?'selected':''}>${esc(e.name)} · ${esc(type)}${esc(owner)}</option>`;
  }).join('');
  if(currentUser){
    if($('sessionUserName'))$('sessionUserName').textContent=currentUser.displayName||currentUser.display_name||currentUser.email;
    if($('sessionUserRole'))$('sessionUserRole').textContent=platformUser?(currentUser?.role==='owner'?'Propietario':'Desarrollador'):'Cliente';
  }
}
function resetWorkspaceState(){
  settings={};guests=[];photos=[];themes=[];qrTemplates=[];eventTypes=[];featureAccess={};featureContext=[];photosLoadedForEvent=0;guestsLoadedForEvent=0;tableNamesLoadedForEvent=0;tableNames=[];
  storeData=null;storePreviewUrl='';storePreviewProductId=0;storeComposerEnabledIds.clear();
  seatingState=null;selectedFloorItem=null;seatingLayoutDirty=false;
  ['sInvitations','sConfirmed','sAdults','sChildren','sTotal','sPending','sDietary','sPhotos'].forEach(id=>{if($(id))$(id).textContent='0';});
  if($('panelEventName'))$('panelEventName').textContent='Cargando evento…';
  if($('publicEventBtn')){$('publicEventBtn').href='#';$('publicEventBtn').classList.add('disabled-link');}
  if($('guestRows'))$('guestRows').innerHTML='';
  if($('photoGrid'))$('photoGrid').innerHTML='';
  document.body.classList.add('workspace-loading');
  if($('eventSelect'))$('eventSelect').disabled=true;
}
async function refreshEvents(preferredEventId=eventId){
  const response=await api('/api/admin/events',{eventId:0});
  events=await readJson(response,'Lista de eventos');
  eventId=events.some(item=>item.id===Number(preferredEventId))?Number(preferredEventId):(events[0]?.id||0);
  if(eventId)localStorage.setItem('eventId',String(eventId));else localStorage.removeItem('eventId');
  renderEvents();
  return eventId;
}
async function switchActiveEvent(nextEventId,{refresh=false}={}){
  workspaceController?.abort();
  workspaceRevision++;
  if(refresh)await refreshEvents(nextEventId);
  else{
    eventId=events.some(item=>item.id===Number(nextEventId))?Number(nextEventId):(events[0]?.id||0);
    if(eventId)localStorage.setItem('eventId',String(eventId));else localStorage.removeItem('eventId');
    renderEvents();
  }
  seatingState=null;selectedFloorItem=null;seatingLayoutDirty=false;
  await load();
}
async function ensurePhotosLoaded({force=false}={}){
  if(!eventId||featureAccess.guestPhotoUpload===false)return;
  if(!force&&photosLoadedForEvent===eventId)return;
  try{
    const response=await api('/api/admin/photos');
    const loaded=await readJson(response,'Fotografías');
    photos=Array.isArray(loaded)?loaded:(loaded?.items||[]);
    photoCounts=Array.isArray(loaded)?{}:(loaded?.counts||{});
    photosLoadedForEvent=eventId;
    renderPhotos();
  }catch(error){status(error.message||'No se pudieron cargar las fotografías.',false);}
}

async function ensureGuestsLoaded({force=false}={}){
  if(!eventId||featureAccess.guests===false)return;
  if(!force&&guestsLoadedForEvent===eventId)return;
  try{
    const response=await api('/api/admin/guests');
    guests=await readJson(response,'Invitados');
    guestsLoadedForEvent=eventId;
    renderGuests();
    renderPhysicalInvitationStudio();
  }catch(error){status(error.message||'No se pudieron cargar los invitados.',false);}
}
function applyDashboardStats(dashboard={}){
  if($('sInvitations'))$('sInvitations').textContent=dashboard.invitations||0;
  if($('sConfirmed'))$('sConfirmed').textContent=dashboard.confirmed_families||0;
  if($('sAdults'))$('sAdults').textContent=dashboard.adults||0;
  if($('sChildren'))$('sChildren').textContent=dashboard.children||0;
  if($('sTotal'))$('sTotal').textContent=Number(dashboard.adults||0)+Number(dashboard.children||0);
  if($('sPending'))$('sPending').textContent=dashboard.pending_families||0;
  if($('sDietary'))$('sDietary').textContent=dashboard.dietary_records||0;
  if($('sPhotos'))$('sPhotos').textContent=dashboard.photos||0;
}
async function refreshDashboardStats(){
  if(!eventId)return;
  try{const response=await api('/api/admin/dashboard');applyDashboardStats(await readJson(response,'Resumen'));}
  catch(error){status(error.message||'No se pudo actualizar el resumen.',false);}
}
async function refreshGuestsAfterMutation(){
  guestsLoadedForEvent=0;tableNamesLoadedForEvent=0;seatingState=null;selectedFloorItem=null;seatingLayoutDirty=false;
  await Promise.all([ensureGuestsLoaded({force:true}),refreshDashboardStats()]);
}

async function ensureTableNamesLoaded({force=false}={}){
  if(!eventId)return;
  if(!force&&tableNamesLoadedForEvent===eventId)return;
  try{
    const response=await api('/api/admin/tables');
    tableNames=await readJson(response,'Mesas');
    tableNamesLoadedForEvent=eventId;
    const options=(tableNames||[]).map(table=>`<option value="${esc(table)}">${esc(table)}</option>`).join('');
    if($('tableSelect'))$('tableSelect').innerHTML=`<option value="">QR general</option>${options}`;
    if($('photoTableFilter'))$('photoTableFilter').innerHTML=`<option value="">Todas las mesas</option>${options}`;
  }catch(error){status(error.message||'No se pudieron cargar las mesas.',false);}
}

async function load(){
  if(!eventId){
    resetWorkspaceState();
    if($('panelEventName'))$('panelEventName').textContent='Sin evento activo';
    tab('dashboard');
    status('Tu cuenta no tiene un evento disponible.',false);
    document.body.classList.remove('workspace-loading');
    return;
  }

  const targetEventId=eventId;
  const revision=++workspaceRevision;
  workspaceController?.abort();
  const controller=new AbortController();
  workspaceController=controller;
  const workspaceApi=(url,opt={})=>api(url,{...opt,eventId:targetEventId,signal:controller.signal});
  const isCurrent=()=>revision===workspaceRevision&&targetEventId===eventId&&!controller.signal.aborted;
  resetWorkspaceState();
  status('Cargando espacio de trabajo…');

  try{
    const platformUser=['owner','developer'].includes(currentUser?.role);
    const featureResponse=await workspaceApi(`/api/admin/features${platformUser&&supportClientView?'?view=client':''}`);
    const featureData=await readJson(featureResponse,'Disponibilidad de módulos');
    currentPlanCode=featureData.planCode||'studio';
    featureContext=featureData.features||[];
    featureAccess=Object.fromEntries(featureContext.map(item=>[item.key,item.allowed]));
    designAccess=featureData.designAccess||{opening:{},gallery:{}};
    const endpoints=[
      ['/api/admin/dashboard','Resumen'],
      ['/api/admin/settings','Ajustes'],
      [`/api/admin/themes${platformUser&&supportClientView?'?view=client':''}`,'Plantillas'],
      ['/api/admin/qr-templates','Plantillas QR'],
      ['/api/admin/event-types','Tipos de evento']
    ];
    const responses=await Promise.all(endpoints.map(([url])=>workspaceApi(url)));
    const results=[];
    for(let i=0;i<responses.length;i++)results.push(await readJson(responses[i],endpoints[i][1]));

    if(!isCurrent())return;
    const [dashboard,loadedSettings,loadedThemes,loadedQrTemplates,loadedEventTypes]=results;

    settings=loadedSettings;
    themes=loadedThemes;
    qrTemplates=loadedQrTemplates;
    eventTypes=loadedEventTypes;

    if($('panelEventName'))$('panelEventName').textContent=settings._event?.name||'Evento';
    if($('publicEventBtn')){
      const slug=settings._event?.slug;
      const relativeUrl=slug?`/e/${encodeURIComponent(slug)}`:'';
      $('publicEventBtn').href=relativeUrl||'#';$('publicEventBtn').rel='noopener';
      $('publicEventBtn').classList.toggle('disabled-link',!slug);
      if($('publicEventUrl'))$('publicEventUrl').value=relativeUrl?new URL(relativeUrl,location.origin).href:'';
    }

    applyDashboardStats(dashboard);

    fillSettings();

    applyDynamicPresentation();
    applyFeatureVisibility();
    renderEventTypeOptions();
    updateThemeLivePreview();

    renderGiftPresets();
    renderThemes();
    renderGuests();
    if(!$('tab-photos')?.classList.contains('hidden'))void ensurePhotosLoaded();
    renderQrTemplates();
    renderPhysicalInvitationStudio();
    renderWorkspaceTools();

    if(isCurrent())status('Espacio de trabajo cargado.');

    const deferredEventId=targetEventId;
    scheduleDeferredTask('workspace-secondary-load',async()=>{
      if(deferredEventId!==eventId||controller.signal.aborted)return;
      /* Sólo contexto transversal. QR, negocio, usuarios, mesas y pagos se
         cargan al abrir su vista para no bloquear la entrada al evento. */
      await Promise.all([loadAccountContext(),loadNotifications()]);
      if(deferredEventId!==eventId||controller.signal.aborted)return;
      if(['owner','developer'].includes(currentUser?.role)||featureFlags().whatsappBusiness)await loadWhatsAppStatus({eventId:deferredEventId,signal:controller.signal});
    },0);
  }catch(error){
    if(error.name==='AbortError')return;
    console.error(error);
    if(isCurrent())status(error.message||'No se pudo cargar el espacio de trabajo.',false);
  }finally{
    if(isCurrent()){
      document.body.classList.remove('workspace-loading');
      if($('eventSelect'))$('eventSelect').disabled=false;
      enhanceResponsiveTables();
    }
  }
}


function missingMediaUrls(){return new Set((settings._mediaHealth?.missing||[]).map(item=>String(item.url||'')));}
function isMissingMediaUrl(url){return missingMediaUrls().has(String(url||''));}
function forgetMissingMediaUrl(url){if(!settings._mediaHealth?.missing)return;settings._mediaHealth.missing=settings._mediaHealth.missing.filter(item=>item.url!==url);settings._mediaHealth.missingCount=settings._mediaHealth.missing.length;}
function renderMediaHealth(){
  const notice=$('mediaHealthNotice'),text=$('mediaHealthText');
  if(!notice||!text)return;
  const count=Number(settings._mediaHealth?.missingCount||0);
  notice.classList.toggle('hidden',count<1);
  text.textContent=count?`${count} referencia(s) apuntan a archivos locales que no están en esta copia. Puedes restaurar uploads o retirar únicamente esas referencias.`:'';
}
function renderHeroMediaPreview(){
  const container=$('heroPreview');if(!container)return;
  const url=String(settings.media?.heroImage||'');
  if(!url){container.innerHTML='<p class="muted media-empty">Sin portada cargada.</p>';return;}
  if(isMissingMediaUrl(url)){container.innerHTML='<div class="missing-media-placeholder"><strong>Portada no disponible</strong><small>La base conserva la referencia, pero el archivo no está en uploads.</small></div>';return;}
  container.innerHTML=`<img src="${esc(url)}" alt="Vista previa de portada" loading="lazy" decoding="async">`;
}

function renderMedia(containerId,items,type){
  const container=$(containerId);
  if(!container)return;
  if(!Array.isArray(items)||!items.length){container.innerHTML='<p class="muted media-empty">No hay archivos cargados todavía.</p>';return;}
  container.innerHTML=items.map(url=>{
    const missing=isMissingMediaUrl(url);
    return `<figure class="gallery-admin-item ${missing?'media-reference-missing':''}">${missing
      ?'<div class="missing-media-placeholder"><strong>Archivo no disponible</strong><small>La base conserva la referencia, pero el archivo no está en uploads. Puedes restaurarlo o quitar la referencia.</small></div>'
      :`<img src="${esc(url)}" alt="Archivo cargado" loading="lazy" decoding="async">`}<button class="mini-btn remove-media" type="button" data-url="${esc(url)}" data-type="${esc(type)}">Quitar</button></figure>`;
  }).join('');
  container.querySelectorAll('.remove-media').forEach(button=>{
    button.addEventListener('click',async()=>{
      if(!confirm('¿Quitar esta imagen?'))return;
      const response=await api('/api/admin/media/item',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:button.dataset.url,type:button.dataset.type})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)return status(data.error||'No se pudo quitar la imagen.',false);
      const url=button.dataset.url;forgetMissingMediaUrl(url);
      if(button.dataset.type==='gallery')settings.media.gallery=(settings.media?.gallery||[]).filter(item=>item!==url);
      else if(button.dataset.type==='dress')settings.dressCode.referenceImages=(settings.dressCode?.referenceImages||[]).filter(item=>item!==url);
      renderMedia(containerId,button.dataset.type==='gallery'?settings.media.gallery:settings.dressCode.referenceImages,button.dataset.type);
      status('Imagen retirada.');
    });
  });
}


function renderGiftMessageSuggestionPreview(){
  const container=$('giftMessageAdminPreview');
  if(!container)return;
  const presets=Array.isArray(settings?._giftMessagePresets)?settings._giftMessagePresets:[];
  container.innerHTML=presets.map(item=>`<article><strong>${esc(item.label||'Sugerencia')}</strong><p>${esc(item.text||'')}</p></article>`).join('');
}

function giftPersuasionCatalog(){
  return Array.isArray(settings?._giftPersuasionPresets)?settings._giftPersuasionPresets:[];
}

function renderGiftPersuasionOptions(){
  const select=$('giftBankPersuasionPreset');
  if(!select)return;
  const current=select.value||settings?.gifts?.bank?.persuasionPresetId||'';
  const options=[
    '<option value="">Sin mensaje motivador</option>',
    ...giftPersuasionCatalog().map(item=>`<option value="${esc(item.id)}">${esc(item.label)}</option>`),
    '<option value="custom">Mensaje personalizado</option>'
  ];
  select.innerHTML=options.join('');
  select.value=[...select.options].some(option=>option.value===current)?current:'';
}

function updateGiftPersuasionFields(){
  const select=$('giftBankPersuasionPreset');
  const preview=$('giftBankPersuasionPreview');
  const customField=$('giftBankPersuasionCustomField');
  const presetId=select?.value||'';
  customField?.classList.toggle('hidden',presetId!=='custom');
  if(!preview)return;
  const preset=giftPersuasionCatalog().find(item=>item.id===presetId);
  const customText=String($('giftBankPersuasionCustom')?.value||'').trim();
  const text=presetId==='custom'?customText:(preset?.text||'');
  const strategy=presetId==='custom'?'Mensaje definido por el anfitrión':(preset?.strategy||'');
  preview.replaceChildren();
  if(text){
    const strong=document.createElement('strong');strong.textContent=strategy;
    const paragraph=document.createElement('p');paragraph.textContent=text;
    preview.append(strong,paragraph);
  }
  preview.classList.toggle('hidden',!text);
}

function updateGiftFields(){
  const cashEnabled=$('giftCashEnabled')?.checked===true;
  const registryEnabled=$('giftRegistryEnabled')?.checked===true;
  const bankEnabled=$('giftBankInfoEnabled')?.checked===true;
  const openpayEnabled=$('giftOpenpayEnabled')?.checked===true;
  const messageEnabled=openpayEnabled&&$('giftOpenpayMessageEnabled')?.checked===true;

  $('giftCashOptions')?.classList.toggle('hidden',!cashEnabled);
  $('giftRegistryOptions')?.classList.toggle('hidden',!registryEnabled);
  $('giftBankField')?.classList.toggle('hidden',!bankEnabled);
  $('giftOpenpayOptions')?.classList.toggle('hidden',!openpayEnabled);
  $('giftMessageSuggestionPreview')?.classList.toggle('hidden',!messageEnabled);
  if(messageEnabled)renderGiftMessageSuggestionPreview();
  if(bankEnabled)updateGiftPersuasionFields();
}

function renderGiftPresets(){
  renderGiftPersuasionOptions();
  updateGiftFields();
  updateGiftPersuasionFields();
}

function setValue(id,value){
  const element=$(id);
  if(element)element.value=value??'';
}
function setChecked(id,value){
  const element=$(id);
  if(element)element.checked=!!value;
}
function mergeSettingsResponse(next){
  if(!next||typeof next!=="object")return settings;
  const metadata=Object.fromEntries(Object.entries(settings||{}).filter(([key])=>key.startsWith("_")));
  settings={...settings,...metadata,...next};
  return settings;
}
function applyEventPalette(element){
  if(!element)return;
  const palette=settings?._themePalette||{};
  ['bg','paper','ink','muted','accent','accentText','gold','line','accentContrast'].forEach(key=>{
    const value=palette[key];
    const cssKey=key==='accentContrast'?'accent-contrast':key==='accentText'?'accent-text':key;
    if(/^#[0-9a-f]{6}$/i.test(String(value||'')))element.style.setProperty(`--${cssKey}`,value);
  });
  element.dataset.surfaceTexture=String(settings?._surfaceTexture||'none');
}
function automaticDateLabel(dateValue){
  const match=String(dateValue||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match)return '';
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));
  return new Intl.DateTimeFormat('es-MX',{
    day:'numeric',month:'long',year:'numeric',timeZone:'UTC'
  }).format(date);
}
function restoreAutomaticDateLabel(){
  const generated=automaticDateLabel($('eventDate')?.value);
  if(!generated)return status('Selecciona primero la fecha del evento.',false);
  setValue('dateLabel',generated);
  lastGeneratedDateLabel=generated;
  updateThemeLivePreview();
}
function fillSettings(){
  setValue('partner1',settings.couple?.partner1);
  setValue('partner2',settings.couple?.partner2);
  setValue('displayName',settings.couple?.displayName);
  setValue('eventDate',(settings.event?.dateTime||'').slice(0,10));
  setValue('dateLabel',settings.event?.dateLabel);
  lastGeneratedDateLabel=automaticDateLabel((settings.event?.dateTime||'').slice(0,10));
  setValue('heroMessage',settings.event?.heroMessage);
  setValue('closingMessage',settings.event?.closingMessage);
  setValue('venueName',settings.venue?.name);
  setValue('ceremonyTime',settings.venue?.ceremonyTime);
  setValue('receptionTime',settings.venue?.receptionTime);
  setValue('venueAddress',settings.venue?.address);
  setValue('mapsUrl',settings.venue?.mapsUrl);
  setValue('venueNotes',settings.venue?.notes);
  setValue('storyText',settings.story?.text);
  setValue('dressTitle',settings.dressCode?.title);
  setValue('dressDescription',settings.dressCode?.description);
  setValue('menuServiceMode',settings.menus?.serviceMode||(settings.menus?.selectionEnabled?'guest-choice':'fixed'));
  setValue('adultMenus',(settings.menus?.adultOptions||[]).join('\n'));
  setValue('childMenus',(settings.menus?.childOptions||[]).join('\n'));
  setValue('menuInstructions',settings.menus?.instructions);
  setChecked('developerMode',(settings.developer?.mode||'production')==='development');
  setChecked('showDevBanner',settings.developer?.showBanner!==false);
  setValue('headingFont',settings.typography?.heading||'georgia');
  setValue('bodyFont',settings.typography?.body||'system');
  setValue('nameCaseMode',settings.typography?.nameCase||'title');
  const designPalette={...(settings._themePalette||{}),...(settings.designKit?.palette||{})};
  setChecked('designKitEnabled',Boolean(settings.designKit?.enabled));
  setValue('designKitTexture',settings.designKit?.texture||'none');
  ['bg','paper','ink','muted','accent','gold','line'].forEach(key=>setValue(`designKit${key[0].toUpperCase()}${key.slice(1)}`,designPalette[key]||'#ffffff'));
  setValue('experienceModeSelect',settings.presentation?.experienceMode||'auto');
  setValue('motionLevelSelect',settings.presentation?.motionLevel||'balanced');
  setValue('galleryStyleSelect',settings.presentation?.galleryStyle||'classic');
  setValue('rosePetalColor',settings.presentation?.rosePetalColor||'');
  setValue('floralPetalColor',settings.presentation?.floralPetalColor||'');
  setValue('floralCenterColor',settings.presentation?.floralCenterColor||'');
  setValue('creativeProtagonist',settings.creativeBrief?.protagonist||'');
  setValue('creativeMilestone',settings.creativeBrief?.milestone||'');
  setValue('creativeTheme',settings.creativeBrief?.theme||'');
  setValue('creativeTone',settings.creativeBrief?.tone||'joyful');
  setValue('creativeVisualNotes',settings.creativeBrief?.visualNotes||'');
  setChecked('creativeRightsConfirmed',settings.creativeBrief?.assetRightsConfirmed===true);
  const localization=settings.localization||{};
  const defaultLocale=localization.defaultLocale||'es';
  const enabledLocales=Array.isArray(localization.enabledLocales)?localization.enabledLocales:[defaultLocale];
  setValue('defaultLocale',defaultLocale);
  setChecked('localeEs',enabledLocales.includes('es'));
  setChecked('localeEn',enabledLocales.includes('en'));
  setChecked('localePt',enabledLocales.includes('pt'));
  renderTranslationEditor();

  const gift=settings.gifts||{};
  const methods=gift.methods||{};
  const legacyMode=gift.mode||'cash-envelopes';
  const cashEnabled=methods.cashEnvelopes?.enabled??(legacyMode==='cash-envelopes');
  const registryEnabled=methods.registry?.enabled??(legacyMode==='registry'||legacyMode==='mixed');
  const bankEnabled=methods.bankTransfer?.enabled??(gift.bankInfoEnabled===true||legacyMode==='bank-transfer'||legacyMode==='mixed');
  setValue('giftTitle',gift.title||gift.cashTitle||'Regalos');
  setValue('giftMessage',gift.message||'');
  setValue('giftDescription',gift.description||gift.cashDescription||'');
  setChecked('giftCashEnabled',cashEnabled);
  setValue('giftCashInstructions',methods.cashEnvelopes?.instructions||gift.cashEnvelopeInstructions||((legacyMode==='cash-envelopes')?gift.description:'')||'');
  setChecked('giftRegistryEnabled',registryEnabled);
  setValue('giftLink',gift.link||'');
  setValue('giftLinkLabel',gift.linkLabel||'');
  const bank=gift.bank||{};
  setChecked('giftBankInfoEnabled',bankEnabled);
  setValue('giftBankName',bank.bankName||'');
  setValue('giftBankHolder',bank.accountHolder||'');
  setValue('giftBankClabe',bank.clabe||'');
  setValue('giftBankAccount',bank.accountNumber||'');
  setValue('giftBankReferenceConcept',bank.referenceConcept||'');
  setValue('giftBankInstructions',bank.instructions||gift.bankInfo||'');
  setValue('giftBankPersuasionPreset',bank.persuasionPresetId||'');
  setValue('giftBankPersuasionCustom',bank.persuasionCustomText||'');
  setChecked('giftOpenpayEnabled',gift.openpay?.enabled===true);
  setValue('giftOpenpaySuggestedAmount',gift.openpay?.suggestedAmountCents==null?'':Number(gift.openpay.suggestedAmountCents)/100);
  setChecked('giftOpenpayAllowCustom',gift.openpay?.suggestedAmountCents==null?true:gift.openpay?.allowCustomAmount!==false);
  setChecked('giftOpenpayMessageEnabled',gift.openpay?.messageEnabled!==false);
  renderGiftPersuasionOptions();
  setValue('giftBankPersuasionPreset',bank.persuasionPresetId||'');
  updateGiftFields();
  updateGiftPersuasionFields();

  const venues=settings.venues||{};
  setChecked('samePlace',venues.samePlace!==false);
  setValue('ceremonyName',venues.ceremony?.name);
  setValue('ceremonySeparateTime',venues.ceremony?.time);
  setValue('ceremonyAddress',venues.ceremony?.address);
  setValue('ceremonyMaps',venues.ceremony?.mapsUrl);
  setValue('ceremonyLat',venues.ceremony?.lat);
  setValue('ceremonyLng',venues.ceremony?.lng);
  setValue('receptionName',venues.reception?.name);
  setValue('receptionSeparateTime',venues.reception?.time);
  setValue('receptionAddress',venues.reception?.address);
  setValue('receptionMaps',venues.reception?.mapsUrl);
  setValue('receptionLat',venues.reception?.lat);
  setValue('receptionLng',venues.reception?.lng);

  setValue('accessibilityOptions',(settings.accessibility?.options||[]).join('\n'));
  setValue('accessibilityHelp',settings.accessibility?.helpText||'');
  setChecked('rsvpEnabled',settings.rsvp?.enabled!==false);
  const closeAt=settings.rsvp?.closeAt?new Date(settings.rsvp.closeAt):null;
  setValue('rsvpCloseAt',closeAt&&!Number.isNaN(closeAt.getTime())?new Date(closeAt.getTime()-closeAt.getTimezoneOffset()*60000).toISOString().slice(0,16):'');
  const seatReleaseAt=settings.rsvp?.seatReleaseAt?new Date(settings.rsvp.seatReleaseAt):null;
  setValue('rsvpSeatReleaseAt',seatReleaseAt&&!Number.isNaN(seatReleaseAt.getTime())?new Date(seatReleaseAt.getTime()-seatReleaseAt.getTimezoneOffset()*60000).toISOString().slice(0,16):'');
  setChecked('rsvpAllowChanges',settings.rsvp?.allowChanges!==false);
  setChecked('rsvpFlexibleComposition',settings.rsvp?.allowFlexibleComposition===true);
  setValue('photoMessageMaxLength',settings.photoPolicy?.messageMaxLength??500);
  setValue('spotifyUrl',settings.media?.spotifyUrl||'');
  const labels=settings.presentation||{};
  setValue('eventTypeSelect',settings._event?.event_type||settings.event?.eventType||'wedding');
  setValue('heroEyebrowText',labels.heroEyebrow||'Evento especial');
  setValue('openButtonText',labels.openButton||'Abrir invitación');
  setValue('rsvpTitleText',labels.rsvpTitle||'Confirma tu asistencia');
  setValue('agendaTitleText',labels.agendaTitle||'Momentos del evento');
  setValue('guestLabelText',labels.guestLabel||'Familia o invitado');
  setValue('dashboardTitleText',labels.dashboardTitle||'Resumen del evento');
  setValue('dashboardDescriptionText',labels.dashboardDescription||'Consulta asistencia, necesidades y recursos del evento activo.');

  renderHeroMediaPreview();
  renderMedia('settingsGallery',settings.media?.gallery||[],'gallery');
  renderMedia('dressSettingsGallery',settings.dressCode?.referenceImages||[],'dress');
  renderMediaHealth();
  renderMusicStudio();
  updateFontPreviews();
  updateDeveloperModeUi();
  renderAgendaLab();
  const qrDesign=settings.qrDesign||{};
  setValue('qrDesignTitle',qrDesign.title||'Captura nuestros recuerdos');
  setValue('qrDesignMessage',qrDesign.message||'Escanea el código y comparte las fotografías que tomes durante la celebración.');
  setValue('qrDesignInstruction',qrDesign.instruction||'No necesitas instalar ninguna aplicación.');
  setChecked('qrShowTableName',qrDesign.showTableName!==false);
  setChecked('qrShowFamilies',qrDesign.showFamilies===true);
  setChecked('qrUseThemeColors',qrDesign.useInvitationColors!==false);
  setValue('physicalTemplateSelect',settings.physicalInvitation?.templateId||'auto-theme');
  populateExperienceSelectors();
  setValue('openingStyleSelect',settings.presentation?.openingStyle||defaultOpeningId());
  updateDesignProductControls();
  updateQrMockup();
}

function stationeryCatalog(){return settings?._stationeryCatalog||{};}
function defaultOpeningId(){return stationeryCatalog().openingId||experienceOptions().openings?.[0]?.id||"";}
function selectedOpeningDefinition(){
  const selected=$('openingStyleSelect')?.value||settings.presentation?.openingStyle||'';
  return (experienceOptions().openings||[]).find(item=>item.id===selected)||null;
}
function stationeryPresetLabel(){
  const catalog=stationeryCatalog(),presetId=settings.stationery?.presetId||catalog.defaults?.presetId;
  return (catalog.presets||[]).find(item=>item.id===presetId)?.label||presetId||'Configuración predeterminada';
}
function refreshStationeryLaunchCard(){
  const card=$('stationeryLaunchCard'),opening=selectedOpeningDefinition(),editor=opening?.editor;
  const editable=editor?.type==='stationery-studio'&&Boolean(editor.path);
  card?.classList.toggle('hidden',!editable);
  if(!editable)return;
  const displayName=$('displayName')?.value||settings.couple?.displayName||settings._event?.name||'';
  const dateLabel=$('dateLabel')?.value||settings.event?.dateLabel||'';
  const headingLabel=$('headingFont')?.selectedOptions?.[0]?.textContent||settings.typography?.heading||'Tipografía del evento';
  if($('stationeryLaunchNames'))$('stationeryLaunchNames').textContent=displayName||'—';
  if($('stationeryLaunchDate'))$('stationeryLaunchDate').textContent=dateLabel||'—';
  if($('stationeryLaunchFont'))$('stationeryLaunchFont').textContent=headingLabel;
  if($('stationeryLaunchPreset'))$('stationeryLaunchPreset').textContent=stationeryPresetLabel();
  const state=$('stationeryLaunchState');
  if(state){
    const customized=settings.stationery?.customized===true,synced=settings.stationery?.syncDesignTokens===true;
    state.textContent=customized?(synced?'Aplicado y sincronizado':'Aplicado sin sincronización global'):'Listo para personalizar';
    state.className=`status-pill ${customized?'confirmed':'pending'}`;
  }
  const link=$('openStationeryStudioBtn');
  if(link){
    const url=new URL(editor.path,window.location.origin);
    if(eventId)url.searchParams.set('eventId',String(eventId));
    link.href=`${url.pathname}${url.search}`;
    link.textContent=editor.label||'Abrir estudio avanzado';
    link.setAttribute('aria-disabled',String(!eventId));
  }
  const hint=$('stationeryLaunchHint');
  if(hint){
    hint.textContent='El estudio avanzado hereda nombres, fecha y tipografía del evento. Los cambios sólo se vuelven globales al usar Aplicar a la invitación.';
    if(featureAccess.templates!==true&&!['owner','developer'].includes(currentUser?.role))hint.textContent='Tu perfil puede abrir el estudio en modo de consulta, pero la aplicación de cambios requiere acceso a Plantillas.';
  }
}
function experienceOptions(){return settings?._experiences||publicCatalog?.experiences||{openings:[],galleries:[],motionLevels:[]};}
function populateExperienceSelectors(){
  const catalog=experienceOptions();
  const fill=(id,items,current)=>{const select=$(id);if(!select||!items?.length)return;select.innerHTML=items.map(item=>`<option value="${esc(item.id)}">${esc(item.label)}${item.commercial?' · Store':''}</option>`).join('');if(items.some(item=>item.id===current))select.value=current;};
  fill('openingStyleSelect',catalog.openings,settings.presentation?.openingStyle||defaultOpeningId());
  fill('galleryStyleSelect',catalog.galleries,settings.presentation?.galleryStyle||'classic');
  fill('motionLevelSelect',catalog.motionLevels,settings.presentation?.motionLevel||'balanced');
}
function updateDesignProductControls(){
  const platformUser=['owner','developer'].includes(currentUser?.role)&&!supportClientView;
  const opening=$('openingStyleSelect'),gallery=$('galleryStyleSelect'),catalog=experienceOptions();
  for(const item of catalog.openings||[]){const option=opening?.querySelector(`option[value="${CSS.escape(item.id)}"]`);if(option&&item.commercial)option.disabled=!platformUser&&!designAccess.opening?.[item.id];}
  for(const item of catalog.galleries||[]){const option=gallery?.querySelector(`option[value="${CSS.escape(item.id)}"]`);if(option&&item.commercial)option.disabled=!platformUser&&!designAccess.gallery?.[item.id];}
  if(opening?.selectedOptions?.[0]?.disabled)opening.value=defaultOpeningId();
  if(gallery?.selectedOptions?.[0]?.disabled)gallery.value='classic';
  const canEditTemplates=platformUser||featureAccess.templates===true;
  if($('saveOpeningStyleBtn'))$('saveOpeningStyleBtn').disabled=!canEditTemplates;
  const activeOpening=(catalog.openings||[]).find(item=>item.id===opening?.value);
  const colorControls=new Set(activeOpening?.colorControls||[]);
  ['rosePetalColor','floralPetalColor','floralCenterColor'].forEach(key=>$(key+'Field')?.classList.toggle('hidden',!colorControls.has(key)));
  refreshStationeryLaunchCard();
}


function activeQrTemplate(){
  const id=settings.qrDesign?.templateId||'classic-holder';
  return qrTemplates.find(item=>item.id===id)||qrTemplates[0];
}

function renderQrTemplates(){
  const grid=$('qrTemplateGrid');
  if(!grid)return;
  const activeId=settings.qrDesign?.templateId||'classic-holder';

  grid.innerHTML=qrTemplates.map(template=>`
    <article class="qr-template-card ${template.id===activeId?'selected':''}" data-template="${esc(template.id)}">
      <div class="mini-table-scene">
        <div class="mini-plate"></div>
        <div class="mini-glass"></div>
        <div class="mini-sign mini-${esc(template.mockup)}">
          <span>${esc(template.icon)}</span>
          <b>QR</b>
        </div>
      </div>
      <div class="qr-template-info">
        <h3>${esc(template.name)}</h3>
        <p>${esc(template.description)}</p>
        <small>${esc(template.printNote)}</small>
        <button class="secondary-btn choose-qr-template" type="button" data-id="${esc(template.id)}">
          ${template.id===activeId?'Diseño activo':'Usar diseño'}
        </button>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.choose-qr-template').forEach(button=>{
    button.addEventListener('click',async()=>{
      const next={
        ...(settings.qrDesign||{}),
        templateId:button.dataset.id
      };
      const response=await api('/api/admin/settings',{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({qrDesign:next})
      });
      if(!response.ok)return status('No se pudo aplicar la plantilla QR.',false);
      settings.qrDesign=next;
      renderQrTemplates();
      updateQrMockup();
      status('Plantilla QR aplicada.');
    });
  });

  updateQrMockup();
}

function updateQrMockup(){
  const template=activeQrTemplate();
  if(!template)return;

  const mockup=$('qrPhysicalMockup');
  if(mockup){
    mockup.className=`qr-physical-mockup qr-mockup-${template.mockup}`;
    applyEventPalette(mockup);
  }

  if($('activeQrTemplateName'))$('activeQrTemplateName').textContent=template.name;
  if($('activeQrTemplateNote'))$('activeQrTemplateNote').textContent=template.printNote;
  if($('mockupTitle'))$('mockupTitle').textContent=$('qrDesignTitle')?.value||settings.qrDesign?.title||'Captura nuestros recuerdos';
  if($('mockupCouple'))$('mockupCouple').textContent=$('displayName')?.value||settings.couple?.displayName||'Nuestro evento';
  if($('mockupTable'))$('mockupTable').textContent=$('tableSelect')?.value||'QR general';

  const scene=$('qrTableScene');
  if(scene){
    scene.className=`qr-table-scene theme-${settings.themeId||'romantic-wine'}`;
  }
}

function renderPhysicalInvitationStudio(){
  const select=$('physicalGuestSelect');
  if(!select)return;
  const realGuests=guests.filter(guest=>!guest.is_test);
  const current=Number(select.value)||realGuests[0]?.id||0;
  select.innerHTML=realGuests.length
    ?realGuests.map(guest=>`<option value="${guest.id}" ${guest.id===current?'selected':''}>${esc(guest.family_name)}</option>`).join('')
    :'<option value="">Primero agrega un invitado real</option>';
  const selected=realGuests.find(guest=>guest.id===Number(select.value));
  if($('physicalPreviewEyebrow'))$('physicalPreviewEyebrow').textContent=settings.presentation?.heroEyebrow||'Invitación especial';
  if($('physicalPreviewEvent'))$('physicalPreviewEvent').textContent=presentedName($('displayName')?.value||settings.couple?.displayName||settings._event?.name||'Evento activo');
  if($('physicalPreviewGuest'))$('physicalPreviewGuest').textContent=presentedName(selected?.family_name||'Selecciona un invitado');
  const template=$('physicalTemplateSelect')?.value||settings.physicalInvitation?.templateId||'auto-theme';
  if($('physicalInvitePreview')){
    $('physicalInvitePreview').className=`physical-invite-mini-preview template-${template} theme-${settings.themeId||'romantic-wine'}`;
    applyEventPalette($('physicalInvitePreview'));
  }
  if($('downloadPhysicalInviteBtn'))$('downloadPhysicalInviteBtn').disabled=!selected;
}

$('physicalGuestSelect')?.addEventListener('change',renderPhysicalInvitationStudio);
function presentationDraftFromForm(){
  const fallbackOpening=defaultOpeningId();
  return {
    ...(settings.presentation||{}),
    openingStyle:$('openingStyleSelect')?.value||fallbackOpening,
    experienceMode:$('experienceModeSelect')?.value||'auto',
    motionLevel:$('motionLevelSelect')?.value||'balanced',
    galleryStyle:$('galleryStyleSelect')?.value||'classic',
    rosePetalColor:$('rosePetalColor')?.value||settings.presentation?.rosePetalColor||'',
    floralPetalColor:$('floralPetalColor')?.value||settings.presentation?.floralPetalColor||'',
    floralCenterColor:$('floralCenterColor')?.value||settings.presentation?.floralCenterColor||''
  };
}
function refreshOpenInvitationPreview(){
  const frame=$('openingPreviewFrame');
  if(!frame||frame.src==='about:blank')return;
  try{const url=new URL(frame.src,window.location.origin);url.searchParams.set('_',String(Date.now()));frame.src=`${url.pathname}${url.search}`;}catch{}
}
async function saveOpeningSelection(){
  const button=$('saveOpeningStyleBtn');if(!button)return;
  button.disabled=true;status('Guardando entrada animada…');
  try{
    const response=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({presentation:presentationDraftFromForm()})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'No se pudo guardar la entrada animada.');
    mergeSettingsResponse(data.settings||{presentation:presentationDraftFromForm()});
    setValue('openingStyleSelect',settings.presentation?.openingStyle||defaultOpeningId());
    updateDesignProductControls();applyDynamicPresentation();updateQrMockup();renderPhysicalInvitationStudio();refreshOpenInvitationPreview();
    status('Entrada animada guardada y coordinación visual actualizada.');
  }catch(error){status(error.message||'No se pudo guardar la entrada animada.',false);}
  finally{button.disabled=!(featureAccess.templates===true||(['owner','developer'].includes(currentUser?.role)&&!supportClientView));}
}
async function reloadStationeryStateFromServer(){
  if(!eventId)return;
  try{
    const response=await api('/api/admin/settings',{cache:'no-store'});
    const data=await readJson(response,'Actualización del estudio de sobres');
    mergeSettingsResponse(data);
    setValue('openingStyleSelect',settings.presentation?.openingStyle||defaultOpeningId());
    updateDesignProductControls();applyDynamicPresentation();updateQrMockup();renderPhysicalInvitationStudio();refreshOpenInvitationPreview();
    status('El estudio avanzado aplicó la nueva configuración del sobre.');
  }catch(error){status(error.message||'No se pudo refrescar la configuración aplicada por el estudio.',false);}
}
$('openingStyleSelect')?.addEventListener('change',updateDesignProductControls);
$('saveOpeningStyleBtn')?.addEventListener('click',saveOpeningSelection);
['displayName','dateLabel','headingFont'].forEach(id=>$(id)?.addEventListener('input',refreshStationeryLaunchCard));
try{
  const stationeryChannel=new BroadcastChannel('eventstudio-stationery');
  stationeryChannel.addEventListener('message',event=>{if(Number(event.data?.eventId)===Number(eventId))void reloadStationeryStateFromServer();});
}catch{}
window.addEventListener('storage',event=>{
  if(event.key!=='eventstudio:stationery-applied'||!event.newValue)return;
  try{const signal=JSON.parse(event.newValue);if(Number(signal.eventId)===Number(eventId))void reloadStationeryStateFromServer();}catch{}
});

$('previewOpeningBtn')?.addEventListener('click',async()=>{
  const selected=$('openingStyleSelect')?.value||defaultOpeningId();
  if(selected==='none')return status('Selecciona una apertura antes de probarla.',false);
  const eventSlug=settings._event?.slug;
  if(!eventSlug)return status('El evento activo todavía no tiene un enlace de vista previa.',false);
  const base=await ensureEventPreviewBaseUrl();
  const url=previewUrlFromOptions({previewOpening:selected},base);
  if(!url)return status('No se pudo crear una vista previa autorizada.',false);
  const frame=$('openingPreviewFrame'),dialog=$('openingPreviewDialog');
  if(!frame||!dialog)return;
  frame.src=replayablePreviewUrl(url);dialog.showModal();
});
$('closeOpeningPreviewBtn')?.addEventListener('click',()=>{
  $('openingPreviewDialog')?.close();
  if($('openingPreviewFrame'))$('openingPreviewFrame').src='about:blank';
});
$('openingPreviewDialog')?.addEventListener('click',event=>{
  if(event.target!==event.currentTarget)return;
  event.currentTarget.close();
  $('openingPreviewFrame').src='about:blank';
});
if($('openingMotionHint')&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  $('openingMotionHint').textContent='Tu sistema solicita movimiento reducido. La invitación pública respetará esta preferencia; la vista de prueba fuerza la animación sólo para que puedas evaluarla.';
}

function creativeBriefFromForm(){
  return {
    protagonist:$('creativeProtagonist')?.value.trim()||'',
    milestone:$('creativeMilestone')?.value.trim()||'',
    theme:$('creativeTheme')?.value.trim()||'',
    tone:$('creativeTone')?.value||'joyful',
    visualNotes:$('creativeVisualNotes')?.value.trim()||'',
    assetRightsConfirmed:$('creativeRightsConfirmed')?.checked===true
  };
}

function creativePrompt(brief){
  const eventType=settings._event?.event_type||settings.event?.eventType||'celebración';
  const palette=(themes.find(theme=>theme.id===settings.themeId)?.tags||[]).slice(0,3).join(', ');
  const photos=(settings.media?.gallery||[]).length+(settings.media?.heroImage?1:0);
  return [
    'Crea un recurso visual ORIGINAL para una invitación digital vertical y adaptable.',
    `Celebración: ${eventType}.`,
    `Protagonista: ${brief.protagonist||'por definir'}.`,
    `Momento: ${brief.milestone||'por definir'}.`,
    `Temática: ${brief.theme||'por definir'}.`,
    `Tono: ${brief.tone}.`,
    `Dirección visual: ${brief.visualNotes||'composición clara, alegre y legible'}.`,
    palette?`Referencia cromática de la plantilla: ${palette}.`:'',
    `La invitación utilizará ${photos} fotografía(s) reales; deja áreas limpias para integrarlas sin alterar rostros.`,
    'No copies personajes, logotipos, vestuario distintivo ni escenarios de franquicias. Diseña personajes y elementos propios.',
    'No incluyas nombres, fechas, direcciones ni texto dentro de la imagen: EventStudio los superpondrá de forma accesible.',
    'Entrega un fondo vertical 9:16 y una versión horizontal 16:9, sin marcas de agua.'
  ].filter(Boolean).join('\n');
}

$('saveCreativeBriefBtn')?.addEventListener('click',async()=>{
  const creativeBrief=creativeBriefFromForm();
  const response=await api('/api/admin/settings',{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({creativeBrief})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo guardar el contexto creativo.',false);
  settings.creativeBrief=data.settings?.creativeBrief||creativeBrief;
  status('Contexto creativo guardado. No se envió información a servicios externos.');
});

$('buildCreativePromptBtn')?.addEventListener('click',()=>{
  const brief=creativeBriefFromForm();
  if(!brief.theme&&!brief.protagonist)return status('Describe al protagonista o la temática para preparar una solicitud útil.',false);
  if(!brief.assetRightsConfirmed)return status('Confirma primero que puedes usar los recursos que entregarás.',false);
  $('creativePromptOutput').value=creativePrompt(brief);
  const platformUser=['owner','developer'].includes(currentUser?.role);
  $('creativePromptField').classList.toggle('hidden',!platformUser);
  $('copyCreativePromptBtn').classList.toggle('hidden',!platformUser);
  status(platformUser
    ?'Instrucción interna preparada localmente para revisión.'
    :'Solicitud visual preparada. No se envió ni se cobró nada; falta conectar el proveedor automático.');
});

$('copyCreativePromptBtn')?.addEventListener('click',async()=>{
  const value=$('creativePromptOutput')?.value||'';
  if(!value)return;
  try{
    await navigator.clipboard.writeText(value);
    status('Prompt copiado.');
  }catch{
    $('creativePromptOutput').focus();
    $('creativePromptOutput').select();
    status('Seleccioné el prompt; usa Copiar desde tu navegador.');
  }
});

$('physicalTemplateSelect')?.addEventListener('change',async()=>{
  const physicalInvitation={...(settings.physicalInvitation||{}),templateId:$('physicalTemplateSelect').value};
  const response=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({physicalInvitation})});
  if(!response.ok)return status('No se pudo guardar la plantilla física.',false);
  settings.physicalInvitation=physicalInvitation;renderPhysicalInvitationStudio();status('Plantilla física coordinada guardada.');
});
$('downloadPhysicalInviteBtn')?.addEventListener('click',()=>{
  const guest=guests.find(item=>item.id===Number($('physicalGuestSelect')?.value));
  if(!guest)return status('Selecciona un invitado real.',false);
  const template=$('physicalTemplateSelect')?.value||'auto-theme';
  download(`/api/admin/physical-invitation.pdf?guestId=${guest.id}&template=${encodeURIComponent(template)}`,`invitacion-fisica-${guest.family_name}.pdf`);
});

async function saveQrDesign(){
  const body={
    qrDesign:{
      ...(settings.qrDesign||{}),
      title:$('qrDesignTitle')?.value||'Captura nuestros recuerdos',
      message:$('qrDesignMessage')?.value||'',
      instruction:$('qrDesignInstruction')?.value||'',
      showTableName:!!$('qrShowTableName')?.checked,
      showFamilies:!!$('qrShowFamilies')?.checked,
      useInvitationColors:!!$('qrUseThemeColors')?.checked,
      templateId:settings.qrDesign?.templateId||'classic-holder'
    }
  };

  const response=await api('/api/admin/settings',{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  let data={};
  try{data=await response.json();}catch{}
  if(!response.ok)return status(data.error||'No se pudo guardar el diseño QR.',false);
  settings.qrDesign=body.qrDesign;
  updateQrMockup();
  status('Configuración QR guardada.');
}



function featureFlags(){
  return {
    agenda:featureAccess.program!==false,
    templates:featureAccess.templates!==false,
    thematicExperience:featureAccess.thematicExperience!==false,
    qr:featureAccess.qrCards!==false,
    photos:featureAccess.guestPhotoUpload!==false,
    gifts:featureAccess.gifts!==false,
    menus:featureAccess.menus!==false,
    spotify:featureAccess.music!==false,
    domains:featureAccess.customDomains!==false,
    tablesLab:featureAccess.seating!==false,
    whatsappBusiness:featureAccess.whatsappBusiness!==false,
    billing:true
  };
}
function applyFeatureVisibility(){
  const features=featureFlags();
  const platformUser=['owner','developer'].includes(currentUser?.role);
  const visible=(enabled)=>(platformUser&&!supportClientView)||enabled;
  $('templatesTabBtn')?.classList.toggle('hidden',!visible(features.templates));
  $('typographyCard')?.classList.toggle('hidden',!visible(features.templates));
  const quickCreativeTypes=new Set(['birthday','kids-party','baby-shower','gender-reveal','custom']);
  const creativeRelevant=quickCreativeTypes.has(settings._event?.event_type||'custom');
  $('creativeBriefStudio')?.classList.toggle('hidden',!visible(features.thematicExperience)||!creativeRelevant);
  $('guestsTabBtn')?.classList.toggle('hidden',!visible(featureAccess.guests!==false));
  $('qrTabBtn')?.classList.toggle('hidden',!visible(features.qr));
  $('photosTabBtn')?.classList.toggle('hidden',!visible(features.photos));
  $('agendaSettingsDetails')?.classList.toggle('hidden',!visible(features.agenda));
  $('giftSettingsCard')?.classList.toggle('hidden',!visible(features.gifts));
  $('menuSettingsGroup')?.classList.toggle('hidden',!visible(features.menus));
  $('musicStudio')?.classList.toggle('hidden',!visible(features.spotify));
  $('spotifySourceOption')?.classList.toggle('hidden',!visible(features.spotify));
  if(!visible(features.spotify)&&selectedMusicSource()==='spotify')setSelectedMusicSource('none');
  $('galleryForm')?.classList.toggle('hidden',!visible(featureAccess.gallery!==false));
  $('invitationGalleryManager')?.classList.toggle('hidden',!visible(featureAccess.gallery!==false));
  $('dressTitleField')?.classList.toggle('hidden',!visible(featureAccess.dressCode!==false));
  $('dressDescriptionField')?.classList.toggle('hidden',!visible(featureAccess.dressCode!==false));
  $('dressForm')?.classList.toggle('hidden',!visible(featureAccess.dressCode!==false));
  $('dressGalleryManager')?.classList.toggle('hidden',!visible(featureAccess.dressCode!==false));
  $('photoMessagePolicyField')?.classList.toggle('hidden',!visible(featureAccess.guestPhotoMessages!==false));
  $('photosStatCard')?.classList.toggle('hidden',!visible(featureAccess.guestPhotoUpload!==false));
  $('domainManagerCard')?.classList.toggle('hidden',!visible(features.domains));
  $('tablesLabTabBtn')?.classList.toggle('hidden',!visible(features.tablesLab));
  $('billingTabBtn')?.classList.remove('hidden');
  $('venueReportBtn')?.classList.toggle('hidden',!visible(featureAccess.reports!==false));
  const showWhatsappBusiness=visible(features.whatsappBusiness);
  $('whatsappReadinessCard')?.classList.toggle('hidden',!showWhatsappBusiness);
  $('automaticMessagingCard')?.classList.toggle('hidden',!showWhatsappBusiness);
}
$('supportClientView')?.addEventListener('change',async event=>{
  supportClientView=event.target.checked;
  await load();
  status(supportClientView?'Vista cliente activa. Tus permisos de propietario/desarrollador permanecen intactos.':'Vista técnica completa activa.');
});

function renderWorkspaceTools(){
  const container=$('workspaceTools');
  if(!container)return;
  const destinations={
    invitation:{tab:'dashboard',icon:'↗',title:'Invitación',description:'Vista pública y resumen'},
    guests:{tab:'guests',icon:'◎',title:'Invitados y RSVP',description:'Lista, confirmaciones y WhatsApp'},
    rsvp:{tab:'guests',icon:'◎',title:'Invitados y RSVP',description:'Lista, confirmaciones y WhatsApp'},
    whatsappManual:{tab:'guests',icon:'◎',title:'Invitados y RSVP',description:'Lista, confirmaciones y WhatsApp'},
    templates:{tab:'templates',icon:'✦',title:'Diseño',description:'Plantillas, apertura y tipografía'},
    thematicExperience:{tab:'templates',icon:'★',title:'Experiencia temática',description:'Escenas animadas, fotos y contexto creativo'},
    premiumTemplates:{tab:'templates',icon:'✦',title:'Diseño',description:'Plantillas, apertura y tipografía'},
    music:{tab:'settings',icon:'♫',title:'Contenido',description:'Música, programa y detalles'},
    program:{tab:'settings',icon:'♫',title:'Contenido',description:'Música, programa y detalles'},
    locations:{tab:'settings',icon:'♫',title:'Contenido',description:'Música, programa y detalles'},
    dressCode:{tab:'settings',icon:'♫',title:'Contenido',description:'Música, programa y detalles'},
    gifts:{tab:'settings',icon:'♫',title:'Contenido',description:'Música, programa y detalles'},
    gallery:{tab:'settings',icon:'♫',title:'Contenido',description:'Música, programa y detalles'},
    guestPhotoUpload:{tab:'photos',icon:'▣',title:'Álbum colaborativo',description:'Fotos y mensajes de invitados'},
    guestPhotoMessages:{tab:'photos',icon:'▣',title:'Álbum colaborativo',description:'Fotos y mensajes de invitados'},
    qrCards:{tab:'qr',icon:'▦',title:'QR e impresión',description:'Material por mesa e invitaciones'},
    physicalInvitations:{tab:'qr',icon:'▦',title:'QR e impresión',description:'Material por mesa e invitaciones'},
    seating:{tab:'tables-lab',icon:'⌗',title:'Mesas',description:'Plano y asignación de lugares'},
    reports:{tab:'dashboard',icon:'↓',title:'Reportes',description:'Resumen operativo y exportaciones'},
    menus:{tab:'settings',icon:'◇',title:'Menús',description:'Platillos y restricciones'}
  };
  const groups=new Map();
  featureContext.filter(item=>item.allowed&&destinations[item.key]).forEach(item=>{
    const destination=destinations[item.key];
    if(!document.querySelector(`[data-tab="${destination.tab}"]`))return;
    if(!groups.has(destination.title))groups.set(destination.title,{...destination,features:[]});
    groups.get(destination.title).features.push(item.label);
  });
  container.innerHTML=[...groups.values()].map(group=>`
    <button class="workspace-tool" type="button" data-tool-tab="${esc(group.tab)}">
      <span class="workspace-tool-icon">${group.icon}</span>
      <span><strong>${esc(group.title)}</strong><small>${esc(group.description)}</small></span>
      <span class="workspace-tool-arrow">›</span>
    </button>
  `).join('')||'<p class="muted">No hay herramientas disponibles para este evento.</p>';
  container.querySelectorAll('[data-tool-tab]').forEach(button=>button.addEventListener('click',()=>tab(button.dataset.toolTab)));
}


function eventTypePreset(){
  const type=$('eventTypeSelect')?.value||settings._event?.event_type||'custom';
  return eventTypes.find(item=>item.id===type)||eventTypes.find(item=>item.id==='custom')||eventTypes[0];
}

function renderEventTypeOptions(){
  const select=$('eventTypeSelect');
  if(!select)return;
  const active=settings._event?.event_type||settings.event?.eventType||'wedding';
  select.innerHTML=eventTypes.map(type=>`<option value="${esc(type.id)}" ${type.id===active?'selected':''}>${type.icon} ${esc(type.name)}</option>`).join('');
}

function applyEventTypePreset(){
  const preset=eventTypePreset();
  if(!preset)return;
  const labels=preset.defaults||{};
  const {storyTitle,...presentationLabels}=labels;
  settings.presentation={...(settings.presentation||{}),...presentationLabels};
  settings.story={...(settings.story||{}),title:storyTitle||settings.story?.title||'Información del evento'};
  setValue('heroEyebrowText',labels.heroEyebrow);
  setValue('openButtonText',labels.openButton);
  setValue('rsvpTitleText',labels.rsvpTitle);
  setValue('agendaTitleText',labels.agendaTitle);
  setValue('guestLabelText',labels.guestLabel);
  updateThemeLivePreview();
  status(`Textos sugeridos para ${preset.name} aplicados en la vista. Guarda la configuración para confirmarlos.`);
}

function applyDynamicPresentation(){
  const labels=settings.presentation||{};
  if($('dashboardDynamicTitle'))$('dashboardDynamicTitle').textContent=labels.dashboardTitle||'Resumen del evento';
  if($('dashboardDynamicDescription'))$('dashboardDynamicDescription').textContent=labels.dashboardDescription||'Consulta asistencia, necesidades y recursos del evento activo.';
  if($('venueReportHelp'))$('venueReportHelp').textContent=labels.reportDescription||'Incluye asistentes, menús, restricciones y necesidades especiales para coordinar la operación del evento.';
  if($('panelEventName'))$('panelEventName').textContent=settings._event?.name||settings.couple?.displayName||'Evento';
  if($('topbarEyebrow'))$('topbarEyebrow').textContent='Administración del evento';
}

function updateThemeLivePreview(themeId){
  /* RC15: la vista grande embebida se sustituyó por un modal. Conservamos esta
     función como sincronizador ligero para llamadas existentes del formulario. */
  const activeTheme=themeId||settings.themeId||'romantic-wine';
  const slug=settings._event?.slug;
  if($('openFullPreviewBtn'))$('openFullPreviewBtn').href=slug?`/e/${encodeURIComponent(slug)}?preview=1&previewTheme=${encodeURIComponent(activeTheme)}`:'#';
}


if($('applyEventTypePresetBtn'))$('applyEventTypePresetBtn').onclick=applyEventTypePreset;
['heroEyebrowText','displayName','dateLabel','heroMessage'].forEach(id=>$(id)?.addEventListener('input',updateFontPreviews));
$('eventDate')?.addEventListener('change',()=>{
  restoreAutomaticDateLabel();
  updateThemeLivePreview();
});
$('restoreDateLabelBtn')?.addEventListener('click',restoreAutomaticDateLabel);
$('eventTypeSelect')?.addEventListener('change',applyEventTypePreset);

function renderThemes(){
  const eventName=presentedName($('displayName')?.value||settings.couple?.displayName||settings._event?.name||'Evento activo');
  const eventDate=$('dateLabel')?.value||settings.event?.dateLabel||'Fecha por confirmar';
  const typeLabel=eventTypes.find(type=>type.id===settings._event?.event_type)?.name||'este evento';
  if($('themeContextTitle'))$('themeContextTitle').textContent=`Diseños para ${typeLabel.toLocaleLowerCase('es-MX')}`;
  const normalizedSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX').trim();
  const search=normalizedSearch($('themeSearch')?.value);
  const platformUser=['owner','developer'].includes(currentUser?.role);
  const visibleThemes=themes.filter(theme=>{
    const haystack=normalizedSearch([theme.name,theme.description,theme.layoutLabel,theme.photoStyleLabel,theme.motionLabel,...(theme.tags||[])].join(' '));
    return !search||haystack.includes(search);
  });
  $('themeGrid').innerHTML=visibleThemes.map(theme=>{
    const minimum=theme.minPlan||'starter';
    const locked=theme.allowed===false;
    const planName={express:'Express',starter:'Esencial',basic:'Plus',premium:'Premium'}[minimum]||minimum;
    return `
    <article class="theme-card ${settings.themeId===theme.id?'selected':''} ${locked?'theme-locked':''}">
      <button class="theme-preview ${theme.className} preview-theme-button" data-id="${theme.id}" type="button">
        <span>${theme.preview}</span><strong class="theme-preview-event-name">${esc(eventName)}</strong><small class="theme-preview-event-date">${esc(eventDate)}</small>
      </button>
      <div class="theme-card-body">
        <div class="theme-card-title"><h3>${esc(theme.name)}</h3><span class="theme-plan-badge">${esc(planName)}</span></div>
        <p>${esc(theme.description)}</p>
        <div class="theme-structure-list"><span>${esc(theme.layoutLabel||'Composición clásica')}</span><span>${esc(theme.photoStyleLabel||'Fotos en tarjetas')}</span><span>${esc(theme.motionLabel||'Movimiento sutil')}</span></div>
        <div class="theme-tag-list">${(theme.tags||[]).slice(0,3).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>
        <div class="theme-commerce-actions"><button class="secondary-btn choose-theme" data-id="${theme.id}" ${locked?'disabled':''}>${locked?'Sólo vista previa':(settings.themeId===theme.id?'Plantilla activa':'Aplicar plantilla')}</button>
        ${locked&&!platformUser&&theme.productId?`<button class="primary-btn add-theme-cart" data-product-id="${theme.productId}">Agregar · $${(Number(theme.price_cents||0)/100).toLocaleString('es-MX')}</button>`:''}</div>
      </div>
    </article>`;
  }).join('')||'<div class="catalog-empty"><strong>No encontramos una plantilla con esos filtros.</strong><span>Prueba otro tipo de evento o borra la búsqueda.</span></div>';

  document.querySelectorAll('.preview-theme-button').forEach(button=>{
    button.onclick=()=>openThemePreview(button.dataset.id);
  });

  document.querySelectorAll('.choose-theme').forEach(button=>{
    button.onclick=async()=>{
      const response=await api('/api/admin/settings',{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({themeId:button.dataset.id})
      });
      if(!response.ok)return status('No se pudo aplicar la plantilla.',false);
      settings.themeId=button.dataset.id;
      renderThemes();
      updateThemeLivePreview();
      status('Plantilla aplicada.');
    };
  });
  document.querySelectorAll('.add-theme-cart').forEach(button=>button.onclick=async()=>{
    const response=await api('/api/store/cart/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:Number(button.dataset.productId)})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return status(data.error||'No se pudo agregar la plantilla.',false);
    status('Plantilla agregada al carrito. Puedes continuar desde Plan y extras.');
  });
}
$('themeSearch')?.addEventListener('input',renderThemes);

async function saveLocalization(){
  const defaultLocale=$('defaultLocale')?.value||'es';
  const enabledLocales=[
    $('localeEs')?.checked?'es':'',
    $('localeEn')?.checked?'en':'',
    $('localePt')?.checked?'pt':''
  ].filter(Boolean);
  if(!enabledLocales.includes(defaultLocale))enabledLocales.push(defaultLocale);
  const contentTranslations={};
  document.querySelectorAll('#translationEditor [data-translation-locale][data-translation-path]').forEach(input=>{
    const locale=input.dataset.translationLocale,path=input.dataset.translationPath;
    (contentTranslations[locale]||={})[path]=input.value;
  });
  const localization={defaultLocale,enabledLocales,contentTranslations};
  const response=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({localization})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudieron guardar los idiomas.',false);
  settings.localization=localization;
  fillSettings();
  status('Idiomas de la invitación actualizados.');
}
$('saveLocalizationBtn')?.addEventListener('click',saveLocalization);
$('defaultLocale')?.addEventListener('change',()=>{
  const checkbox={es:'localeEs',en:'localeEn',pt:'localePt'}[$('defaultLocale').value];
  if(checkbox)setChecked(checkbox,true);
  renderTranslationEditor();
});
['localeEs','localeEn','localePt'].forEach(id=>$(id)?.addEventListener('change',renderTranslationEditor));
const TRANSLATABLE_FIELDS=[
  ['event.heroMessage','Mensaje principal'],['event.closingMessage','Mensaje final'],
  ['story.title','Título de historia'],['story.text','Historia'],
  ['dressCode.title','Título de vestimenta'],['dressCode.description','Descripción de vestimenta'],
  ['gifts.title','Título de regalos'],['gifts.message','Mensaje de regalos'],
  ['gifts.description','Descripción de regalos'],['venue.title','Título del lugar'],['venue.notes','Notas del lugar']
];
function renderTranslationEditor(){
  const container=$('translationEditor');if(!container||!settings?.localization)return;
  const defaultLocale=$('defaultLocale')?.value||settings.localization.defaultLocale||'es';
  const enabled=['es','en','pt'].filter(locale=>$({es:'localeEs',en:'localeEn',pt:'localePt'}[locale])?.checked&&locale!==defaultLocale);
  const saved=settings.localization.contentTranslations||{};
  container.innerHTML=enabled.map(locale=>`<details open><summary>${locale==='en'?'English':locale==='pt'?'Português':'Español'}</summary><div class="translation-field-grid">${TRANSLATABLE_FIELDS.map(([path,label])=>`<label>${esc(label)}<textarea data-translation-locale="${locale}" data-translation-path="${esc(path)}">${esc(saved[locale]?.[path]||'')}</textarea></label>`).join('')}</div></details>`).join('')||'<p class="muted">Activa otro idioma para editar sus textos personalizados.</p>';
}
function configureAutomaticTranslation(){
  const enabled=publicCatalog?.capabilities?.automaticTranslation===true;
  const button=$('autoTranslateBtn'),hint=$('translationProviderHint');
  const locale=preferredUiLocale();
  const copy={
    es:{ready:'El proveedor automático está disponible. Revisa siempre los textos generados antes de publicar.',manual:'La traducción manual permanece disponible. La generación automática se habilita al configurar un proveedor seguro en el servidor.',readyTitle:'Generar con el proveedor configurado',missingTitle:'Proveedor automático no configurado'},
    en:{ready:'Automatic translation is available. Always review generated text before publishing.',manual:'Manual translation remains available. Automatic generation is enabled after a secure provider is configured on the server.',readyTitle:'Generate with the configured provider',missingTitle:'Automatic provider not configured'},
    pt:{ready:'A tradução automática está disponível. Revise sempre os textos gerados antes de publicar.',manual:'A tradução manual continua disponível. A geração automática é habilitada após configurar um provedor seguro no servidor.',readyTitle:'Gerar com o provedor configurado',missingTitle:'Provedor automático não configurado'}
  }[locale];
  if(button){button.disabled=!enabled;button.title=enabled?copy.readyTitle:copy.missingTitle;}
  if(hint)hint.textContent=enabled?copy.ready:copy.manual;
}
$('autoTranslateBtn')?.addEventListener('click',async()=>{
  if(publicCatalog?.capabilities?.automaticTranslation!==true)return status('La traducción automática no está configurada. Puedes capturar y guardar cada idioma manualmente.',false);
  const defaultLocale=$('defaultLocale')?.value||'es';
  const enabledLocales=['es','en','pt'].filter(locale=>$({es:'localeEs',en:'localeEn',pt:'localePt'}[locale])?.checked);
  if(enabledLocales.length<2)return status('Activa al menos dos idiomas.',false);
  const response=await api('/api/admin/localization/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({localization:{defaultLocale,enabledLocales,contentTranslations:settings.localization?.contentTranslations||{}}})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudieron generar las traducciones.',false);
  settings.localization=data.localization;fillSettings();status('Traducciones generadas. Revísalas y guárdalas antes de publicar.');
});
function invitationFlowHtml(guest){
  const saveDateSent=guest.delivery_status==='sent'||guest.sent_at||guest.last_delivery_at;
  const rsvpDelivered=saveDateSent||guest.status==='confirmed'||guest.status==='declined';
  const confirmed=guest.status==='confirmed';

  return `<div class="invitation-stage-list">
    <span class="stage-pill ${saveDateSent?'done':''}">Save the Date</span>
    <span class="stage-arrow">›</span>
    <span class="stage-pill ${rsvpDelivered?'active':''}">RSVP</span>
    <span class="stage-arrow">›</span>
    <span class="stage-pill ${confirmed?'done':''}">Confirmación</span>
  </div>`;
}

function renderInvitationFlowSummary(){
  const realGuests=guests.filter(guest=>!guest.is_test);
  const saveDate=realGuests.filter(guest=>guest.delivery_status==='sent'||guest.sent_at||guest.last_delivery_at).length;
  const pending=realGuests.filter(guest=>guest.status==='pending').length;
  const confirmed=realGuests.filter(guest=>guest.status==='confirmed').length;
  const declined=realGuests.filter(guest=>guest.status==='declined').length;

  if($('flowSaveDate'))$('flowSaveDate').textContent=saveDate;
  if($('flowRsvpPending'))$('flowRsvpPending').textContent=pending;
  if($('flowConfirmed'))$('flowConfirmed').textContent=confirmed;
  if($('flowDeclined'))$('flowDeclined').textContent=declined;
}

function guestStatusLabel(statusValue){
  return {pending:'Pendiente',confirmed:'Confirmada',declined:'No asistirá'}[statusValue]||statusValue||'Pendiente';
}
function guestNeedsSummary(guest){
  let accessibility=[];
  try{accessibility=JSON.parse(guest.accessibility_options||'[]');}catch{}
  return [guest.dietary,guest.special_needs,...accessibility,guest.accessibility_other]
    .map(value=>String(value||'').trim()).filter(Boolean).join(' · ');
}

function renderGuests(){
  const q=String($('guestSearch')?.value||'').trim().toLowerCase();
  const statusFilter=String($('guestStatusFilter')?.value||'');
  const visible=guests.filter(g=>
    (!statusFilter||g.status===statusFilter)
    &&[g.family_name,g.phone,g.table_name,g.status].some(v=>String(v||'').toLowerCase().includes(q))
  );

  $('guestRows').innerHTML=visible.map(g=>`<tr class="${g.is_test?'test-row':''}">
    <td class="guest-select-cell"><input class="guest-select" type="checkbox" value="${g.id}" aria-label="Seleccionar ${esc(g.family_name)}"></td>
    <td class="guest-mobile-overview">
      <div class="guest-mobile-title"><strong>${g.is_test?'<span class="test-tag">PRUEBA</span> ':''}${esc(g.family_name)}</strong><span class="status-pill ${g.status}">${esc(guestStatusLabel(g.status))}</span></div>
      <div class="guest-mobile-meta"><span>☎ ${esc(g.phone||'Sin teléfono')}</span><span>⌾ ${esc(g.table_name||'Sin mesa')}</span><span>${Number(g.adults??0)+Number(g.children??0)}/${Number(g.max_adults||0)+Number(g.max_children||0)} lugares</span></div>
      <details class="guest-mobile-details"><summary>Ver seguimiento y detalles</summary>${invitationFlowHtml(g)}<dl><div><dt>Adultos</dt><dd>${g.adults??0}/${g.max_adults}</dd></div><div><dt>Niños</dt><dd>${g.children??0}/${g.max_children}</dd></div><div><dt>Restricciones</dt><dd>${esc(guestNeedsSummary(g)||'Ninguna registrada')}</dd></div></dl></details>
    </td>
    <td class="guest-desktop-cell">${g.is_test?'<span class="test-tag">PRUEBA</span> ':''}${esc(g.family_name)}</td>
    <td class="guest-desktop-cell">${esc(g.phone)}</td>
    <td class="guest-desktop-cell">${esc(g.table_name)}</td>
    <td class="guest-desktop-cell">${invitationFlowHtml(g)}</td>
    <td class="guest-desktop-cell"><span class="status-pill ${g.status}">${esc(guestStatusLabel(g.status))}</span></td>
    <td class="guest-desktop-cell">${g.adults??0}/${g.max_adults}</td>
    <td class="guest-desktop-cell">${g.children??0}/${g.max_children}</td>
    <td class="guest-desktop-cell">${esc(guestNeedsSummary(g))}</td>
    <td class="actions-cell">
      <a class="mini-btn" target="_blank" rel="noopener" href="${esc(g.invitation_url)}">Abrir</a>
      ${g.whatsapp_url&&!g.is_test?`<a class="mini-btn whatsapp" target="_blank" rel="noopener" href="${esc(g.whatsapp_url)}">WhatsApp</a>`:''}
      <button class="mini-btn copy" data-url="${esc(g.invitation_url)}">Copiar enlace</button>
      <button class="mini-btn edit-guest" data-id="${g.id}">Modificar</button>
      <button class="mini-btn delete-guest" data-id="${g.id}" data-name="${esc(g.family_name)}">Eliminar</button>
    </td>
  </tr>`).join('');
  $('guestEmptyState')?.classList.toggle('hidden',visible.length>0);

  document.querySelectorAll('.copy').forEach(button=>{
    button.onclick=async()=>{
      await navigator.clipboard.writeText(button.dataset.url);
      status('Enlace copiado.');
    };
  });
  document.querySelectorAll('.edit-guest').forEach(button=>{
    button.onclick=()=>openGuestEditor(Number(button.dataset.id));
  });
  document.querySelectorAll('.delete-guest').forEach(button=>{
    button.onclick=()=>deleteGuest(Number(button.dataset.id),button.dataset.name);
  });
  document.querySelectorAll('.guest-select').forEach(input=>{
    input.onchange=updateSelectedCount;
  });

  renderInvitationFlowSummary();
  updateSelectedCount();
  enhanceResponsiveTables($('tab-guests'));
}


function openGuestEditor(id){
  const guest=guests.find(item=>item.id===id);
  if(!guest)return status('No se encontró el invitado.',false);
  setValue('editGuestId',guest.id);
  setValue('editGuestCode',guest.code);
  setValue('editGuestFamily',guest.family_name);
  setValue('editGuestPhone',guest.phone);
  setValue('editGuestTable',guest.table_name);
  setValue('editGuestAdults',guest.max_adults);
  setValue('editGuestChildren',guest.max_children);
  setValue('editGuestMessage',guest.custom_message);
  setValue('editGuestNotes',guest.private_notes);
  const dialog=$('guestEditDialog');
  if(dialog?.showModal)dialog.showModal();
}

async function deleteGuest(id,name){
  if(!confirm(`¿Eliminar la invitación de "${name}"? También se eliminará su confirmación asociada.`))return;
  const response=await api(`/api/admin/guests/${id}`,{method:'DELETE'});
  let data={};
  try{data=await response.json();}catch{}
  if(!response.ok)return status(data.error||'No se pudo eliminar la invitación.',false);
  status(`Invitación de ${name} eliminada.`);
  await refreshGuestsAfterMutation();
}

function photoModerationLabel(value){return {pending:'Pendiente',approved:'Aprobada',hidden:'No aprobada / oculta'}[value]||'Pendiente';}
function renderPhotos(){
  const table=$('photoTableFilter')?.value||'',moderation=$('photoStatusFilter')?.value||'';
  photoViewerItems=photos.filter(p=>(!table||p.table_name===table)&&(!moderation||(p.moderation_status||'pending')===moderation));
  if($('photoModerationCounts'))$('photoModerationCounts').innerHTML=[['pending','Pendientes'],['approved','Aprobadas'],['hidden','No aprobadas']].map(([key,label])=>`<span class="status-pill ${key==='approved'?'confirmed':''}">${label}: ${Number(photoCounts[key]||photos.filter(p=>(p.moderation_status||'pending')===key).length)}</span>`).join('');
  if($('downloadPhotosZip')){
    const params=new URLSearchParams({eventId:String(eventId),status:moderation||'approved'});if(table)params.set('table',table);
    $('downloadPhotosZip').href=`/api/admin/photos-export.zip?${params}`;
    $('downloadPhotosZip').textContent=moderation?`Descargar ${photoModerationLabel(moderation).toLowerCase()}`:'Descargar aprobadas';
  }
  $('photoGrid').innerHTML=photoViewerItems.map((p,index)=>`<figure class="photo-card moderation-${esc(p.moderation_status||'pending')}">
    <button class="photo-open" type="button" data-photo-index="${index}" aria-label="Ampliar fotografía de ${esc(p.uploaded_by||'invitado')}"><img src="${p.url}" loading="lazy" decoding="async" alt="Fotografía de ${esc(p.uploaded_by||'invitado')}"></button>
    <figcaption><strong>${esc(p.table_name||'Sin mesa')} · ${esc(p.uploaded_by||'Invitado')}</strong>
      ${p.message?`<p>${esc(p.message)}</p>`:''}<small>Estado: ${esc(photoModerationLabel(p.moderation_status||'pending'))}</small>
      <div class="inline-actions">
        ${p.batch_id&&p.moderation_status!=='approved'?`<button class="mini-btn photo-moderate" data-batch="${p.batch_id}" data-status="approved">Aprobar</button>`:''}
        ${p.batch_id&&p.moderation_status!=='pending'?`<button class="mini-btn photo-moderate" data-batch="${p.batch_id}" data-status="pending">Volver a pendiente</button>`:''}
        ${p.batch_id&&p.moderation_status!=='hidden'?`<button class="mini-btn photo-moderate" data-batch="${p.batch_id}" data-status="hidden">No aprobar</button>`:''}
        <button class="mini-btn photo-delete" data-photo="${p.id}">Eliminar</button>
      </div>
    </figcaption></figure>`).join('')||'<p class="muted">No hay fotografías para estos filtros.</p>';
  document.querySelectorAll('.photo-open').forEach(button=>button.onclick=()=>openAdminPhotoViewer(Number(button.dataset.photoIndex)));
  document.querySelectorAll('.photo-moderate').forEach(button=>button.onclick=async()=>{
    const response=await api(`/api/admin/photo-batches/${button.dataset.batch}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:button.dataset.status})});
    const data=await response.json();status(response.ok?'Moderación actualizada.':data.error,response.ok);if(response.ok)await ensurePhotosLoaded({force:true});
  });
  document.querySelectorAll('.photo-delete').forEach(button=>button.onclick=async()=>{
    if(!confirm('¿Eliminar definitivamente esta fotografía?'))return;
    const response=await api(`/api/admin/photos/${button.dataset.photo}`,{method:'DELETE'});const data=await response.json();status(response.ok?'Fotografía eliminada.':data.error,response.ok);if(response.ok){await ensurePhotosLoaded({force:true});if($('sPhotos'))$('sPhotos').textContent=Math.max(0,Number($('sPhotos').textContent||0)-1);}
  });
}

let photoViewerItems=[],photoViewerIndex=0;
function renderAdminPhotoViewer(){
  const photo=photoViewerItems[photoViewerIndex];if(!photo)return;
  $('adminPhotoViewerImage').src=photo.url;
  $('adminPhotoViewerTitle').textContent=`${photo.table_name||'Sin mesa'} · ${photo.uploaded_by||'Invitado'}`;
  $('adminPhotoViewerMessage').textContent=photo.message||'';
  $('adminPhotoViewerCounter').textContent=`${photoViewerIndex+1} de ${photoViewerItems.length}`;
  $('previousAdminPhoto').disabled=photoViewerItems.length<2;
  $('nextAdminPhoto').disabled=photoViewerItems.length<2;
}
function openAdminPhotoViewer(index){photoViewerIndex=index;renderAdminPhotoViewer();$('adminPhotoViewer')?.showModal();}
function moveAdminPhotoViewer(step){if(!photoViewerItems.length)return;photoViewerIndex=(photoViewerIndex+step+photoViewerItems.length)%photoViewerItems.length;renderAdminPhotoViewer();}
$('closeAdminPhotoViewer')?.addEventListener('click',()=>$('adminPhotoViewer')?.close());
$('previousAdminPhoto')?.addEventListener('click',()=>moveAdminPhotoViewer(-1));
$('nextAdminPhoto')?.addEventListener('click',()=>moveAdminPhotoViewer(1));
$('adminPhotoViewer')?.addEventListener('click',event=>{if(event.target===$('adminPhotoViewer'))$('adminPhotoViewer').close();});
document.addEventListener('keydown',event=>{if(!$('adminPhotoViewer')?.open)return;if(event.key==='ArrowLeft')moveAdminPhotoViewer(-1);if(event.key==='ArrowRight')moveAdminPhotoViewer(1);});
async function qr(t,opt={}){
  const response=await api(`/api/admin/qr?table=${encodeURIComponent(t)}`,opt);
  const data=await readJson(response,'Código QR');
  if($('qrImage'))$('qrImage').src=data.dataUrl;
  if($('qrUrl')){$('qrUrl').textContent=data.url;$('qrUrl').dataset.url=data.url;}
  if($('mockupTable'))$('mockupTable').textContent=t||'QR general';
  updateQrMockup();
}
async function download(url,name){const r=await api(url);if(!r.ok){status('No se pudo descargar.',false);return false;}const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);return true;}
$('loginBtn').onclick=login;$('adminPassword').onkeydown=e=>{if(e.key==='Enter')login();};async function logout(){
  const buttons=[$('logoutBtn'),$('topLogoutBtn')].filter(Boolean);
  buttons.forEach(button=>{button.disabled=true;button.textContent='Cerrando sesión…';});
  try{await api('/api/auth/logout',{method:'POST'});}catch{}
  localStorage.removeItem('authToken');
  localStorage.removeItem('eventId');
  sessionStorage.clear();
  authToken='';currentUser=null;eventId=0;
  /* Evita que el historial/bfcache deje visible la interfaz de desarrollo después
     de cerrar sesión. El servidor seguirá siendo la autoridad de acceso. */
  location.replace(`/admin.html?logout=1&_=${Date.now()}`);
}
$('logoutBtn').onclick=logout;
if($('topLogoutBtn'))$('topLogoutBtn').onclick=logout;
$('eventSelect').onchange=async e=>switchActiveEvent(Number(e.target.value));

function buildEventDateTime(dateValue){
  const date=String(dateValue||'').trim();
  if(!date)return settings.event?.dateTime||'';

  const activeAgenda=(settings.agenda?.items||[]).find(item=>item.enabled&&item.time);
  const time=activeAgenda?.time||'12:00';
  const previous=String(settings.event?.dateTime||'');
  const offsetMatch=previous.match(/([+-]\d{2}:\d{2}|Z)$/);
  const offset=offsetMatch?offsetMatch[1]:'-06:00';
  return `${date}T${time}:00${offset}`;
}

function updateDeveloperModeUi(){
  const development=!!$('developerMode')?.checked;
  if($('modeBadge')){
    $('modeBadge').textContent=development?'Desarrollo':'Producción';
    $('modeBadge').className=`mode-badge ${development?'':'production'}`;
  }
  if($('developerModeFeedback')){
    $('developerModeFeedback').textContent=development
      ?'Modo desarrollo activo: puedes crear pruebas y abrir la invitación con ?preview=1.'
      :'Modo producción activo: los invitados no verán avisos ni controles de prueba.';
  }
  if($('testInviteBtn'))$('testInviteBtn').disabled=!development;
}

async function saveDeveloperModeImmediately(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  updateDeveloperModeUi();

  const developer={
    ...(settings.developer||{}),
    mode:$('developerMode')?.checked?'development':'production',
    showBanner:!!$('showDevBanner')?.checked
  };

  const response=await api('/api/admin/settings',{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({developer})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    status(data.error||'No se pudo cambiar el modo del evento.',false);
    return;
  }
  settings.developer=developer;
  updateDeveloperModeUi();
  status(developer.mode==='development'?'Modo desarrollador activado.':'Modo producción activado.');
}

$('settingsForm').onsubmit=async event=>{
  event.preventDefault();

  const value=id=>$(id)?.value??'';
  const checked=id=>!!$(id)?.checked;
  const platformUser=['owner','developer'].includes(currentUser?.role);

  const body={
    couple:{partner1:value('partner1'),partner2:value('partner2'),displayName:value('displayName')},
    event:{
      dateTime:buildEventDateTime(value('eventDate')),
      dateLabel:value('dateLabel'),
      heroMessage:value('heroMessage'),
      closingMessage:value('closingMessage')
    },
    story:{title:settings.story?.title||'Información del evento',text:value('storyText')},
    dressCode:{title:value('dressTitle'),description:value('dressDescription')},
    menus:{
      serviceMode:value('menuServiceMode')||'fixed',
      selectionEnabled:value('menuServiceMode')==='guest-choice',
      adultOptions:value('adultMenus').split('\n').map(x=>x.trim()).filter(Boolean),
      childOptions:value('childMenus').split('\n').map(x=>x.trim()).filter(Boolean),
      instructions:value('menuInstructions')
    },
    typography:{heading:value('headingFont')||'georgia',body:value('bodyFont')||'system',nameCase:value('nameCaseMode')||'title'},
    accessibility:{
      enabled:true,
      options:value('accessibilityOptions').split('\n').map(x=>x.trim()).filter(Boolean),
      helpText:value('accessibilityHelp')
    },
    rsvp:{enabled:checked('rsvpEnabled'),closeAt:value('rsvpCloseAt')?new Date(value('rsvpCloseAt')).toISOString():'',seatReleaseAt:value('rsvpSeatReleaseAt')?new Date(value('rsvpSeatReleaseAt')).toISOString():'',allowChanges:checked('rsvpAllowChanges'),allowFlexibleComposition:checked('rsvpFlexibleComposition')},
    photoPolicy:{...(settings.photoPolicy||{}),messageMaxLength:Math.max(0,Math.min(2000,Number(value('photoMessageMaxLength')||500)))},
    media:{...(settings.media||{})},
    eventMeta:{eventType:value('eventTypeSelect')||'custom'},
    presentation:{
      ...(settings.presentation||{}),
      heroEyebrow:value('heroEyebrowText'),
      openButton:value('openButtonText'),
      rsvpTitle:value('rsvpTitleText'),
      agendaTitle:value('agendaTitleText'),
      guestLabel:value('guestLabelText'),
      dashboardTitle:value('dashboardTitleText'),
      dashboardDescription:value('dashboardDescriptionText')
    }
  };

  if(platformUser){
    body.developer={mode:checked('developerMode')?'development':'production',showBanner:checked('showDevBanner')};
  }

  const response=await api('/api/admin/settings',{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });

  let data={};
  try{data=await response.json();}catch{}

  if(!response.ok){
    return status(data.error||'No se pudo guardar la configuración.',false);
  }

  settings=data.settings||settings;
  fillSettings();applyDynamicPresentation();renderThemes();renderQrTemplates();renderPhysicalInvitationStudio();
  status('Configuración guardada.');
};

$('saveGiftBtn').onclick=async()=>{
  const clabe=String($('giftBankClabe')?.value||'').replace(/\D/g,'');
  if(clabe&&clabe.length!==18)return status('La CLABE debe contener exactamente 18 dígitos o dejarse vacía.',false);
  const suggestedRaw=String($('giftOpenpaySuggestedAmount')?.value||'').trim();
  const suggestedAmountCents=suggestedRaw===''?null:Math.round(Number(suggestedRaw)*100);
  if(suggestedAmountCents!==null&&(!Number.isFinite(suggestedAmountCents)||suggestedAmountCents<1000||suggestedAmountCents>50000000))return status('El monto sugerido debe estar entre $10 y $500,000 MXN o dejarse vacío.',false);
  const allowCustomAmount=suggestedAmountCents===null?true:$('giftOpenpayAllowCustom')?.checked!==false;
  const cashEnabled=$('giftCashEnabled')?.checked===true;
  const registryEnabled=$('giftRegistryEnabled')?.checked===true;
  const bankEnabled=$('giftBankInfoEnabled')?.checked===true;
  const openpayEnabled=$('giftOpenpayEnabled')?.checked===true;
  const activeLegacy=[cashEnabled?'cash-envelopes':'',registryEnabled?'registry':'',bankEnabled?'bank-transfer':''].filter(Boolean);
  const legacyMode=activeLegacy.length===0?(openpayEnabled?'mixed':'no-gifts'):(activeLegacy.length===1?activeLegacy[0]:'mixed');
  const body={gifts:{
    mode:legacyMode,
    title:$('giftTitle').value,
    message:$('giftMessage').value,
    description:$('giftDescription').value,
    methods:{
      cashEnvelopes:{enabled:cashEnabled,instructions:$('giftCashInstructions')?.value||''},
      registry:{enabled:registryEnabled},
      bankTransfer:{enabled:bankEnabled}
    },
    link:$('giftLink').value,
    linkLabel:$('giftLinkLabel').value,
    bankInfoEnabled:bankEnabled,
    bank:{
      bankName:$('giftBankName')?.value||'',
      accountHolder:$('giftBankHolder')?.value||'',
      clabe,
      accountNumber:$('giftBankAccount')?.value||'',
      referenceConcept:$('giftBankReferenceConcept')?.value||'',
      instructions:$('giftBankInstructions')?.value||'',
      persuasionPresetId:$('giftBankPersuasionPreset')?.value||'',
      persuasionCustomText:$('giftBankPersuasionCustom')?.value||''
    },
    openpay:{enabled:openpayEnabled,suggestedAmountCents,allowCustomAmount,messageEnabled:$('giftOpenpayMessageEnabled')?.checked!==false}
  }};
  const r=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  status(r.ok?'Modalidad de regalos guardada.':(data.error||'No se pudo guardar.'),r.ok);
  if(r.ok){settings=data.settings||settings;fillSettings();renderGiftPresets();updateGiftFields();}
};
$('testInviteBtn').onclick=async()=>{const adults=Number(prompt('Adultos permitidos para la prueba:',2));const children=Number(prompt('Niños permitidos para la prueba:',1));const family=prompt('Nombre que verá la invitación:','Familia de prueba')||'Familia de prueba';const r=await api('/api/admin/developer/test-invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adults,children,family_name:family})}),d=await r.json();if(!r.ok)return status(d.error,false);$('testInviteResult').innerHTML=`<strong>Invitación de prueba lista</strong><div><a class="primary-btn" target="_blank" href="${d.url}">Abrir prueba</a><button class="secondary-btn" id="copyTestUrl">Copiar enlace</button></div>`;$('testInviteResult').classList.remove('hidden');$('copyTestUrl').onclick=async()=>{await navigator.clipboard.writeText(d.url);status('Enlace de prueba copiado.');};};

function mediaUploadKey(){
  if(globalThis.crypto?.randomUUID)return `media:${eventId}:${crypto.randomUUID()}`;
  if(globalThis.crypto?.getRandomValues){const bytes=new Uint32Array(4);crypto.getRandomValues(bytes);return `media:${eventId}:${[...bytes].map(value=>value.toString(16)).join('')}`;}
  return `media:${eventId}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2,14)}`;
}
function waitForOnline(){
  if(navigator.onLine!==false)return Promise.resolve();
  status('Sin conexión. La transferencia continuará al recuperar la red.');
  return new Promise(resolve=>window.addEventListener('online',resolve,{once:true}));
}
function uploadFormDataOnce(endpoint,formData,{label,uploadKey}){
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();let settled=false,stallTimer=0;
    const clearStall=()=>{if(stallTimer){clearTimeout(stallTimer);stallTimer=0;}};
    const armStall=()=>{
      clearStall();
      /* Un teléfono puede mantener la conexión nominalmente abierta aunque deje
         de enviar bytes. Si pasan 45 s sin progreso, abortamos esa petición y
         dejamos que el mismo uploadKey se reintente de forma idempotente. */
      stallTimer=setTimeout(()=>{
        if(settled)return;settled=true;
        try{xhr.abort();}catch{}
        reject(Object.assign(new Error('La transferencia dejó de avanzar. EventStudio volverá a intentarla.'),{network:true,stalled:true}));
      },45000);
    };
    xhr.open('POST',endpoint,true);xhr.responseType='json';xhr.withCredentials=true;
    xhr.setRequestHeader('x-event-id',String(eventId||''));xhr.setRequestHeader('x-upload-key',uploadKey);if(authToken)xhr.setRequestHeader('Authorization',`Bearer ${authToken}`);
    xhr.upload.onloadstart=armStall;
    xhr.upload.onprogress=event=>{armStall();if(event.lengthComputable)status(`${label}: ${Math.max(1,Math.round(event.loaded/event.total*100))}%`);};
    xhr.onload=()=>{if(settled)return;settled=true;clearStall();const data=xhr.response&&typeof xhr.response==='object'?xhr.response:{};resolve({ok:xhr.status>=200&&xhr.status<300,status:xhr.status,data});};
    xhr.onerror=()=>{if(settled)return;settled=true;clearStall();reject(Object.assign(new Error('La conexión se interrumpió durante la transferencia.'),{network:true}));};
    xhr.onabort=()=>{if(settled)return;settled=true;clearStall();reject(Object.assign(new Error('La transferencia fue cancelada antes de terminar.'),{aborted:true}));};
    xhr.send(formData);
  });
}

async function optimizeAdminImageForUpload(file){
  const supported=new Set(['image/jpeg','image/png','image/webp']);
  if(!file||!supported.has(file.type)||file.size<2.5*1024*1024)return file;
  let bitmap=null,url='';
  try{
    if('createImageBitmap' in window)bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
    else{
      url=URL.createObjectURL(file);
      bitmap=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});
    }
    const width=Number(bitmap.width||bitmap.naturalWidth||0),height=Number(bitmap.height||bitmap.naturalHeight||0);
    if(!width||!height)return file;
    const maxSide=3000,scale=Math.min(1,maxSide/Math.max(width,height));
    if(scale===1&&file.size<4*1024*1024)return file;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return file;
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.90));
    if(!blob||blob.size>=file.size*.94)return file;
    const base=String(file.name||'imagen').replace(/\.[^.]+$/,'');
    return new File([blob],`${base}.webp`,{type:'image/webp',lastModified:file.lastModified||Date.now()});
  }catch{return file;}
  finally{try{bitmap?.close?.();}catch{}if(url)URL.revokeObjectURL(url);}
}
async function prepareAdminImages(files){
  const output=[];
  for(let index=0;index<files.length;index++){
    status(`Preparando imagen ${index+1} de ${files.length}…`);
    output.push(await optimizeAdminImageForUpload(files[index]));
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return output;
}
async function uploadFormData(endpoint,formData,{label='Archivo'}={}){
  const uploadKey=mediaUploadKey();
  const retryableStatuses=new Set([408,425,429,499,502,503,504]);
  for(let attempt=1;attempt<=3;attempt++){
    await waitForOnline();
    try{
      const result=await uploadFormDataOnce(endpoint,formData,{label,uploadKey});
      if(result.ok||!retryableStatuses.has(result.status)||attempt===3)return result;
      status(`${label}: conexión inestable, reintentando (${attempt}/3)…`);
    }catch(error){
      if(error.aborted||attempt===3)throw error;
      status(`${label}: transferencia interrumpida, reintentando (${attempt}/3)…`);
    }
    await new Promise(resolve=>setTimeout(resolve,700*attempt));
  }
  throw new Error('No fue posible completar la transferencia.');
}

function single(form,input,endpoint){
  $(form).onsubmit=async e=>{
    e.preventDefault();const f=$(input).files[0];if(!f)return status('Selecciona un archivo.',false);
    const button=e.submitter||e.target.querySelector('button[type="submit"],button');if(button)button.disabled=true;
    try{
      const prepared=f.type?.startsWith('image/')?await optimizeAdminImageForUpload(f):f;
      const d=new FormData();d.append('file',prepared);
      if(prepared!==f)status(`Imagen optimizada: ${Math.max(1,Math.round((1-prepared.size/f.size)*100))}% menos datos.`);
      const result=await uploadFormData(endpoint,d,{label:prepared.name||f.name||'Archivo'});const data=result.data||{};
      if(!result.ok)return status(data.error||`No se pudo cargar el archivo (${result.status}).`,false);
      e.target.reset();
      if(form==='heroForm'){settings.media={...(settings.media||{}),heroImage:data.url};forgetMissingMediaUrl(data.url);renderHeroMediaPreview();renderMediaHealth();}
      if(form==='musicForm'){settings.media={...(settings.media||{}),music:data.url,musicSource:'upload'};forgetMissingMediaUrl(data.url);setSelectedMusicSource('upload');renderMusicStudio();await saveMusicSelection();}
      status('Archivo cargado.');
    }catch(error){status(error.message||'La transferencia se interrumpió.',false);}
    finally{if(button)button.disabled=false;}
  };
}
single('heroForm','heroFile','/api/admin/media/hero');
single('musicForm','musicFile','/api/admin/media/music');
function multi(form,input,endpoint,field){
  $(form).onsubmit=async e=>{
    e.preventDefault();const files=[...$(input).files];if(!files.length)return status('Selecciona al menos una imagen.',false);
    const button=e.submitter||e.target.querySelector('button[type="submit"],button');if(button)button.disabled=true;
    try{
      const preparedFiles=await prepareAdminImages(files);
      const d=new FormData();preparedFiles.forEach(f=>d.append(field,f));
      const originalBytes=files.reduce((sum,file)=>sum+file.size,0),preparedBytes=preparedFiles.reduce((sum,file)=>sum+file.size,0);
      const saved=originalBytes>preparedBytes?Math.round((1-preparedBytes/originalBytes)*100):0;
      if(saved)status(`${files.length} imagen(es) optimizadas: ${saved}% menos datos. Subiendo…`);
      const result=await uploadFormData(endpoint,d,{label:`${files.length} imagen(es)`});const data=result.data||{};
      if(!result.ok)return status(data.error||`No se pudieron cargar las imágenes (${result.status}).`,false);
      e.target.reset();
      if(form==='galleryForm'){settings.media={...(settings.media||{}),gallery:data.gallery||settings.media?.gallery||[]};renderMedia('settingsGallery',settings.media.gallery,'gallery');}
      if(form==='dressForm'){settings.dressCode={...(settings.dressCode||{}),referenceImages:data.referenceImages||settings.dressCode?.referenceImages||[]};renderMedia('dressSettingsGallery',settings.dressCode.referenceImages,'dress');}
      status('Imágenes agregadas.');
    }catch(error){status(error.message||'La transferencia se interrumpió.',false);}
    finally{if(button)button.disabled=false;}
  };
}
multi('galleryForm','galleryFiles','/api/admin/media/gallery','files');
multi('dressForm','dressFiles','/api/admin/media/dress','files');


$('closeGuestEditBtn')?.addEventListener('click',()=>{
  $('guestEditDialog')?.close();
});

$('guestEditForm')?.addEventListener('submit',async event=>{
  event.preventDefault();

  const id=Number($('editGuestId').value);
  const body={
    code:$('editGuestCode').value,
    family_name:$('editGuestFamily').value,
    phone:$('editGuestPhone').value,
    table_name:$('editGuestTable').value,
    max_adults:Number($('editGuestAdults').value),
    max_children:Number($('editGuestChildren').value),
    custom_message:$('editGuestMessage').value,
    private_notes:$('editGuestNotes').value
  };

  const response=await api(`/api/admin/guests/${id}`,{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });

  let data={};
  try{data=await response.json();}catch{}

  if(!response.ok){
    return status(data.error||'No se pudo modificar el invitado.',false);
  }

  $('guestEditDialog')?.close();
  status('Invitación modificada.');
  await refreshGuestsAfterMutation();
});

$('guestForm').onsubmit=async event=>{
  event.preventDefault();
  const body={code:$('gCode').value,family_name:$('gFamily').value,phone:$('gPhone').value,table_name:$('gTable').value,max_adults:Number($('gAdults').value),max_children:Number($('gChildren').value),custom_message:$('gMessage').value};
  const response=await api('/api/admin/guests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  status(response.ok?(data.generatedCode?`Invitación guardada con código ${data.code}.`:'Invitación guardada.'):(data.error||'No se pudo guardar.'),response.ok);
  if(response.ok){event.target.reset();setValue('gAdults',2);setValue('gChildren',0);await refreshGuestsAfterMutation();}
};
$('importForm').onsubmit=async event=>{
  event.preventDefault();
  const file=$('excelFile').files[0];
  if(!file)return status('Selecciona un archivo Excel o CSV.',false);
  const formData=new FormData();formData.append('file',file);
  const response=await api('/api/admin/import',{method:'POST',body:formData});
  const data=await response.json().catch(()=>({}));
  const errors=Array.isArray(data.errors)?data.errors:[];
  const warnings=errors.length?` · ${errors.length} error(es): ${errors.slice(0,3).map(item=>`fila ${item.row}: ${item.message}`).join(' | ')}`:'';
  status(response.ok?`Insertados: ${data.inserted||0} · Actualizados: ${data.updated||0} · Códigos generados: ${data.generatedCodes||0} · Omitidos: ${data.skipped||0}${warnings}`:(data.error||'No se pudo importar.'),response.ok);
  if(response.ok)await refreshGuestsAfterMutation();
};
$('guestSearch').oninput=renderGuests;$('guestStatusFilter')?.addEventListener('change',renderGuests);$('photoTableFilter').onchange=renderPhotos;$('photoStatusFilter')?.addEventListener('change',renderPhotos);$('generateQrBtn').onclick=()=>qr($('tableSelect').value);
document.querySelectorAll('[data-guest-jump]').forEach(button=>button.addEventListener('click',()=>{
  $(button.dataset.guestJump)?.scrollIntoView({behavior:'smooth',block:'start'});
}));
$('tableSelect').addEventListener('change',()=>{qr($('tableSelect').value);updateQrMockup();});
$('saveQrDesignBtn').onclick=saveQrDesign;
['qrDesignTitle','qrDesignMessage','qrDesignInstruction'].forEach(id=>$(id)?.addEventListener('input',updateQrMockup));
$('downloadQrBtn').onclick=()=>download(`/api/admin/qr.png?table=${encodeURIComponent($('tableSelect').value)}`,'qr-limpio.png');
$('downloadQrCardBtn').onclick=()=>{
  const template=settings.qrDesign?.templateId||'classic-holder';
  const table=$('tableSelect').value;
  download(`/api/admin/qr-card.pdf?table=${encodeURIComponent(table)}&template=${encodeURIComponent(template)}`,`tarjeta-${table||'general'}.pdf`);
};
$('downloadQrSetBtn').onclick=()=>{
  const template=settings.qrDesign?.templateId||'classic-holder';
  download(`/api/admin/qr-set.pdf?template=${encodeURIComponent(template)}`,`set-qr-${template}.pdf`);
};
$('openQrDestinationBtn')?.addEventListener('click',()=>{const url=$('qrUrl')?.dataset.url;if(!url)return status('Primero genera el QR.',false);window.open(url,'_blank','noopener');});
$('templateBtn').onclick=()=>download('/api/admin/template.xlsx','plantilla_invitados_vacia.xlsx');
$('exportGuestsBtn')?.addEventListener('click',()=>download('/api/admin/guests.xlsx',`invitados-${settings._event?.slug||'evento'}.xlsx`));
$('venueReportBtn').onclick=()=>download('/api/admin/venue-report.xlsx','resumen_operativo_del_evento.xlsx');

function floorKey(kind,item){
  if(!item._key)item._key=`${kind}-${item.id||`new-${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  return item._key;
}
function floorItems(){
  if(!seatingState)return [];
  return [
    ...(seatingState.zones||[]).map(item=>({kind:'zone',item})),
    ...(seatingState.tables||[]).map(item=>({kind:'table',item}))
  ];
}
const LAYOUT_GEOMETRY_EPSILON=.25;
const floorNumber=value=>Math.round(Number(value)*100)/100;
function floorItemLabel(record){
  return record.kind==='table'?(record.item.name||'Mesa'):(record.item.label||'Área');
}
function markSeatingLayoutDirty(){
  seatingLayoutDirty=true;
  seatingSaveStatus('Tienes cambios sin guardar. Guárdalos antes de exportar el PDF.','saving');
}
function overlapPairs(){
  const items=floorItems();
  const pairs=[];
  for(let left=0;left<items.length;left++)for(let right=left+1;right<items.length;right++){
    const a=items[left].item,b=items[right].item;
    const overlapX=Math.min(Number(a.x)+Number(a.width),Number(b.x)+Number(b.width))-Math.max(Number(a.x),Number(b.x));
    const overlapY=Math.min(Number(a.y)+Number(a.height),Number(b.y)+Number(b.height))-Math.max(Number(a.y),Number(b.y));
    const overlap=overlapX>LAYOUT_GEOMETRY_EPSILON&&overlapY>LAYOUT_GEOMETRY_EPSILON;
    if(overlap)pairs.push([items[left],items[right]]);
  }
  return pairs;
}
function renderSeatingWarnings(){
  if(!seatingState)return;
  const warnings=[];
  const overlaps=overlapPairs();
  if(overlaps.length){
    const [left,right]=overlaps[0];
    warnings.push(`${overlaps.length} cruce${overlaps.length===1?'':'s'}: ${floorItemLabel(left)} con ${floorItemLabel(right)}`);
  }
  if(seatingState.summary?.unassigned)warnings.push(`${seatingState.summary.unassigned} persona${seatingState.summary.unassigned===1?'':'s'} sin mesa`);
  const full=(seatingState.tables||[]).filter(table=>table.occupied>table.capacity);
  if(full.length)warnings.push(`${full.length} mesa${full.length===1?'':'s'} con sobrecupo`);
  const node=$('seatingWarnings');
  if(node){
    node.textContent=warnings.length?`Atención: ${warnings.join(' · ')}`:'Plano sin cruces, sobrecupo ni personas pendientes de asignar.';
    node.classList.toggle('clear',!warnings.length);
  }
}
function updateSeatingStats(){
  if(!seatingState)return;
  if($('seatingPeopleCount'))$('seatingPeopleCount').textContent=seatingState.summary.people;
  if($('seatingAssignedCount'))$('seatingAssignedCount').textContent=seatingState.summary.assigned;
  if($('seatingUnassignedCount'))$('seatingUnassignedCount').textContent=seatingState.summary.unassigned;
  if($('seatingCapacityCount'))$('seatingCapacityCount').textContent=seatingState.summary.capacity;
  if($('seatingAvailableCount'))$('seatingAvailableCount').textContent=seatingState.summary.availableSeats??Math.max(0,seatingState.summary.capacity-seatingState.summary.assigned);
}
function seatDots(table){
  const count=Math.min(Number(table.capacity)||0,16);
  return Array.from({length:count},(_,index)=>{
    const angle=(Math.PI*2*index)/Math.max(1,count)-Math.PI/2;
    const x=50+Math.cos(angle)*48;
    const y=50+Math.sin(angle)*48;
    const occupied=index<Number(table.occupied||0);
    return `<i class="seat-dot ${occupied?'occupied':''}" style="left:${x}%;top:${y}%"></i>`;
  }).join('');
}
function renderSeatingCanvas(){
  const canvas=$('seatingCanvas');
  if(!canvas||!seatingState)return;
  floorItems().forEach(({kind,item})=>floorKey(kind,item));
  const overlaps=new Set(overlapPairs().flat().map(({kind,item})=>floorKey(kind,item)));
  canvas.innerHTML=`
    <div class="canvas-stage-label">SALÓN · arrastra para mover</div>
    ${(seatingState.zones||[]).map(zone=>`<button type="button" class="floor-item floor-zone zone-${esc(zone.type)} zone-shape-${esc(zone.shape||'rect')} ${selectedFloorItem===zone?'selected':''} ${overlaps.has(floorKey('zone',zone))?'overlap':''}" data-kind="zone" data-key="${floorKey('zone',zone)}" style="left:${zone.x}%;top:${zone.y}%;width:${zone.width}%;height:${zone.height}%;transform:rotate(${Number(zone.rotation||0)}deg)"><span>${esc(zone.label)}</span></button>`).join('')}
    ${(seatingState.tables||[]).map(table=>{const familyText=(table.families||[]).slice(0,2).join(' · ');const extra=Math.max(0,(table.families||[]).length-2);return `<button type="button" class="floor-item floor-table ${table.shape==='round'?'round':'rect'} ${selectedFloorItem===table?'selected':''} ${overlaps.has(floorKey('table',table))?'overlap':''} ${table.occupied>=table.capacity?'full':''}" data-kind="table" data-key="${floorKey('table',table)}" style="left:${table.x}%;top:${table.y}%;width:${table.width}%;height:${table.height}%;transform:rotate(${Number(table.rotation||0)}deg)">${seatDots(table)}<strong>${esc(table.name)}</strong><small>${table.occupied} / ${table.capacity} · ${table.available??Math.max(0,table.capacity-table.occupied)} libres</small>${familyText?`<em>${esc(familyText)}${extra?` +${extra}`:''}</em>`:''}</button>`}).join('')}
  `;
  canvas.querySelectorAll('.floor-item').forEach(node=>{
    const record=floorItems().find(({kind,item})=>kind===node.dataset.kind&&floorKey(kind,item)===node.dataset.key);
    if(!record)return;
    node.addEventListener('click',()=>selectFloorItem(record.item,record.kind));
    node.addEventListener('pointerdown',event=>startFloorDrag(event,node,record.item,record.kind));
  });
  renderSeatingWarnings();
}
function startFloorDrag(event,node,item,kind){
  if(event.button!==0)return;
  event.preventDefault();
  selectFloorItem(item,kind,false);
  const canvas=$('seatingCanvas');
  const box=canvas.getBoundingClientRect();
  const start={clientX:event.clientX,clientY:event.clientY,x:Number(item.x),y:Number(item.y)};
  node.setPointerCapture(event.pointerId);
  const move=moveEvent=>{
    item.x=Math.max(0,Math.min(100-Number(item.width),start.x+(moveEvent.clientX-start.clientX)/box.width*100));
    item.y=Math.max(0,Math.min(100-Number(item.height),start.y+(moveEvent.clientY-start.clientY)/box.height*100));
    node.style.left=`${item.x}%`;node.style.top=`${item.y}%`;
  };
  const end=()=>{node.removeEventListener('pointermove',move);markSeatingLayoutDirty();renderSeatingCanvas();};
  node.addEventListener('pointermove',move);
  node.addEventListener('pointerup',end,{once:true});
  node.addEventListener('pointercancel',end,{once:true});
}
function selectFloorItem(item,kind,rerender=true){
  selectedFloorItem=item;
  item._kind=kind;
  $('floorInspectorEmpty')?.classList.add('hidden');
  $('floorInspectorFields')?.classList.remove('hidden');
  setValue('floorItemName',kind==='table'?item.name:item.label);
  setValue('floorItemShape',item.shape||'rect');
  setValue('floorZoneType',item.type||'other');
  setValue('floorZoneShape',item.shape||'rect');
  setValue('floorItemCapacity',item.capacity||10);
  setValue('floorItemOrder',(kind==='table'?(seatingState.tables||[]):(seatingState.zones||[])).indexOf(item)+1);
  setValue('floorItemWidth',Math.round(Number(item.width)));
  setValue('floorItemHeight',Math.round(Number(item.height)));
  $('floorItemShapeLabel')?.classList.toggle('hidden',kind!=='table');
  $('floorItemCapacityLabel')?.classList.toggle('hidden',kind!=='table');
  $('floorZoneTypeLabel')?.classList.toggle('hidden',kind!=='zone');
  $('floorZoneShapeLabel')?.classList.toggle('hidden',kind!=='zone');
  if(rerender)renderSeatingCanvas();
}
function updateSelectedFloorItem(){
  if(!selectedFloorItem)return;
  if(selectedFloorItem._kind==='table'){
    selectedFloorItem.name=$('floorItemName').value.trim()||selectedFloorItem.name;
    selectedFloorItem.shape=$('floorItemShape').value;
    selectedFloorItem.capacity=Math.max(1,Math.min(30,Number($('floorItemCapacity').value)||1));
  }else{
    selectedFloorItem.label=$('floorItemName').value.trim()||selectedFloorItem.label;
    selectedFloorItem.type=$('floorZoneType')?.value||'other';
    selectedFloorItem.shape=$('floorZoneShape')?.value||'rect';
  }
  selectedFloorItem.width=Math.max(6,Math.min(70,Number($('floorItemWidth').value)||6));
  selectedFloorItem.height=Math.max(6,Math.min(70,Number($('floorItemHeight').value)||6));
  const list=selectedFloorItem._kind==='table'?seatingState.tables:seatingState.zones;
  const current=list.indexOf(selectedFloorItem);
  const desired=Math.max(0,Math.min(list.length-1,(Number($('floorItemOrder').value)||1)-1));
  if(current!==desired){list.splice(current,1);list.splice(desired,0,selectedFloorItem);}
  markSeatingLayoutDirty();
  renderSeatingCanvas();renderSeatingPeople();
}
['floorItemName','floorItemShape','floorItemCapacity','floorItemOrder','floorItemWidth','floorItemHeight','floorZoneType','floorZoneShape'].forEach(id=>$(id)?.addEventListener('change',updateSelectedFloorItem));
function addFloorTable(shape){
  if(!seatingState)return;
  const number=(seatingState.tables||[]).length+1;
  const table={id:0,name:`Mesa ${number}`,shape,capacity:shape==='round'?10:8,x:8+(number%5)*16,y:8+(number%3)*23,width:shape==='round'?14:22,height:shape==='round'?18:13,rotation:0,occupied:0};
  seatingState.tables.push(table);markSeatingLayoutDirty();selectFloorItem(table,'table');
}
$('addRoundTableBtn')?.addEventListener('click',()=>addFloorTable('round'));
$('addRectTableBtn')?.addEventListener('click',()=>addFloorTable('rect'));
$('addDanceFloorBtn')?.addEventListener('click',()=>{
  if(!seatingState)return;
  const zone={id:0,type:'dance_floor',shape:'rect',label:(seatingState.zones||[]).some(item=>item.type==='dance_floor')?'Área especial':'Pista de baile',x:35,y:35,width:30,height:25,rotation:0};
  seatingState.zones.push(zone);markSeatingLayoutDirty();selectFloorItem(zone,'zone');
});
$('applyUniformTablesBtn')?.addEventListener('click',()=>{
  if(!seatingState?.tables?.length)return;
  const width=Math.max(6,Math.min(70,Number($('uniformTableWidth')?.value)||14));
  const height=Math.max(6,Math.min(70,Number($('uniformTableHeight')?.value)||18));
  const shape=$('uniformTableShape')?.value||'keep';
  seatingState.tables.forEach(table=>{table.width=width;table.height=height;if(shape!=='keep')table.shape=shape;});
  markSeatingLayoutDirty();
  renderSeatingCanvas();status('Medida uniforme aplicada. Ajusta posiciones si aparece algún cruce y guarda el plano.');
});
$('deleteFloorItemBtn')?.addEventListener('click',()=>{
  if(!selectedFloorItem||!seatingState)return;
  const isTable=selectedFloorItem._kind==='table';
  if(isTable&&Number(selectedFloorItem.occupied||0)>0&&!confirm('Esta mesa tiene personas asignadas. Al guardar se quedarán sin mesa. ¿Continuar?'))return;
  const list=isTable?seatingState.tables:seatingState.zones;
  list.splice(list.indexOf(selectedFloorItem),1);selectedFloorItem=null;
  markSeatingLayoutDirty();
  $('floorInspectorEmpty')?.classList.remove('hidden');$('floorInspectorFields')?.classList.add('hidden');
  renderSeatingCanvas();renderSeatingPeople();
});
$('autoArrangeTablesBtn')?.addEventListener('click',()=>{
  if(!seatingState)return;
  let floor=seatingState.zones.find(zone=>zone.type==='dance_floor');
  if(floor)Object.assign(floor,{x:34,y:34,width:32,height:28,rotation:0});
  const positions=[[4,5],[25,4],[61,4],[82,5],[4,70],[25,76],[61,76],[82,70],[4,37],[82,37],[45,4],[45,78]];
  seatingState.tables.forEach((table,index)=>{
    const pos=positions[index]||[4+(index%5)*20,4+Math.floor(index/5)*24];
    table.x=Math.min(94-table.width,pos[0]);table.y=Math.min(94-table.height,pos[1]);
  });
  markSeatingLayoutDirty();
  renderSeatingCanvas();status('Mesas ordenadas alrededor de la pista. Revisa el plano y guárdalo.');
});
function renderSeatingPeople(){
  const list=$('seatingPeopleList');
  if(!list||!seatingState)return;
  const query=String($('seatingPeopleSearch')?.value||'').trim().toLocaleLowerCase('es-MX');
  const people=(seatingState.people||[]).filter(person=>!query||`${person.name} ${person.family}`.toLocaleLowerCase('es-MX').includes(query));
  list.innerHTML=people.length?people.map(person=>{
    const tableId=person.assignment?.tableId||'';
    const attendanceLabel=person.status==='confirmed'?'Confirmado':(person.status==='declined'?'No asistirá · reservado en el plan':'Pendiente');
    const releaseAction=person.releaseEligible&&person.assignment?`<button class="mini-btn release-seat-btn" data-guest="${person.guestId}" data-person="${esc(person.personKey)}" type="button">Liberar lugar</button>`:'';
    const releaseBadge=person.releaseEligible?`<em class="release-seat-badge">${person.releaseReason==='declined'?'No asistirá · lugar reutilizable':'Pendiente fuera de tolerancia · revisar'}</em>`:'';
    return `<article class="seating-person ${person.status} ${person.releaseEligible?'release-eligible':''}"><div><strong>${esc(person.name)}</strong><small>${esc(person.family)} · ${person.type==='child'?'Niño':'Adulto'} · ${attendanceLabel}</small>${releaseBadge}</div><div class="seat-person-actions"><select class="person-table-select" data-guest="${person.guestId}" data-person="${esc(person.personKey)}"><option value="">Sin mesa</option>${(seatingState.tables||[]).map(table=>`<option value="${table.id}" ${table.id===tableId?'selected':''} ${!table.id||table.occupied>=table.capacity&&table.id!==tableId?'disabled':''}>${esc(table.name)} · ${table.id?`${table.occupied}/${table.capacity}`:'guarda el plano primero'}</option>`).join('')}</select>${releaseAction}</div></article>`;
  }).join(''):'<p class="muted">No hay personas que coincidan con esta vista.</p>';
  list.querySelectorAll('.release-seat-btn').forEach(button=>button.addEventListener('click',async()=>{
    if(!confirm('¿Liberar este lugar? El RSVP y el historial del invitado se conservan; EventStudio no asignará a otra persona automáticamente.'))return;
    const response=await api('/api/admin/seating/assignment',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({guestId:Number(button.dataset.guest),personKey:button.dataset.person,tableId:null})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return status(data.error||'No se pudo liberar el lugar.',false);
    await loadSeating();status('Lugar liberado. Tú decides si lo reasignas a otra persona.');
  }));
  list.querySelectorAll('.person-table-select').forEach(select=>select.addEventListener('change',async()=>{
    select.disabled=true;
    try{
      const response=await api('/api/admin/seating/assignment',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({guestId:Number(select.dataset.guest),personKey:select.dataset.person,tableId:select.value?Number(select.value):null})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'No se pudo asignar el asiento.');
      await loadSeating();status(select.value?'Asiento asignado.':'Persona marcada sin mesa.');
    }catch(error){status(error.message,false);await loadSeating();}
  }));
}
$('seatingPeopleSearch')?.addEventListener('input',renderSeatingPeople);
async function loadSeating(){
  if(!eventId)return;
  const mode=$('seatingMode')?.value||'planned';
  try{
    const response=await api(`/api/admin/seating?mode=${encodeURIComponent(mode)}`);
    seatingState=await readJson(response,'Plano de mesas');selectedFloorItem=null;
    seatingLayoutDirty=false;seatingSaveStatus('');
    $('floorInspectorEmpty')?.classList.remove('hidden');$('floorInspectorFields')?.classList.add('hidden');
    updateSeatingStats();
    renderSeatingCanvas();renderSeatingPeople();
    if($('downloadSeatingPdfBtn'))$('downloadSeatingPdfBtn').textContent=mode==='confirmed'?'Exportar PDF confirmado':'Exportar PDF planeado';
  }catch(error){status(error.message,false);}
}
$('seatingMode')?.addEventListener('change',loadSeating);
function seatingSaveStatus(message,type='error'){
  const node=$('seatingSaveStatus');
  if(!node)return;
  node.textContent=message||'';
  node.className=`seating-save-status${message?' visible':''}${type==='ok'?' ok':type==='saving'?' saving':''}`;
}
function seatingLayoutPayload(){
  const clean=item=>({
    ...item,
    x:floorNumber(item.x),y:floorNumber(item.y),
    width:floorNumber(item.width),height:floorNumber(item.height),
    rotation:floorNumber(item.rotation||0),
    _key:undefined,_kind:undefined,families:undefined,occupied:undefined,available:undefined
  });
  return {mode:$('seatingMode').value,tables:(seatingState.tables||[]).map(clean),zones:(seatingState.zones||[]).map(clean)};
}
$('saveSeatingLayoutBtn')?.addEventListener('click',async()=>{
  if(!seatingState)return;
  updateSelectedFloorItem();
  const overlaps=overlapPairs();
  if(overlaps.length){
    const [left,right]=overlaps[0];
    const message=`No se guardó: ${floorItemLabel(left)} se cruza con ${floorItemLabel(right)}. Sepáralos un poco y vuelve a intentar.`;
    seatingSaveStatus(message);status(message,false);return;
  }
  const button=$('saveSeatingLayoutBtn');
  button.disabled=true;seatingSaveStatus('Guardando las medidas y posiciones del plano…','saving');
  try{
    const response=await api('/api/admin/seating/layout',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(seatingLayoutPayload())});
    seatingState=await readJson(response,'Guardar plano');
    seatingLayoutDirty=false;
    selectedFloorItem=null;
    $('floorInspectorEmpty')?.classList.remove('hidden');$('floorInspectorFields')?.classList.add('hidden');
    updateSeatingStats();
    renderSeatingCanvas();renderSeatingPeople();
    const options=seatingState.tables.map(table=>`<option value="${esc(table.name)}">${esc(table.name)}</option>`).join('');
    if($('tableSelect'))$('tableSelect').innerHTML=`<option value="">QR general</option>${options}`;
    if($('photoTableFilter'))$('photoTableFilter').innerHTML=`<option value="">Todas las mesas</option>${options}`;
    seatingSaveStatus('Plano guardado. Las medidas y posiciones ya quedaron registradas para este evento.','ok');
    status('Plano, orden y capacidades guardados para este evento.');
  }catch(error){
    const message=`No se guardó el plano: ${error.message}`;
    seatingSaveStatus(message);status(message,false);
  }finally{button.disabled=false;}
});
$('downloadSeatingPdfBtn')?.addEventListener('click',async()=>{
  if(!seatingState)return;
  if(seatingLayoutDirty){
    const message='Guarda primero los cambios del plano para que el PDF coincida exactamente con lo que ves.';
    seatingSaveStatus(message);status(message,false);return;
  }
  const mode=$('seatingMode')?.value==='confirmed'?'confirmed':'planned';
  const modeLabel=mode==='confirmed'?'confirmado':'planeado';
  seatingSaveStatus(`Preparando el PDF ${modeLabel}…`,'saving');
  const ok=await download(`/api/admin/seating/layout.pdf?mode=${mode}`,`plano-mesas-${modeLabel}.pdf`);
  seatingSaveStatus(ok?`PDF ${modeLabel} descargado con el plano y la distribución por mesa.`:'No se pudo generar el PDF del plano.',ok?'ok':'error');
});

function selectedGuestIds(){return [...document.querySelectorAll('.guest-select:checked')].map(x=>Number(x.value));}
function updateSelectedCount(){if($('selectedCount'))$('selectedCount').textContent=`${selectedGuestIds().length} seleccionados`;}
document.addEventListener('change',e=>{if(e.target.classList.contains('guest-select'))updateSelectedCount();});
$('selectAllGuests')?.addEventListener('change',e=>{document.querySelectorAll('.guest-select').forEach(x=>x.checked=e.target.checked);updateSelectedCount();});
$('sendPendingBtn')?.addEventListener('click',()=>{document.querySelectorAll('.guest-select').forEach(x=>{const g=guests.find(y=>y.id===Number(x.value));x.checked=g?.status==='pending';});updateSelectedCount();});
$('sendSelectedBtn')?.addEventListener('click',async()=>{
  const ids=selectedGuestIds();if(!ids.length)return status('Selecciona al menos un invitado.',false);
  const r=await api(`/api/admin/guests/whatsapp-batch?ids=${ids.join(',')}`);
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return status(data.error||'No se pudo preparar la cola de WhatsApp.',false);
  const queue=Array.isArray(data)?data:[];
  const box=$('whatsappQueue');box.classList.remove('hidden');
  box.innerHTML=`<h3>Cola de envío por WhatsApp</h3><p class="muted">Por seguridad, WhatsApp requiere confirmar cada envío. Abre uno, envíalo y continúa con el siguiente.</p>
    <div id="queueRows">${queue.map((x,i)=>`<div class="queue-row"><span>${i+1}. ${esc(x.family)}</span>${x.url?`<a class="mini-btn whatsapp queue-open" data-id="${x.id}" href="${x.url}" target="_blank">Abrir WhatsApp</a>`:'<span class="error">Sin teléfono</span>'}</div>`).join('')}</div>
    <button id="markQueueSent" class="secondary-btn">Marcar seleccionados como enviados</button>`;
  $('markQueueSent').onclick=async()=>{const mr=await api('/api/admin/guests/mark-sent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});if(mr.ok){status('Invitaciones marcadas como enviadas.');await refreshGuestsAfterMutation();}};
});


let spotifyController=null;
let spotifyIframeApi=null;
let selectedSpotifyTrack=null;
let spotifyIframePromise=null;
let spotifyControllerGeneration=0;

function loadSpotifyIframeApi(){
  if(spotifyIframeApi)return Promise.resolve(spotifyIframeApi);
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
      spotifyIframeApi=api;
      if(settled){
        spotifyIframePromise=Promise.resolve(api);
        renderSpotifyController();
        return;
      }
      finish(resolve,api);
    };
    const script=document.createElement('script');
    script.id='spotifyIframeApiScript';
    script.src='https://open.spotify.com/embed/iframe-api/v1';
    script.async=true;
    script.onerror=()=>finish(reject,new Error('Spotify no respondió.'));
    document.head.appendChild(script);
    timeout=setTimeout(()=>finish(reject,new Error('Spotify tardó demasiado en responder.')),12000);
  });
  return spotifyIframePromise;
}

function retrySpotifyIframeApi(){
  document.getElementById('spotifyIframeApiScript')?.remove();
  spotifyIframePromise=null;
  spotifyIframeApi=null;
  renderSpotifyController();
}

function formatSeconds(value){
  const seconds=Math.max(0,Math.floor(Number(value)||0));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}

function selectedMusicSource(){
  return document.querySelector('input[name="musicSource"]:checked')?.value||'none';
}

function setSelectedMusicSource(source){
  const radio=document.querySelector(`input[name="musicSource"][value="${source||'none'}"]`);
  if(radio)radio.checked=true;
  document.querySelectorAll('.music-source-panel').forEach(panel=>panel.classList.add('hidden'));
  if(source==='upload')$('musicUploadPanel')?.classList.remove('hidden');
  if(source==='spotify')$('spotifyMusicPanel')?.classList.remove('hidden');
  updateMusicStatus();
}

function updateMusicStatus(){
  const source=selectedMusicSource();
  if(!$('musicSelectionStatus'))return;
  if(source==='upload'){
    $('musicSelectionStatus').textContent=settings.media?.music
      ?`Archivo seleccionado · inicia en ${formatSeconds($('uploadStartSeconds')?.value)}`
      :'Selecciona y sube un archivo de audio.';
  }else if(source==='spotify'){
    const name=selectedSpotifyTrack?.name||settings.media?.spotifyTrackName;
    const start=formatSeconds($('spotifyStartSeconds')?.value||0);
    $('musicSelectionStatus').textContent=name
      ?`Spotify: ${name} · inicia en ${start}`
      :(spotifyEntity($('spotifyUrl')?.value)?'Enlace de Spotify listo para guardar.':'Pega un enlace de Spotify.');
  }else{
    $('musicSelectionStatus').textContent='La invitación se publicará sin música.';
  }
}

function renderUploadedMusicPreview(){
  const container=$('musicPreview');
  if(!container)return;
  const url=settings.media?.music;
  if(!url){
    container.innerHTML='<p class="muted">Todavía no hay un archivo de audio subido.</p>';
    $('deleteUploadedMusicBtn')?.classList.add('hidden');
    return;
  }
  if(isMissingMediaUrl(url)){
    container.innerHTML='<div class="missing-media-placeholder"><strong>Audio no disponible</strong><small>La referencia existe en la base, pero el archivo no está en uploads/site-media.</small></div>';
    $('deleteUploadedMusicBtn')?.classList.remove('hidden');
    return;
  }
  container.innerHTML=`<audio id="uploadedMusicPreviewAudio" controls preload="metadata" src="${esc(url)}"></audio>`;
  $('deleteUploadedMusicBtn')?.classList.remove('hidden');
  const audio=$('uploadedMusicPreviewAudio');
  audio?.addEventListener('loadedmetadata',()=>{
    const max=Math.max(1,Math.floor(audio.duration||300)-1);
    $('uploadStartSeconds').max=String(max);
  });
}

function spotifyEntity(url){
  const match=String(url||'').match(/open\.spotify\.com\/(track|playlist|album)\/([A-Za-z0-9]+)/);
  return match?{type:match[1],id:match[2],uri:`spotify:${match[1]}:${match[2]}`} : null;
}

function spotifyEmbedUrl(url){
  const entity=spotifyEntity(url);
  return entity?`https://open.spotify.com/embed/${entity.type}/${entity.id}?utm_source=generator`:'';
}

function spotifyFallbackMarkup(url){
  return `<iframe title="Reproductor de Spotify" style="border-radius:16px" src="${spotifyEmbedUrl(url)}" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager"></iframe>
    <a class="spotify-open-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir en Spotify</a>`;
}

function syncSpotifyStartEditor(durationMs=0){
  const editor=$('spotifyStartEditor');
  const input=$('spotifyStartSeconds');
  const entity=spotifyEntity($('spotifyUrl')?.value||settings.media?.spotifyUrl||'');
  if(!editor||!input)return;
  const supportsStart=entity?.type==='track';
  editor.classList.toggle('hidden',!supportsStart);
  if(!supportsStart){
    input.value='0';
    $('spotifyStartLabel').textContent='00:00';
    return;
  }
  const knownDuration=Math.max(Number(durationMs||selectedSpotifyTrack?.durationMs||settings.media?.spotifyDurationMs||0),0);
  const saved=Math.max(0,Number(input.value||settings.media?.spotifyStartSeconds||0));
  input.max=String(knownDuration>0?Math.max(1,Math.floor(knownDuration/1000)-1):Math.max(600,saved+60));
  input.value=String(Math.min(saved,Number(input.max)));
  $('spotifyStartLabel').textContent=formatSeconds(input.value);
}

function renderSpotifySelected(){
  const card=$('spotifySelectedTrack');
  if(!card)return;
  const name=selectedSpotifyTrack?.name||settings.media?.spotifyTrackName||'';
  const artists=selectedSpotifyTrack?.artists||settings.media?.spotifyArtists||'';
  if(!name){
    card.classList.add('hidden');
    card.innerHTML='';
    return;
  }
  card.classList.remove('hidden');
  card.innerHTML=`
    ${selectedSpotifyTrack?.image?`<img src="${esc(selectedSpotifyTrack.image)}" alt="">`:''}
    <div><strong>${esc(name)}</strong><span>${esc(artists)}</span></div>`;
}

function renderSpotifyController(){
  const container=$('spotifyPreview');
  if(!container)return;
  const url=$('spotifyUrl')?.value||settings.media?.spotifyUrl||'';
  const entity=spotifyEntity(url);
  if(!entity){
    container.innerHTML='<p class="muted">Pega o selecciona un enlace válido de Spotify.</p>';
    $('spotifyConnectionStatus').textContent='';
    $('spotifyStartEditor')?.classList.add('hidden');
    spotifyController=null;
    return;
  }
  const generation=++spotifyControllerGeneration;
  spotifyController?.destroy?.();
  spotifyController=null;
  syncSpotifyStartEditor();
  container.innerHTML=spotifyFallbackMarkup(url);
  $('spotifyConnectionStatus').textContent='Conectando con los controles oficiales de Spotify…';

  loadSpotifyIframeApi().then(api=>{
    if(generation!==spotifyControllerGeneration)return;
    container.innerHTML='<div id="spotifyControllerTarget"></div>';
    api.createController(
      $('spotifyControllerTarget'),
      {uri:entity.uri,width:'100%',height:152},
      controller=>{
        if(generation!==spotifyControllerGeneration){controller.destroy?.();return;}
        spotifyController=controller;
        const start=entity.type==='track'?Number($('spotifyStartSeconds')?.value||0):0;
        controller.addListener?.('ready',()=>{
          $('spotifyConnectionStatus').textContent=start
            ?`Spotify listo. La canción comenzará desde ${formatSeconds(start)} al reproducir.`
            :'Spotify listo.';
        });
        controller.addListener?.('playback_update',event=>{
          if(event?.data?.duration)syncSpotifyStartEditor(event.data.duration);
        });
        controller.loadEntity?.(entity.uri,false,start);
      }
    );
  }).catch(error=>{
    if(generation!==spotifyControllerGeneration)return;
    container.innerHTML=spotifyFallbackMarkup(url);
    $('spotifyConnectionStatus').innerHTML=`${esc(error.message)} Se dejó el reproductor básico y el enlace directo. <button id="retrySpotifyBtn" class="link-btn" type="button">Reintentar</button>`;
    $('retrySpotifyBtn')?.addEventListener('click',retrySpotifyIframeApi);
  });
}

function renderMusicStudio(){
  const source=settings.media?.musicSource
    ||(settings.media?.spotifyUrl?'spotify':settings.media?.music?'upload':'none');
  setSelectedMusicSource(source);
  setValue('spotifyUrl',settings.media?.spotifyUrl||'');
  setValue('uploadStartSeconds',Number(settings.media?.musicStartSeconds||0));
  setValue('spotifyStartSeconds',Number(settings.media?.spotifyStartSeconds||0));
  $('uploadStartLabel').textContent=formatSeconds($('uploadStartSeconds')?.value);
  $('spotifyStartLabel').textContent=formatSeconds($('spotifyStartSeconds')?.value);

  selectedSpotifyTrack=settings.media?.spotifyTrackName?{
    name:settings.media.spotifyTrackName,
    artists:settings.media.spotifyArtists||'',
    url:settings.media.spotifyUrl||'',
    uri:settings.media.spotifyUri||'',
    durationMs:Number(settings.media.spotifyDurationMs||0)
  }:null;

  $('deleteSpotifyMusicBtn')?.classList.toggle('hidden',!settings.media?.spotifyUrl);
  renderUploadedMusicPreview();
  renderSpotifySelected();
  syncSpotifyStartEditor();
  renderSpotifyController();
  updateMusicStatus();
}

async function saveMusicSelection(){
  const source=selectedMusicSource();
  if(source==='upload'&&!settings.media?.music){
    return status('Primero sube un archivo de música.',false);
  }
  if(source==='spotify'&&!spotifyEntity($('spotifyUrl')?.value)){
    return status('Selecciona o pega un enlace válido de Spotify.',false);
  }

  const media={
    ...(settings.media||{}),
    musicSource:source,
    musicStartSeconds:Number($('uploadStartSeconds')?.value||0),
    spotifyUrl:$('spotifyUrl')?.value.trim()||'',
    spotifyUri:spotifyEntity($('spotifyUrl')?.value)?.uri||'',
    spotifyTrackName:selectedSpotifyTrack?.name||(
      spotifyEntity($('spotifyUrl')?.value)?.uri===settings.media?.spotifyUri
        ?settings.media?.spotifyTrackName||''
        :''
    ),
    spotifyArtists:selectedSpotifyTrack?.artists||(
      spotifyEntity($('spotifyUrl')?.value)?.uri===settings.media?.spotifyUri
        ?settings.media?.spotifyArtists||''
        :''
    ),
    spotifyDurationMs:Number(selectedSpotifyTrack?.durationMs||(
      spotifyEntity($('spotifyUrl')?.value)?.uri===settings.media?.spotifyUri
        ?settings.media?.spotifyDurationMs||0
        :0
    )),
    spotifyStartSeconds:Number($('spotifyStartSeconds')?.value||0)
  };

  const response=await api('/api/admin/settings',{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({media})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo guardar la música.',false);
  settings.media=data.settings?.media||media;
  renderMusicStudio();
  status('Selección de música guardada.');
}

document.querySelectorAll('input[name="musicSource"]').forEach(radio=>{
  radio.addEventListener('change',()=>setSelectedMusicSource(radio.value));
});
$('previewSpotifyLinkBtn')?.addEventListener('click',()=>{
  selectedSpotifyTrack=null;
  setValue('spotifyStartSeconds',0);
  syncSpotifyStartEditor();
  renderSpotifySelected();
  renderSpotifyController();
  updateMusicStatus();
});
$('spotifyUrl')?.addEventListener('change',()=>{
  selectedSpotifyTrack=null;
  setValue('spotifyStartSeconds',0);
  syncSpotifyStartEditor();
  renderSpotifySelected();
  renderSpotifyController();
  updateMusicStatus();
});
$('uploadStartSeconds')?.addEventListener('input',event=>{
  $('uploadStartLabel').textContent=formatSeconds(event.target.value);
  updateMusicStatus();
});
$('spotifyStartSeconds')?.addEventListener('input',event=>{
  $('spotifyStartLabel').textContent=formatSeconds(event.target.value);
  updateMusicStatus();
});
$('previewSpotifyFromStartBtn')?.addEventListener('click',()=>{
  const entity=spotifyEntity($('spotifyUrl')?.value);
  if(entity?.type!=='track')return status('El punto de inicio se aplica a enlaces de canciones.',false);
  if(!spotifyController)return status('Spotify todavía no está listo. Revisa la conexión o pulsa Reintentar.',false);
  const start=Number($('spotifyStartSeconds')?.value||0);
  try{
    /* El clic ya es un gesto del usuario: mover el reproductor cargado evita la
       carrera loadEntity→play que antes obligaba a pulsar Play por separado. */
    spotifyController.seek?.(start);
    spotifyController.play?.();
    $('spotifyConnectionStatus').textContent=`Reproduciendo desde ${formatSeconds(start)}.`;
    status(`Spotify inició desde ${formatSeconds(start)}.`);
  }catch{
    spotifyController.loadEntity?.(entity.uri,false,start);
    queueMicrotask(()=>spotifyController?.play?.());
    status(`Iniciando Spotify desde ${formatSeconds(start)}.`);
  }
});
$('previewUploadFromStartBtn')?.addEventListener('click',()=>{
  const audio=$('uploadedMusicPreviewAudio');
  if(!audio)return status('Primero sube un archivo.',false);
  audio.currentTime=Number($('uploadStartSeconds').value||0);
  audio.play().catch(()=>{});
});
$('saveMusicSelectionBtn')?.addEventListener('click',saveMusicSelection);

async function deleteMusicSource(source){
  const label=source==='upload'?'el archivo cargado':'el enlace de Spotify';
  if(!confirm(`¿Eliminar ${label}?`))return;
  const response=await api('/api/admin/media/music',{
    method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({source})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo eliminar la música.',false);
  settings.media=data.media;
  selectedSpotifyTrack=null;
  renderMusicStudio();
  loadStorageUsage();
  status(source==='upload'?'Archivo de música eliminado.':'Enlace de Spotify eliminado.');
}
$('deleteUploadedMusicBtn')?.addEventListener('click',()=>deleteMusicSource('upload'));
$('deleteSpotifyMusicBtn')?.addEventListener('click',()=>deleteMusicSource('spotify'));

const fontCss={georgia:'Georgia,serif',baskerville:'Baskerville,serif',garamond:'Garamond,serif',didot:'Didot,serif',system:'Inter,system-ui,sans-serif',humanist:'Trebuchet MS,sans-serif',classic:'Palatino Linotype,serif','great-vibes':'Great Vibes,Georgia,cursive',cormorant:'Cormorant Garamond,Georgia,serif',playfair:'Playfair Display,Georgia,serif',cinzel:'Cinzel,Georgia,serif',lora:'Lora,Georgia,serif',montserrat:'Montserrat,Inter,sans-serif'};
function titleCaseName(value){
  const minorWords=new Set(['y','e','de','del','la','las','los','familia']);
  let wordIndex=0;
  return String(value||'').trim().toLocaleLowerCase('es-MX').split(/([\s-]+)/).map(part=>{
    if(!part||/^[\s-]+$/.test(part))return part;
    const current=wordIndex++;if(['xv','xxv'].includes(part))return part.toLocaleUpperCase('es-MX');if(current>0&&minorWords.has(part))return part;
    return part.replace(/^\p{L}/u,letter=>letter.toLocaleUpperCase('es-MX'));
  }).join('');
}
function presentedName(value,mode=$('nameCaseMode')?.value||settings.typography?.nameCase||'title'){
  if(mode==='uppercase')return String(value||'').toLocaleUpperCase('es-MX');
  if(mode==='title'||mode==='small-caps')return titleCaseName(value);
  return String(value||'');
}
function updateFontPreviews(){
  const heading=$('headingFontPreview');
  const body=$('bodyFontPreview');
  if(heading){
    heading.style.fontFamily=fontCss[$('headingFont')?.value]||fontCss.georgia;
    heading.textContent=presentedName($('displayName')?.value||settings.couple?.displayName||settings._event?.name||'Evento activo');
  }
  if(body){
    body.style.fontFamily=fontCss[$('bodyFont')?.value]||fontCss.system;
    body.textContent=$('heroMessage')?.value||settings.event?.heroMessage||settings.story?.text||'Mensaje del evento activo';
  }
  document.querySelectorAll('.theme-preview-event-name').forEach(node=>node.textContent=presentedName($('displayName')?.value||settings.couple?.displayName||settings._event?.name||'Evento activo'));
  document.querySelectorAll('.theme-preview-event-date').forEach(node=>node.textContent=$('dateLabel')?.value||settings.event?.dateLabel||'Fecha por confirmar');
  updateThemeLivePreview();
  updateQrMockup();
  renderPhysicalInvitationStudio();
  const rawName=$('displayName')?.value||settings.couple?.displayName||'';
  const scriptFont=$('headingFont')?.value==='great-vibes';
  const uppercase=$('nameCaseMode')?.value==='uppercase';
  const warning=$('typographyWarning');
  if(warning){
    const message=scriptFont&&uppercase?'La caligrafía pierde legibilidad en mayúsculas. Recomendamos “Tipo título”.':scriptFont&&rawName.length>38?'El nombre es largo para una fuente caligráfica; la invitación reducirá el tamaño automáticamente.':'';
    warning.textContent=message;warning.classList.toggle('hidden',!message);
  }
}
$('headingFont')?.addEventListener('change',updateFontPreviews);$('bodyFont')?.addEventListener('change',updateFontPreviews);$('nameCaseMode')?.addEventListener('change',updateFontPreviews);
function currentDesignKitPayload(enabled=$('designKitEnabled')?.checked){
  const palette={};
  ['bg','paper','ink','muted','accent','gold','line'].forEach(key=>palette[key]=$(`designKit${key[0].toUpperCase()}${key.slice(1)}`)?.value||'');
  return {enabled:Boolean(enabled),palette,texture:$('designKitTexture')?.value||'none'};
}
$('saveDesignKitBtn')?.addEventListener('click',async()=>{
  const designKit=currentDesignKitPayload();
  const response=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({designKit})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo guardar el kit de diseño.',false);
  settings=data.settings||{...settings,designKit};status('Kit de diseño aplicado a los activos compatibles.');
  updateThemeLivePreview();updateQrMockup();renderPhysicalInvitationStudio();
});
$('resetDesignKitBtn')?.addEventListener('click',async()=>{
  setChecked('designKitEnabled',false);
  const response=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({designKit:{enabled:false,palette:{},texture:'none'}})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo restaurar la paleta de la plantilla.',false);
  settings=data.settings||settings;fillSettings();applyDynamicPresentation();renderThemes();renderQrTemplates();renderPhysicalInvitationStudio();status('La plantilla vuelve a controlar la paleta.');
});
$('saveTypographyBtn')?.addEventListener('click',async()=>{
  const typography={
    heading:$('headingFont')?.value||'georgia',
    body:$('bodyFont')?.value||'system',
    nameCase:$('nameCaseMode')?.value||'title'
  };
  const response=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({typography})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo guardar la tipografía.',false);
  settings.typography=typography;
  updateFontPreviews();
  status('Tipografía y uso de mayúsculas guardados.');
});
async function loadUsers(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  const requests=[api('/api/admin/users')];
  if(!ownerPlans.length)requests.push(api('/api/admin/plans'));
  const responses=await Promise.all(requests);
  if(!responses[0].ok)return;
  ownerUsers=await responses[0].json();
  if(responses[1]?.ok)ownerPlans=await responses[1].json();
  $('uEvents').innerHTML=events.map(event=>`<option value="${event.id}">${esc(event.name)}</option>`).join('');
  const planSelect=$('uPlan');
  if(planSelect){
    const previous=planSelect.value||'trial';
    planSelect.innerHTML=ownerPlans.map(plan=>`<option value="${esc(plan.code)}">${esc(plan.name)}${plan.code==='trial'?' · prueba':' · cortesía'}</option>`).join('');
    planSelect.value=ownerPlans.some(plan=>plan.code===previous)?previous:(ownerPlans.some(plan=>plan.code==='trial')?'trial':ownerPlans[0]?.code||'');
  }
  syncNewUserRoleFields();
  renderUsers();
}
function renderUsers(){
  const query=String($('userSearch')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const role=$('userRoleFilter')?.value||'',active=$('userActiveFilter')?.value||'';
  const visible=ownerUsers.filter(user=>{
    const haystack=`${user.display_name} ${user.email||''} ${user.phone||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return (!query||haystack.includes(query))&&(!role||user.role===role)&&(!active||(active==='active')===Boolean(user.active));
  });
  $('userRows').innerHTML=visible.map(user=>`<tr>
    <td>${esc(user.display_name)}</td>
    <td>${esc(user.email||user.phone||'')}</td>
    <td>${esc(user.role)}</td>
    <td>${user.active?'Activo':'Inactivo'}${user.must_change_password?' · Debe cambiar contraseña':''}</td>
    <td>
      ${user.role!=='owner'?`<button class="mini-btn edit-user" data-id="${user.id}">Editar</button><button class="mini-btn reset-user-password" data-id="${user.id}" data-name="${esc(user.display_name)}">Contraseña temporal</button>${user.active?`<button class="mini-btn deactivate-user" data-id="${user.id}" data-name="${esc(user.display_name)}">Desactivar</button>`:`<button class="mini-btn reactivate-user" data-id="${user.id}" data-name="${esc(user.display_name)}">Reactivar</button>`}
      <button class="mini-btn delete-user" data-id="${user.id}" data-name="${esc(user.display_name)}">Eliminar definitivamente</button>`:''}
    </td>
  </tr>`).join('')||'<tr><td colspan="5" class="muted">No hay usuarios que coincidan con los filtros.</td></tr>';

  document.querySelectorAll('.edit-user').forEach(button=>button.onclick=()=>openUserEditor(Number(button.dataset.id)));
  document.querySelectorAll('.deactivate-user').forEach(button=>button.onclick=()=>removeUser(button,'deactivate'));
  document.querySelectorAll('.reactivate-user').forEach(button=>button.onclick=()=>reactivateUser(button));
  document.querySelectorAll('.delete-user').forEach(button=>button.onclick=()=>removeUser(button,'permanent'));
  document.querySelectorAll('.reset-user-password').forEach(button=>button.onclick=()=>resetUserPassword(button));
  enhanceResponsiveTables($('tab-users'));
}
$('userSearch')?.addEventListener('input',renderUsers);
$('userRoleFilter')?.addEventListener('change',renderUsers);
$('userActiveFilter')?.addEventListener('change',renderUsers);

function openUserEditor(userId){
  const user=ownerUsers.find(item=>item.id===userId);if(!user)return;
  $('editUserId').value=String(user.id);
  $('editUserName').value=user.display_name||'';
  $('editUserEmail').value=user.email||'';
  $('editUserRole').value=user.role||'client';
  const assigned=new Set(user.event_ids||[]);
  $('editUserEvents').innerHTML=events.map(event=>`<option value="${event.id}" ${assigned.has(event.id)?'selected':''}>${esc(event.name)}</option>`).join('');
  showDialog($('userEditDialog'));
}
$('closeUserEditBtn')?.addEventListener('click',()=>$('userEditDialog')?.close());
$('userEditForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const userId=Number($('editUserId').value);
  const eventIds=[...$('editUserEvents').selectedOptions].map(option=>Number(option.value));
  const response=await api(`/api/admin/users/${userId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:$('editUserName').value,email:$('editUserEmail').value,role:$('editUserRole').value,eventIds})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo editar la cuenta.',false);
  $('userEditDialog')?.close();status('Cuenta actualizada sin modificar su plan.');await loadUsers();await loadPlatformEvents();
});

async function reactivateUser(button){
  if(!confirm(`¿Reactivar la cuenta de "${button.dataset.name}"? Conservará sus eventos y su plan actual.`))return;
  const response=await api(`/api/admin/users/${button.dataset.id}/reactivate`,{method:'POST'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo reactivar la cuenta.',false);
  status('Cuenta reactivada. Las sesiones anteriores permanecen cerradas.');
  await loadUsers();await loadPlatformEvents();
}

async function resetUserPassword(button){
  const temporaryPassword=prompt(`Escribe una contraseña temporal de al menos 12 caracteres para ${button.dataset.name}.`);
  if(!temporaryPassword)return;
  const response=await api(`/api/admin/users/${button.dataset.id}/reset-password`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({temporaryPassword})});
  const data=await response.json().catch(()=>({}));
  status(response.ok?'Contraseña temporal guardada; las sesiones anteriores fueron cerradas.':(data.error||'No se pudo restablecer la contraseña.'),response.ok);
  if(response.ok)await loadUsers();
}

async function removeUser(button,mode){
  const name=button.dataset.name;
  const message=mode==='permanent'
    ? `¿Eliminar definitivamente a "${name}" y los eventos que le pertenezcan? Esta acción libera archivos y no se puede deshacer.`
    : `¿Desactivar la cuenta de "${name}"?`;
  if(!confirm(message))return;
  const response=await api(`/api/admin/users/${button.dataset.id}?mode=${mode}`,{method:'DELETE'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo actualizar el usuario.',false);
  status(mode==='permanent'?'Usuario eliminado definitivamente.':'Usuario desactivado.');
  await loadUsers();
  await loadPlatformEvents();
}

async function loadPlatformEvents(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  try{
    const [response,clientsResponse]=await Promise.all([api('/api/admin/platform-events'),api('/api/admin/clients')]);
    const rows=await readJson(response,'Eventos alojados');
    ownerClients=await readJson(clientsResponse,'Clientes disponibles');
    if(!$('platformEventRows'))return;

    $('platformEventRows').innerHTML=rows.length
      ?rows.map(event=>`<tr>
        <td><strong>${esc(event.name)}</strong><br><small>${esc(event.slug)}</small></td>
        <td>${esc(event.owner_name||event.owner_email||'Sin cliente asignado')}</td>
        <td>${esc(event.event_type||'custom')}</td>
        <td>${event.guest_count||0}</td>
        <td>${event.photo_count||0}</td>
        <td><span class="status-pill ${event.archived?'declined':'confirmed'}">${event.archived?'Archivado':esc(event.cleanup_status||'Activo')}</span></td>
        <td>
          ${event.archived
            ?`<button class="mini-btn restore-event" data-id="${event.id}">Restaurar</button>`
            :`<button class="mini-btn archive-event" data-id="${event.id}" data-name="${esc(event.name)}">Archivar</button>`}
          <button class="mini-btn publication-event" data-id="${event.id}" data-published="${event.published?1:0}">${event.published?'Despublicar':'Publicar'}</button>
          <button class="mini-btn delete-event" data-id="${event.id}" data-name="${esc(event.name)}" data-protected="${event.protected?1:0}">Eliminar definitivamente</button>
          <div class="ownership-action"><select class="transfer-client" data-id="${event.id}"><option value="">Pasar control a…</option>${ownerClients.filter(client=>client.active).map(client=>`<option value="${client.id}" ${client.id===event.owner_user_id?'selected':''}>${esc(client.display_name)}</option>`).join('')}</select><button class="mini-btn transfer-event" data-id="${event.id}" data-name="${esc(event.name)}">Transferir</button></div>
        </td>
      </tr>`).join('')
      :'<tr><td colspan="7" class="muted">Todavía no hay eventos alojados.</td></tr>';

    document.querySelectorAll('.archive-event').forEach(button=>button.onclick=()=>archiveEvent(button));
    document.querySelectorAll('.restore-event').forEach(button=>button.onclick=()=>restoreEvent(button));
    document.querySelectorAll('.publication-event').forEach(button=>button.onclick=()=>setEventPublication(button));
    document.querySelectorAll('.delete-event').forEach(button=>button.onclick=()=>deleteEventPermanent(button));
    document.querySelectorAll('.transfer-event').forEach(button=>button.onclick=()=>transferEvent(button));
    enhanceResponsiveTables($('tab-owner'));
  }catch(error){
    console.error(error);
    if($('platformEventRows')){
      $('platformEventRows').innerHTML=`<tr><td colspan="7" class="error">${esc(error.message||'No se pudieron cargar los eventos.')}</td></tr>`;
    }
    status(error.message||'No se pudieron cargar los eventos alojados.',false);
  }
}

async function transferEvent(button){
  const select=document.querySelector(`.transfer-client[data-id="${button.dataset.id}"]`);
  const clientId=Number(select?.value);
  if(!clientId)return status('Selecciona la cuenta cliente que recibirá el evento.',false);
  const client=ownerClients.find(item=>item.id===clientId);
  if(!confirm(`¿Transferir “${button.dataset.name}” a ${client?.display_name||'este cliente'}? Tú conservarás acceso de soporte como propietario.`))return;
  const response=await api(`/api/admin/events/${button.dataset.id}/transfer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo transferir el evento.',false);
  status(data.subscriptionUsable?`Control transferido. Se aplicará el plan ${data.plan}.`:'Control transferido. Asigna un plan al cliente antes de publicar la operación comercial.',data.subscriptionUsable);
  events=await(await api('/api/admin/events')).json();renderEvents();await loadPlatformEvents();await loadOwnerDashboard();
}

async function setEventPublication(button){
  const headers={'Content-Type':'application/json','x-event-id':button.dataset.id};
  if(authToken)headers.Authorization=`Bearer ${authToken}`;
  const response=await fetch(`/api/admin/events/${button.dataset.id}/publication`,{method:'PATCH',credentials:'same-origin',headers,body:JSON.stringify({published:button.dataset.published!=='1'})});
  const data=await response.json().catch(()=>({}));
  status(response.ok?(data.published?'Evento publicado.':'Evento retirado de publicación.'):(data.error||'No se pudo cambiar la publicación.'),response.ok);
  if(response.ok)await loadPlatformEvents();
}

async function archiveEvent(button){
  if(!confirm(`¿Archivar "${button.dataset.name}"? Tendrá 15 días de tolerancia antes de liberar sus archivos.`))return;
  const response=await api(`/api/admin/events/${button.dataset.id}?mode=archive&graceDays=15`,{method:'DELETE'});
  if(!response.ok)return status('No se pudo archivar el evento.',false);
  status('Evento archivado con periodo de tolerancia.');
  const archivedId=Number(button.dataset.id);
  if(archivedId===eventId)await switchActiveEvent(0,{refresh:true});
  else{await refreshEvents(eventId);await loadPlatformEvents();}
}

async function restoreEvent(button){
  const response=await api(`/api/admin/events/${button.dataset.id}/restore`,{method:'POST'});
  if(!response.ok)return status('No se pudo restaurar el evento.',false);
  status('Evento restaurado.');
  await refreshEvents(eventId);
  await loadPlatformEvents();
}

async function deleteEventPermanent(button){
  if(!confirm(`¿Eliminar definitivamente "${button.dataset.name}"? Se borrarán invitados, confirmaciones y archivos. Esta acción no se puede deshacer.`))return;
  let confirmName='';
  if(button.dataset.protected==='1'){
    confirmName=prompt('Evento protegido: escribe el nombre exacto. También debe existir un respaldo completo.')||'';
    if(!confirmName)return;
  }
  const response=await api(`/api/admin/events/${button.dataset.id}?mode=permanent`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmName})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo eliminar el evento.',false);
  const deletedId=Number(button.dataset.id);
  const previousActiveId=eventId;
  await refreshEvents(deletedId===previousActiveId?0:previousActiveId);
  await loadPlatformEvents();
  await load();
  status('Evento y archivos eliminados definitivamente.');
}

function syncNewUserRoleFields(){
  const isClient=$('uRole')?.value==='client';
  $('uPlanField')?.classList.toggle('hidden',!isClient);
  if($('uPlan'))$('uPlan').required=isClient;
}
$('uRole')?.addEventListener('change',syncNewUserRoleFields);
$('userForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const eventIds=[...$('uEvents').selectedOptions].map(o=>Number(o.value));
  const payload={displayName:$('uName').value,email:$('uEmail').value,password:$('uPassword').value,role:$('uRole').value,eventIds};
  if(payload.role==='client')payload.planCode=$('uPlan')?.value||'trial';
  const r=await api('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({}));
  status(r.ok?(d.plan?`Usuario creado con ${d.plan.name}. Deberá cambiar la contraseña temporal al entrar.`:'Usuario creado. Deberá cambiar la contraseña temporal al entrar.'):(d.error||'No se pudo crear el usuario.'),r.ok);
  if(r.ok){e.target.reset();syncNewUserRoleFields();await loadUsers();await loadOwnerDashboard();}
});


function togglePassword(inputId,button){const input=$(inputId);if(!input)return;input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'Ver':'Ocultar';}
$('toggleLoginPassword')?.addEventListener('click',e=>togglePassword('adminPassword',e.currentTarget));
$('toggleRegisterPassword')?.addEventListener('click',e=>togglePassword('registerPassword',e.currentTarget));
function openRegisterForm(){
  $('registerForm')?.classList.remove('hidden');
  $('showRegisterBtn')?.classList.add('hidden');
  $('registerEventType')?.focus({preventScroll:true});
}
$('showRegisterBtn')?.addEventListener('click',openRegisterForm);
$('cancelRegisterBtn')?.addEventListener('click',()=>{$('registerForm').classList.add('hidden');$('showRegisterBtn').classList.remove('hidden');});

function renderRegisterPlans(){
  const plans=publicCatalog?.plans||[];
  const selected=$('registerPlan')?.value||'basic';
  const grid=$('registerPlanCards');
  if(!grid)return;
  grid.innerHTML=plans.map(plan=>`
    <button class="register-plan-card ${plan.code===selected?'selected':''}" type="button" data-register-plan="${esc(plan.code)}">
      ${plan.featured?'<span class="register-plan-popular">Más elegido</span>':''}
      <strong>${esc(plan.name)}</strong>
      <b>$${(Number(plan.price_cents||0)/100).toLocaleString('es-MX')} <small>${esc(plan.currency||'MXN')}</small></b>
      <span>${esc(plan.tagline||'')}</span>
      <small>${plan.max_guests} invitados · ${plan.duration_days} días</small>
    </button>
  `).join('');
  grid.querySelectorAll('[data-register-plan]').forEach(button=>button.addEventListener('click',()=>{
    $('registerPlan').value=button.dataset.registerPlan;
    const selectedTheme=publicCatalog?.themes?.find(theme=>theme.id===$('registerTheme')?.value);
    const targetPlan=plans.find(plan=>plan.code===button.dataset.registerPlan);
    if(selectedTheme&&!registrationPlanAllowsTheme(targetPlan,selectedTheme)){
      $('registerTheme').value='';
      renderRegisterThemeChoice();
      $('registerStatus').textContent='La plantilla elegida requiere un nivel mayor; selecciona otra en el catálogo o continúa sin plantilla.';
      $('registerStatus').className='status-message error';
    }
    renderRegisterPlans();
  }));
}

function registrationPlanAllowsTheme(plan,theme){
  if(!plan||!theme)return false;
  const included=new Set(plan.included||[]);
  if(included.has(`theme:${theme.id}`))return true;
  const ranks={express:1,starter:2,basic:3,premium:4};
  const required=ranks[theme.minPlan||'starter']||2;
  return Object.entries(ranks).some(([tier,rank])=>rank>=required&&included.has(`themes:tier:${tier}`));
}

function renderRegisterThemeChoice(){
  const container=$('registerThemeChoice');
  if(!container)return;
  const selected=publicCatalog?.themes?.find(theme=>theme.id===$('registerTheme')?.value);
  container.classList.toggle('hidden',!selected);
  container.innerHTML=selected
    ?`<span class="${esc(selected.className)}">${selected.preview}</span><div><strong>${esc(selected.name)}</strong><small>Plantilla elegida desde el catálogo</small></div><button id="clearRegisterTheme" class="mini-btn" type="button">Cambiar</button>`
    :'';
  $('clearRegisterTheme')?.addEventListener('click',()=>{
    $('registerTheme').value='';
    renderRegisterThemeChoice();
  });
}

async function loadPublicPlans(){
  const [optsRes,catalogRes]=await Promise.all([fetch('/api/public/auth-options'),fetch('/api/public/catalog')]);
  const opts=await readJson(optsRes,'Opciones de acceso');
  publicCatalog=await readJson(catalogRes,'Catálogo público');
  populateExperienceSelectors();
  configureAutomaticTranslation();
  if($('registerTrialTitle'))$('registerTrialTitle').textContent=`Comienza tu prueba de ${publicCatalog.trialDays} días`;
  if($('registerTrialAcknowledgementText'))$('registerTrialAcknowledgementText').textContent=`Entiendo que la prueba dura ${publicCatalog.trialDays} días, comienza privada y no realiza ningún cobro automático.`;
  const params=new URLSearchParams(location.search);
  const requestedPlan=params.get('plan');
  const selectedPlan=publicCatalog.plans.some(plan=>plan.code===requestedPlan)?requestedPlan:'basic';
  if($('registerPlan'))$('registerPlan').value=selectedPlan;
  if($('registerEventType')){
    $('registerEventType').innerHTML=publicCatalog.eventTypes.map(type=>`<option value="${esc(type.id)}">${type.icon} ${esc(type.name)}</option>`).join('');
    const requestedType=params.get('eventType');
    $('registerEventType').value=publicCatalog.eventTypes.some(type=>type.id===requestedType)?requestedType:'wedding';
  }
  const requestedTheme=params.get('theme');
  if($('registerTheme'))$('registerTheme').value=publicCatalog.themes.some(theme=>theme.id===requestedTheme)?requestedTheme:'';
  const selectedTheme=publicCatalog.themes.find(theme=>theme.id===$('registerTheme')?.value);
  const selectedPlanDetails=publicCatalog.plans.find(plan=>plan.code===selectedPlan);
  if(selectedTheme&&!registrationPlanAllowsTheme(selectedPlanDetails,selectedTheme))$('registerTheme').value='';
  renderRegisterPlans();
  renderRegisterThemeChoice();
  $('showRegisterBtn')?.classList.toggle('hidden',!opts.registrationEnabled);
  if(!opts.registrationEnabled)$('registerForm')?.classList.add('hidden');
  if(opts.registrationEnabled&&params.get('register')==='1')openRegisterForm();
  const google=$('googleLoginBtn');if(google){google.classList.toggle('hidden',!opts.googleEnabled);google.disabled=!opts.googleEnabled;google.title=opts.googleEnabled?'Continuar con Google':'';}
}
$('registerForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  if($('registerPassword').value!==$('registerPasswordConfirm').value){$('registerStatus').textContent='Las contraseñas no coinciden.';$('registerStatus').className='status-message error';return;}
  const registrationParams=new URLSearchParams(location.search);
  const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:$('registerName').value,email:$('registerEmail').value,phone:$('registerPhone').value,password:$('registerPassword').value,planCode:$('registerPlan').value,eventType:$('registerEventType').value,themeId:$('registerTheme').value,eventName:registrationParams.get('draftName')||'',eventDate:registrationParams.get('draftDate')||'',locale:$('registerLocale').value,acceptTerms:$('registerTrialAcknowledgement').checked})});
  const d=await r.json();
  if(!r.ok){$('registerStatus').textContent=d.error||'No se pudo crear la cuenta.';$('registerStatus').className='status-message error';return;}
  authToken=d.token||'';currentUser=d.user;eventId=d.eventId;localStorage.removeItem('authToken');localStorage.setItem('eventId',String(eventId));
  events=await(await api('/api/admin/events')).json();renderEvents();
      applyRoleUI();
      $('loginScreen').classList.add('hidden');
      $('adminApp').classList.remove('hidden');
      await load();tab('dashboard');
});
$('googleLoginBtn')?.addEventListener('click',async()=>{const r=await fetch('/api/auth/google',{method:'POST'});const d=await r.json();$('loginStatus').textContent=d.error||'Google no está configurado.';});

function renderOwnerClients(){
  if(!$('clientRows'))return;
  const query=String($('clientSearch')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const state=$('clientStatusFilter')?.value||'';
  const filtered=ownerClients.filter(client=>{
    const haystack=`${client.display_name} ${client.email||''} ${client.phone||''} ${client.plan_name||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const matchesState=!state||(state==='active'?client.active&&client.subscription_status==='active':client.subscription_status===state);
    return (!query||haystack.includes(query))&&matchesState;
  });
  const pages=Math.max(1,Math.ceil(filtered.length/CLIENT_PAGE_SIZE));
  clientPage=Math.min(clientPage,pages);
  const visible=filtered.slice((clientPage-1)*CLIENT_PAGE_SIZE,clientPage*CLIENT_PAGE_SIZE);
  $('clientRows').innerHTML=visible.length
    ?visible.map(client=>`<tr>
      <td>${esc(client.display_name)}</td>
      <td>${esc(client.email||'')}<br>${esc(client.phone||'')}</td>
      <td>${esc(client.plan_name||'Sin plan')}</td>
      <td>${esc(client.subscription_status||'Sin suscripción')}</td>
      <td>${client.event_count||0}<br><small>${client.published_event_count||0} publicado(s)</small></td>
      <td>${esc(client.last_login_at||'Nunca')}</td>
      <td>$${((client.paid_cents||0)/100).toLocaleString('es-MX')}</td>
      <td><button class="secondary-btn open-client-commerce" data-id="${client.id}">Abrir perfil</button></td>
    </tr>`).join('')
    :'<tr><td colspan="8" class="muted">No hay clientes que coincidan con los filtros.</td></tr>';
  $('clientPageStatus').textContent=`Página ${clientPage} de ${pages} · ${filtered.length} cliente(s)`;
  $('clientPrevPage').disabled=clientPage<=1;
  $('clientNextPage').disabled=clientPage>=pages;
  document.querySelectorAll('.open-client-commerce').forEach(button=>button.onclick=()=>openClientCommerce(Number(button.dataset.id)));
  enhanceResponsiveTables($('tab-owner'));
}

async function loadOwnerDashboard(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  try{
    const [summaryResponse,clientsResponse,plansResponse]=await Promise.all([
      api('/api/admin/owner-summary'),
      api('/api/admin/clients'),
      api('/api/admin/plans')
    ]);

    const summary=await readJson(summaryResponse,'Resumen de propietario');
    const clients=await readJson(clientsResponse,'Listado de clientes');
    ownerClients=clients;ownerPlans=await readJson(plansResponse,'Planes internos');

    if($('oClients'))$('oClients').textContent=summary.clients||0;
    if($('oActive'))$('oActive').textContent=summary.active_clients||0;
    if($('oTrials'))$('oTrials').textContent=summary.active_trials||0;
    if($('oEvents'))$('oEvents').textContent=summary.events||0;
    if($('pBusinessPublished'))$('pBusinessPublished').textContent=summary.published_events||0;
    if($('oRevenue'))$('oRevenue').textContent=`$${((summary.revenue_cents||0)/100).toLocaleString('es-MX')} MXN`;

    renderOwnerClients();
  }catch(error){
    console.error(error);
    status(error.message||'No se pudo cargar el resumen de clientes.',false);
  }
}

async function loadOwnerCommercialCenter(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  try{
    const [controlsResponse,requestsResponse,analyticsResponse,showcaseResponse]=await Promise.all([
      api('/api/admin/commercial-controls'),
      api('/api/admin/publication-requests'),
      api(`/api/admin/analytics/funnel?days=${Number($('analyticsDays')?.value||30)}`),
      api('/api/admin/showcase')
    ]);
    const controls=await readJson(controlsResponse,'Políticas comerciales');
    const requests=await readJson(requestsResponse,'Solicitudes de publicación');
    const analytics=await readJson(analyticsResponse,'Analítica de conversión');
    const showcase=await readJson(showcaseResponse,'Showcase');
    const publication=controls.platform?.publication||{mode:'manual_owner'},branding=controls.platform?.branding||{};
    setValue('platformPublicationMode',publication.mode||'manual_owner');
    setChecked('platformAttributionEnabled',branding.attributionEnabled!==false);
    setValue('platformAttributionLabel',branding.attributionLabel||'Creado con EventStudio');
    setValue('platformAttributionUrl',branding.attributionUrl||'');
    setChecked('platformAttributionInvitation',branding.attributionOnInvitation!==false);
    setChecked('platformAttributionPrint',Boolean(branding.attributionOnPrint));
    setChecked('platformAttributionQr',Boolean(branding.attributionOnQr));
    setChecked('platformProofWatermark',Boolean(branding.proofWatermarkEnabled));
    if($('publicationRequestRows'))$('publicationRequestRows').innerHTML=requests.length?requests.map(row=>`
      <article class="publication-request-row status-${esc(row.status)}"><div><strong>${esc(row.event_name)}</strong><small>${esc(row.display_name)} · ${esc(row.email||'')} · ${esc(row.requested_at)} · ${esc(row.status)}</small></div>${row.status==='pending'?`<div class="request-actions"><button class="secondary-btn publication-decision" data-id="${row.id}" data-action="reject" type="button">Rechazar</button><button class="primary-btn publication-decision" data-id="${row.id}" data-action="approve" type="button">Aprobar</button></div>`:`<span class="status-pill ${row.status==='approved'?'confirmed':''}">${esc(row.status)}</span>`}</article>
    `).join(''):'<p class="muted">No hay solicitudes de publicación.</p>';
    document.querySelectorAll('.publication-decision').forEach(button=>button.onclick=async()=>{
      const action=button.dataset.action;if(!confirm(action==='approve'?'¿Aprobar y publicar este sitio?':'¿Rechazar esta solicitud?'))return;
      const response=await api(`/api/admin/publication-requests/${button.dataset.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
      const data=await response.json().catch(()=>({}));
      status(response.ok?(action==='approve'?'Sitio publicado por autorización del propietario.':'Solicitud rechazada.'):(data.error||'No se pudo atender la solicitud.'),response.ok);
      if(response.ok)await loadOwnerCommercialCenter();
    });
    const funnelOrder=['landing_view','catalog_view','showcase_view','template_previewed','store_view','store_search','store_product_previewed','cart_added','checkout_started','payment_completed','publication_requested','published'];
    const countMap=new Map((analytics.counts||[]).map(item=>[item.event_name,item]));
    const funnelLabels={landing_view:'Visitas',catalog_view:'Catálogo',showcase_view:'Showcase',template_previewed:'Plantillas probadas',store_view:'Tienda',store_search:'Búsquedas',store_product_previewed:'Productos probados',cart_added:'Añadidos al carrito',checkout_started:'Pago iniciado',payment_completed:'Compras confirmadas',publication_requested:'Publicación solicitada',published:'Publicados'};
    if($('analyticsFunnel'))$('analyticsFunnel').innerHTML=funnelOrder.map(key=>{const row=countMap.get(key)||{total:0,sessions:0};return `<article><span>${esc(funnelLabels[key]||key)}</span><strong>${Number(row.total||0).toLocaleString('es-MX')}</strong><small>${Number(row.sessions||0).toLocaleString('es-MX')} sesiones</small></article>`;}).join('');
    const humanAnalyticsValue=(key,value)=>{const raw=String(value||'');if(!raw)return '—';if(key==='product'){const product=(commerceData?.products||[]).find(item=>item.code===raw);if(product)return product.name;}if(key==='theme'){const id=raw.replace(/^theme:/,'');const theme=themes.find(item=>item.id===id);if(theme)return theme.name;}return raw.replace(/^(theme|experience|feature):/,'').replace(/[-_:]+/g,' ').replace(/\b\w/g,char=>char.toLocaleUpperCase('es-MX'));};
    const insight=(rows,key)=>rows?.length?rows.map(row=>`<div class="analytics-rank-row"><span>${esc(humanAnalyticsValue(key,row[key]))}</span><strong>${Number(row.total||0)}</strong></div>`).join(''):'<p class="muted">Todavía sin datos.</p>';
    if($('analyticsTopProducts'))$('analyticsTopProducts').innerHTML=insight(analytics.topProducts,'product');
    if($('analyticsTopThemes'))$('analyticsTopThemes').innerHTML=insight(analytics.topThemes,'theme');
    if($('analyticsEventTypes'))$('analyticsEventTypes').innerHTML=insight(analytics.eventTypes,'event_type');
    if($('showcaseAdminRows'))$('showcaseAdminRows').innerHTML=showcase.map(item=>`
      <article class="showcase-admin-item"><div class="showcase-admin-thumb" style="${item.asset_url?`background-image:url('${esc(item.asset_url)}')`:''}"></div><div><strong>${esc(item.title)}</strong><small>${esc(item.source_type==='demo'?'Demo editorial':item.source_type)} · ${esc(item.event_type||'')}</small></div><label>Estado<select class="showcase-status" data-id="${item.id}" data-sort="${item.sort_order||0}">${['draft','published','hidden'].map(value=>`<option value="${value}" ${value===item.status?'selected':''}>${({draft:'Borrador',published:'Publicado',hidden:'Oculto'})[value]}</option>`).join('')}</select></label></article>
    `).join('')||'<p class="muted">Todavía no hay muestras.</p>';
    document.querySelectorAll('.showcase-status').forEach(select=>select.onchange=async()=>{
      const response=await api(`/api/admin/showcase/${select.dataset.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value,sortOrder:Number(select.dataset.sort||0)})});
      const data=await response.json().catch(()=>({}));status(response.ok?'Showcase actualizado.':(data.error||'No se pudo actualizar.'),response.ok);if(response.ok)await loadOwnerCommercialCenter();
    });
  }catch(error){console.error(error);status(error.message||'No se pudo cargar el centro comercial del propietario.',false);}
}
$('platformCommercialForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const response=await api('/api/admin/platform-settings/commercial',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    publicationMode:$('platformPublicationMode').value,
    attributionEnabled:$('platformAttributionEnabled').checked,attributionLabel:$('platformAttributionLabel').value,attributionUrl:$('platformAttributionUrl').value,
    attributionOnInvitation:$('platformAttributionInvitation').checked,attributionOnPrint:$('platformAttributionPrint').checked,attributionOnQr:$('platformAttributionQr').checked,
    proofWatermarkEnabled:$('platformProofWatermark').checked
  })});
  const data=await response.json().catch(()=>({}));status(response.ok?'Política global y marca actualizadas.':(data.error||'No se pudo guardar.'),response.ok);
  if(response.ok)await loadOwnerCommercialCenter();
});
$('refreshPublicationRequests')?.addEventListener('click',loadOwnerCommercialCenter);
$('analyticsDays')?.addEventListener('change',loadOwnerCommercialCenter);

$('clientSearch')?.addEventListener('input',()=>{clientPage=1;renderOwnerClients();});
$('clientStatusFilter')?.addEventListener('change',()=>{clientPage=1;renderOwnerClients();});
$('clientPrevPage')?.addEventListener('click',()=>{clientPage=Math.max(1,clientPage-1);renderOwnerClients();});
$('clientNextPage')?.addEventListener('click',()=>{clientPage++;renderOwnerClients();});

const commerceKindLabels={
  feature:'Módulo',bundle:'Función',template_collection:'Colección',
  template:'Plantilla',storage:'Almacenamiento'
};
const commerceStateLabels={
  available:'Disponible',experimental:'Experimental',hidden:'Oculto',disabled:'Deshabilitado'
};
const commerceReadinessLabels={draft:'Borrador',lab:'Laboratorio',qa:'QA',approved:'Aprobado',retired:'Retirado'};
const money=value=>`$${(Number(value||0)/100).toLocaleString('es-MX')} MXN`;

function commerceProductMatches(product){
  const kind=$('commerceKind')?.value||'';
  const query=String($('commerceSearch')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX').trim();
  const haystack=`${product.name} ${product.description} ${product.code}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX');
  return (!kind||product.kind===kind)&&(!query||haystack.includes(query));
}
function productPreviewMarkup(product){
  const preview=String(product.preview||'');
  if(/^https?:|^data:|^\/uploads\//.test(preview))return `<img src="${esc(preview)}" alt="${esc(product.name||'Producto')}">`;
  const code=String(product.code||'');
  if(code==='experience:rose-bloom')return '<span class="catalog-visual rose">🌹</span>';
  if(code==='experience:particle-heart')return '<span class="catalog-visual heart">♡</span>';
  if(code.includes('cinematic-depth')||product.presentation_slot==='gallery')return '<span class="catalog-visual cards">▱</span>';
  if(product.kind==='storage')return '<span class="catalog-visual storage">▣</span>';
  if(product.kind==='feature')return '<span class="catalog-visual feature">⚙</span>';
  return `<b>${esc(preview||String(commerceKindLabels[product.kind]||product.kind).slice(0,2))}</b>`;
}

function fillProductClassificationOptions(product=null){
  const selectedGrants=new Set(product?.grants||[]);
  if($('commerceProductGrants'))$('commerceProductGrants').innerHTML=(commerceData?.authorizedGrants||[]).map(grant=>`<option value="${esc(grant)}" ${selectedGrants.has(grant)?'selected':''}>${esc(grant)}</option>`).join('');
  const selectedTypes=new Set(product?.eventTypes?.length?product.eventTypes:['*']);
  if($('commerceProductEventTypes'))$('commerceProductEventTypes').innerHTML=[{id:'*',name:'Todos los eventos'},...(commerceData?.eventTypes||[])].map(type=>`<option value="${esc(type.id)}" ${selectedTypes.has(type.id)?'selected':''}>${esc(type.name||type.id)}</option>`).join('');
  const selectedCategories=new Set((product?.categories||[]).map(category=>Number(category.id)));
  if($('commerceProductCategories'))$('commerceProductCategories').innerHTML=(commerceData?.categories||[]).filter(category=>category.active!==false&&Number(category.active)!==0).map(category=>`<label class="checkbox-line"><input type="checkbox" value="${category.id}" ${selectedCategories.has(Number(category.id))?'checked':''}> ${esc(category.icon||'')} ${esc(category.name)}</label>`).join('')||'<small>Sin categorías configuradas.</small>';
}
function productFormPayload(){
  return {
    code:$('commerceProductCode')?.value||'',kind:$('commerceProductKind')?.value||'bundle',
    name:$('commerceProductName').value,description:$('commerceProductDescription').value,
    priceCents:Math.round(Number($('commerceProductPrice').value||0)*100),commercialStatus:$('commerceProductState').value,
    readinessStatus:$('commerceProductReadiness').value,releaseVersion:$('commerceProductRelease').value,
    presentationSlot:$('commerceProductSlot').value,previewStrategy:$('commerceProductPreviewStrategy').value,
    storageMb:Math.max(0,Math.round(Number($('commerceProductStorage')?.value||0))),
    grants:[...($('commerceProductGrants')?.selectedOptions||[])].map(option=>option.value),
    eventTypes:[...($('commerceProductEventTypes')?.selectedOptions||[])].map(option=>option.value),
    categoryIds:[...document.querySelectorAll('#commerceProductCategories input:checked')].map(input=>Number(input.value)),
    public:$('commerceProductPublic').checked
  };
}
function openNewCommerceProduct(){
  if(!commerceData)return;
  setValue('commerceProductId','');setValue('commerceProductCode','');setValue('commerceProductKind','bundle');
  setValue('commerceProductName','');setValue('commerceProductDescription','');setValue('commerceProductPrice','0.00');
  setValue('commerceProductState','hidden');setValue('commerceProductReadiness','draft');setValue('commerceProductRelease','');
  setValue('commerceProductSlot','feature');setValue('commerceProductPreviewStrategy','none');setValue('commerceProductStorage','0');
  setChecked('commerceProductPublic',false);fillProductClassificationOptions(null);
  if($('commerceProductCode'))$('commerceProductCode').disabled=false;if($('commerceProductKind'))$('commerceProductKind').disabled=false;
  $('commerceProductDialogTitle').textContent='Nuevo producto';
  $('commerceProductPreview').innerHTML='<div class="commerce-product-placeholder"><b>+</b></div><div><b>Producto gobernado</b><small>Empieza en borrador; sólo capacidades autorizadas pueden asignarse desde la interfaz.</small></div>';
  showDialog($('commerceProductDialog'));
}
function renderCommerceClassification(){
  if(!commerceData)return;
  if($('storeCategoryAdminRows'))$('storeCategoryAdminRows').innerHTML=(commerceData.categories||[]).map(category=>`<form class="classification-row store-category-row" data-id="${category.id}"><input name="name" value="${esc(category.name)}" maxlength="80"><input name="icon" value="${esc(category.icon||'')}" maxlength="12"><input name="sort" type="number" min="0" value="${Number(category.sort_order||0)}"><label><input name="active" type="checkbox" ${category.active!==false&&Number(category.active)!==0?'checked':''}> activa</label><button class="mini-btn" type="submit">Guardar</button></form>`).join('')||'<p class="muted">Sin categorías.</p>';
  document.querySelectorAll('.store-category-row').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const data=new FormData(form);const response=await api(`/api/admin/commerce/categories/${form.dataset.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.get('name'),icon:data.get('icon'),sortOrder:Number(data.get('sort')||0),active:data.get('active')==='on'})});const body=await response.json().catch(()=>({}));status(response.ok?'Categoría actualizada.':(body.error||'No se pudo actualizar la categoría.'),response.ok);if(response.ok)await loadCommerceWorkbench();});
  const activeCategories=(commerceData.categories||[]).filter(category=>category.active!==false&&Number(category.active)!==0);
  if($('commercialProfileAdminRows'))$('commercialProfileAdminRows').innerHTML=(commerceData.profiles||[]).map(profile=>{const recommended=new Set(profile.recommendedCategories||[]),curated=new Set((profile.curatedProductIds||[]).map(Number));return `<form class="commercial-profile-card" data-id="${profile.id}"><label><span>Nombre</span><input name="name" value="${esc(profile.name)}" maxlength="100"></label><label class="profile-description"><span>Descripción</span><input name="description" value="${esc(profile.description||'')}" maxlength="300"></label><label><span>Categorías recomendadas</span><select name="recommendations" multiple size="4">${activeCategories.map(category=>`<option value="${esc(category.code)}" ${recommended.has(category.code)?'selected':''}>${esc(category.name)}</option>`).join('')}</select></label><label><span>Catálogo</span><select name="catalogMode"><option value="all" ${(profile.catalogMode||'all')==='all'?'selected':''}>Puede ver todo lo disponible</option><option value="curated" ${(profile.catalogMode||'all')==='curated'?'selected':''}>Sólo productos asignados</option></select></label><label class="profile-products"><span>Productos visibles</span><select name="curatedProducts" multiple size="5">${(commerceData.products||[]).map(product=>`<option value="${product.id}" ${curated.has(Number(product.id))?'selected':''}>${esc(product.name)}</option>`).join('')}</select></label><label><span>Orden</span><input name="sort" type="number" min="0" value="${Number(profile.sort_order||0)}"></label><label class="profile-active"><input name="active" type="checkbox" ${profile.active!==false&&Number(profile.active)!==0?'checked':''}> activo</label><button class="mini-btn profile-save" type="submit">Guardar</button></form>`;}).join('')||'<p class="muted">Sin perfiles.</p>';
  document.querySelectorAll('.commercial-profile-card').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const data=new FormData(form);const recommendedCategories=[...form.querySelector('[name="recommendations"]')?.selectedOptions||[]].map(option=>option.value),curatedProductIds=[...form.querySelector('[name="curatedProducts"]')?.selectedOptions||[]].map(option=>Number(option.value));const response=await api(`/api/admin/commercial-profiles/${form.dataset.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.get('name'),description:data.get('description'),recommendedCategories,catalogMode:data.get('catalogMode')||'all',curatedProductIds,sortOrder:Number(data.get('sort')||0),active:data.get('active')==='on'})});const body=await response.json().catch(()=>({}));status(response.ok?'Perfil comercial actualizado.':(body.error||'No se pudo actualizar el perfil.'),response.ok);if(response.ok)await loadCommerceWorkbench();});
}

function renderCommerceCatalog(){
  const grid=$('commerceProductGrid');
  if(!grid||!commerceData)return;
  const products=commerceData.products.filter(commerceProductMatches);
  grid.innerHTML=products.map(product=>`
    <article class="commerce-product-card compact state-${esc(product.commercial_status)}" data-product-id="${product.id}">
      <button class="commerce-product-open" data-id="${product.id}" type="button" aria-label="Editar ${esc(product.name)}">
        <span class="commerce-product-thumb">${productPreviewMarkup(product)}</span>
        <span class="commerce-product-info"><span class="commerce-kind">${esc(commerceKindLabels[product.kind]||product.kind)}</span><strong>${esc(product.name)}</strong><small>${esc(product.description)}</small></span>
        <span class="commerce-product-meta"><span class="status-pill">${esc(commerceStateLabels[product.commercial_status]||product.commercial_status)}</span><span class="status-pill readiness-${esc(product.readiness_status)}">${esc(commerceReadinessLabels[product.readiness_status]||product.readiness_status)}</span><b>${money(product.price_cents)}</b></span>
      </button>
    </article>
  `).join('')||'<p class="muted">No hay productos con este filtro.</p>';
  grid.querySelectorAll('.commerce-product-open').forEach(button=>button.onclick=()=>openCommerceProduct(Number(button.dataset.id)));
}

function openCommerceProduct(id){
  const product=commerceData?.products.find(item=>item.id===id);
  if(!product)return;
  setValue('commerceProductId',product.id);
  setValue('commerceProductCode',product.code);
  setValue('commerceProductKind',product.kind);
  if($('commerceProductCode'))$('commerceProductCode').disabled=true;if($('commerceProductKind'))$('commerceProductKind').disabled=true;
  setValue('commerceProductName',product.name);
  setValue('commerceProductDescription',product.description);
  setValue('commerceProductPrice',(Number(product.price_cents||0)/100).toFixed(2));
  setValue('commerceProductState',product.commercial_status);
  setValue('commerceProductReadiness',product.readiness_status||'approved');
  setValue('commerceProductRelease',product.release_version||'');
  setValue('commerceProductSlot',product.presentation_slot||'feature');
  setValue('commerceProductPreviewStrategy',product.preview_strategy||'none');
  setValue('commerceProductStorage',Number(product.storage_mb||0));
  setChecked('commerceProductPublic',product.public);
  fillProductClassificationOptions(product);
  $('commerceProductDialogTitle').textContent=product.name;
  $('commerceProductPreview').innerHTML=`<div class="commerce-product-placeholder">${productPreviewMarkup(product)}</div><div><b>${esc(commerceKindLabels[product.kind]||product.kind)}</b><small>${esc(product.code)}</small></div>`;
  showDialog($('commerceProductDialog'));
}

$('commerceProductForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const id=Number($('commerceProductId').value||0),creating=!id,payload=productFormPayload();
  const response=await api(creating?'/api/admin/commerce/products':`/api/admin/commerce/products/${id}`,{
    method:creating?'POST':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||`No se pudo ${creating?'crear':'guardar'} el producto.`,false);
  $('commerceProductDialog').close();
  status(creating?'Producto creado en borrador.':'Producto actualizado en el catálogo.');
  await loadCommerceWorkbench();
});
$('newCommerceProductBtn')?.addEventListener('click',openNewCommerceProduct);
$('createStoreCategoryForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const response=await api('/api/admin/commerce/categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('newStoreCategoryName').value,icon:$('newStoreCategoryIcon').value})});
  const data=await response.json().catch(()=>({}));status(response.ok?'Categoría creada.':(data.error||'No se pudo crear la categoría.'),response.ok);
  if(response.ok){event.target.reset();await loadCommerceWorkbench();}
});
$('createCommercialProfileForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const response=await api('/api/admin/commercial-profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('newCommercialProfileName').value})});
  const data=await response.json().catch(()=>({}));status(response.ok?'Perfil comercial creado.':(data.error||'No se pudo crear el perfil.'),response.ok);
  if(response.ok){event.target.reset();await loadCommerceWorkbench();}
});

function renderCommercePlans(){
  const grid=$('commercePlanGrid');
  if(!grid||!commerceData)return;
  grid.innerHTML=commerceData.plans.map(plan=>`
    <article class="commerce-plan-card summary ${plan.featured?'featured':''}" data-plan-id="${plan.id}">
      <button class="commerce-plan-open" data-id="${plan.id}" type="button">
        <span class="plan-card-head"><span><small class="commerce-plan-kicker">${plan.featured?'Recomendado':'Plan comercial'}</small><strong>${esc(plan.name)}</strong></span><span class="status-pill ${plan.public?'confirmed':''}">${plan.public?'En tienda':'Interno'}</span></span>
        <span class="plan-card-tagline">${esc(plan.tagline||'Configura límites, publicación y contenido incluido.')}</span>
        <span class="plan-price-row"><b class="plan-summary-price">${money(plan.price_cents)}</b><small>${plan.duration_days} días</small></span>
        <span class="plan-limit-grid">
          <span><b>${plan.max_events}</b><small>eventos</small></span>
          <span><b>${plan.max_published_events??plan.max_events}</b><small>publicados</small></span>
          <span><b>${plan.max_guests}</b><small>invitados</small></span>
          <span><b>${plan.max_storage_mb}</b><small>MB base</small></span>
        </span>
        <span class="plan-policy-line"><b>Publicación</b><small>${plan.publication_policy==='auto_after_entitlement'?'Automática con derecho vigente':plan.publication_policy==='disabled'?'Deshabilitada':'Manual por propietario'}</small></span>
        <span class="plan-card-footer"><span><b>${plan.products.length}</b> productos incluidos · valor ${money(plan.catalog_value_cents)}</span><em>Configurar →</em></span>
      </button>
    </article>
  `).join('');
  grid.querySelectorAll('.commerce-plan-open').forEach(button=>button.onclick=()=>openCommercePlan(Number(button.dataset.id)));
}

function renderPlanProductOptions(){
  const query=String($('planProductSearch')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const grouped=Object.groupBy
    ?Object.groupBy(commerceData.products,product=>commerceKindLabels[product.kind]||product.kind)
    :commerceData.products.reduce((result,product)=>{const key=commerceKindLabels[product.kind]||product.kind;(result[key]||=[]).push(product);return result;},{});
  $('planProductOptions').innerHTML=Object.entries(grouped).map(([label,products])=>{
    const visible=products.filter(product=>!query||`${product.name} ${product.description} ${product.code}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query));
    if(!visible.length)return '';
    return `<fieldset><legend>${esc(label)}</legend>${visible.map(product=>`<label class="plan-product-option"><input type="checkbox" value="${product.id}" ${planDraftProductIds.has(product.id)?'checked':''}><span class="plan-product-option-preview">${productPreviewMarkup(product)}</span><span class="plan-product-option-info"><b>${esc(product.name)}</b><small>${money(product.price_cents)} · ${esc(commerceStateLabels[product.commercial_status]||product.commercial_status)}</small><small>${esc(product.description||'')}</small></span></label>`).join('')}</fieldset>`;
  }).join('')||'<p class="muted">No hay productos con esta búsqueda.</p>';
  document.querySelectorAll('#planProductOptions input').forEach(input=>input.addEventListener('change',()=>{
    const id=Number(input.value);
    if(input.checked)planDraftProductIds.add(id);else planDraftProductIds.delete(id);
  }));
}

function openCommercePlan(id){
  const plan=commerceData?.plans.find(item=>item.id===id);
  if(!plan)return;
  setValue('commercePlanId',plan.id);setValue('planDialogName',plan.name);setValue('planDialogTagline',plan.tagline||'');
  setValue('planDialogPrice',(Number(plan.price_cents||0)/100).toFixed(2));setValue('planDialogDays',plan.duration_days);
  setValue('planDialogRetention',plan.retention_days||0);setValue('planDialogEvents',plan.max_events);
  setValue('planDialogPublishedEvents',plan.max_published_events??plan.max_events);setValue('planDialogPublicationPolicy',plan.publication_policy||'manual_owner');
  setValue('planDialogGuests',plan.max_guests);setValue('planDialogStorage',plan.max_storage_mb);
  setChecked('planDialogPublic',plan.public);setChecked('planDialogFeatured',plan.featured);
  $('commercePlanDialogTitle').textContent=plan.name;
  $('commercePlanValue').textContent=`Valor equivalente de lo incluido: ${money(plan.catalog_value_cents)}. Tú decides el precio final.`;
  $('planProductSearch').value='';
  $('planProductOptions').innerHTML='';
  planDraftProductIds=new Set(plan.products.map(product=>product.id));
  renderPlanProductOptions();
  $('deleteCommercePlanBtn').classList.toggle('hidden',['trial','express','starter','basic','premium','studio'].includes(plan.code));
  showDialog($('commercePlanDialog'));
}

$('planProductSearch')?.addEventListener('input',renderPlanProductOptions);
$('commercePlanForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const id=Number($('commercePlanId').value);
  const plan=commerceData.plans.find(item=>item.id===id);
  const productIds=[...planDraftProductIds];
  const response=await api(`/api/admin/commerce/plans/${id}`,{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      name:$('planDialogName').value,tagline:$('planDialogTagline').value,
      priceCents:Math.round(Number($('planDialogPrice').value||0)*100),
      durationDays:Number($('planDialogDays').value),retentionDays:Number($('planDialogRetention').value),
      maxEvents:Number($('planDialogEvents').value),maxPublishedEvents:Number($('planDialogPublishedEvents').value),
      publicationPolicy:$('planDialogPublicationPolicy').value,maxGuests:Number($('planDialogGuests').value),
      maxStorageMb:Number($('planDialogStorage').value),public:$('planDialogPublic').checked,
      featured:$('planDialogFeatured').checked,productIds
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo guardar el plan.',false);
  $('commercePlanDialog').close();
  status(`Plan ${data.plan?.name||plan.name} actualizado.`);
  await Promise.all([loadCommerceWorkbench(),loadOwnerDashboard()]);
});

$('deleteCommercePlanBtn')?.addEventListener('click',async()=>{
  const id=Number($('commercePlanId').value);
  const plan=commerceData?.plans.find(item=>item.id===id);
  if(!plan||!confirm(`¿Eliminar definitivamente el paquete "${plan.name}"?`))return;
  const response=await api(`/api/admin/commerce/plans/${id}`,{method:'DELETE'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo eliminar el paquete.',false);
  $('commercePlanDialog').close();status('Paquete eliminado.');
  await loadCommerceWorkbench();
});

function renderPromotions(){
  if(!commerceData)return;
  if($('promotionPlan'))$('promotionPlan').innerHTML='<option value="">Todos los planes</option>'+commerceData.plans.map(plan=>`<option value="${esc(plan.code)}">${esc(plan.name)}</option>`).join('');
  if($('promotionEventType'))$('promotionEventType').innerHTML='<option value="">Todos los eventos</option>'+eventTypes.map(type=>`<option value="${esc(type.id)}">${esc(type.name)}</option>`).join('');
  if($('promotionProducts'))$('promotionProducts').innerHTML=commerceData.products.filter(product=>product.commercial_status!=='disabled').map(product=>`<option value="${product.id}">${esc(commerceKindLabels[product.kind]||product.kind)} · ${esc(product.name)}</option>`).join('');
  if($('promotionRows'))$('promotionRows').innerHTML=(commerceData.promotions||[]).map(promotion=>`
    <article class="row-between"><div><strong>${esc(promotion.name)}</strong><br><small>${esc(promotion.status)} · ${promotion.audience_plan_code?`Plan ${esc(promotion.audience_plan_code)}`:'Todos los planes'} · ${promotion.event_type?esc(promotion.event_type):'Todos los eventos'} · ${promotion.product_ids.length} producto(s)</small></div>
    <select class="promotion-state" data-id="${promotion.id}">${['draft','active','paused','ended'].map(value=>`<option value="${value}" ${value===promotion.status?'selected':''}>${value}</option>`).join('')}</select></article>
  `).join('')||'<p class="muted">Todavía no hay promociones.</p>';
  document.querySelectorAll('.promotion-state').forEach(select=>select.onchange=async()=>{
    const response=await api(`/api/admin/commerce/promotions/${select.dataset.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value})});
    const data=await response.json().catch(()=>({}));
    status(response.ok?'Estado de promoción actualizado.':(data.error||'No se pudo actualizar.'),response.ok);
  });
}

async function loadCommerceWorkbench(){
  if(!['owner','developer'].includes(currentUser?.role)||!$('commerceProductGrid'))return;
  const [catalogResponse,promotionsResponse]=await Promise.all([
    api('/api/admin/commerce/catalog'),api('/api/admin/commerce/promotions')
  ]);
  commerceData=await readJson(catalogResponse,'Catálogo comercial');
  commerceData.promotions=await readJson(promotionsResponse,'Promociones');
  renderCommerceClassification();renderCommerceCatalog();renderCommercePlans();renderPromotions();
}

function clientProfileProductOptions(){
  return (activeClientProfile?.products||[])
    .filter(product=>product.commercial_status!=='disabled')
    .map(product=>`<option value="${product.id}">${esc(commerceKindLabels[product.kind]||product.kind)} · ${esc(product.name)}</option>`).join('');
}

function renderClientCommercialProfile(){
  const profile=activeClientProfile;
  if(!profile)return;
  $('clientCommerceTitle').textContent=profile.client.display_name;
  $('clientCommerceSummary').textContent=`${profile.client.email||profile.client.phone||'Sin contacto'} · Idioma: ${(profile.client.preferred_locale||'es').toUpperCase()}`;
  const controls=profile.commercialControls||{};
  if($('clientCommercialControls'))$('clientCommercialControls').innerHTML=`
    <form id="clientCommercialControlsForm" class="client-commercial-controls-form">
      <div class="row-between"><div><strong>Perfil, límites y publicación</strong><small>Estos ajustes pertenecen a la cuenta; no cambian el rol de seguridad del usuario.</small></div><span class="status-pill">${esc(controls.profile_name||'Sin perfil')}</span></div>
      <div class="form-grid">
        <label>Perfil comercial<select id="clientProfileId"><option value="">Pareja / organizador particular</option>${(profile.profiles||[]).map(item=>`<option value="${item.id}" ${Number(controls.profile_id)===Number(item.id)?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label>
        <label>Máximo de eventos<input id="clientMaxEventsOverride" type="number" min="0" placeholder="Heredar del plan" value="${controls.max_events_override??''}"></label>
        <label>Máximo de sitios publicados<input id="clientMaxPublishedOverride" type="number" min="0" placeholder="Heredar del plan" value="${controls.max_published_events_override??''}"></label>
        <label>Publicación<select id="clientPublicationPolicyOverride"><option value="">Heredar del plan</option><option value="manual_owner" ${controls.publication_policy_override==='manual_owner'?'selected':''}>Manual por propietario</option><option value="auto_after_entitlement" ${controls.publication_policy_override==='auto_after_entitlement'?'selected':''}>Automática con derecho vigente</option><option value="disabled" ${controls.publication_policy_override==='disabled'?'selected':''}>Deshabilitada</option></select></label>
        <label class="wide">Nota interna<textarea id="clientCommercialNote" maxlength="500">${esc(controls.note||'')}</textarea></label>
      </div><button class="secondary-btn" type="submit">Guardar controles del cliente</button>
    </form>`;
  $('clientCommerceEvents').innerHTML=`
    <section class="client-plan-assignment">
      <label>Plan de la cuenta<select id="profilePlanSelect">${profile.plans.map(plan=>`<option value="${esc(plan.code)}" ${plan.code===profile.subscription?.plan_code?'selected':''}>${esc(plan.name)}</option>`).join('')}</select></label>
      <button id="profileGrantPlanBtn" class="secondary-btn" type="button">Asignar como cortesía</button>
      <small>No genera pago ni ingreso.</small>
    </section>
    <details class="client-order-history"><summary>Compras y selecciones (${profile.orders.length})</summary>
      ${profile.orders.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Evento</th><th>Importe</th><th>Estado</th></tr></thead><tbody>${profile.orders.map(order=>`<tr><td>${esc(order.created_at)}</td><td>${order.event_id}</td><td>${money(order.subtotal_cents)}</td><td>${esc(order.status)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Todavía no hay compras ni selecciones enviadas.</p>'}
    </details>
    <details class="client-order-history"><summary>Notificaciones recibidas (${profile.notifications?.length||0})</summary>
      ${(profile.notifications||[]).map(item=>`<article class="profile-notification"><b>${esc(item.title)}</b><span>${esc(item.message)}</span><small>${esc(item.created_at)}${item.read_at?' · Leída':' · Pendiente'}</small></article>`).join('')||'<p class="muted">Todavía no hay notificaciones.</p>'}
    </details>
    ${profile.events.map(event=>`
      <article class="client-event-commerce" data-event-id="${event.id}">
        <div class="row-between"><div><strong>${esc(event.name)}</strong><small>${esc(event.event_type)} · ${event.storage_limit_mb} MB · ${event.features.length} herramientas visibles</small></div><button class="secondary-btn preview-client-event" data-event-id="${event.id}" type="button">Visualizar su menú</button></div>
        <div class="grant-origin-list">${event.origins.map(origin=>`
          <span class="grant-origin origin-${esc(origin.origin)}"><b>${esc(origin.name)}</b><small>${esc(origin.originLabel)}${origin.endsAt?` · hasta ${esc(origin.endsAt)}`:''}${origin.usageLimit?` · ${origin.usageUsed||0}/${origin.usageLimit} usos`:''}</small>
          ${['courtesy','legacy'].includes(origin.origin)&&origin.grantId?`<button class="revoke-event-grant" data-event-id="${event.id}" data-grant-id="${origin.grantId}" type="button">Revocar</button>`:''}</span>
        `).join('')}</div>
        <form class="courtesy-form">
          <label>Producto<select class="courtesy-product">${clientProfileProductOptions()}</select></label>
          <label>Vence<input class="courtesy-ends" type="datetime-local"></label>
          <label>Usos máximos<input class="courtesy-uses" type="number" min="1" placeholder="Sin límite"></label>
          <label>MB extra<input class="courtesy-storage" type="number" min="0" value="0"></label>
          <label class="wide">Motivo<input class="courtesy-note" maxlength="500" placeholder="Ej. cortesía de bienvenida"></label>
          <button class="primary-btn grant-courtesy" type="submit">Dar cortesía</button>
        </form>
      </article>
    `).join('')||'<p class="muted">Este cliente todavía no tiene eventos.</p>'}`;
  $('clientCommercialControlsForm')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const response=await api(`/api/admin/clients/${profile.client.id}/commercial-controls`,{
      method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        profileId:$('clientProfileId').value||null,
        maxEventsOverride:$('clientMaxEventsOverride').value===''?null:Number($('clientMaxEventsOverride').value),
        maxPublishedEventsOverride:$('clientMaxPublishedOverride').value===''?null:Number($('clientMaxPublishedOverride').value),
        publicationPolicyOverride:$('clientPublicationPolicyOverride').value,
        note:$('clientCommercialNote').value
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return status(data.error||'No se pudieron guardar los controles comerciales.',false);
    status('Perfil comercial, límites y publicación del cliente actualizados.');
    await openClientCommerce(profile.client.id,{reuseDialog:true});
  });
  $('profileGrantPlanBtn')?.addEventListener('click',async()=>{
    const planCode=$('profilePlanSelect').value;
    if(!confirm('¿Asignar este plan como cortesía? No se registrará ningún ingreso.'))return;
    const response=await api(`/api/admin/users/${profile.client.id}/grant-plan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planCode,reason:'Cortesía desde perfil comercial'})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return status(data.error||'No se pudo asignar el plan.',false);
    status('Plan asignado como cortesía; ingreso registrado: $0.');
    await openClientCommerce(profile.client.id,{reuseDialog:true});
  });
  document.querySelectorAll('.courtesy-form').forEach(form=>form.onsubmit=async event=>{
    event.preventDefault();
    const card=form.closest('.client-event-commerce');
    const response=await api(`/api/admin/events/${card.dataset.eventId}/grants`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        productId:Number(form.querySelector('.courtesy-product').value),
        endsAt:form.querySelector('.courtesy-ends').value||null,
        usageLimit:form.querySelector('.courtesy-uses').value||null,
        storageMb:Number(form.querySelector('.courtesy-storage').value||0),
        note:form.querySelector('.courtesy-note').value
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return status(data.error||'No se pudo dar la cortesía.',false);
    status('Cortesía aplicada; ingreso registrado: $0.');
    await openClientCommerce(profile.client.id,{reuseDialog:true});
  });
  document.querySelectorAll('.revoke-event-grant').forEach(button=>button.onclick=async()=>{
    if(!confirm('¿Revocar esta cortesía?'))return;
    const response=await api(`/api/admin/events/${button.dataset.eventId}/grants/${button.dataset.grantId}`,{method:'DELETE'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return status(data.error||'No se pudo revocar.',false);
    status('Cortesía revocada.');
    await openClientCommerce(profile.client.id,{reuseDialog:true});
  });
  document.querySelectorAll('.preview-client-event').forEach(button=>button.onclick=()=>{
    const clientEvent=profile.events.find(item=>Number(item.id)===Number(button.dataset.eventId));
    if(!clientEvent)return;
    const groups=new Map();
    (clientEvent.features||[]).forEach(feature=>{
      const group=feature.group||'Evento';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(feature);
    });
    $('clientMenuPreviewTitle').textContent=clientEvent.name;
    $('clientMenuPreviewSummary').textContent=`${profile.client.display_name} · ${profile.subscription?.plan_name||'Sin plan'} · ${clientEvent.features.length} herramientas visibles`;
    $('clientMenuPreviewBody').innerHTML=[...groups.entries()].map(([group,features])=>`<section class="client-menu-preview-group"><strong>${esc(group)}</strong><div>${features.map(feature=>`<span><b>${esc(feature.label)}</b><small>${esc(feature.key)}</small></span>`).join('')}</div></section>`).join('')||'<p class="muted">Este evento no tiene herramientas visibles para el cliente.</p>';
    showDialog($('clientMenuPreviewDialog'));
  });
}

async function openClientCommerce(clientId,{reuseDialog=false}={}){
  const response=await api(`/api/admin/clients/${clientId}/commercial-profile`);
  activeClientProfile=await readJson(response,'Perfil comercial del cliente');
  renderClientCommercialProfile();
  const dialog=$('clientCommerceDialog');
  if(!reuseDialog)showDialog(dialog);
}
$('closeClientCommerceBtn')?.addEventListener('click',()=>$('clientCommerceDialog')?.close());
$('clientCommerceDialog')?.addEventListener('click',event=>{if(event.target===$('clientCommerceDialog'))event.currentTarget.close();});
$('closeClientMenuPreviewBtn')?.addEventListener('click',()=>$('clientMenuPreviewDialog')?.close());
$('clientMenuPreviewDialog')?.addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close();});

$('commerceSearch')?.addEventListener('input',renderCommerceCatalog);
$('commerceKind')?.addEventListener('change',renderCommerceCatalog);
$('refreshCommerceBtn')?.addEventListener('click',loadCommerceWorkbench);
$('createCommercePlanForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const response=await api('/api/admin/commerce/plans',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      name:$('newPlanName').value,code:$('newPlanCode').value,
      priceCents:Math.round(Number($('newPlanPrice').value||0)*100),
      public:$('newPlanPublic').checked
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo crear el plan.',false);
  event.target.reset();$('newPlanPrice').value='0';
  status(`Plan ${data.plan.name} creado. Ábrelo para elegir sus funciones y límites.`);
  await Promise.all([loadCommerceWorkbench(),loadOwnerDashboard()]);
});
$('promotionForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const productIds=[...$('promotionProducts').selectedOptions].map(option=>Number(option.value));
  const response=await api('/api/admin/commerce/promotions',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      name:$('promotionName').value,audiencePlanCode:$('promotionPlan').value,
      eventType:$('promotionEventType').value,status:$('promotionStatus').value,
      startsAt:$('promotionStarts').value||null,endsAt:$('promotionEnds').value||null,
      productIds,note:$('promotionNote').value
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo guardar la promoción.',false);
  event.target.reset();status('Promoción guardada sin registrar ingresos.');
  await loadCommerceWorkbench();
});

function analyticsSessionKey(){
  let key=localStorage.getItem('eventstudioAnalyticsSession');
  if(!key){
    key=`es-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
    localStorage.setItem('eventstudioAnalyticsSession',key);
  }
  return key;
}
function trackConversion(name,metadata={}){
  if(!name)return;
  fetch('/api/analytics/track',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({eventName:name,sessionKey:analyticsSessionKey(),eventSlug:storeData?.event?.slug||events.find(item=>Number(item.id)===Number(eventId))?.slug||'',metadata})
  }).catch(()=>{});
}
function storeProductSearchText(product){
  return [product.name,product.description,product.code,...(product.categories||[]).map(category=>category.name),...(product.eventTypes||[])].join(' ').toLowerCase();
}
function productPreviewOptions(product){
  const options={};
  if(!product)return options;
  if(product.kind==='template'&&String(product.code||'').startsWith('theme:'))options.previewTheme=String(product.code).slice(6);
  if(String(product.code||'').startsWith('experience:')){
    const experienceId=String(product.code).slice('experience:'.length);
    if(publicCatalog?.experiences?.openings?.some(item=>item.id===experienceId))options.previewOpening=experienceId;
    if(publicCatalog?.experiences?.galleries?.some(item=>item.id===experienceId))options.previewGallery=experienceId;
  }
  const manifest=product.previewManifest||{};
  if(manifest.theme)options.previewTheme=manifest.theme;
  if(manifest.opening)options.previewOpening=manifest.opening;
  if(manifest.gallery)options.previewGallery=manifest.gallery;
  return options;
}
function eventPreviewSlug(){
  return storeData?.event?.slug||settings?._event?.slug||events.find(item=>Number(item.id)===Number(eventId))?.slug||'';
}
function eventPreviewBaseUrl(){
  const cached=previewLinkCache.get(Number(eventId));
  return cached&&cached.expiresAt>Date.now()?cached.url:'';
}
async function ensureEventPreviewBaseUrl(){
  const slug=eventPreviewSlug();if(!slug||!eventId)return '';
  const cached=eventPreviewBaseUrl();if(cached)return cached;
  const response=await api('/api/admin/preview-links',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.url){status(data.error||'No se pudo crear la vista previa temporal.',false);return '';}
  const url=new URL(data.url,window.location.origin);
  if(url.pathname!==`/e/${encodeURIComponent(slug)}`)return '';
  const expiresAt=Date.parse(data.expiresAt||'')||Date.now()+Math.max(5,Number(data.expiresInMinutes)||5)*60000;
  const base=`${url.pathname}${url.search}`;
  previewLinkCache.set(Number(eventId),{url:base,expiresAt:expiresAt-30000});
  return base;
}
/* Contrato compartido por las vistas de apertura. Mantenerlo centralizado evita
   que un botón olvide opening=1 o forceMotion=1 y parezca no hacer nada. */
const OPENING_PREVIEW_QUERY='opening=1&forceMotion=1';
function previewUrlFromOptions(options={},base=eventPreviewBaseUrl()){
  if(!base)return '';
  const url=new URL(base,window.location.origin);
  Object.entries(options).forEach(([key,value])=>{if(value)url.searchParams.set(key,value);});
  if(options.previewOpening){
    for(const [key,value] of new URLSearchParams(OPENING_PREVIEW_QUERY))url.searchParams.set(key,value);
  }
  return `${url.pathname}${url.search}`;
}
function productPreviewUrl(product,base=eventPreviewBaseUrl()){return previewUrlFromOptions(productPreviewOptions(product),base);}
function setStorePreview(url,{title='Tu invitación',hint='Esta simulación no guarda cambios ni concede derechos comerciales.',open=false}={}){
  if(!url)return status('No fue posible preparar la vista previa.',false);
  storePreviewUrl=url;
  if($('storePreviewTitle'))$('storePreviewTitle').textContent=title;
  if($('storePreviewOpen')){$('storePreviewOpen').href=url;$('storePreviewOpen').classList.remove('disabled-link');}
  if($('storePreviewHint'))$('storePreviewHint').textContent=hint;
  if(open)openStorePreviewDialog(url);
}
function fitPreviewStage(stage,mode='phone'){
  if(!stage)return;const frame=stage.querySelector('iframe');if(!frame)return;
  const dimensions=mode==='desktop'?{width:1280,height:800}:{width:390,height:844};
  stage.classList.toggle('desktop',mode==='desktop');stage.classList.toggle('phone',mode!=='desktop');
  const dialog=stage.closest('dialog');
  const availableWidth=Math.max(220,stage.clientWidth-16);
  const reserved=[...(dialog?.children||[])].filter(child=>child!==stage).reduce((sum,child)=>sum+child.getBoundingClientRect().height,0);
  const availableHeight=Math.max(220,Math.min(780,(dialog?.clientHeight||window.innerHeight*.92)-reserved-24));
  const scale=Math.min(1,availableWidth/dimensions.width,availableHeight/dimensions.height);
  frame.style.width=`${dimensions.width}px`;frame.style.height=`${dimensions.height}px`;frame.style.transform=`scale(${scale})`;
  stage.style.height=`${Math.max(220,Math.ceil(dimensions.height*scale)+12)}px`;
}
function setStorePreviewDevice(mode){
  storePreviewDeviceMode=mode==='desktop'?'desktop':'phone';
  $('previewPhoneModeBtn')?.classList.toggle('active',storePreviewDeviceMode==='phone');
  $('previewDesktopModeBtn')?.classList.toggle('active',storePreviewDeviceMode==='desktop');
  fitPreviewStage($('storePreviewStage'),storePreviewDeviceMode);
}
function replayablePreviewUrl(value){
  const url=new URL(value,window.location.origin);url.searchParams.set('_',String(Date.now()));return `${url.pathname}${url.search}`;
}
function openStorePreviewDialog(url=storePreviewUrl){
  const dialog=$('storePreviewDialog'),frame=$('storePreviewFrame');if(!dialog||!frame||!url)return;
  frame.src=replayablePreviewUrl(url);
  const currentIsMobile=window.matchMedia('(max-width: 720px)').matches;
  setStorePreviewDevice(currentIsMobile?'desktop':'phone');
  if(!dialog.open)dialog.showModal();requestAnimationFrame(()=>fitPreviewStage($('storePreviewStage'),storePreviewDeviceMode));
}
function closeStorePreview(){
  $('storePreviewDialog')?.close();if($('storePreviewFrame'))$('storePreviewFrame').src='about:blank';
}
async function openThemePreview(themeId){
  const theme=themes.find(item=>item.id===themeId);const slug=settings._event?.slug;if(!theme||!slug)return;
  const base=await ensureEventPreviewBaseUrl();
  const url=previewUrlFromOptions({previewTheme:themeId},base);
  if(!url)return status('No se pudo crear una vista previa autorizada.',false);
  if($('themePreviewDialogTitle'))$('themePreviewDialogTitle').textContent=theme.name;
  if($('openFullPreviewBtn'))$('openFullPreviewBtn').href=url;
  const frame=$('themePreviewFrame'),dialog=$('themePreviewDialog');if(!frame||!dialog)return;
  frame.src=replayablePreviewUrl(url);if(!dialog.open)dialog.showModal();requestAnimationFrame(()=>fitPreviewStage($('themePreviewStage'),'phone'));
  trackConversion('template_previewed',{themeId,eventType:settings._event?.event_type||''});
}
async function previewStoreProduct(productId){
  const product=storeData?.products?.find(item=>Number(item.id)===Number(productId));
  if(!product)return;
  const base=await ensureEventPreviewBaseUrl();
  const url=productPreviewUrl(product,base);
  if(!url)return status('Este producto todavía no tiene una vista previa interactiva.',false);
  storePreviewProductId=product.id;
  const focus={theme:'Observa colores, tipografía y composición general.',opening:'Observa la animación de entrada antes de abrir la invitación.',gallery:'Desliza la galería y observa cómo se presentan las fotografías.',feature:'Observa la función resaltada dentro de tu invitación.'}[composerProductSlot(product)]||'Observa el cambio aplicado a tu invitación.';
  if($('storePreviewFocus'))$('storePreviewFocus').textContent=`Simulando: ${product.name} · ${focus}`;
  setStorePreview(url,{title:product.name,hint:'Vista previa con los datos reales de tu evento. Probar no agrega al carrito, no guarda ni activa el producto.',open:true});
  trackConversion('store_product_previewed',{productId:product.id,productCode:product.code,kind:product.kind});
}
function composerProductSlot(item){
  if(item.kind==='template')return 'theme';
  const slot=String(item.presentation_slot||'feature');
  return slot==='template'?'theme':slot;
}
function composerOptions(){
  const options={};
  const items=storeData?.cart?.items||[];
  items.filter(item=>storeComposerEnabledIds.has(Number(item.product_id))).forEach(item=>Object.assign(options,productPreviewOptions(item)));
  return options;
}
function buildComposerPreviewUrl(base=eventPreviewBaseUrl()){return previewUrlFromOptions(composerOptions(),base);}
function toggleComposerProduct(productId,enabled){
  const id=Number(productId),item=(storeData?.cart?.items||[]).find(row=>Number(row.product_id)===id);
  if(!item)return;
  const slot=composerProductSlot(item);
  if(enabled&&['theme','opening','gallery'].includes(slot)){
    const competing=(storeData?.cart?.items||[]).find(row=>Number(row.product_id)!==id&&storeComposerEnabledIds.has(Number(row.product_id))&&composerProductSlot(row)===slot);
    if(competing){
      storeComposerEnabledIds.delete(Number(competing.product_id));
      status(`${item.name} sustituye a ${competing.name} sólo dentro de esta simulación.`);
    }
  }
  if(enabled)storeComposerEnabledIds.add(id);else storeComposerEnabledIds.delete(id);
  renderCart();
}
function syncComposerWithCart(){
  const ids=new Set((storeData?.cart?.items||[]).map(item=>Number(item.product_id)));
  [...storeComposerEnabledIds].forEach(id=>{if(!ids.has(id))storeComposerEnabledIds.delete(id);});
  ids.forEach(id=>{if(!storeComposerEnabledIds.has(id))storeComposerEnabledIds.add(id);});
}
function storeOwnershipLabel(product){if(!product?.owned)return '';return product.origin==='purchase'?'Adquirido':product.origin==='courtesy'?'Cortesía':product.origin==='promotion'?'Promoción activa':'Incluido en tu plan';}
function renderStore(){
  if(!storeData)return;
  const platformUser=['owner','developer'].includes(currentUser?.role);
  $('clientStoreCard')?.classList.toggle('hidden',platformUser);
  if(platformUser)return;
  const copy=UI_COPY[preferredUiLocale()];
  const dynamic=(storeData.categories||[]).filter(category=>category.active!==0).map(category=>[category.code,category.name]);
  const categories=[['suggested',copy.categories.suggested],...dynamic,['all',copy.categories.all]];
  if(!activeStoreCategory||!categories.some(([key])=>key===activeStoreCategory))activeStoreCategory='suggested';
  $('storeCategoryChips').innerHTML=categories.map(([key,label])=>`<button class="${key===activeStoreCategory?'active':''}" data-store-category="${esc(key)}" type="button">${esc(label)}</button>`).join('');
  $('storeCategoryChips').querySelectorAll('button').forEach(button=>button.onclick=()=>{activeStoreCategory=button.dataset.storeCategory;renderStore();});
  let products=[...(storeData.products||[])];
  if(activeStoreCategory==='suggested'){
    const profilePriorities=storeData.customerProfile?.recommendedCategories||[];
    const score=product=>{const codes=(product.categories||[]).map(category=>category.code);const matches=profilePriorities.map((code,index)=>codes.includes(code)?Math.max(1,profilePriorities.length-index):0);return Math.max(0,...matches);};
    products=products.sort((a,b)=>Number(Boolean(a.owned))-Number(Boolean(b.owned))||score(b)-score(a)||Number(Boolean(b.featured))-Number(Boolean(a.featured))||Number(a.sort_order||0)-Number(b.sort_order||0)).slice(0,8);
  }else if(activeStoreCategory!=='all')products=products.filter(product=>(product.categories||[]).some(category=>category.code===activeStoreCategory));
  const query=storeSearchTerm.trim().toLowerCase();
  if(query)products=products.filter(product=>storeProductSearchText(product).includes(query));
  $('storePlanBadge').textContent=storeData.plan?.name||'Sin plan';
  $('storeContextText').textContent=preferredUiLocale()==='en'
    ?`Only products compatible with ${storeData.event.name} are shown. Included or granted items are marked.`
    :preferredUiLocale()==='pt'
      ?`Você vê somente produtos compatíveis com ${storeData.event.name}. Itens incluídos ou concedidos estão marcados.`
      :`Sólo ves opciones compatibles con ${storeData.event.name} que todavía puedes adquirir. Lo incluido en tu plan se gestiona en sus módulos correspondientes.`;
  $('storeProductGrid').innerHTML=products.map(product=>{
    const canPreview=product.preview_strategy&&product.preview_strategy!=='none'&&Boolean(eventPreviewSlug());
    const categoryNames=(product.categories||[]).slice(0,2).map(category=>`<span>${esc(category.name)}</span>`).join('');
    return `<article class="store-product ${product.owned?'owned':''}">
      <div class="store-product-meta"><span class="commerce-kind">${esc(commerceKindLabels[product.kind]||product.kind)}</span>${categoryNames}</div>
      <h3>${esc(product.name)}</h3><p>${esc(product.description)}</p>
      <div class="store-card-actions">${canPreview?`<button class="secondary-btn preview-store-product" data-id="${product.id}" type="button">Probar</button>`:''}
      ${product.owned?`<span class="status-pill confirmed">${esc(storeOwnershipLabel(product))}</span>`:`<button class="primary-btn add-store-product" data-id="${product.id}" type="button">${copy.add}</button>`}</div>
      <strong class="store-product-price">${product.owned?esc(storeOwnershipLabel(product)):money(product.price_cents)}</strong>
    </article>`;
  }).join('')||'<p class="muted">No hay productos que coincidan con esta búsqueda.</p>';
  document.querySelectorAll('.add-store-product').forEach(button=>button.onclick=()=>addStoreProduct(Number(button.dataset.id)));
  document.querySelectorAll('.preview-store-product').forEach(button=>button.onclick=()=>{void previewStoreProduct(Number(button.dataset.id));});
  syncComposerWithCart();
  renderCart();
}

function renderCart(){
  const cart=storeData?.cart||{items:[],subtotal_cents:0,currency:'MXN'};
  $('cartItems').innerHTML=cart.items.length?cart.items.map(item=>`
    <div class="cart-item composer-cart-item"><label class="composer-toggle-label" title="Incluir sólo en la simulación"><input class="composer-toggle" data-id="${item.product_id}" type="checkbox" ${storeComposerEnabledIds.has(Number(item.product_id))?'checked':''}><span>Simular</span></label><span>${esc(item.name)}</span>${item.kind==='storage'?`<label class="cart-quantity">Cantidad<input class="storage-cart-quantity" data-id="${item.product_id}" type="number" min="1" max="100" value="${item.quantity}"></label>`:`<small>${esc(composerProductSlot(item))}</small>`}<strong>${money(item.unit_price_cents*item.quantity)}</strong><button class="remove-cart-item" data-id="${item.product_id}" type="button" aria-label="Quitar">×</button></div>
  `).join(''):'<p class="muted">Aún no has agregado nada.</p>';
  $('cartTotal').textContent=money(cart.subtotal_cents);
  $('submitCartBtn').disabled=!cart.items.length||storeData.paymentProvider==='pending-integration';
  $('submitCartBtn').textContent=storeData.paymentProvider==='pending-integration'?'Pago próximamente':'Continuar al pago';
  const candidate=(storeData.plans||[]).filter(plan=>Number(plan.price_cents)>=Number(cart.subtotal_cents)&&plan.code!==storeData.plan?.code).sort((a,b)=>a.price_cents-b.price_cents)[0];
  $('planComparison').innerHTML=cart.items.length&&candidate
    ?`<strong>También puedes comparar</strong><span>${esc(candidate.name)} cuesta ${money(candidate.price_cents)} y ya reúne varias herramientas.</span>`
    :'';
  document.querySelectorAll('.remove-cart-item').forEach(button=>button.onclick=()=>removeStoreProduct(Number(button.dataset.id)));
  document.querySelectorAll('.storage-cart-quantity').forEach(input=>input.onchange=()=>updateStoreQuantity(Number(input.dataset.id),Number(input.value)));
  document.querySelectorAll('.composer-toggle').forEach(input=>input.onchange=()=>toggleComposerProduct(Number(input.dataset.id),input.checked));
}

async function loadStore(){
  if(['owner','developer'].includes(currentUser?.role)||!eventId)return renderStore();
  const response=await api('/api/store');
  storeData=await readJson(response,'Tienda del evento');
  renderStore();
  if(!storePreviewUrl){
    const base=await ensureEventPreviewBaseUrl();
    if(base)setStorePreview(base,{title:'Tu invitación',hint:'Vista de tu invitación actual. Prueba un producto o simula el carrito para comparar.',open:false});
  }
}
async function addStoreProduct(productId){
  const response=await api('/api/store/cart/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo agregar.',false);
  storeData.cart=data.cart;storeComposerEnabledIds.add(Number(productId));renderStore();status('Producto agregado a tu selección.');
  const product=storeData.products.find(item=>Number(item.id)===Number(productId));trackConversion('cart_added',{productId,productCode:product?.code||''});
}
async function removeStoreProduct(productId){
  const response=await api(`/api/store/cart/items/${productId}`,{method:'DELETE'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo quitar.',false);
  storeData.cart=data.cart;storeComposerEnabledIds.delete(Number(productId));renderStore();
}
async function updateStoreQuantity(productId,quantity){
  const response=await api(`/api/store/cart/items/${productId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({quantity})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo cambiar la cantidad.',false);
  storeData.cart=data.cart;renderStore();
}
$('storeSearchInput')?.addEventListener('input',event=>{
  storeSearchTerm=event.target.value||'';renderStore();
  if(storeSearchTerm.trim().length>=3)trackConversion('store_search',{queryLength:storeSearchTerm.trim().length});
});
$('clearCartBtn')?.addEventListener('click',async()=>{
  if(!storeData?.cart?.items?.length)return;
  if(!confirm('¿Vaciar la selección guardada de este evento?'))return;
  const response=await api('/api/store/cart',{method:'DELETE'});const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo vaciar la selección.',false);
  storeData.cart=data.cart;storeComposerEnabledIds.clear();renderStore();status('Selección vaciada.');
});
$('simulateCartBtn')?.addEventListener('click',async()=>{
  const base=await ensureEventPreviewBaseUrl();
  const url=buildComposerPreviewUrl(base);
  if(!url)return status('Agrega al menos un producto con vista previa para simularlo.',false);
  setStorePreview(url,{title:'Simulación de tu selección',hint:'Esta es la combinación actual de tu selección. Cierra la vista, cambia los elementos y vuelve a probar para comparar.',open:true});
  trackConversion('store_product_previewed',{source:'cart-composer'});
});
$('storePreviewReplay')?.addEventListener('click',()=>{
  const frame=$('storePreviewFrame');if(!frame||!storePreviewUrl)return;frame.src=replayablePreviewUrl(storePreviewUrl);
});
$('previewPhoneModeBtn')?.addEventListener('click',()=>setStorePreviewDevice('phone'));
$('previewDesktopModeBtn')?.addEventListener('click',()=>setStorePreviewDevice('desktop'));
$('closeStorePreviewBtn')?.addEventListener('click',closeStorePreview);
$('storePreviewDialog')?.addEventListener('click',event=>{if(event.target===event.currentTarget)closeStorePreview();});
$('closeThemePreviewBtn')?.addEventListener('click',()=>{ $('themePreviewDialog')?.close();if($('themePreviewFrame'))$('themePreviewFrame').src='about:blank';});
$('themePreviewDialog')?.addEventListener('click',event=>{if(event.target===event.currentTarget){event.currentTarget.close();if($('themePreviewFrame'))$('themePreviewFrame').src='about:blank';}});
window.addEventListener('resize',()=>{if($('storePreviewDialog')?.open)fitPreviewStage($('storePreviewStage'),storePreviewDeviceMode);if($('themePreviewDialog')?.open)fitPreviewStage($('themePreviewStage'),'phone');});
$('phonePreviewBtn')?.addEventListener('click',async()=>{
  const response=await api('/api/admin/preview-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({minutes:120})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo crear el enlace temporal.',false);
  const url=new URL(data.url,window.location.origin);
  Object.entries(composerOptions()).forEach(([key,value])=>{if(value)url.searchParams.set(key,value);});
  const absolute=url.href;
  try{await navigator.clipboard.writeText(absolute);status('Enlace temporal copiado. Ábrelo en tu teléfono; caduca automáticamente.');}
  catch{status('Enlace temporal creado. Ábrelo desde la vista previa.');}
  if($('storePreviewHint'))$('storePreviewHint').innerHTML=`Enlace temporal multidispositivo válido hasta ${esc(data.expiresAt||'')}. <a href="${esc(absolute)}" target="_blank" rel="noopener">Abrir</a>`;
  trackConversion('preview_link_created',{source:'store-composer'});
});
$('submitCartBtn')?.addEventListener('click',async()=>{
  if(storeData?.paymentProvider==='pending-integration')return status('La selección queda guardada; el cobro se habilitará al conectar el proveedor.',false);
  trackConversion('checkout_started',{subtotalCents:storeData?.cart?.subtotal_cents||0});
  const response=await api('/api/store/cart/submit',{method:'POST'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    if(data.code==='CART_CONTAINS_OWNED_PRODUCT'){
      await loadStore();
      return status(data.error||'Tu plan o una cortesía ya incluye uno de esos productos. Actualizamos la selección para evitar un cobro duplicado.',false);
    }
    return status(data.error||'No se pudo preparar el pago.',false);
  }
  if(data.demoConfirmationAvailable){
    if(!confirm(`Compra demo por ${money(data.subtotal_cents)}. ¿Confirmar y activar ahora?`))return status(data.message);
    const confirmation=await api(`/api/store/orders/${data.orderId}/confirm-demo`,{method:'POST'});
    const result=await confirmation.json().catch(()=>({}));
    status(confirmation.ok?result.message:(result.error||'No se pudo confirmar la compra.'),confirmation.ok);
    if(confirmation.ok)trackConversion('payment_completed',{orderId:data.orderId,subtotalCents:data.subtotal_cents});
  }else if(data.checkoutUrl){status('Redirigiendo al pago seguro…');window.location.assign(data.checkoutUrl);return;}
  else status(data.message);
  await Promise.all([loadStore(),loadStorageUsage(),loadNotifications()]);
});

async function loadBilling(){
  const bRes=await api('/api/billing/me');
  if(!bRes.ok)return;
  const b=await bRes.json(),plans=b.plans||[],sub=b.subscription,locale=preferredUiLocale(),copy=UI_COPY[locale];
  const words={
    es:{state:'Estado',validity:'Vigencia',until:'Hasta',events:'evento(s)',guests:'invitados',history:'Historial',none:'Sin suscripción activa.',days:'días',retention:'días de conservación'},
    en:{state:'Status',validity:'Valid until',until:'Up to',events:'event(s)',guests:'guests',history:'History',none:'No active subscription.',days:'days',retention:'retention days'},
    pt:{state:'Estado',validity:'Vigência',until:'Até',events:'evento(s)',guests:'convidados',history:'Histórico',none:'Sem assinatura ativa.',days:'dias',retention:'dias de conservação'}
  }[locale];
  $('subscriptionSummary').innerHTML=sub?`<div class="subscription-card"><strong>${esc(sub.name)}</strong><span>${words.state}: ${esc(sub.status)}</span><span>${words.validity}: ${esc(sub.ends_at||'—')}</span><span>${words.until} ${sub.max_events} ${words.events}, ${sub.max_guests} ${words.guests} y ${sub.max_storage_mb} MB</span></div>`:`<p>${words.none}</p>`;
  $('billingPlans').innerHTML=['demo','mercadopago'].includes(b.provider)?plans.map(p=>`<article class="plan-card"><h3>${esc(p.name)}</h3><strong>$${(p.price_cents/100).toLocaleString('es-MX')} ${p.currency}</strong><p>${p.duration_days} ${words.days} · ${p.retention_days||0} ${words.retention} · ${p.max_events} ${words.events} · ${p.max_guests} ${words.guests}</p><button class="primary-btn payment-checkout" data-plan="${p.code}">${sub?.code===p.code?copy.billing.renew:copy.billing.upgrade}</button></article>`).join(''):'<p class="muted">Checkout no disponible.</p>';
  $('paymentHistory').innerHTML=`<h3>${words.history}</h3>${b.payments.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Referencia</th><th>Importe</th><th>Estado</th></tr></thead><tbody>${b.payments.map(x=>`<tr><td>${esc(x.created_at)}</td><td>${esc(x.provider_reference||'')}</td><td>$${(x.amount_cents/100).toLocaleString('es-MX')} ${x.currency}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">—</p>'}`;
  document.querySelectorAll('.payment-checkout').forEach(btn=>btn.onclick=async()=>{if(b.provider==='demo'&&!confirm('Este pago es sólo una simulación de desarrollo. ¿Continuar?'))return;const r=await api('/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planCode:btn.dataset.plan})});const d=await r.json();if(!r.ok)return status(d.error||'No se pudo preparar el pago.',false);if(d.checkoutUrl){status('Redirigiendo al pago seguro…');window.location.assign(d.checkoutUrl);return;}status(d.message,true);await loadBilling();});
  enhanceResponsiveTables($('tab-billing'));
}
const baseTabHandler=tab;
tab=function(name){
  baseTabHandler(name);
  if(name==='users')scheduleDeferredTask('tab-users',()=>loadUsers(),0);
  if(name==='guests')scheduleDeferredTask('tab-guests',()=>ensureGuestsLoaded(),0);
  if(name==='photos')scheduleDeferredTask('tab-photo-tables',()=>ensureTableNamesLoaded(),0);
  if(name==='qr'&&featureAccess.qrCards!==false)scheduleDeferredTask('tab-qr',async()=>{await Promise.all([ensureGuestsLoaded(),ensureTableNamesLoaded()]);await qr('');},0);
  if(name==='tables-lab')scheduleDeferredTask('tab-seating',()=>loadSeating(),0);
  if(name==='owner')scheduleDeferredTask('tab-owner',async()=>{
    await Promise.all([loadOwnerDashboard(),loadPlatformEvents(),loadPlatformSummary(),loadBackups(),loadCommerceWorkbench(),loadOwnerCommercialCenter()]);
  },0);
  if(name==='billing')scheduleDeferredTask('tab-billing',async()=>{
    await Promise.all([loadBilling(),loadDomains(),loadStorageUsage(),loadStore()]);
  },0);
};

async function loadBackups(){
  if(!['owner','developer'].includes(currentUser?.role)||!$('backupRows'))return;
  const response=await api('/api/admin/backups');
  if(!response.ok)return;
  const rows=await response.json();
  $('backupRows').innerHTML=rows.length?rows.map(row=>`<article class="row-between"><div><strong>${esc(row.filename)}</strong><br><small>${esc(row.created_at)} · ${(Number(row.size_bytes||0)/1024/1024).toFixed(2)} MB · SHA-256 ${esc(String(row.checksum_sha256||'').slice(0,16))}…</small></div>${row.status==='ready'?`<button class="mini-btn backup-download" data-id="${row.id}" data-name="${esc(row.filename)}">Descargar</button>`:`<span>${esc(row.status)}</span>`}</article>`).join(''):'<p class="muted">Todavía no hay respaldos.</p>';
  document.querySelectorAll('.backup-download').forEach(button=>button.onclick=()=>download(`/api/admin/backups/${button.dataset.id}/download`,button.dataset.name));
}
$('createBackupBtn')?.addEventListener('click',async()=>{
  const button=$('createBackupBtn');button.disabled=true;status('Creando respaldo completo…');
  try{const response=await api('/api/admin/backups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'panel-manual'})});const data=await response.json();status(response.ok?'Respaldo creado. Descárgalo y guárdalo fuera del servidor.':data.error,response.ok);if(response.ok)await loadBackups();}finally{button.disabled=false;}
});

function backupFormData(){
  const file=$('restoreBackupFile')?.files?.[0];
  if(!file)return null;
  const form=new FormData();form.append('backup',file,file.name);return form;
}
$('restoreBackupFile')?.addEventListener('change',()=>{
  $('restoreBackupPreview')?.classList.add('hidden');
  if($('restoreBackupSummary'))$('restoreBackupSummary').innerHTML='';
  if($('restoreBackupConfirmation'))$('restoreBackupConfirmation').value='';
});
$('restoreBackupForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=backupFormData();if(!form)return status('Selecciona un respaldo ZIP.',false);
  const button=$('inspectBackupBtn');button.disabled=true;status('Validando manifiesto, huella y base SQLite…');
  try{
    const response=await api('/api/admin/backups/inspect',{method:'POST',body:form});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return status(data.error||'El respaldo no es válido.',false);
    const summary=data.summary||{};
    $('restoreBackupSummary').innerHTML=`<strong>Respaldo válido</strong><p>Versión ${esc(summary.appVersion||'no indicada')} · ${Number(summary.uploadFiles||0)} archivo(s) · ${(Number(summary.unpackedBytes||summary.databaseBytes||0)/1024/1024).toFixed(2)} MB descomprimidos.</p><small>Creado: ${esc(summary.createdAt||'sin fecha')} · Base SHA-256 ${esc(String(summary.databaseSha256||'').slice(0,20))}…${summary.disabledDemoAccounts?` · ${summary.disabledDemoAccounts} cuenta(s) demo se desactivarán`:''}</small>`;
    $('restoreBackupPreview').classList.remove('hidden');status('El respaldo es compatible. Revisa el resumen antes de restaurar.');
  }finally{button.disabled=false;}
});
$('applyBackupRestoreBtn')?.addEventListener('click',async()=>{
  const form=backupFormData();if(!form)return status('Selecciona nuevamente el respaldo ZIP.',false);
  const confirmation=$('restoreBackupConfirmation')?.value.trim();
  if(confirmation!=='RESTAURAR')return status('Escribe RESTAURAR para confirmar.',false);
  if(!confirm('Se creará un respaldo de regreso y EventStudio se reiniciará. ¿Continuar?'))return;
  form.append('confirmation',confirmation);
  const button=$('applyBackupRestoreBtn');button.disabled=true;status('Creando rollback y preparando restauración…');
  try{
    const response=await api('/api/admin/backups/restore',{method:'POST',body:form});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){button.disabled=false;return status(data.error||'No se pudo preparar la restauración.',false);}
    status(`Restauración validada. Punto de regreso: ${data.rollback?.filename||'creado'}. Esperando reinicio…`);
    window.setTimeout(async function waitForRestoredServer(){
      try{const health=await fetch('/api/health',{cache:'no-store'});if(health.ok)return location.reload();}catch{}
      window.setTimeout(waitForRestoredServer,1800);
    },2500);
  }catch(error){button.disabled=false;status(error.message||'La conexión se interrumpió antes de confirmar la restauración.',false);}
});

async function restoreSession(){
  const me=await api('/api/auth/me?optional=1');if(!me.ok){localStorage.removeItem('authToken');authToken='';return;}
  const session=await me.json();if(!session.authenticated){localStorage.removeItem('authToken');authToken='';return;}
  currentUser=session;if(currentUser.must_change_password&&!(await forcePasswordChange()))return;events=await(await api('/api/admin/events')).json();const savedEventId=Number(localStorage.getItem('eventId'));eventId=events.some(e=>e.id===savedEventId)?savedEventId:events[0]?.id;localStorage.setItem('eventId',String(eventId||''));renderEvents();
      applyRoleUI();
      $('loginScreen').classList.add('hidden');
      $('adminApp').classList.remove('hidden');
      await load();
}
loadPublicPlans().catch(error=>{console.error(error);if($('loginStatus'))$('loginStatus').textContent=error.message||'No se pudo cargar el catálogo de acceso.';});
restoreSession().catch(error=>{console.error(error);if($('loginStatus'))$('loginStatus').textContent=error.message||'No se pudo restaurar la sesión.';});
async function loadPlatformSummary(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  const r=await api('/api/admin/platform-summary');
  if(!r.ok)return;
  const d=await r.json();
  if($('pBusinessClients'))$('pBusinessClients').textContent=d.clients;
  if($('pBusinessEvents'))$('pBusinessEvents').textContent=d.events;
  if($('pBusinessWeddings'))$('pBusinessWeddings').textContent=d.weddings;
  if($('pBusinessGuests'))$('pBusinessGuests').textContent=d.guests;
  if($('pBusinessPhotos'))$('pBusinessPhotos').textContent=d.photos;
}

if($('deleteSelectedGuestsBtn'))$('deleteSelectedGuestsBtn').onclick=async()=>{
  const ids=selectedGuestIds();
  if(!ids.length)return status('Selecciona al menos una invitación para eliminar.',false);
  if(!confirm(`¿Eliminar ${ids.length} invitación(es) seleccionada(s)? También se eliminarán sus confirmaciones asociadas.`))return;
  const r=await api('/api/admin/guests/delete-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return status(d.error||'No se pudieron eliminar.',false);
  status(`${d.deleted} invitación(es) eliminada(s).`);
  await refreshGuestsAfterMutation();
};


$('cleanMissingMediaBtn')?.addEventListener('click',async()=>{
  const count=Number(settings._mediaHealth?.missingCount||0);
  if(!count)return renderMediaHealth();
  if(!confirm(`¿Quitar ${count} referencia(s) a archivos que no existen en esta copia? Esto no elimina archivos físicos ni URLs externas.`))return;
  const response=await api('/api/admin/media/missing',{method:'DELETE'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudieron limpiar las referencias.',false);
  settings=data.settings||settings;
  fillSettings();
  status(data.removed?`${data.removed} referencia(s) no disponibles retiradas de la configuración.`:'No había referencias faltantes para limpiar.');
});


const UI_COPY={
  es:{
    nav:{dashboard:'Resumen',settings:'Configuración',templates:'Plantillas',guests:'Invitados',qr:'QR e impresión','tables-lab':'Plano y mesas',photos:'Fotografías',owner:'Mi negocio',users:'Usuarios',billing:'Plan y extras'},
    eventActive:'Evento activo',newEvent:'＋ Nuevo evento',logout:'Cerrar sesión',
    clientWorkspace:'Panel de mi evento',clientContext:'Aquí administras únicamente los eventos contratados o incluidos en tu plan.',
    storeTitle:'Extras para tu evento',storeSelection:'Tu selección',storePay:'Continuar al pago',included:'Incluido',active:'Activo',add:'Agregar',
    billing:{subscription:'Plan y pagos',storage:'Espacio del evento',upgrades:'Extras para tu evento',domain:'Dirección de tu evento',language:'Idioma del panel',renew:'Renovar',upgrade:'Mejorar'},
    categories:{suggested:'Sugeridos',essentials:'Invitación',templates:'Plantillas',animations:'Animaciones',logistics:'Logística',photos:'Fotografías',print:'Impresión',all:'Todo'}
  },
  en:{
    nav:{dashboard:'Overview',settings:'Settings',templates:'Templates',guests:'Guests',qr:'QR & print','tables-lab':'Floor plan & tables',photos:'Photos',owner:'My business',users:'Users',billing:'Plan & upgrades'},
    eventActive:'Active event',newEvent:'＋ New event',logout:'Sign out',
    clientWorkspace:'My event dashboard',clientContext:'Here you manage only the events and tools included in your plan.',
    storeTitle:'Upgrades for this event',storeSelection:'Your selection',storePay:'Continue to payment',included:'Included',active:'Active',add:'Add',
    billing:{subscription:'Plan & payments',storage:'Event storage',upgrades:'Upgrades for this event',domain:'Event address',language:'Dashboard language',renew:'Renew',upgrade:'Upgrade'},
    categories:{suggested:'Suggested',essentials:'Invitation',templates:'Templates',animations:'Animations',logistics:'Logistics',photos:'Photos',print:'Print',all:'All'}
  },
  pt:{
    nav:{dashboard:'Resumo',settings:'Configurações',templates:'Modelos',guests:'Convidados',qr:'QR e impressão','tables-lab':'Planta e mesas',photos:'Fotos',owner:'Meu negócio',users:'Usuários',billing:'Plano e melhorias'},
    eventActive:'Evento ativo',newEvent:'＋ Novo evento',logout:'Sair',
    clientWorkspace:'Painel do meu evento',clientContext:'Aqui você administra somente os eventos e recursos incluídos no seu plano.',
    storeTitle:'Melhorias para este evento',storeSelection:'Sua seleção',storePay:'Continuar para o pagamento',included:'Incluído',active:'Ativo',add:'Adicionar',
    billing:{subscription:'Plano e pagamentos',storage:'Espaço do evento',upgrades:'Melhorias para este evento',domain:'Endereço do evento',language:'Idioma do painel',renew:'Renovar',upgrade:'Melhorar'},
    categories:{suggested:'Sugeridos',essentials:'Convite',templates:'Modelos',animations:'Animações',logistics:'Logística',photos:'Fotos',print:'Impressão',all:'Tudo'}
  }
};
function preferredUiLocale(){
  const locale=String(currentUser?.preferred_locale||currentUser?.preferredLocale||'es').toLowerCase();
  return UI_COPY[locale]?locale:'es';
}
function applyInterfaceLocale(){
  const locale=preferredUiLocale(),copy=UI_COPY[locale];
  document.documentElement.lang=locale;
  document.querySelectorAll('.tab-btn[data-tab]').forEach(button=>{
    const span=button.querySelector('span');
    if(span&&copy.nav[button.dataset.tab])span.textContent=copy.nav[button.dataset.tab];
  });
  const eventLabel=document.querySelector('.event-switcher-label');
  if(eventLabel?.firstChild)eventLabel.firstChild.textContent=copy.eventActive;
  if($('newEventBtn'))$('newEventBtn').textContent=copy.newEvent;
  if($('logoutBtn'))$('logoutBtn').textContent=copy.logout;
  if($('topLogoutBtn'))$('topLogoutBtn').textContent=copy.logout;
  const storeTitle=$('clientStoreCard')?.querySelector('h2');
  if(storeTitle)storeTitle.textContent=copy.storeTitle;
  const billingHeadings=[
    [$('subscriptionCard')?.querySelector('h2'),copy.billing.subscription],
    [$('storageUsageCard')?.querySelector('h2'),copy.billing.storage],
    [$('domainManagerCard')?.querySelector('h2'),copy.billing.domain],
    [document.querySelector('#tab-billing .account-preferences-card h2'),copy.billing.language]
  ];
  billingHeadings.forEach(([element,text])=>{if(element)element.textContent=text;});
  const cartTitle=$('clientStoreCard')?.querySelector('.cart-card h3');
  if(cartTitle)cartTitle.textContent=copy.storeSelection;
  if($('submitCartBtn')&&!$('submitCartBtn').disabled)$('submitCartBtn').textContent=copy.storePay;
  translateStaticInterface(locale);
  configureAutomaticTranslation();
}
const STATIC_I18N={
  en:{
    'La traducción manual permanece disponible. La generación automática se habilita al configurar un proveedor seguro en el servidor.':'Manual translation remains available. Automatic generation is enabled after a secure provider is configured on the server.',
    'Simular vista cliente':'Simulate client view',
    'Mi cuenta':'My account','Idioma del panel':'Dashboard language','Idioma':'Language','Fotografías recibidas':'Received photos','Estado':'Status','Todas':'All','Pendientes':'Pending','Aprobadas':'Approved','No aprobadas / ocultas':'Not approved / hidden','Descargar selección':'Download selection','Productos y disponibilidad':'Products & availability','Catálogo único':'Unified catalog','Constructor de paquetes':'Package builder','Clientes':'Clients','Eventos alojados':'Hosted events','Respaldos y restauración':'Backups & restore','Plan activo':'Active plan','Plan y pagos':'Plan & payments','Tu selección':'Your selection','Total':'Total','Probar':'Preview','Cerrar':'Close','Reproducir':'Replay','Teléfono':'Phone','Computadora':'Desktop','Abrir en otro dispositivo':'Open on another device','Borrador':'Draft','Publicado':'Published','Oculto':'Hidden','Guardar':'Save','Buscar':'Search',
    'Mi negocio':'My business','Galería pública':'Public showcase','Marketing visual':'Visual marketing','Abrir galería pública':'Open public showcase','Analítica de conversión':'Conversion analytics','Productos más vistos':'Most viewed products','Plantillas más vistas':'Most viewed templates','Tipos de evento':'Event types','Planes comerciales':'Commercial plans','Perfiles comerciales':'Commercial profiles','Categorías de tienda':'Store categories','Publicación y marca':'Publishing & branding','Solicitudes de publicación':'Publishing requests','Actualizar':'Refresh','Crear':'Create','Editar':'Edit','Disponible':'Available','Experimental':'Experimental','Deshabilitado':'Disabled','Aprobado':'Approved','Laboratorio':'Lab','Retirado':'Retired','Precio':'Price','Vista previa':'Preview','Agregar':'Add','Adquirido':'Purchased','Incluido en tu plan':'Included in your plan','Cortesía':'Courtesy','Promoción activa':'Active promotion','Vaciar selección':'Clear selection','Continuar al pago':'Continue to payment','Pago próximamente':'Payment coming soon','Simulación en contexto':'Context preview','Vista previa del producto':'Product preview','Fotografías':'Photos','Mesa':'Table','No aprobada':'Not approved','Aprobar':'Approve','Volver a pendiente':'Return to pending','Eliminar':'Delete','Plan y extras':'Plan & extras','Tu plan activo':'Your active plan','Extras para tu evento':'Extras for your event','Publicación y dirección':'Publishing & address','Almacenamiento':'Storage','Configuración':'Settings','Invitados':'Guests','QR e impresión':'QR & print','Plano y mesas':'Floor plan & tables','Usuarios':'Users','Resumen':'Overview','Plantillas':'Templates','Nuevo producto':'New product','Nuevo perfil':'New profile','Nueva categoría':'New category','Activo':'Active','Inactivo':'Inactive','Puede ver todo lo disponible':'Can view everything available','Sólo productos asignados':'Only assigned products','Categorías recomendadas':'Recommended categories','Productos visibles para este perfil':'Products visible for this profile','Crear prueba privada':'Create private trial','Volver al acceso':'Back to sign in','Explorar plantillas y paquetes':'Explore templates & packages','Iniciar sesión':'Sign in','Fuentes y uso de mayúsculas':'Fonts and capitalization','Fuente de títulos':'Heading font','Fuente de texto':'Body font','Presentación de nombres y títulos':'Name and title casing','Guardar tipografía y mayúsculas':'Save typography and casing','Kit de diseño global':'Global design kit','Colores, textura y estilo coordinados':'Coordinated colors, texture and style','Textura':'Texture','Sin textura':'No texture','Papel fino':'Fine paper','Lino sutil':'Subtle linen','Grano suave':'Soft grain','Lavado acuarela':'Watercolor wash','Personalizar paleta del evento':'Customize event palette','Fondo':'Background','Papel':'Paper','Texto':'Text','Secundario':'Secondary','Acento':'Accent','Metal/detalle':'Metal/detail','Línea':'Line','Guardar kit':'Save kit','Usar colores de la plantilla':'Use template colors','Identidad del evento':'Event identity','Tipo y textos visibles':'Type and visible text','Tipo de evento':'Event type','Texto superior de portada':'Cover eyebrow','Botón principal':'Primary button','Título de confirmación':'RSVP title','Encabezado de agenda':'Schedule heading','Nombre para invitados':'Guest label','Título del resumen':'Summary title','Descripción del resumen':'Summary description','Aplicar textos sugeridos para este tipo':'Apply suggested copy','Idiomas':'Languages','Invitación multilingüe':'Multilingual invitation','Idioma principal':'Primary language','Idiomas disponibles para el invitado':'Languages available to guests','Generar traducciones':'Generate translations','Guardar idiomas y textos':'Save languages and text','Contenido':'Content','Información del evento':'Event information','Nombre principal':'Primary name','Segundo nombre, opcional':'Second name, optional','Título público del evento':'Public event title','Fecha principal del evento':'Main event date','Fecha escrita':'Written date','Mensaje portada':'Cover message','Mensaje final':'Closing message','Historia':'Story','Código de vestimenta':'Dress code','Descripción':'Description','Confirmaciones':'RSVP settings','Fecha y hora de cierre':'RSVP closing date and time','Guardar configuración':'Save settings','Programa y ubicaciones':'Schedule & locations','Momentos del evento':'Event moments','Configurar':'Configure','Obsequios':'Gifts','Modalidad de regalos':'Gift options','Multimedia':'Media','Portada, música y galerías':'Cover, music and galleries','Portada':'Cover','Álbum':'Gallery','Referencias de vestimenta':'Dress references','Subir portada':'Upload cover','Agregar fotos':'Add photos','Agregar referencias':'Add references','Música de la invitación':'Invitation music','Selecciona una sola fuente':'Choose one source','Sin música':'No music','Subir archivo':'Upload file','Subir y seleccionar':'Upload and select','Eliminar archivo cargado':'Remove uploaded file','Guardar selección de música':'Save music selection','Álbum de la invitación':'Invitation gallery','Archivo no disponible':'File unavailable','Modo desarrollador':'Developer mode','Pruebas internas':'Internal tests','Aviso en vista previa':'Preview notice','Tipografía':'Typography','Cargando evento…':'Loading event…','Cargando el mensaje de este evento…':'Loading this event message…','Georgia elegante':'Elegant Georgia','Baskerville clásica':'Classic Baskerville','Garamond romántica':'Romantic Garamond','Didot editorial':'Editorial Didot','Palatino ceremonial':'Ceremonial Palatino','Great Vibes caligráfica':'Calligraphic Great Vibes','Cormorant romántica':'Romantic Cormorant','Playfair editorial':'Editorial Playfair','Cinzel ceremonial':'Ceremonial Cinzel','Sistema limpia':'Clean system font','Humanista amable':'Friendly humanist','Clásica legible':'Readable classic','Lora cálida':'Warm Lora','Montserrat moderna':'Modern Montserrat','Cormorant elegante':'Elegant Cormorant','Como fue capturado':'As entered','Mayúsculas y minúsculas automáticas (recomendado)':'Automatic capitalization (recommended)','Todo en mayúsculas':'All uppercase','Versalitas':'Small caps','Se aplica a la invitación digital, vistas previas, QR e invitación física. Las fuentes caligráficas se leen mejor con mayúsculas y minúsculas combinadas.':'Applies to the digital invitation, previews, QR and printed invitation. Calligraphic fonts read best with mixed upper and lower case.','La plantilla sigue siendo la base. Si activas este kit, EventStudio coordina colores y una textura superficial discreta entre invitación web, QR e impresos compatibles, manteniendo contraste legible.':'The template remains the base. When enabled, EventStudio coordinates colors and a subtle surface texture across the web invitation, QR and compatible print pieces while keeping readable contrast.','Usa una base sugerida y personaliza sólo los textos que necesites.':'Use suggested copy as a base and customize only what you need.','Traduce controles, fechas y también los mensajes personalizados del evento.':'Translates controls, dates and the event’s custom messages.','Español':'Spanish','English':'English','Português':'Portuguese','Las traducciones se guardan con el evento y pueden corregirse antes de publicar. La generación automática requiere configurar un proveedor seguro en el servidor.':'Translations are saved with the event and can be corrected before publishing. Automatic generation requires a secure provider configured on the server.','Los horarios se configuran únicamente en “Programa y ubicaciones”.':'Times are configured only in “Schedule & locations”.','Restaurar texto automático':'Restore automatic text','Se genera al cambiar la fecha; después puedes personalizar el texto.':'Generated when the date changes; you can customize the text afterward.','Vacío mantiene las confirmaciones abiertas.':'Leave empty to keep RSVPs open.','Revisar lugares sin confirmar desde':'Review unconfirmed seats from','Después de esta fecha EventStudio sólo marcará lugares como candidatos para liberar. Nunca mueve, elimina ni sustituye invitados automáticamente.':'After this date EventStudio only marks seats as candidates to release. It never moves, removes or replaces guests automatically.','Permitir que una familia modifique su respuesta':'Allow a family to change its response','Permitir cambiar la combinación adulto/niño sin superar los lugares totales':'Allow changing the adult/child mix without exceeding total seats','Límite del mensaje en fotos':'Photo message limit','Menús':'Menus','Cómo se servirá el menú':'How the menu will be served','Menú fijo para adultos y menú fijo para niños':'Fixed adult menu and fixed children’s menu','Cada invitado distribuye sus platillos entre opciones':'Each guest distributes meals among options','En modo fijo sólo se pedirán alergias o restricciones; en modo elección la suma se controla contra los asistentes confirmados.':'In fixed mode only allergies or restrictions are requested; in choice mode totals are checked against confirmed attendees.','Menús adulto, uno por línea':'Adult menu options, one per line','Menús infantil, uno por línea':'Children’s menu options, one per line','Explicación de menú':'Menu explanation','Configura las partes y ubicaciones del evento.':'Configure the event moments and locations.','Programa público':'Public schedule','Momentos y ubicaciones':'Moments & locations','Activa únicamente las partes que tendrá este evento. Cada momento puede usar la misma ubicación o una diferente.':'Enable only the moments this event will have. Each moment can use the same or a different location.','Mostrar programa en la invitación':'Show schedule in the invitation','Los momentos desactivados no se mostrarán.':'Disabled moments will not be shown.','Todos los momentos en la misma ubicación':'All moments at the same location','Al activarlo se reutilizan lugar, dirección y mapa del primer momento.':'When enabled, the first moment’s venue, address and map are reused.','＋ Agregar momento personalizado':'＋ Add custom moment','Guardar programa y ubicaciones':'Save schedule & locations','Tipo':'Type','Sobres y buzón':'Envelopes & mailbox','Mesa de regalos':'Gift registry','Transferencia':'Bank transfer','Opciones combinadas':'Combined options','Sin regalos':'No gifts','Título':'Title','Mensaje principal':'Main message','Enlace de mesa de regalos':'Gift registry link','Texto del botón':'Button text','Datos de transferencia':'Transfer details','Guardar modalidad de regalos':'Save gift options','Referencias multimedia pendientes de restaurar':'Media references awaiting restore','Quitar referencias no disponibles':'Remove unavailable references','Puedes subir un archivo o elegir Spotify. Ambas opciones permiten guardar un punto de inicio.':'You can upload a file or choose Spotify. Both options can save a start point.','No se mostrará reproductor.':'No player will be shown.','MP3, M4A, OGG u otro audio compatible.':'MP3, M4A, OGG or another compatible audio format.','Spotify':'Spotify','Pega el enlace de una canción, álbum o playlist.':'Paste a song, album or playlist link.','Iniciar desde':'Start at','00:00':'00:00','Escuchar desde aquí':'Listen from here','Enlace de canción, álbum o playlist':'Song, album or playlist link','Cargar vista previa':'Load preview','El punto se aplica con el reproductor oficial. La reproducción automática sigue dependiendo del navegador y de la conexión del invitado.':'The start point is applied with the official player. Autoplay still depends on the browser and the guest’s connection.','Eliminar enlace de Spotify':'Remove Spotify link','Ej. Mis XV años o Evento especial':'E.g. My quinceañera or Special event','Abrir invitación':'Open invitation','Confirma tu asistencia':'Confirm your attendance','Familia o invitado':'Family or guest','Persona, festejado o marca':'Person, honoree or brand','Opcional':'Optional','Banco, titular, CLABE o indicaciones':'Bank, account holder, CLABE or instructions'
  },
  pt:{
    'La traducción manual permanece disponible. La generación automática se habilita al configurar un proveedor seguro en el servidor.':'A tradução manual continua disponível. A geração automática é habilitada após configurar um provedor seguro no servidor.',
    'Simular vista cliente':'Simular visão do cliente',
    'Mi cuenta':'Minha conta','Idioma del panel':'Idioma do painel','Idioma':'Idioma','Fotografías recibidas':'Fotos recebidas','Estado':'Estado','Todas':'Todas','Pendientes':'Pendentes','Aprobadas':'Aprovadas','No aprobadas / ocultas':'Não aprovadas / ocultas','Descargar selección':'Baixar seleção','Productos y disponibilidad':'Produtos e disponibilidade','Catálogo único':'Catálogo único','Constructor de paquetes':'Construtor de pacotes','Clientes':'Clientes','Eventos alojados':'Eventos hospedados','Respaldos y restauración':'Backups e restauração','Plan activo':'Plano ativo','Plan y pagos':'Plano e pagamentos','Tu selección':'Sua seleção','Total':'Total','Probar':'Testar','Cerrar':'Fechar','Reproducir':'Reproduzir','Teléfono':'Telefone','Computadora':'Computador','Abrir en otro dispositivo':'Abrir em outro dispositivo','Borrador':'Rascunho','Publicado':'Publicado','Oculto':'Oculto','Guardar':'Salvar','Buscar':'Buscar',
    'Mi negocio':'Meu negócio','Galería pública':'Galeria pública','Marketing visual':'Marketing visual','Abrir galería pública':'Abrir galeria pública','Analítica de conversión':'Analítica de conversão','Productos más vistos':'Produtos mais vistos','Plantillas más vistas':'Modelos mais vistos','Tipos de evento':'Tipos de evento','Planes comerciales':'Planos comerciais','Perfiles comerciales':'Perfis comerciais','Categorías de tienda':'Categorias da loja','Publicación y marca':'Publicação e marca','Solicitudes de publicación':'Solicitações de publicação','Actualizar':'Atualizar','Crear':'Criar','Editar':'Editar','Disponible':'Disponível','Experimental':'Experimental','Deshabilitado':'Desativado','Aprobado':'Aprovado','Laboratorio':'Laboratório','Retirado':'Retirado','Precio':'Preço','Vista previa':'Prévia','Agregar':'Adicionar','Adquirido':'Adquirido','Incluido en tu plan':'Incluído no seu plano','Cortesía':'Cortesia','Promoción activa':'Promoção ativa','Vaciar selección':'Limpar seleção','Continuar al pago':'Continuar para o pagamento','Pago próximamente':'Pagamento em breve','Simulación en contexto':'Simulação em contexto','Vista previa del producto':'Prévia do produto','Fotografías':'Fotos','Mesa':'Mesa','No aprobada':'Não aprovada','Aprobar':'Aprovar','Volver a pendiente':'Voltar para pendente','Eliminar':'Excluir','Plan y extras':'Plano e extras','Tu plan activo':'Seu plano ativo','Extras para tu evento':'Extras para seu evento','Publicación y dirección':'Publicação e endereço','Almacenamiento':'Armazenamento','Configuración':'Configurações','Invitados':'Convidados','QR e impresión':'QR e impressão','Plano y mesas':'Planta e mesas','Usuarios':'Usuários','Resumen':'Resumo','Plantillas':'Modelos','Nuevo producto':'Novo produto','Nuevo perfil':'Novo perfil','Nueva categoría':'Nova categoria','Activo':'Ativo','Inactivo':'Inativo','Puede ver todo lo disponible':'Pode ver tudo disponível','Sólo productos asignados':'Somente produtos atribuídos','Categorías recomendadas':'Categorias recomendadas','Productos visibles para este perfil':'Produtos visíveis para este perfil','Crear prueba privada':'Criar teste privado','Volver al acceso':'Voltar ao acesso','Explorar plantillas y paquetes':'Explorar modelos e pacotes','Iniciar sesión':'Entrar','Fuentes y uso de mayúsculas':'Fontes e uso de maiúsculas','Fuente de títulos':'Fonte dos títulos','Fuente de texto':'Fonte do texto','Presentación de nombres y títulos':'Apresentação de nomes e títulos','Guardar tipografía y mayúsculas':'Salvar tipografia e maiúsculas','Kit de diseño global':'Kit de design global','Colores, textura y estilo coordinados':'Cores, textura e estilo coordenados','Textura':'Textura','Sin textura':'Sem textura','Papel fino':'Papel fino','Lino sutil':'Linho sutil','Grano suave':'Grão suave','Lavado acuarela':'Lavagem aquarela','Personalizar paleta del evento':'Personalizar paleta do evento','Fondo':'Fundo','Papel':'Papel','Texto':'Texto','Secundario':'Secundário','Acento':'Acento','Metal/detalle':'Metal/detalhe','Línea':'Linha','Guardar kit':'Salvar kit','Usar colores de la plantilla':'Usar cores do modelo','Identidad del evento':'Identidade do evento','Tipo y textos visibles':'Tipo e textos visíveis','Tipo de evento':'Tipo de evento','Texto superior de portada':'Texto superior da capa','Botón principal':'Botão principal','Título de confirmación':'Título da confirmação','Encabezado de agenda':'Cabeçalho da agenda','Nombre para invitados':'Nome para convidados','Título del resumen':'Título do resumo','Descripción del resumen':'Descrição do resumo','Aplicar textos sugeridos para este tipo':'Aplicar textos sugeridos','Idiomas':'Idiomas','Invitación multilingüe':'Convite multilíngue','Idioma principal':'Idioma principal','Idiomas disponibles para el invitado':'Idiomas disponíveis ao convidado','Generar traducciones':'Gerar traduções','Guardar idiomas y textos':'Salvar idiomas e textos','Contenido':'Conteúdo','Información del evento':'Informações do evento','Nombre principal':'Nome principal','Segundo nombre, opcional':'Segundo nome, opcional','Título público del evento':'Título público do evento','Fecha principal del evento':'Data principal do evento','Fecha escrita':'Data por extenso','Mensaje portada':'Mensagem da capa','Mensaje final':'Mensagem final','Historia':'História','Código de vestimenta':'Código de vestimenta','Descripción':'Descrição','Confirmaciones':'Confirmações','Fecha y hora de cierre':'Data e hora de encerramento','Guardar configuración':'Salvar configurações','Programa y ubicaciones':'Programa e locais','Momentos del evento':'Momentos do evento','Configurar':'Configurar','Obsequios':'Presentes','Modalidad de regalos':'Modalidade de presentes','Multimedia':'Multimídia','Portada, música y galerías':'Capa, música e galerias','Portada':'Capa','Álbum':'Álbum','Referencias de vestimenta':'Referências de vestimenta','Subir portada':'Enviar capa','Agregar fotos':'Adicionar fotos','Agregar referencias':'Adicionar referências','Música de la invitación':'Música do convite','Selecciona una sola fuente':'Selecione uma única fonte','Sin música':'Sem música','Subir archivo':'Enviar arquivo','Subir y seleccionar':'Enviar e selecionar','Eliminar archivo cargado':'Excluir arquivo enviado','Guardar selección de música':'Salvar seleção de música','Álbum de la invitación':'Álbum do convite','Archivo no disponible':'Arquivo indisponível','Modo desarrollador':'Modo desenvolvedor','Pruebas internas':'Testes internos','Aviso en vista previa':'Aviso na prévia','Tipografía':'Tipografia','Cargando evento…':'Carregando evento…','Cargando el mensaje de este evento…':'Carregando a mensagem deste evento…','Georgia elegante':'Georgia elegante','Baskerville clásica':'Baskerville clássica','Garamond romántica':'Garamond romântica','Didot editorial':'Didot editorial','Palatino ceremonial':'Palatino cerimonial','Great Vibes caligráfica':'Great Vibes caligráfica','Cormorant romántica':'Cormorant romântica','Playfair editorial':'Playfair editorial','Cinzel ceremonial':'Cinzel cerimonial','Sistema limpia':'Fonte limpa do sistema','Humanista amable':'Humanista amigável','Clásica legible':'Clássica legível','Lora cálida':'Lora acolhedora','Montserrat moderna':'Montserrat moderna','Cormorant elegante':'Cormorant elegante','Como fue capturado':'Como foi digitado','Mayúsculas y minúsculas automáticas (recomendado)':'Maiúsculas e minúsculas automáticas (recomendado)','Todo en mayúsculas':'Tudo em maiúsculas','Versalitas':'Versaletes','Se aplica a la invitación digital, vistas previas, QR e invitación física. Las fuentes caligráficas se leen mejor con mayúsculas y minúsculas combinadas.':'Aplica-se ao convite digital, prévias, QR e convite impresso. Fontes caligráficas ficam mais legíveis com maiúsculas e minúsculas combinadas.','La plantilla sigue siendo la base. Si activas este kit, EventStudio coordina colores y una textura superficial discreta entre invitación web, QR e impresos compatibles, manteniendo contraste legible.':'O modelo continua sendo a base. Ao ativar este kit, o EventStudio coordena cores e uma textura superficial discreta entre convite web, QR e impressos compatíveis, mantendo contraste legível.','Usa una base sugerida y personaliza sólo los textos que necesites.':'Use uma base sugerida e personalize apenas os textos necessários.','Traduce controles, fechas y también los mensajes personalizados del evento.':'Traduz controles, datas e também as mensagens personalizadas do evento.','Español':'Espanhol','English':'Inglês','Português':'Português','Las traducciones se guardan con el evento y pueden corregirse antes de publicar. La generación automática requiere configurar un proveedor seguro en el servidor.':'As traduções são salvas com o evento e podem ser corrigidas antes da publicação. A geração automática exige um provedor seguro configurado no servidor.','Los horarios se configuran únicamente en “Programa y ubicaciones”.':'Os horários são configurados somente em “Programa e locais”.','Restaurar texto automático':'Restaurar texto automático','Se genera al cambiar la fecha; después puedes personalizar el texto.':'É gerado ao alterar a data; depois você pode personalizar o texto.','Vacío mantiene las confirmaciones abiertas.':'Deixe vazio para manter as confirmações abertas.','Revisar lugares sin confirmar desde':'Revisar lugares não confirmados a partir de','Después de esta fecha EventStudio sólo marcará lugares como candidatos para liberar. Nunca mueve, elimina ni sustituye invitados automáticamente.':'Após esta data o EventStudio apenas marca lugares como candidatos a liberação. Nunca move, remove ou substitui convidados automaticamente.','Permitir que una familia modifique su respuesta':'Permitir que uma família altere sua resposta','Permitir cambiar la combinación adulto/niño sin superar los lugares totales':'Permitir alterar a combinação adulto/criança sem exceder o total de lugares','Límite del mensaje en fotos':'Limite da mensagem nas fotos','Menús':'Menus','Cómo se servirá el menú':'Como o menu será servido','Menú fijo para adultos y menú fijo para niños':'Menu fixo para adultos e menu fixo infantil','Cada invitado distribuye sus platillos entre opciones':'Cada convidado distribui seus pratos entre as opções','En modo fijo sólo se pedirán alergias o restricciones; en modo elección la suma se controla contra los asistentes confirmados.':'No modo fixo serão solicitadas apenas alergias ou restrições; no modo de escolha o total é validado contra os participantes confirmados.','Menús adulto, uno por línea':'Opções de menu adulto, uma por linha','Menús infantil, uno por línea':'Opções de menu infantil, uma por linha','Explicación de menú':'Explicação do menu','Configura las partes y ubicaciones del evento.':'Configure os momentos e locais do evento.','Programa público':'Programa público','Momentos y ubicaciones':'Momentos e locais','Activa únicamente las partes que tendrá este evento. Cada momento puede usar la misma ubicación o una diferente.':'Ative somente os momentos que este evento terá. Cada momento pode usar o mesmo local ou um local diferente.','Mostrar programa en la invitación':'Mostrar programa no convite','Los momentos desactivados no se mostrarán.':'Momentos desativados não serão exibidos.','Todos los momentos en la misma ubicación':'Todos os momentos no mesmo local','Al activarlo se reutilizan lugar, dirección y mapa del primer momento.':'Ao ativar, o local, endereço e mapa do primeiro momento são reutilizados.','＋ Agregar momento personalizado':'＋ Adicionar momento personalizado','Guardar programa y ubicaciones':'Salvar programa e locais','Tipo':'Tipo','Sobres y buzón':'Envelopes e caixa','Mesa de regalos':'Lista de presentes','Transferencia':'Transferência','Opciones combinadas':'Opções combinadas','Sin regalos':'Sem presentes','Título':'Título','Mensaje principal':'Mensagem principal','Enlace de mesa de regalos':'Link da lista de presentes','Texto del botón':'Texto do botão','Datos de transferencia':'Dados de transferência','Guardar modalidad de regalos':'Salvar opções de presentes','Referencias multimedia pendientes de restaurar':'Referências de mídia aguardando restauração','Quitar referencias no disponibles':'Remover referências indisponíveis','Puedes subir un archivo o elegir Spotify. Ambas opciones permiten guardar un punto de inicio.':'Você pode enviar um arquivo ou escolher Spotify. Ambas as opções permitem salvar um ponto de início.','No se mostrará reproductor.':'Nenhum player será exibido.','MP3, M4A, OGG u otro audio compatible.':'MP3, M4A, OGG ou outro formato de áudio compatível.','Spotify':'Spotify','Pega el enlace de una canción, álbum o playlist.':'Cole o link de uma música, álbum ou playlist.','Iniciar desde':'Iniciar em','00:00':'00:00','Escuchar desde aquí':'Ouvir a partir daqui','Enlace de canción, álbum o playlist':'Link de música, álbum ou playlist','Cargar vista previa':'Carregar prévia','El punto se aplica con el reproductor oficial. La reproducción automática sigue dependiendo del navegador y de la conexión del invitado.':'O ponto é aplicado com o player oficial. A reprodução automática ainda depende do navegador e da conexão do convidado.','Eliminar enlace de Spotify':'Remover link do Spotify','Ej. Mis XV años o Evento especial':'Ex. Meus 15 anos ou Evento especial','Abrir invitación':'Abrir convite','Confirma tu asistencia':'Confirme sua presença','Familia o invitado':'Família ou convidado','Persona, festejado o marca':'Pessoa, homenageado ou marca','Opcional':'Opcional','Banco, titular, CLABE o indicaciones':'Banco, titular, CLABE ou instruções'
  }
};
function canonicalStaticSpanish(text){
  const current=String(text||'').trim();
  if(!current)return current;
  if(Object.prototype.hasOwnProperty.call(STATIC_I18N.en,current)||Object.prototype.hasOwnProperty.call(STATIC_I18N.pt,current))return current;
  for(const locale of ['en','pt']){
    for(const [spanish,translated] of Object.entries(STATIC_I18N[locale]||{})){
      if(current===translated)return spanish;
    }
  }
  return current;
}
const STATIC_I18N_OBSERVER_OPTIONS={childList:true,subtree:true,characterData:true};
let staticI18nObserver=null;
function translateStaticInterface(locale){
  const map=STATIC_I18N[locale]||{};
  const shouldResumeObserver=Boolean(staticI18nObserver&&document.body);
  // La traducción cambia nodos del DOM. Desconectar temporalmente evita que el
  // MutationObserver se dispare a sí mismo y monopolice el hilo principal.
  if(shouldResumeObserver)staticI18nObserver.disconnect();
  try{
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){const parent=node.parentElement;if(!parent||['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(parent.tagName)||parent.closest('[data-no-auto-i18n]'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});
    let node;
    while((node=walker.nextNode())){
      const raw=String(node.nodeValue||'');
      const trimmed=raw.trim();
      if(!trimmed)continue;
      const spanish=canonicalStaticSpanish(trimmed);
      const translated=locale==='es'?spanish:(map[spanish]||spanish);
      if(translated!==trimmed)node.nodeValue=raw.replace(trimmed,translated);
    }
    document.querySelectorAll('select option').forEach(option=>{
      const current=String(option.textContent||'');const spanish=canonicalStaticSpanish(current);const translated=locale==='es'?spanish:((map[spanish])||spanish);if(translated!==current)option.textContent=translated;
    });
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(element=>{
      for(const attribute of ['placeholder','title','aria-label']){
        if(!element.hasAttribute(attribute))continue;
        const current=element.getAttribute(attribute)||'';const spanish=canonicalStaticSpanish(current);const translated=locale==='es'?spanish:(map[spanish]||spanish);if(translated!==current)element.setAttribute(attribute,translated);
      }
    });
  }finally{
    if(shouldResumeObserver&&document.body)staticI18nObserver.observe(document.body,STATIC_I18N_OBSERVER_OPTIONS);
  }
}
let staticI18nScheduled=false;
function scheduleStaticInterfaceTranslation(){
  if(staticI18nScheduled)return;
  staticI18nScheduled=true;
  queueMicrotask(()=>{
    staticI18nScheduled=false;
    if(document.body)translateStaticInterface(preferredUiLocale());
  });
}
if(document.body){
  staticI18nObserver=new MutationObserver(scheduleStaticInterfaceTranslation);
  staticI18nObserver.observe(document.body,STATIC_I18N_OBSERVER_OPTIONS);
}

async function loadAccountContext(){
  const r=await api('/api/account/context');
  if(!r.ok)return;
  const c=await r.json();
  currentUser.preferred_locale=c.preferredLocale||currentUser.preferred_locale||'es';
  if($('accountLocale'))$('accountLocale').value=preferredUiLocale();
  applyInterfaceLocale();
  const platform=c.isPlatformUser;
  $('accountContextIcon').textContent=platform?'◆':'♡';
  $('accountContextTitle').textContent=platform?'Vista de propietario y desarrollo':UI_COPY[preferredUiLocale()].clientWorkspace;
  $('accountContextText').textContent=platform
    ? `Aquí ves todos los clientes y eventos. ${supportClientView?'Vista cliente simula únicamente las herramientas del evento seleccionado; tus permisos de propietario/desarrollador no cambian.':'Vista técnica completa: administración, negocio y herramientas de plataforma.'}`
    : UI_COPY[preferredUiLocale()].clientContext;
  if(platform){
    $('subscriptionBadge').textContent=currentUser?.role==='owner'?'PROPIETARIO':'DESARROLLADOR';
    $('clientPlanCard')?.classList.add('hidden');
  }else{
    const e=c.entitlement;
    $('subscriptionBadge').textContent=e?`${e.plan_name} · ${e.status}`:'SIN PLAN';
    $('clientPlanCard')?.classList.remove('hidden');
    $('clientPlanTitle').textContent=e?`Plan ${e.plan_name}`:'Cuenta sin plan activo';
    $('clientPlanText').textContent=e
      ? `${c.eventCount} de ${e.max_events} evento(s) utilizados. Estado: ${e.status}. Vigencia: ${e.ends_at||'sin fecha'}.`
      : 'La cuenta existe, pero necesita una prueba o pago vigente para alojar eventos.';
    $('createClientEventBtn').disabled=!c.canCreateEvent;
    $('createClientEventBtn').textContent=c.canCreateEvent?'Crear otro evento':'Límite del plan alcanzado';
  }
}
function notificationGrants(item){
  try{return JSON.parse(item?.grants_json||'[]');}catch{return [];}
}
function notificationDestination(item){
  if(!item)return 'dashboard';
  if(!item.product_id&&item.kind==='courtesy')return 'billing';
  const grants=notificationGrants(item);
  const slot=String(item.presentation_slot||'');
  if(slot==='theme'||slot==='opening'||grants.some(value=>String(value).startsWith('theme:')||String(value).startsWith('opening:')||value==='templates'||value==='premiumTemplates'))return 'templates';
  if(slot==='print'||grants.some(value=>['qr','physicalInvitations','qrCards'].includes(String(value))))return 'qr';
  if(slot==='storage')return 'billing';
  if(grants.some(value=>['guestPhotoUpload','guestPhotoMessages'].includes(String(value))))return 'photos';
  if(grants.some(value=>['seating','tablesLab','menus'].includes(String(value))))return 'tables-lab';
  if(grants.some(value=>['guests','rsvp','whatsappManual','whatsappBusiness','reports'].includes(String(value))))return 'guests';
  if(slot==='gallery'||grants.some(value=>['gallery','music','program','locations','dressCode','gifts'].includes(String(value))))return 'settings';
  return 'dashboard';
}
function renderNewFeatureBadges(items=[]){
  document.querySelectorAll('.nav-new-badge').forEach(node=>node.remove());
  const unreadCourtesy=items.filter(item=>item.kind==='courtesy'&&!item.read_at);
  const tabs=new Set(unreadCourtesy.map(notificationDestination));
  tabs.forEach(tabName=>{
    const button=document.querySelector(`.tab-btn[data-tab="${CSS.escape(tabName)}"]`);
    if(!button)return;
    const badge=document.createElement('span');badge.className='nav-new-badge';badge.textContent='NEW';badge.setAttribute('aria-label','Contenido nuevo');button.appendChild(badge);
  });
}
function showNotificationDetail(item){
  if(!item)return;
  const dialog=$('notificationDetailDialog');if(!dialog)return;
  $('notificationDetailTitle').textContent=item.product_name||item.title||'Notificación';
  $('notificationDetailMessage').textContent=item.message||'';
  const meta=[];
  if(item.event_name)meta.push(`Evento: ${item.event_name}`);
  if(item.product_kind)meta.push(`Tipo: ${commerceKindLabels[item.product_kind]||item.product_kind}`);
  if(item.created_at)meta.push(`Recibido: ${item.created_at}`);
  $('notificationDetailMeta').textContent=meta.join(' · ');
  $('notificationDetailDescription').textContent=item.product_description||(
    item.kind==='courtesy'?'Esta cortesía ya forma parte de los derechos de tu evento mientras permanezca vigente.':''
  );
  const action=$('notificationDetailAction');
  const destination=notificationDestination(item);
  if(action){
    action.dataset.tab=destination;action.dataset.eventId=item.event_id||'';
    action.textContent=destination==='billing'?'Ver mi plan y extras':'Abrir la sección';
  }
  showDialog(dialog);
}
async function openNotification(item){
  if(!item)return;
  if(!item.read_at){
    const response=await api(`/api/account/notifications/${item.id}/read`,{method:'PATCH'});
    if(response.ok)item.read_at=new Date().toISOString();
  }
  showNotificationDetail(item);
  await loadNotifications();
}
async function loadNotifications(){
  if(!currentUser)return;
  const response=await api('/api/account/notifications');
  if(!response.ok)return;
  const data=await response.json();
  accountNotifications=data.items||[];
  if($('notificationCount')){
    $('notificationCount').textContent=data.unread||0;
    $('notificationCount').hidden=!data.unread;
  }
  renderNewFeatureBadges(accountNotifications);
  if($('notificationList'))$('notificationList').innerHTML=accountNotifications.length
    ?accountNotifications.map(item=>`<button class="notification-item ${item.read_at?'read':'unread'}" data-id="${item.id}" type="button"><b>${esc(item.title)}</b><span>${esc(item.message)}</span><small>${esc(item.created_at)}</small></button>`).join('')
    :'<p class="muted">Todavía no tienes notificaciones.</p>';
  document.querySelectorAll('.notification-item').forEach(button=>button.onclick=()=>openNotification(accountNotifications.find(item=>Number(item.id)===Number(button.dataset.id))));
}
$('notificationBtn')?.addEventListener('click',async()=>{await loadNotifications();showDialog($('notificationDialog'));});
$('notificationDetailAction')?.addEventListener('click',async event=>{
  const target=event.currentTarget;
  const targetEventId=Number(target.dataset.eventId||0);
  $('notificationDetailDialog')?.close();$('notificationDialog')?.close();
  if(targetEventId&&targetEventId!==eventId&&events.some(item=>item.id===targetEventId))await switchActiveEvent(targetEventId);
  tab(target.dataset.tab||'dashboard');
});
$('closeNotificationDetailBtn')?.addEventListener('click',()=>$('notificationDetailDialog')?.close());
$('notificationDetailDialog')?.addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close();});
$('accountLocale')?.addEventListener('change',async event=>{
  const response=await api('/api/account/locale',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({locale:event.target.value})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo cambiar el idioma.',false);
  currentUser.preferred_locale=data.locale;
  applyInterfaceLocale();
  await loadAccountContext();
  status(data.locale==='en'?'Interface language updated.':data.locale==='pt'?'Idioma da interface atualizado.':'Idioma de la interfaz actualizado.');
});


$('copyPublicEventUrlBtn')?.addEventListener('click',async()=>{
  const url=$('publicEventUrl')?.value||'';
  if(!url)return status('El evento todavía no tiene un enlace público.',false);
  try{await navigator.clipboard.writeText(url);status('Enlace público copiado.');}
  catch{status('No se pudo copiar automáticamente. Selecciona el enlace y cópialo manualmente.',false);}
});
async function createEventForCurrentUser(){
  const available=eventTypes.length?eventTypes:[{id:'wedding',name:'Boda'},{id:'xv',name:'XV años'},{id:'birthday',name:'Cumpleaños'},{id:'corporate',name:'Empresarial'},{id:'graduation',name:'Graduación'},{id:'custom',name:'Personalizado'}];
  $('newEventType').innerHTML=available.map(item=>`<option value="${esc(item.id)}">${item.icon||'◆'} ${esc(item.name)}</option>`).join('');
  $('newEventName').value='';
  showDialog($('newEventDialog'));
  $('newEventName').focus({preventScroll:true});
}
$('newEventForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const name=$('newEventName').value.trim();
  const type=$('newEventType').value||'custom';
  if(!name)return;
  const r=await api('/api/admin/events',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,eventType:type})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return status(d.error||'No se pudo crear el evento.',false);
  $('newEventDialog').close();
  await switchActiveEvent(d.id,{refresh:true});
  status('Evento creado.');
});
if($('createClientEventBtn'))$('createClientEventBtn').onclick=createEventForCurrentUser;
if($('newEventBtn'))$('newEventBtn').onclick=createEventForCurrentUser;

$('giftCashEnabled')?.addEventListener('change',updateGiftFields);
$('giftRegistryEnabled')?.addEventListener('change',updateGiftFields);
$('giftBankInfoEnabled')?.addEventListener('change',updateGiftFields);
$('giftOpenpayEnabled')?.addEventListener('change',updateGiftFields);
$('giftOpenpayMessageEnabled')?.addEventListener('change',updateGiftFields);
$('giftBankPersuasionPreset')?.addEventListener('change',updateGiftPersuasionFields);
$('giftBankPersuasionCustom')?.addEventListener('input',updateGiftPersuasionFields);
$('giftOpenpaySuggestedAmount')?.addEventListener('input',event=>{
  if(String(event.target.value||'').trim()==='')setChecked('giftOpenpayAllowCustom',true);
});


const AGENDA_LIBRARY=[
  {type:'ceremony',title:'Ceremonia',icon:'♡'},
  {type:'reception',title:'Recepción o celebración',icon:'✦'},
  {type:'welcome',title:'Cóctel o rompehielos',icon:'◌'},
  {type:'rehearsal',title:'Cena de ensayo',icon:'◇'},
  {type:'afterparty',title:'Tornaboda o fiesta posterior',icon:'♫'}
];

const GENERAL_AGENDA_LIBRARY=[
  {type:'ceremony',title:'Actividad principal',icon:'◇'},
  {type:'reception',title:'Recepción',icon:'✦'},
  {type:'welcome',title:'Bienvenida',icon:'◌'},
  {type:'rehearsal',title:'Comida o cena',icon:'□'},
  {type:'afterparty',title:'Actividad posterior',icon:'♫'}
];

function agendaLibraryForEvent(){
  const eventType=settings._event?.event_type||settings.event?.eventType||'custom';
  return eventType==='wedding'?AGENDA_LIBRARY:GENERAL_AGENDA_LIBRARY;
}

function agendaDefaultItem(type,index){
  return {
    id:`${type.type}-${Date.now()}-${index}`,
    type:type.type,
    title:type.title,
    enabled:false,
    date:'',
    time:'',
    venue:'',
    address:'',
    mapsUrl:'',
    dressCode:'',
    audience:'all',
    notes:''
  };
}

function agendaCard(item,index){
  return `<article class="agenda-item-card" data-id="${esc(item.id||`item-${index}`)}" data-type="${esc(item.type||'custom')}">
    <div class="agenda-card-head">
      <span>${item.type==='custom'?'＋':([...AGENDA_LIBRARY,...GENERAL_AGENDA_LIBRARY].find(x=>x.type===item.type)?.icon||'◫')}</span>
      <div><strong>${esc(item.title||'Momento del evento')}</strong><small>${item.type==='custom'?'Momento personalizado':'Parte configurable del evento'}</small></div>
      <input class="agenda-enabled" type="checkbox" ${item.enabled?'checked':''}>
    </div>
    <div class="form-grid">
      <label>Título<input class="agenda-title" value="${esc(item.title||'')}"></label>
      <label>Fecha<input class="agenda-date" type="date" value="${esc(item.date||'')}"></label>
      <label>Hora<input class="agenda-time" type="time" value="${esc(item.time||'')}"></label>
      <label>Público<select class="agenda-audience"><option value="all" ${item.audience==='all'?'selected':''}>Todos los invitados</option><option value="selected" ${item.audience==='selected'?'selected':''}>Sólo invitados seleccionados</option></select></label>
      <label class="wide agenda-location-field">Lugar<input class="agenda-venue" value="${esc(item.venue||'')}" placeholder="Nombre del lugar"></label>
      <label class="wide agenda-location-field">Dirección<input class="agenda-address" value="${esc(item.address||'')}" placeholder="Dirección completa"></label>
      <label class="wide agenda-location-field">Enlace de Google Maps<input class="agenda-map" value="${esc(item.mapsUrl||'')}" placeholder="https://maps.app.goo.gl/..."></label>
      <label>Código de vestimenta<input class="agenda-dress" value="${esc(item.dressCode||'')}" placeholder="Opcional"></label>
      <label class="wide">Notas<textarea class="agenda-notes" placeholder="Indicaciones opcionales">${esc(item.notes||'')}</textarea></label>
      ${item.type==='custom'?'<button class="mini-btn remove-agenda-item wide" type="button">Quitar momento</button>':''}
    </div>
  </article>`;
}


function updateAgendaCompactSummary(){
  const agenda=settings.agenda||{};
  const active=(agenda.items||[]).filter(item=>item.enabled);
  const summary=$('agendaCompactSummary');
  if(!summary)return;
  if(!agenda.enabled||!active.length){summary.textContent='El programa no se mostrará en la invitación.';return;}
  const names=active.map(item=>item.title).filter(Boolean).slice(0,3).join(', ');
  const extra=active.length>3?` y ${active.length-3} más`:'';
  summary.textContent=`${active.length} momento(s): ${names}${extra}. ${agenda.sameLocation?'Todos en la misma ubicación.':'Con ubicaciones independientes.'}`;
}
function renderAgendaLab(){
  const grid=$('agendaItemsGrid');
  if(!grid)return;
  const agenda=settings.agenda||{enabled:false,sameLocation:false,items:[]};
  setChecked('agendaEnabled',!!agenda.enabled);
  setChecked('agendaSameLocation',!!agenda.sameLocation);

  const existing=agenda.items||[];
  const standard=agendaLibraryForEvent().map((type,index)=>
    existing.find(item=>item.type===type.type)||agendaDefaultItem(type,index)
  );
  const custom=existing.filter(item=>item.type==='custom');
  const items=[...standard,...custom];

  grid.innerHTML=items.map(agendaCard).join('');
  bindAgendaCards();
  updateAgendaLocationMode();
  updateAgendaCompactSummary();
}

function bindAgendaCards(){
  document.querySelectorAll('.remove-agenda-item').forEach(button=>{
    button.onclick=()=>button.closest('.agenda-item-card')?.remove();
  });
}

function updateAgendaLocationMode(){
  const same=!!$('agendaSameLocation')?.checked;
  const cards=[...document.querySelectorAll('.agenda-item-card')];
  cards.forEach((card,index)=>{
    card.querySelectorAll('.agenda-location-field').forEach(field=>{
      field.classList.toggle('shared-location-muted',same&&index>0);
      field.querySelectorAll('input').forEach(input=>input.disabled=same&&index>0);
    });
  });
}

function addCustomAgendaItem(){
  const grid=$('agendaItemsGrid');
  if(!grid)return;
  const wrapper=document.createElement('div');
  wrapper.innerHTML=agendaCard({
    id:`custom-${Date.now()}`,
    type:'custom',
    title:'Momento personalizado',
    enabled:true,
    date:'',
    time:'',
    venue:'',
    address:'',
    mapsUrl:'',
    dressCode:'',
    audience:'all',
    notes:''
  },grid.children.length);
  grid.appendChild(wrapper.firstElementChild);
  bindAgendaCards();
  updateAgendaLocationMode();
}

function collectAgendaLab(){
  const sameLocation=!!$('agendaSameLocation')?.checked;
  const items=[...document.querySelectorAll('.agenda-item-card')].map(card=>({
    id:card.dataset.id||`${card.dataset.type}-${Date.now()}`,
    type:card.dataset.type||'custom',
    title:card.querySelector('.agenda-title')?.value.trim()||'',
    enabled:!!card.querySelector('.agenda-enabled')?.checked,
    date:card.querySelector('.agenda-date')?.value||'',
    time:card.querySelector('.agenda-time')?.value||'',
    venue:card.querySelector('.agenda-venue')?.value.trim()||'',
    address:card.querySelector('.agenda-address')?.value.trim()||'',
    mapsUrl:card.querySelector('.agenda-map')?.value.trim()||'',
    dressCode:card.querySelector('.agenda-dress')?.value.trim()||'',
    audience:card.querySelector('.agenda-audience')?.value||'all',
    notes:card.querySelector('.agenda-notes')?.value.trim()||''
  }));

  if(sameLocation&&items.length){
    const source=items.find(item=>item.venue||item.address||item.mapsUrl)||items[0];
    items.forEach((item,index)=>{
      if(index>0){
        item.venue=source.venue;
        item.address=source.address;
        item.mapsUrl=source.mapsUrl;
      }
    });
  }
  return {enabled:!!$('agendaEnabled')?.checked,sameLocation,items};
}

$('agendaSameLocation')?.addEventListener('change',updateAgendaLocationMode);
$('addCustomAgendaBtn')?.addEventListener('click',addCustomAgendaItem);
if($('saveAgendaBtn'))$('saveAgendaBtn').onclick=async()=>{
  const agenda=collectAgendaLab();
  const enabledItems=agenda.items.filter(item=>item.enabled);
  if(agenda.enabled&&!enabledItems.length){
    return status('Activa al menos un momento antes de mostrar el programa.',false);
  }
  const invalidMap=enabledItems.find(item=>item.mapsUrl&&!/^https?:\/\//i.test(item.mapsUrl));
  if(invalidMap)return status(`El enlace de Maps de "${invalidMap.title}" debe comenzar con http:// o https://.`,false);

  const response=await api('/api/admin/settings',{
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({agenda})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo guardar el programa.',false);
  settings.agenda=agenda;
  updateAgendaCompactSummary();
  $('agendaSettingsDetails')?.removeAttribute('open');
  status('Programa y ubicaciones guardados.');
};

async function loadPublicationStatus(){
  if(!eventId||!$('publicationClientPanel'))return;
  const platformUser=['owner','developer'].includes(currentUser?.role);
  $('publicationClientPanel').classList.toggle('hidden',platformUser);
  if(platformUser)return;
  const response=await api('/api/publication/status');
  if(!response.ok)return;
  const data=await response.json();
  const access=data.access||{},latest=data.latest;
  const statusText=data.event?.published?'Publicado':latest?.status==='pending'?'Esperando aprobación':access.policy==='disabled'?'Publicación deshabilitada':access.auto?'Listo para autopublicar':'Listo para solicitar';
  if($('publicationStatusText'))$('publicationStatusText').textContent=statusText;
  if($('publishedEventLimitText'))$('publishedEventLimitText').textContent=`${access.publishedCount||0} de ${access.maxPublishedEvents??0} sitio(s) publicados · ${access.mode==='manual_owner'?'modo manual':access.policy==='auto_after_entitlement'?'automático cuando el plan lo autorice':'según política configurada'}`;
  if($('requestPublicationBtn')){
    $('requestPublicationBtn').disabled=Boolean(data.event?.published||latest?.status==='pending'||!access.allowed||access.policy==='disabled');
    $('requestPublicationBtn').textContent=data.event?.published?'Sitio publicado':latest?.status==='pending'?'Solicitud enviada':access.auto?'Publicar ahora':'Solicitar publicación';
  }
}
$('requestPublicationBtn')?.addEventListener('click',async()=>{
  const response=await api('/api/publication/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionKey:analyticsSessionKey()})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo solicitar la publicación.',false);
  status(data.published?'El sitio quedó publicado según la política autorizada.':'Solicitud enviada al propietario/desarrollador.');
  await Promise.all([loadPublicationStatus(),loadDomains()]);
});

async function loadDomains(){
  const response=await api('/api/admin/domains');
  if(!response.ok)return;
  const data=await response.json();
  loadPublicationStatus();

  if($('includedEventUrl'))$('includedEventUrl').textContent=data.includedUrl;
  if($('copyIncludedUrlBtn')){
    $('copyIncludedUrlBtn').onclick=async()=>{
      await navigator.clipboard.writeText(data.includedUrl);
      status('Enlace del evento copiado.');
    };
  }

  const aliases=data.aliases||[];
  const verified=aliases.find(item=>item.verified);
  if($('customDomainStatus')){
    $('customDomainStatus').textContent=verified
      ? verified.hostname
      : aliases.length
        ? `${aliases[0].hostname} · pendiente`
        : 'Sin configurar';
  }

  if($('domainRows')){
    $('domainRows').innerHTML=aliases.length
      ? aliases.map(item=>`
        <article class="domain-row">
          <div>
            <strong>${esc(item.hostname)}</strong>
            <span class="status-pill ${item.verified?'confirmed':'pending'}">
              ${item.verified?'Verificado':'Pendiente de DNS'}
            </span>
          </div>
          <button class="mini-btn remove-domain" data-id="${item.id}" type="button">Quitar</button>
        </article>
      `).join('')
      : '<p class="muted">Todavía no has conectado un dominio propio.</p>';

    document.querySelectorAll('.remove-domain').forEach(button=>{
      button.onclick=async()=>{
        if(!confirm('¿Quitar este dominio del evento?'))return;
        const result=await api(`/api/admin/domains/${button.dataset.id}`,{method:'DELETE'});
        if(!result.ok)return status('No se pudo quitar el dominio.',false);
        await loadDomains();
        status('Dominio retirado.');
      };
    });
  }
}

if($('customDomainForm'))$('customDomainForm').onsubmit=async event=>{
  event.preventDefault();
  const hostname=$('customDomainInput').value.trim();
  const response=await api('/api/admin/domains',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({hostname})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo preparar el dominio.',false);

  const instructions=$('domainInstructions');
  instructions.classList.remove('hidden');
  instructions.innerHTML=`
    <h3>Configuración pendiente</h3>
    <p>En el proveedor DNS del dominio crea este registro:</p>
    <dl>
      <div><dt>Tipo</dt><dd>${esc(data.dns.type)}</dd></div>
      <div><dt>Nombre</dt><dd>${esc(data.dns.name)}</dd></div>
      <div><dt>Destino</dt><dd>${esc(data.dns.target)}</dd></div>
    </dl>
    <p class="muted">Cuando publiquemos la plataforma agregaremos la verificación automática y el certificado HTTPS.</p>
  `;
  $('customDomainInput').value='';
  await loadDomains();
  status('Dominio preparado. Falta configurar el DNS.');
};


async function loadStorageUsage(){
  if(!eventId)return;
  const response=await api('/api/admin/storage');
  if(!response.ok)return;
  const data=await response.json();
  const percent=Math.min(100,Number(data.percent||0));
  if($('storageMeterBar')){
    $('storageMeterBar').style.width=`${percent}%`;
    $('storageMeterBar').className=data.status;
  }
  if($('storageUsageText'))$('storageUsageText').textContent=`${data.usedMb} MB de ${data.limitMb} MB utilizados (${data.percent}%)`;
  if($('storageStatusBadge')){
    const labels={ok:'Disponible',warning:'Cerca del límite',critical:'Límite crítico'};
    $('storageStatusBadge').textContent=labels[data.status]||data.status;
    $('storageStatusBadge').className=`status-pill ${data.status==='ok'?'confirmed':data.status==='warning'?'pending':'declined'}`;
  }
  const lifecycle=data.lifecycle||{};
  if($('storageLifecycleText')){
    $('storageLifecycleText').textContent=lifecycle.cleanupStatus==='grace'
      ?`Periodo de tolerancia activo hasta ${lifecycle.graceUntil||'fecha pendiente'}.`
      :lifecycle.cleanupStatus==='purged'
        ?'Los archivos del evento ya fueron liberados.'
        :'Los archivos permanecerán disponibles mientras el plan esté vigente.';
  }
}

$('developerMode')?.addEventListener('change',saveDeveloperModeImmediately);
$('showDevBanner')?.addEventListener('change',saveDeveloperModeImmediately);

async function loadWhatsAppStatus(opt={}){
  if(!$('whatsappProviderBadge'))return;
  const response=await api('/api/admin/whatsapp/status',opt);
  if(!response.ok)return;
  const data=await response.json();
  if(opt.signal?.aborted)return;
  $('whatsappProviderBadge').textContent=data.provider==='simulation'?'Simulación':data.configured?'API oficial':'Manual';
  $('whatsappProviderBadge').className=`status-pill ${data.configured?'confirmed':'pending'}`;
  if($('whatsappActiveProfile'))$('whatsappActiveProfile').textContent=data.activeProfile||'principal';
  if($('whatsappWebhookUrl'))$('whatsappWebhookUrl').textContent=data.webhookUrl||'Se mostrará al publicar';
  if($('whatsappApiRequirement'))$('whatsappApiRequirement').textContent=data.configured?'✓ API oficial lista':'○ API oficial pendiente';
  const labels={phoneNumberId:'Identificador del número',businessAccountId:'Cuenta de WhatsApp Business',accessToken:'Token permanente',appSecret:'Secreto de la aplicación',verifyToken:'Token de verificación del webhook',templateName:'Plantilla aprobada',graphVersion:'Versión de Graph API'};
  if($('whatsappRequirementList')){
    const entries=Object.entries(data.cloudRequirements||{});
    $('whatsappRequirementList').innerHTML=entries.length?entries.map(([key,ready])=>`<span class="${ready?'ready':'pending'}">${ready?'✓':'○'} ${esc(labels[key]||key)}</span>`).join(''):'<span class="ready">✓ Envío manual seguro disponible</span>';
  }
  if($('automaticMessagingHelp'))$('automaticMessagingHelp').textContent=data.reason||'';
  if(!$('automaticMessagingCard')?.classList.contains('hidden'))await loadAutomaticQueue(opt);
}

async function loadAutomaticQueue(opt={}){
  if(!$('automaticMessageRows'))return;
  const response=await api('/api/admin/messaging/queue',opt);
  if(!response.ok){const data=await response.json().catch(()=>({}));$('automaticMessageRows').innerHTML=`<p class="muted">${esc(data.error||'Integración automática no disponible.')}</p>`;return;}
  const rows=await response.json();
  $('automaticMessageRows').innerHTML=rows.length?rows.map(row=>`<article class="row-between"><div><strong>${esc(row.family_name)}</strong><br><small>${esc(row.status)} · ${esc(row.provider)} · intento ${row.attempts}${row.error_message?` · ${esc(row.error_message)}`:''}</small></div><div class="inline-actions">${row.status==='failed'&&row.attempts<5?`<button class="mini-btn retry-message" data-id="${row.id}">Reintentar</button>`:''}${['queued','pending','failed'].includes(row.status)?`<button class="danger-outline-btn cancel-message" data-id="${row.id}">Quitar de la cola</button>`:''}</div></article>`).join(''):'<p class="muted">No hay mensajes automáticos en cola.</p>';
  document.querySelectorAll('.retry-message').forEach(button=>button.onclick=async()=>{const response=await api(`/api/admin/messaging/${button.dataset.id}/retry`,{method:'POST'});const data=await response.json().catch(()=>({}));status(response.ok?'Mensaje devuelto a la cola.':data.error,response.ok);if(response.ok)await loadAutomaticQueue();});
  document.querySelectorAll('.cancel-message').forEach(button=>button.onclick=async()=>{
    if(!confirm('¿Quitar a esta persona de la cola automática?'))return;
    const response=await api('/api/admin/messaging/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[Number(button.dataset.id)]})});
    const data=await response.json().catch(()=>({}));
    status(response.ok?'Persona retirada de la cola.':(data.error||'No se pudo quitar.'),response.ok);
    if(response.ok)await loadAutomaticQueue();
  });
}

$('queueAutomaticBtn')?.addEventListener('click',async()=>{
  const guestIds=selectedGuestIds();if(!guestIds.length)return status('Selecciona al menos un invitado.',false);
  const response=await api('/api/admin/messaging/queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guestIds,kind:'invitation',campaignKey:`panel-${new Date().toISOString().slice(0,10)}`})});
  const data=await response.json().catch(()=>({}));status(response.ok?`${data.queued} encolados; ${data.duplicates} duplicados; ${data.withoutPhone} sin teléfono.`:data.error,response.ok);if(response.ok)await loadAutomaticQueue();
});
$('processAutomaticBtn')?.addEventListener('click',async()=>{
  const response=await api('/api/admin/messaging/process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({all:true})});
  const data=await response.json().catch(()=>({}));status(response.ok?'Cola procesada.':(data.error||'La cola terminó con fallos; revisa los estados.'),response.ok);await loadAutomaticQueue();
});
$('refreshAutomaticBtn')?.addEventListener('click',loadAutomaticQueue);


function enforceAccordionLimit(selector,limit=2){
  const details=[...document.querySelectorAll(selector)];
  details.forEach(item=>item.addEventListener('toggle',()=>{
    if(!item.open)return;
    const opened=details.filter(entry=>entry.open);
    while(opened.length>limit){const previous=opened.shift();if(previous&&previous!==item)previous.open=false;}
  }));
}
function enforceBusinessAccordionLimit(){enforceAccordionLimit('details.business-collapsible',2);}
function enforceSettingsAccordionLimit(){enforceAccordionLimit('details.settings-collapsible',2);}
enforceBusinessAccordionLimit();enforceSettingsAccordionLimit();
