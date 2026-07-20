let authToken='',currentUser=null,eventId=0,events=[],settings={},guests=[],photos=[],themes=[],qrTemplates=[],eventTypes=[],featureAccess={},lastGeneratedDateLabel='',seatingState=null,selectedFloorItem=null,seatingLayoutDirty=false,ownerClients=[],ownerPlans=[];const $=id=>document.getElementById(id);async function api(url,opt={}){
  opt.headers={...(opt.headers||{}),'x-event-id':String(eventId||'')};
  if(authToken)opt.headers.Authorization=`Bearer ${authToken}`;
  opt.credentials='same-origin';
  return fetch(url,opt);
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
}function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}function status(m,ok=true){$('adminStatus').textContent=m;$('adminStatus').className=`status-message ${ok?'success':'error'}`;}function tab(n){document.querySelectorAll('.tab-panel').forEach(x=>x.classList.add('hidden'));document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));$(`tab-${n}`).classList.remove('hidden');document.querySelector(`[data-tab="${n}"]`).classList.add('active');}document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
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
  $('featureControlCard')?.classList.toggle('hidden',!platformUser);
  $('modeBadge')?.classList.toggle('hidden',!platformUser);
  if($('workspaceLabel'))$('workspaceLabel').textContent=platformUser?'Consola de propietario':'Administración de mi evento';
  document.body.classList.toggle('platform-workspace',platformUser);
  document.body.classList.toggle('client-workspace',!platformUser);
}
function renderEvents(){
  const platformUser=['owner','developer'].includes(currentUser?.role);
  $('eventSelect').innerHTML=events.map(e=>{
    const type=e.event_type==='wedding'?'Boda':(e.event_type||'Evento');
    const owner=platformUser&&e.owner_name?` · Cliente: ${e.owner_name}`:'';
    return `<option value="${e.id}" ${e.id===eventId?'selected':''}>${esc(e.name)} · ${esc(type)}${esc(owner)}</option>`;
  }).join('');
  if(currentUser){
    if($('sessionUserName'))$('sessionUserName').textContent=currentUser.displayName||currentUser.display_name||currentUser.email;
    if($('sessionUserRole'))$('sessionUserRole').textContent=platformUser?'Superusuario / desarrollador':'Cliente';
  }
}
async function load(){
  if(!eventId){
    status('Tu cuenta no tiene un evento disponible.',false);
    return;
  }

  status('Cargando espacio de trabajo…');

  try{
    const featureResponse=await api('/api/admin/features');
    const featureContext=await readJson(featureResponse,'Disponibilidad de módulos');
    featureAccess=Object.fromEntries((featureContext.features||[]).map(item=>[item.key,item.allowed]));
    const endpoints=[
      ['/api/admin/dashboard','Resumen'],
      ['/api/admin/settings','Ajustes'],
      [featureAccess.guests!==false?'/api/admin/guests':'','Invitados'],
      [featureAccess.guestPhotoUpload!==false?'/api/admin/photos':'','Fotografías'],
      [featureAccess.seating!==false?'/api/admin/tables':'','Mesas'],
      ['/api/admin/themes','Plantillas'],
      ['/api/admin/qr-templates','Plantillas QR'],
      ['/api/admin/event-types','Tipos de evento']
    ];

    const responses=await Promise.all(endpoints.map(([url])=>url?api(url):null));
    const results=[];

    for(let i=0;i<responses.length;i++){
      results.push(responses[i]?await readJson(responses[i],endpoints[i][1]):[]);
    }

    const [dashboard,loadedSettings,loadedGuests,loadedPhotos,tables,loadedThemes,loadedQrTemplates,loadedEventTypes]=results;

    settings=loadedSettings;
    guests=loadedGuests;
    photos=loadedPhotos;
    themes=loadedThemes;
    qrTemplates=loadedQrTemplates;
    eventTypes=loadedEventTypes;

    if($('panelEventName'))$('panelEventName').textContent=settings._event?.name||'Evento';
    if($('publicEventBtn')){
      const slug=settings._event?.slug;
      $('publicEventBtn').href=slug?`/e/${encodeURIComponent(slug)}`:'#';$('publicEventBtn').rel='noopener';
      $('publicEventBtn').classList.toggle('disabled-link',!slug);
    }

    if($('sInvitations'))$('sInvitations').textContent=dashboard.invitations||0;
    if($('sConfirmed'))$('sConfirmed').textContent=dashboard.confirmed_families||0;
    if($('sAdults'))$('sAdults').textContent=dashboard.adults||0;
    if($('sChildren'))$('sChildren').textContent=dashboard.children||0;
    if($('sTotal'))$('sTotal').textContent=Number(dashboard.adults||0)+Number(dashboard.children||0);
    if($('sPending'))$('sPending').textContent=dashboard.pending_families||0;
    if($('sDietary'))$('sDietary').textContent=dashboard.dietary_records||0;
    if($('sPhotos'))$('sPhotos').textContent=dashboard.photos||0;

    fillSettings();

    applyDynamicPresentation();
    applyFeatureVisibility();
    renderEventTypeOptions();
    updateThemeLivePreview();

    renderGiftPresets();
    renderThemes();
    renderGuests();
    renderPhotos();
    renderQrTemplates();
    renderPhysicalInvitationStudio();

    const options=(tables||[]).map(table=>`<option value="${esc(table)}">${esc(table)}</option>`).join('');
    if($('tableSelect'))$('tableSelect').innerHTML=`<option value="">QR general</option>${options}`;
    if($('photoTableFilter'))$('photoTableFilter').innerHTML=`<option value="">Todas las mesas</option>${options}`;

    if(featureAccess.qrCards!==false)await qr('');
    await loadPlatformSummary();
    await loadAccountContext();
    if(['owner','developer'].includes(currentUser?.role)||featureFlags().whatsappBusiness)await loadWhatsAppStatus();
    if(['owner','developer'].includes(currentUser?.role)){
      await Promise.all([loadOwnerDashboard(),loadPlatformEvents()]);
    }

    status('Espacio de trabajo cargado.');
  }catch(error){
    console.error(error);
    status(error.message||'No se pudo cargar el espacio de trabajo.',false);
  }
}


function renderMedia(containerId,items,type){
  const container=$(containerId);
  if(!container)return;

  if(!Array.isArray(items)||!items.length){
    container.innerHTML='<p class="muted media-empty">No hay archivos cargados todavía.</p>';
    return;
  }

  container.innerHTML=items.map(url=>`
    <figure class="gallery-admin-item">
      <img src="${esc(url)}" alt="Archivo cargado" loading="lazy">
      <button class="mini-btn remove-media" type="button" data-url="${esc(url)}" data-type="${esc(type)}">Quitar</button>
    </figure>
  `).join('');

  container.querySelectorAll('.remove-media').forEach(button=>{
    button.addEventListener('click',async()=>{
      if(!confirm('¿Quitar esta imagen?'))return;
      const response=await api('/api/admin/media/item',{
        method:'DELETE',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({url:button.dataset.url,type:button.dataset.type})
      });
      let data={};
      try{data=await response.json();}catch{}
      if(!response.ok)return status(data.error||'No se pudo quitar la imagen.',false);
      status('Imagen retirada.');
      await load();
    });
  });
}


const GIFT_PRESETS=[
  {
    mode:"cash-envelopes",
    title:"Lluvia de sobres",
    message:"Su presencia es lo más importante para nosotros.",
    description:"Si desean tener un detalle con nosotros, encontrarán sobres en las mesas y un buzón especial donde podrán depositarlos.",
    link:"",
    linkLabel:"",
    bankInfo:"",
    icon:"✉"
  },
  {
    mode:"registry",
    title:"Mesa de regalos",
    message:"Hemos preparado una mesa de regalos para quienes deseen acompañarnos con un detalle.",
    description:"Pueden consultar nuestras opciones en el siguiente enlace.",
    link:"",
    linkLabel:"Ver mesa de regalos",
    bankInfo:"",
    icon:"🎁"
  },
  {
    mode:"bank-transfer",
    title:"Transferencia",
    message:"Su presencia es nuestro mejor regalo.",
    description:"Para quienes deseen hacernos un obsequio, dejamos disponibles los siguientes datos.",
    link:"",
    linkLabel:"",
    bankInfo:"",
    icon:"◈"
  },
  {
    mode:"mixed",
    title:"Opciones de regalo",
    message:"Su presencia es lo más importante para nosotros.",
    description:"Si desean tener un detalle, pueden elegir la opción que les resulte más cómoda.",
    link:"",
    linkLabel:"Ver mesa de regalos",
    bankInfo:"",
    icon:"♡"
  },
  {
    mode:"no-gifts",
    title:"El mejor regalo es compartir",
    message:"Lo más importante para nosotros es contar con su presencia.",
    description:"No es necesario llevar ningún obsequio.",
    link:"",
    linkLabel:"",
    bankInfo:"",
    icon:"✦"
  }
];

function updateGiftFields(){
  const mode=$('giftMode')?.value||'cash-envelopes';
  const showRegistry=mode==='registry'||mode==='mixed';
  const showBank=mode==='bank-transfer'||mode==='mixed';

  $('giftLinkField')?.classList.toggle('hidden',!showRegistry);
  $('giftLinkLabelField')?.classList.toggle('hidden',!showRegistry);
  $('giftBankField')?.classList.toggle('hidden',!showBank);
}

function renderGiftPresets(){
  const grid=$('giftPresetGrid');
  if(!grid)return;

  const activeMode=$('giftMode')?.value||settings.gifts?.mode||'cash-envelopes';

  grid.innerHTML=GIFT_PRESETS.map(preset=>`
    <article class="gift-preset-card ${preset.mode===activeMode?'selected':''}">
      <span class="gift-preset-icon">${preset.icon}</span>
      <div>
        <h3>${esc(preset.title)}</h3>
        <p>${esc(preset.description)}</p>
      </div>
      <button class="secondary-btn gift-preset-button" type="button" data-mode="${esc(preset.mode)}">
        ${preset.mode===activeMode?'Seleccionado':'Usar opción'}
      </button>
    </article>
  `).join('');

  grid.querySelectorAll('.gift-preset-button').forEach(button=>{
    button.addEventListener('click',()=>{
      const preset=GIFT_PRESETS.find(item=>item.mode===button.dataset.mode);
      if(!preset)return;

      setValue('giftMode',preset.mode);
      setValue('giftTitle',preset.title);
      setValue('giftMessage',preset.message);
      setValue('giftDescription',preset.description);
      setValue('giftLink',preset.link);
      setValue('giftLinkLabel',preset.linkLabel);
      setValue('giftBankInfo',preset.bankInfo);

      updateGiftFields();
      renderGiftPresets();
    });
  });

  updateGiftFields();
}

function setValue(id,value){
  const element=$(id);
  if(element)element.value=value??'';
}
function setChecked(id,value){
  const element=$(id);
  if(element)element.checked=!!value;
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

  const gift=settings.gifts||{};
  setValue('giftMode',gift.mode||'cash-envelopes');
  setValue('giftTitle',gift.title||gift.cashTitle||'');
  setValue('giftMessage',gift.message||'');
  setValue('giftDescription',gift.description||gift.cashDescription||'');
  setValue('giftLink',gift.link||'');
  setValue('giftLinkLabel',gift.linkLabel||'');
  setValue('giftBankInfo',gift.bankInfo||'');

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
  const closeAt=settings.rsvp?.closeAt?new Date(settings.rsvp.closeAt):null;
  setValue('rsvpCloseAt',closeAt&&!Number.isNaN(closeAt.getTime())?new Date(closeAt.getTime()-closeAt.getTimezoneOffset()*60000).toISOString().slice(0,16):'');
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
  const features=featureFlags();
  setChecked('featureAgenda',features.agenda);
  setChecked('featureTemplates',features.templates);
  setChecked('featureQr',features.qr);
  setChecked('featurePhotos',features.photos);
  setChecked('featureGifts',features.gifts);
  setChecked('featureMenus',features.menus);
  setChecked('featureSpotify',features.spotify);
  setChecked('featureDomains',features.domains);
  setChecked('featureTablesLab',features.tablesLab);
  setChecked('featureWhatsappBusiness',features.whatsappBusiness);
  const states=settings.featureStates||{};
  setValue('stateProgram',states.program||'available');setValue('stateTemplates',states.templates||'available');
  setValue('stateQr',states.qrCards||'available');setValue('statePhotos',states.guestPhotoUpload||'available');
  setValue('stateGifts',states.gifts||'available');setValue('stateMenus',states.menus||'available');
  setValue('stateMusic',states.music||'available');setValue('stateDomains',states.customDomains||'hidden');
  setValue('stateSeating',states.seating||'available');
  setValue('stateWhatsappBusiness',states.whatsappBusiness||'hidden');



  renderMedia('settingsGallery',settings.media?.gallery||[],'gallery');
  renderMedia('dressSettingsGallery',settings.dressCode?.referenceImages||[],'dress');
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
  setValue('openingStyleSelect',settings.presentation?.openingStyle||'wax-envelope');
  updateQrMockup();
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
  }

  if($('activeQrTemplateName'))$('activeQrTemplateName').textContent=template.name;
  if($('activeQrTemplateNote'))$('activeQrTemplateNote').textContent=template.printNote;
  if($('mockupTitle'))$('mockupTitle').textContent=$('qrDesignTitle')?.value||settings.qrDesign?.title||'Captura nuestros recuerdos';
  if($('mockupCouple'))$('mockupCouple').textContent=$('displayName')?.value||settings.couple?.displayName||'Nuestro evento';
  if($('mockupTable'))$('mockupTable').textContent=$('tableSelect')?.value||'QR general';

  const scene=$('qrTableScene');
  if(scene){
    scene.className=`qr-table-scene ${settings.themeId||'romantic-wine'}`;
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
  if($('physicalPreviewEvent'))$('physicalPreviewEvent').textContent=$('displayName')?.value||settings.couple?.displayName||settings._event?.name||'Evento activo';
  if($('physicalPreviewGuest'))$('physicalPreviewGuest').textContent=selected?.family_name||'Selecciona un invitado';
  const template=$('physicalTemplateSelect')?.value||settings.physicalInvitation?.templateId||'auto-theme';
  if($('physicalInvitePreview'))$('physicalInvitePreview').className=`physical-invite-mini-preview template-${template} theme-${settings.themeId||'romantic-wine'}`;
  if($('downloadPhysicalInviteBtn'))$('downloadPhysicalInviteBtn').disabled=!selected;
}

$('physicalGuestSelect')?.addEventListener('change',renderPhysicalInvitationStudio);
$('saveOpeningStyleBtn')?.addEventListener('click',async()=>{
  const presentation={...(settings.presentation||{}),openingStyle:$('openingStyleSelect')?.value||'wax-envelope'};
  const response=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({presentation})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudo guardar la apertura.',false);
  settings.presentation=presentation;status('Apertura animada guardada. Ábrela en la vista completa para probarla.');
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
  const raw=settings.features||{};
  return {
    agenda:(raw.program??raw.agenda??true)&&featureAccess.program!==false,
    templates:(raw.templates??true)&&featureAccess.templates!==false,
    qr:(raw.qrCards??raw.qr??true)&&featureAccess.qrCards!==false,
    photos:(raw.guestPhotoUpload??raw.photos??true)&&featureAccess.guestPhotoUpload!==false,
    gifts:(raw.gifts??true)&&featureAccess.gifts!==false,
    menus:(raw.menus??true)&&featureAccess.menus!==false,
    spotify:(raw.music??raw.spotify??true)&&featureAccess.music!==false,
    domains:(raw.customDomains??raw.domains??false)&&featureAccess.customDomains!==false,
    tablesLab:(raw.seating??raw.tablesLab??true)&&featureAccess.seating!==false,
    whatsappBusiness:(raw.whatsappBusiness??false)&&featureAccess.whatsappBusiness!==false,
    billing:(raw.billing??false)&&featureAccess.billing!==false
  };
}
function applyFeatureVisibility(){
  const features=featureFlags();
  const platformUser=['owner','developer'].includes(currentUser?.role);
  const visible=(enabled)=>platformUser||enabled;
  $('templatesTabBtn')?.classList.toggle('hidden',!visible(features.templates));
  $('typographyCard')?.classList.toggle('hidden',!visible(features.templates));
  $('guestsTabBtn')?.classList.toggle('hidden',!visible(featureAccess.guests!==false));
  $('qrTabBtn')?.classList.toggle('hidden',!visible(features.qr));
  $('photosTabBtn')?.classList.toggle('hidden',!visible(features.photos));
  $('agendaSettingsDetails')?.classList.toggle('hidden',!visible(features.agenda));
  $('giftSettingsCard')?.classList.toggle('hidden',!visible(features.gifts));
  $('menuSettingsGroup')?.classList.toggle('hidden',!visible(features.menus));
  $('spotifySourceOption')?.classList.toggle('hidden',!visible(features.spotify));
  if(!visible(features.spotify)&&selectedMusicSource()==='spotify')setSelectedMusicSource('none');
  $('domainManagerCard')?.classList.toggle('hidden',!visible(features.domains));
  $('tablesLabTabBtn')?.classList.toggle('hidden',!visible(features.tablesLab));
  $('billingTabBtn')?.classList.toggle('hidden',!visible(features.billing));
  $('venueReportBtn')?.classList.toggle('hidden',!visible(featureAccess.reports!==false));
  const showWhatsappBusiness=visible(features.whatsappBusiness);
  $('whatsappReadinessCard')?.classList.toggle('hidden',!showWhatsappBusiness);
  $('automaticMessagingCard')?.classList.toggle('hidden',!showWhatsappBusiness);
}
async function saveFeatureFlags(){
  const features={
    program:!!$('featureAgenda')?.checked,
    templates:!!$('featureTemplates')?.checked,
    qrCards:!!$('featureQr')?.checked,
    guestPhotoUpload:!!$('featurePhotos')?.checked,
    guestPhotoMessages:!!$('featurePhotos')?.checked,
    gifts:!!$('featureGifts')?.checked,
    menus:!!$('featureMenus')?.checked,
    music:!!$('featureSpotify')?.checked,
    customDomains:!!$('featureDomains')?.checked,
    seating:!!$('featureTablesLab')?.checked,
    whatsappBusiness:!!$('featureWhatsappBusiness')?.checked
  };
  const featureStates={
    program:$('stateProgram')?.value||'available',templates:$('stateTemplates')?.value||'available',
    qrCards:$('stateQr')?.value||'available',guestPhotoUpload:$('statePhotos')?.value||'available',guestPhotoMessages:$('statePhotos')?.value||'available',
    gifts:$('stateGifts')?.value||'available',menus:$('stateMenus')?.value||'available',music:$('stateMusic')?.value||'available',
    customDomains:$('stateDomains')?.value||'hidden',seating:$('stateSeating')?.value||'available',
    whatsappBusiness:$('stateWhatsappBusiness')?.value||'hidden'
  };
  const response=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({features,featureStates})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return status(data.error||'No se pudieron guardar los módulos.',false);
  settings.features={...(settings.features||{}),...features};settings.featureStates={...(settings.featureStates||{}),...featureStates};
  applyFeatureVisibility();
  status('Módulos disponibles actualizados.');
}
if($('saveFeaturesBtn'))$('saveFeaturesBtn').onclick=saveFeatureFlags;

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
  setValue('heroEyebrowText',labels.heroEyebrow);
  setValue('openButtonText',labels.openButton);
  setValue('rsvpTitleText',labels.rsvpTitle);
  setValue('agendaTitleText',labels.agendaTitle);
  setValue('guestLabelText',labels.guestLabel);
  updateThemeLivePreview();
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
  const preview=$('themeLivePreview');
  if(!preview)return;
  const activeTheme=themeId||settings.themeId||'romantic-wine';
  preview.className=`theme-live-preview theme-${activeTheme}`;
  if($('previewEyebrow'))$('previewEyebrow').textContent=$('heroEyebrowText')?.value||settings.presentation?.heroEyebrow||'Evento especial';
  if($('previewEventName'))$('previewEventName').textContent=$('displayName')?.value||settings.couple?.displayName||settings._event?.name||'Nombre del evento';
  if($('previewDate'))$('previewDate').textContent=$('dateLabel')?.value||settings.event?.dateLabel||'Fecha';
  if($('openFullPreviewBtn')){
    const slug=settings._event?.slug;
    $('openFullPreviewBtn').href=slug?`/e/${encodeURIComponent(slug)}?preview=1`:'#';
  }
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
  const eventName=$('displayName')?.value||settings.couple?.displayName||settings._event?.name||'Evento activo';
  const eventDate=$('dateLabel')?.value||settings.event?.dateLabel||'Fecha por confirmar';
  $('themeGrid').innerHTML=themes.map(theme=>`
    <article class="theme-card ${settings.themeId===theme.id?'selected':''}">
      <button class="theme-preview ${theme.className} preview-theme-button" data-id="${theme.id}" type="button">
        <span>${theme.preview}</span><strong class="theme-preview-event-name">${esc(eventName)}</strong><small class="theme-preview-event-date">${esc(eventDate)}</small>
      </button>
      <div class="theme-card-body">
        <h3>${esc(theme.name)}</h3>
        <p>${esc(theme.description)}</p>
        <button class="secondary-btn choose-theme" data-id="${theme.id}">
          ${settings.themeId===theme.id?'Plantilla activa':'Aplicar plantilla'}
        </button>
      </div>
    </article>`).join('');

  document.querySelectorAll('.preview-theme-button').forEach(button=>{
    button.onclick=()=>{
      updateThemeLivePreview(button.dataset.id);
      document.querySelectorAll('.theme-card').forEach(card=>card.classList.remove('previewing'));
      button.closest('.theme-card')?.classList.add('previewing');
    };
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
}
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
  const q=$('guestSearch').value.toLowerCase();
  const visible=guests.filter(g=>[g.family_name,g.phone,g.table_name,g.status].some(v=>String(v||'').toLowerCase().includes(q)));

  $('guestRows').innerHTML=visible.map(g=>`<tr class="${g.is_test?'test-row':''}">
    <td><input class="guest-select" type="checkbox" value="${g.id}"></td>
    <td>${g.is_test?'<span class="test-tag">PRUEBA</span> ':''}${esc(g.family_name)}</td>
    <td>${esc(g.phone)}</td>
    <td>${esc(g.table_name)}</td>
    <td>${invitationFlowHtml(g)}</td>
    <td><span class="status-pill ${g.status}">${esc(guestStatusLabel(g.status))}</span></td>
    <td>${g.adults??0}/${g.max_adults}</td>
    <td>${g.children??0}/${g.max_children}</td>
    <td>${esc(guestNeedsSummary(g))}</td>
    <td class="actions-cell">
      <a class="mini-btn" target="_blank" href="${g.invitation_url}">Abrir</a>
      ${g.whatsapp_url&&!g.is_test?`<a class="mini-btn whatsapp" target="_blank" href="${g.whatsapp_url}">WhatsApp</a>`:''}
      <button class="mini-btn copy" data-url="${g.invitation_url}">Copiar</button>
      <button class="mini-btn edit-guest" data-id="${g.id}">Modificar</button>
      <button class="mini-btn delete-guest" data-id="${g.id}" data-name="${esc(g.family_name)}">Eliminar</button>
    </td>
  </tr>`).join('');

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
  await load();
}

function renderPhotos(){
  const t=$('photoTableFilter').value;
  photoViewerItems=photos.filter(p=>!t||p.table_name===t);
  $('photoGrid').innerHTML=photoViewerItems.map((p,index)=>`<figure class="photo-card">
    <button class="photo-open" type="button" data-photo-index="${index}" aria-label="Ampliar fotografía de ${esc(p.uploaded_by||'invitado')}"><img src="${p.url}" loading="lazy" alt="Fotografía de ${esc(p.uploaded_by||'invitado')}"></button>
    <figcaption><strong>${esc(p.table_name||'Sin mesa')} · ${esc(p.uploaded_by||'Invitado')}</strong>
      ${p.message?`<p>${esc(p.message)}</p>`:''}<small>Moderación: ${esc(p.moderation_status||'pendiente')}</small>
      <div class="inline-actions">
        ${p.batch_id?`<button class="mini-btn photo-moderate" data-batch="${p.batch_id}" data-status="approved">Aprobar</button><button class="mini-btn photo-moderate" data-batch="${p.batch_id}" data-status="hidden">Ocultar</button>`:''}
        <button class="mini-btn photo-delete" data-photo="${p.id}">Eliminar</button>
      </div>
    </figcaption></figure>`).join('')||'<p class="muted">No hay fotografías para este filtro.</p>';
  document.querySelectorAll('.photo-open').forEach(button=>button.onclick=()=>openAdminPhotoViewer(Number(button.dataset.photoIndex)));
  document.querySelectorAll('.photo-moderate').forEach(button=>button.onclick=async()=>{
    const response=await api(`/api/admin/photo-batches/${button.dataset.batch}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:button.dataset.status})});
    const data=await response.json();status(response.ok?'Moderación actualizada.':data.error,response.ok);if(response.ok)await load();
  });
  document.querySelectorAll('.photo-delete').forEach(button=>button.onclick=async()=>{
    if(!confirm('¿Eliminar definitivamente esta fotografía?'))return;
    const response=await api(`/api/admin/photos/${button.dataset.photo}`,{method:'DELETE'});const data=await response.json();status(response.ok?'Fotografía eliminada.':data.error,response.ok);if(response.ok)await load();
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
async function qr(t){
  const response=await api(`/api/admin/qr?table=${encodeURIComponent(t)}`);
  const data=await readJson(response,'Código QR');
  if($('qrImage'))$('qrImage').src=data.dataUrl;
  if($('qrUrl')){$('qrUrl').textContent=data.url;$('qrUrl').dataset.url=data.url;}
  if($('mockupTable'))$('mockupTable').textContent=t||'QR general';
  updateQrMockup();
}
async function download(url,name){const r=await api(url);if(!r.ok){status('No se pudo descargar.',false);return false;}const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);return true;}
$('loginBtn').onclick=login;$('adminPassword').onkeydown=e=>{if(e.key==='Enter')login();};async function logout(){
  try{await api('/api/auth/logout',{method:'POST'});}catch{}
  localStorage.removeItem('authToken');
  localStorage.removeItem('eventId');
  authToken='';
  currentUser=null;
  location.replace('/admin.html');
}
$('logoutBtn').onclick=logout;
if($('topLogoutBtn'))$('topLogoutBtn').onclick=logout;$('eventSelect').onchange=async e=>{eventId=Number(e.target.value);seatingState=null;selectedFloorItem=null;localStorage.setItem('eventId',eventId);await load();};$('newEventBtn').onclick=async()=>{const name=prompt('Nombre del nuevo evento:');if(!name)return;const r=await api('/api/admin/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}),d=await r.json();if(r.ok){events=await(await api('/api/admin/events')).json();eventId=d.id;seatingState=null;selectedFloorItem=null;renderEvents();await load();}};

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
    story:{text:value('storyText')},
    dressCode:{title:value('dressTitle'),description:value('dressDescription')},
    menus:{
      serviceMode:value('menuServiceMode')||'fixed',
      selectionEnabled:value('menuServiceMode')==='guest-choice',
      adultOptions:value('adultMenus').split('\n').map(x=>x.trim()).filter(Boolean),
      childOptions:value('childMenus').split('\n').map(x=>x.trim()).filter(Boolean),
      instructions:value('menuInstructions')
    },
    typography:{heading:value('headingFont')||'georgia',body:value('bodyFont')||'system'},
    accessibility:{
      enabled:true,
      options:value('accessibilityOptions').split('\n').map(x=>x.trim()).filter(Boolean),
      helpText:value('accessibilityHelp')
    },
    rsvp:{closeAt:value('rsvpCloseAt')?new Date(value('rsvpCloseAt')).toISOString():'',allowChanges:checked('rsvpAllowChanges'),allowFlexibleComposition:checked('rsvpFlexibleComposition')},
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

  status('Configuración guardada.');
  await load();
};

$('saveGiftBtn').onclick=async()=>{const body={gifts:{mode:$('giftMode').value,title:$('giftTitle').value,message:$('giftMessage').value,description:$('giftDescription').value,link:$('giftLink').value,linkLabel:$('giftLinkLabel').value,bankInfo:$('giftBankInfo').value}};const r=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});status(r.ok?'Modalidad de regalos guardada.':'No se pudo guardar.',r.ok);if(r.ok)await load();};
$('testInviteBtn').onclick=async()=>{const adults=Number(prompt('Adultos permitidos para la prueba:',2));const children=Number(prompt('Niños permitidos para la prueba:',1));const family=prompt('Nombre que verá la invitación:','Familia de prueba')||'Familia de prueba';const r=await api('/api/admin/developer/test-invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adults,children,family_name:family})}),d=await r.json();if(!r.ok)return status(d.error,false);$('testInviteResult').innerHTML=`<strong>Invitación de prueba lista</strong><div><a class="primary-btn" target="_blank" href="${d.url}">Abrir prueba</a><button class="secondary-btn" id="copyTestUrl">Copiar enlace</button></div>`;$('testInviteResult').classList.remove('hidden');$('copyTestUrl').onclick=async()=>{await navigator.clipboard.writeText(d.url);status('Enlace de prueba copiado.');};await load();};
function single(form,input,endpoint){
  $(form).onsubmit=async e=>{
    e.preventDefault();
    const f=$(input).files[0];
    if(!f)return status('Selecciona un archivo.',false);
    const d=new FormData();d.append('file',f);
    const r=await api(endpoint,{method:'POST',body:d});
    const data=await r.json().catch(()=>({}));
    status(r.ok?'Archivo cargado.':(data.error||'Error.'),r.ok);
    if(r.ok){
      e.target.reset();
      await load();
      if(form==='musicForm'){
        setSelectedMusicSource('upload');
        await saveMusicSelection();
      }
    }
  };
}single('heroForm','heroFile','/api/admin/media/hero');single('musicForm','musicFile','/api/admin/media/music');function multi(form,input,endpoint,field){$(form).onsubmit=async e=>{e.preventDefault();const d=new FormData();[...$(input).files].forEach(f=>d.append(field,f));const r=await api(endpoint,{method:'POST',body:d});status(r.ok?'Imágenes agregadas.':'Error.',r.ok);if(r.ok){e.target.reset();await load();}};}multi('galleryForm','galleryFiles','/api/admin/media/gallery','files');multi('dressForm','dressFiles','/api/admin/media/dress','files');

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
  await load();
});

$('guestForm').onsubmit=async event=>{
  event.preventDefault();
  const body={code:$('gCode').value,family_name:$('gFamily').value,phone:$('gPhone').value,table_name:$('gTable').value,max_adults:Number($('gAdults').value),max_children:Number($('gChildren').value),custom_message:$('gMessage').value};
  const response=await api('/api/admin/guests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  status(response.ok?(data.generatedCode?`Invitación guardada con código ${data.code}.`:'Invitación guardada.'):(data.error||'No se pudo guardar.'),response.ok);
  if(response.ok){event.target.reset();setValue('gAdults',2);setValue('gChildren',0);await load();}
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
  if(response.ok)await load();
};
$('guestSearch').oninput=renderGuests;$('photoTableFilter').onchange=renderPhotos;$('generateQrBtn').onclick=()=>qr($('tableSelect').value);
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
$('templateBtn').onclick=()=>download('/api/admin/template.xlsx','plantilla_invitados.xlsx');$('venueReportBtn').onclick=()=>download('/api/admin/venue-report.xlsx','resumen_operativo_del_evento.xlsx');

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
    return `<article class="seating-person ${person.status}"><div><strong>${esc(person.name)}</strong><small>${esc(person.family)} · ${person.type==='child'?'Niño':'Adulto'} · ${attendanceLabel}</small></div><select class="person-table-select" data-guest="${person.guestId}" data-person="${esc(person.personKey)}"><option value="">Sin mesa</option>${(seatingState.tables||[]).map(table=>`<option value="${table.id}" ${table.id===tableId?'selected':''} ${!table.id||table.occupied>=table.capacity&&table.id!==tableId?'disabled':''}>${esc(table.name)} · ${table.id?`${table.occupied}/${table.capacity}`:'guarda el plano primero'}</option>`).join('')}</select></article>`;
  }).join(''):'<p class="muted">No hay personas que coincidan con esta vista.</p>';
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
  $('markQueueSent').onclick=async()=>{const mr=await api('/api/admin/guests/mark-sent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});if(mr.ok){status('Invitaciones marcadas como enviadas.');await load();}};
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
      :(spotifyEntity($('spotifyUrl')?.value)?'Enlace de Spotify listo para guardar.':'Pega un enlace o busca una canción.');
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

async function searchSpotify(){
  const query=$('spotifySearchQuery')?.value.trim();
  if(!query)return status('Escribe una canción o artista.',false);
  $('spotifySearchResults').innerHTML='<p class="muted">Buscando…</p>';
  const response=await api(`/api/admin/spotify/search?q=${encodeURIComponent(query)}`);
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    $('spotifySearchResults').innerHTML=`<p class="error">${esc(data.error||'No se pudo buscar.')}</p>`;
    return;
  }
  $('spotifySearchResults').innerHTML=data.length?data.map(track=>`
    <button class="spotify-result" type="button"
      data-track='${JSON.stringify(track).replace(/'/g,"&#39;")}'>
      ${track.image?`<img src="${esc(track.image)}" alt="">`:''}
      <span><strong>${esc(track.name)}</strong><small>${esc(track.artists)} · ${esc(track.album)}</small></span>
      <b>Elegir</b>
    </button>`).join(''):'<p class="muted">No se encontraron resultados.</p>';

  document.querySelectorAll('.spotify-result').forEach(button=>{
    button.onclick=()=>{
      selectedSpotifyTrack=JSON.parse(button.dataset.track);
      setValue('spotifyUrl',selectedSpotifyTrack.url);
      setValue('spotifyStartSeconds',0);
      syncSpotifyStartEditor(selectedSpotifyTrack.durationMs);
      renderSpotifySelected();
      renderSpotifyController();
      updateMusicStatus();
    };
  });
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
$('spotifySearchBtn')?.addEventListener('click',searchSpotify);
$('spotifySearchQuery')?.addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();searchSpotify();}
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
  spotifyController.loadEntity?.(entity.uri,false,start);
  spotifyController.play?.();
  status(`Reproduciendo desde ${formatSeconds(start)}.`);
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
function updateFontPreviews(){
  const heading=$('headingFontPreview');
  const body=$('bodyFontPreview');
  if(heading){
    heading.style.fontFamily=fontCss[$('headingFont')?.value]||fontCss.georgia;
    heading.textContent=$('displayName')?.value||settings.couple?.displayName||settings._event?.name||'Evento activo';
  }
  if(body){
    body.style.fontFamily=fontCss[$('bodyFont')?.value]||fontCss.system;
    body.textContent=$('heroMessage')?.value||settings.event?.heroMessage||settings.story?.text||'Mensaje del evento activo';
  }
  document.querySelectorAll('.theme-preview-event-name').forEach(node=>node.textContent=$('displayName')?.value||settings.couple?.displayName||settings._event?.name||'Evento activo');
  document.querySelectorAll('.theme-preview-event-date').forEach(node=>node.textContent=$('dateLabel')?.value||settings.event?.dateLabel||'Fecha por confirmar');
  updateThemeLivePreview();
  updateQrMockup();
  renderPhysicalInvitationStudio();
}
$('headingFont')?.addEventListener('change',updateFontPreviews);$('bodyFont')?.addEventListener('change',updateFontPreviews);
async function loadUsers(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  const response=await api('/api/admin/users');
  if(!response.ok)return;
  const users=await response.json();
  $('uEvents').innerHTML=events.map(event=>`<option value="${event.id}">${esc(event.name)}</option>`).join('');
  $('userRows').innerHTML=users.map(user=>`<tr>
    <td>${esc(user.display_name)}</td>
    <td>${esc(user.email||user.phone||'')}</td>
    <td>${esc(user.role)}</td>
    <td>${user.active?'Activo':'Inactivo'}${user.must_change_password?' · Debe cambiar contraseña':''}</td>
    <td>
      ${user.role!=='owner'?`<button class="mini-btn reset-user-password" data-id="${user.id}" data-name="${esc(user.display_name)}">Contraseña temporal</button><button class="mini-btn deactivate-user" data-id="${user.id}" data-name="${esc(user.display_name)}">Desactivar</button>
      <button class="mini-btn delete-user" data-id="${user.id}" data-name="${esc(user.display_name)}">Eliminar definitivamente</button>`:''}
    </td>
  </tr>`).join('');

  document.querySelectorAll('.deactivate-user').forEach(button=>button.onclick=()=>removeUser(button,'deactivate'));
  document.querySelectorAll('.delete-user').forEach(button=>button.onclick=()=>removeUser(button,'permanent'));
  document.querySelectorAll('.reset-user-password').forEach(button=>button.onclick=()=>resetUserPassword(button));
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
    const [response,clientsResponse,plansResponse]=await Promise.all([api('/api/admin/platform-events'),api('/api/admin/clients'),fetch('/api/public/plans')]);
    const rows=await readJson(response,'Eventos alojados');
    ownerClients=await readJson(clientsResponse,'Clientes disponibles');
    ownerPlans=await plansResponse.json();
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
  await loadPlatformEvents();
}

async function restoreEvent(button){
  const response=await api(`/api/admin/events/${button.dataset.id}/restore`,{method:'POST'});
  if(!response.ok)return status('No se pudo restaurar el evento.',false);
  status('Evento restaurado.');
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
  status('Evento y archivos eliminados definitivamente.');
  const eventsResponse=await api('/api/admin/events');
  events=await eventsResponse.json();
  eventId=events[0]?.id||0;
  renderEvents();
  await loadPlatformEvents();
}

$('userForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const eventIds=[...$('uEvents').selectedOptions].map(o=>Number(o.value));
  const r=await api('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:$('uName').value,email:$('uEmail').value,password:$('uPassword').value,role:$('uRole').value,eventIds})});
  const d=await r.json();status(r.ok?'Usuario creado.':d.error,r.ok);if(r.ok){e.target.reset();await loadUsers();}
});
const oldTab=tab;tab=function(n){oldTab(n);if(n==='users')loadUsers();if(n==='tables-lab')loadSeating();if(n==='owner'){loadOwnerDashboard();loadPlatformEvents();loadPlatformSummary();}};


function togglePassword(inputId,button){const input=$(inputId);if(!input)return;input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'Ver':'Ocultar';}
$('toggleLoginPassword')?.addEventListener('click',e=>togglePassword('adminPassword',e.currentTarget));
$('toggleRegisterPassword')?.addEventListener('click',e=>togglePassword('registerPassword',e.currentTarget));
$('showRegisterBtn')?.addEventListener('click',()=>{$('registerForm').classList.remove('hidden');$('showRegisterBtn').classList.add('hidden');});
$('cancelRegisterBtn')?.addEventListener('click',()=>{$('registerForm').classList.add('hidden');$('showRegisterBtn').classList.remove('hidden');});

async function loadPublicPlans(){
  const optsRes=await fetch('/api/public/auth-options'),opts=await optsRes.json();
  const plans=opts.registrationEnabled?await (await fetch('/api/public/plans')).json():[];
  if($('registerPlan'))$('registerPlan').innerHTML=plans.map(p=>`<option value="${p.code}">${esc(p.name)} · $${(p.price_cents/100).toLocaleString('es-MX')} ${p.currency}</option>`).join('');
  $('showRegisterBtn')?.classList.toggle('hidden',!opts.registrationEnabled);
  if(!opts.registrationEnabled)$('registerForm')?.classList.add('hidden');
  const google=$('googleLoginBtn');if(google){google.disabled=!opts.googleEnabled;google.title=opts.googleEnabled?'Continuar con Google':'Configura GOOGLE_CLIENT_ID para habilitarlo';}
}
$('registerForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  if($('registerPassword').value!==$('registerPasswordConfirm').value){$('registerStatus').textContent='Las contraseñas no coinciden.';$('registerStatus').className='status-message error';return;}
  const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:$('registerName').value,email:$('registerEmail').value,phone:$('registerPhone').value,password:$('registerPassword').value,planCode:$('registerPlan').value,acceptTerms:$('registerTrialAcknowledgement').checked})});
  const d=await r.json();
  if(!r.ok){$('registerStatus').textContent=d.error||'No se pudo crear la cuenta.';$('registerStatus').className='status-message error';return;}
  authToken=d.token||'';currentUser=d.user;eventId=d.eventId;localStorage.removeItem('authToken');localStorage.setItem('eventId',String(eventId));
  events=await(await api('/api/admin/events')).json();renderEvents();
      applyRoleUI();
      $('loginScreen').classList.add('hidden');
      $('adminApp').classList.remove('hidden');
      await load();tab('billing');
});
$('googleLoginBtn')?.addEventListener('click',async()=>{const r=await fetch('/api/auth/google',{method:'POST'});const d=await r.json();$('loginStatus').textContent=d.error||'Google no está configurado.';});

async function loadOwnerDashboard(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  try{
    const [summaryResponse,clientsResponse,plansResponse]=await Promise.all([
      api('/api/admin/owner-summary'),
      api('/api/admin/clients'),
      fetch('/api/public/plans')
    ]);

    const summary=await readJson(summaryResponse,'Resumen de propietario');
    const clients=await readJson(clientsResponse,'Listado de clientes');
    ownerClients=clients;ownerPlans=await plansResponse.json();

    if($('oClients'))$('oClients').textContent=summary.clients||0;
    if($('oActive'))$('oActive').textContent=summary.active_clients||0;
    if($('oTrials'))$('oTrials').textContent=summary.active_trials||0;
    if($('oEvents'))$('oEvents').textContent=summary.events||0;
    if($('oRevenue'))$('oRevenue').textContent=`$${((summary.revenue_cents||0)/100).toLocaleString('es-MX')} MXN`;

    if($('clientRows')){
      $('clientRows').innerHTML=clients.length
        ?clients.map(client=>`<tr>
          <td>${esc(client.display_name)}</td>
          <td>${esc(client.email||'')}<br>${esc(client.phone||'')}</td>
          <td>${esc(client.plan_name||'Sin plan')}</td>
          <td>${esc(client.subscription_status||'Sin suscripción')}</td>
          <td>${client.event_count||0}</td>
          <td>${esc(client.last_login_at||'Nunca')}</td>
          <td>$${((client.paid_cents||0)/100).toLocaleString('es-MX')}</td>
          <td><div class="ownership-action"><select class="grant-plan-select" data-id="${client.id}">${ownerPlans.map(plan=>`<option value="${esc(plan.code)}" ${plan.code===client.plan_code?'selected':''}>${esc(plan.name)}</option>`).join('')}</select><button class="mini-btn grant-plan" data-id="${client.id}" data-name="${esc(client.display_name)}">Asignar</button></div></td>
        </tr>`).join('')
        :'<tr><td colspan="8" class="muted">Todavía no hay clientes registrados.</td></tr>';
      document.querySelectorAll('.grant-plan').forEach(button=>button.onclick=()=>grantClientPlan(button));
    }
  }catch(error){
    console.error(error);
    status(error.message||'No se pudo cargar el resumen de clientes.',false);
  }
}

async function grantClientPlan(button){
  const select=document.querySelector(`.grant-plan-select[data-id="${button.dataset.id}"]`);
  const planCode=select?.value;
  if(!planCode)return;
  if(!confirm(`¿Asignar el plan seleccionado a ${button.dataset.name} como cortesía? No se registrará ningún pago.`))return;
  const response=await api(`/api/admin/users/${button.dataset.id}/grant-plan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planCode,reason:'Plan de cortesía asignado desde el panel propietario'})});
  const data=await response.json().catch(()=>({}));
  status(response.ok?`Plan ${data.plan?.name||planCode} asignado sin registrar un pago.`:(data.error||'No se pudo asignar el plan.'),response.ok);
  if(response.ok)await loadOwnerDashboard();
}

async function loadBilling(){
  const bRes=await api('/api/billing/me');
  if(!bRes.ok)return;
  const b=await bRes.json(),plans=b.plans||[],sub=b.subscription;
  $('subscriptionSummary').innerHTML=sub?`<div class="subscription-card"><strong>${esc(sub.name)}</strong><span>Estado: ${esc(sub.status)}</span><span>Vigencia: ${esc(sub.ends_at||'Sin fecha')}</span><span>Hasta ${sub.max_events} evento(s), ${sub.max_guests} invitados y ${sub.max_storage_mb} MB</span></div>`:'<p>Sin suscripción activa.</p>';
  $('billingPlans').innerHTML=b.provider==='demo'?plans.map(p=>`<article class="plan-card"><h3>${esc(p.name)}</h3><strong>$${(p.price_cents/100).toLocaleString('es-MX')} ${p.currency}</strong><p>${p.duration_days} días · ${p.max_events} evento(s) · ${p.max_guests} invitados</p><button class="primary-btn demo-checkout" data-plan="${p.code}">Simular plan</button></article>`).join(''):'<p class="muted">No hay un proveedor de pagos habilitado. Los planes se administran manualmente hasta conectar un checkout real.</p>';
  $('paymentHistory').innerHTML=`<h3>Historial</h3>${b.payments.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Referencia</th><th>Importe</th><th>Estado</th></tr></thead><tbody>${b.payments.map(x=>`<tr><td>${esc(x.created_at)}</td><td>${esc(x.provider_reference||'')}</td><td>$${(x.amount_cents/100).toLocaleString('es-MX')} ${x.currency}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Todavía no hay pagos.</p>'}`;
  document.querySelectorAll('.demo-checkout').forEach(btn=>btn.onclick=async()=>{if(!confirm('Este pago es sólo una simulación de desarrollo. ¿Continuar?'))return;const r=await api('/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planCode:btn.dataset.plan})});const d=await r.json();status(r.ok?d.message:d.error,r.ok);if(r.ok)await loadBilling();});
}
const originalTabForBusiness=tab;tab=function(name){originalTabForBusiness(name);if(name==='owner'){loadOwnerDashboard();loadBackups();}if(name==='billing'){loadBilling();loadDomains();loadStorageUsage();}if(name==='users')loadUsers();};

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

async function restoreSession(){
  const me=await api('/api/auth/me');if(!me.ok){localStorage.removeItem('authToken');authToken='';loadPublicPlans();return;}
  currentUser=await me.json();if(currentUser.must_change_password&&!(await forcePasswordChange()))return;events=await(await api('/api/admin/events')).json();const savedEventId=Number(localStorage.getItem('eventId'));eventId=events.some(e=>e.id===savedEventId)?savedEventId:events[0]?.id;localStorage.setItem('eventId',String(eventId||''));renderEvents();
      applyRoleUI();
      $('loginScreen').classList.add('hidden');
      $('adminApp').classList.remove('hidden');
      await load();
}
loadPublicPlans();restoreSession().catch(error=>{console.error(error);if($('loginStatus'))$('loginStatus').textContent=error.message||'No se pudo restaurar la sesión.';});

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
  await load();
};


async function loadAccountContext(){
  const r=await api('/api/account/context');
  if(!r.ok)return;
  const c=await r.json();
  const platform=c.isPlatformUser;
  $('accountContextIcon').textContent=platform?'◆':'♡';
  $('accountContextTitle').textContent=platform?'Consola global de la plataforma':'Panel de mi evento';
  $('accountContextText').textContent=platform
    ? 'Aquí ves todos los clientes y eventos. El selector superior sólo abre un evento en modo soporte; no lo convierte en tu boda.'
    : 'Aquí administras únicamente los eventos contratados o incluidos en tu plan.';
  if(platform){
    $('subscriptionBadge').textContent='SUPERUSUARIO';
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

async function createEventForCurrentUser(){
  const name=prompt('Nombre del nuevo evento:');
  if(!name?.trim())return;
  const type=prompt('Tipo de evento (wedding, xv, birthday, corporate):','wedding')||'wedding';
  const r=await api('/api/admin/events',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:name.trim(),eventType:type.trim()})
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return status(d.error||'No se pudo crear el evento.',false);
  const er=await api('/api/admin/events');
  events=await er.json();
  eventId=d.id;
  localStorage.setItem('eventId',String(eventId));
  renderEvents();
  await load();
  status('Evento creado.');
}
if($('createClientEventBtn'))$('createClientEventBtn').onclick=createEventForCurrentUser;
if($('newEventBtn'))$('newEventBtn').onclick=createEventForCurrentUser;

$('giftMode')?.addEventListener('change',()=>{
  updateGiftFields();
  renderGiftPresets();
});


const AGENDA_TYPES=[
  {type:'ceremony',title:'Ceremonia',icon:'◇'},
  {type:'welcome',title:'Rompehielos',icon:'☼'},
  {type:'rehearsal',title:'Cena de ensayo',icon:'♨'},
  {type:'afterparty',title:'Tornaboda',icon:'✦'},
  {type:'custom',title:'Evento personalizado',icon:'＋'}
];

const AGENDA_LIBRARY=[
  {type:'ceremony',title:'Ceremonia',icon:'♡'},
  {type:'reception',title:'Recepción o celebración',icon:'✦'},
  {type:'welcome',title:'Cóctel o rompehielos',icon:'◌'},
  {type:'rehearsal',title:'Cena de ensayo',icon:'◇'},
  {type:'afterparty',title:'Tornaboda o fiesta posterior',icon:'♫'}
];

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
      <span>${item.type==='custom'?'＋':(AGENDA_LIBRARY.find(x=>x.type===item.type)?.icon||'◫')}</span>
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
  const standard=AGENDA_LIBRARY.map((type,index)=>
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

async function loadDomains(){
  const response=await api('/api/admin/domains');
  if(!response.ok)return;
  const data=await response.json();

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

async function loadWhatsAppStatus(){
  if(!$('whatsappProviderBadge'))return;
  const response=await api('/api/admin/whatsapp/status');
  if(!response.ok)return;
  const data=await response.json();
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
  if(!$('automaticMessagingCard')?.classList.contains('hidden'))await loadAutomaticQueue();
}

async function loadAutomaticQueue(){
  if(!$('automaticMessageRows'))return;
  const response=await api('/api/admin/messaging/queue');
  if(!response.ok){const data=await response.json().catch(()=>({}));$('automaticMessageRows').innerHTML=`<p class="muted">${esc(data.error||'Integración automática no disponible.')}</p>`;return;}
  const rows=await response.json();
  $('automaticMessageRows').innerHTML=rows.length?rows.map(row=>`<article class="row-between"><div><strong>${esc(row.family_name)}</strong><br><small>${esc(row.status)} · ${esc(row.provider)} · intento ${row.attempts}${row.error_message?` · ${esc(row.error_message)}`:''}</small></div>${row.status==='failed'&&row.attempts<5?`<button class="mini-btn retry-message" data-id="${row.id}">Reintentar</button>`:''}</article>`).join(''):'<p class="muted">No hay mensajes automáticos en cola.</p>';
  document.querySelectorAll('.retry-message').forEach(button=>button.onclick=async()=>{const response=await api(`/api/admin/messaging/${button.dataset.id}/retry`,{method:'POST'});const data=await response.json().catch(()=>({}));status(response.ok?'Mensaje devuelto a la cola.':data.error,response.ok);if(response.ok)await loadAutomaticQueue();});
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
