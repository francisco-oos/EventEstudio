let authToken=localStorage.getItem('authToken')||'',currentUser=null,eventId=0,events=[],settings={},guests=[],photos=[],themes=[];const $=id=>document.getElementById(id);async function api(url,opt={}){
  opt.headers={
    ...(opt.headers||{}),
    'Authorization':`Bearer ${authToken}`,
    'x-event-id':String(eventId||'')
  };
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
      const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('loginEmail').value,password:$('adminPassword').value})});
      let data;
      try{
        data=await readJson(r,'Inicio de sesión');
      }catch(error){
        $('loginStatus').textContent=error.message;
        return;
      }
      authToken=data.token;currentUser=data.user;localStorage.setItem('authToken',authToken);
      const er=await api('/api/admin/events');events=await er.json();const savedEventId=Number(localStorage.getItem('eventId'));eventId=events.some(e=>e.id===savedEventId)?savedEventId:events[0]?.id;localStorage.setItem('eventId',String(eventId||''));
      renderEvents();
      applyRoleUI();
      $('loginScreen').classList.add('hidden');
      $('adminApp').classList.remove('hidden');
      await load();
    }
    function applyRoleUI(){
  const platformUser=['owner','developer'].includes(currentUser?.role);
  $('usersTabBtn')?.classList.toggle('hidden',!platformUser);
  $('ownerTabBtn')?.classList.toggle('hidden',!platformUser);
  $('testInviteBtn')?.classList.toggle('hidden',!platformUser);
  $('developerModeContainer')?.classList.toggle('hidden',!platformUser);
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
    const endpoints=[
      ['/api/admin/dashboard','Resumen'],
      ['/api/admin/settings','Ajustes'],
      ['/api/admin/guests','Invitados'],
      ['/api/admin/photos','Fotografías'],
      ['/api/admin/tables','Mesas'],
      ['/api/admin/themes','Plantillas']
    ];

    const responses=await Promise.all(endpoints.map(([url])=>api(url)));
    const results=[];

    for(let i=0;i<responses.length;i++){
      results.push(await readJson(responses[i],endpoints[i][1]));
    }

    const [dashboard,loadedSettings,loadedGuests,loadedPhotos,tables,loadedThemes]=results;

    settings=loadedSettings;
    guests=loadedGuests;
    photos=loadedPhotos;
    themes=loadedThemes;

    if($('panelEventName'))$('panelEventName').textContent=settings._event?.name||'Evento';
    if($('sInvitations'))$('sInvitations').textContent=dashboard.invitations||0;
    if($('sConfirmed'))$('sConfirmed').textContent=dashboard.confirmed_families||0;
    if($('sAdults'))$('sAdults').textContent=dashboard.adults||0;
    if($('sChildren'))$('sChildren').textContent=dashboard.children||0;
    if($('sTotal'))$('sTotal').textContent=Number(dashboard.adults||0)+Number(dashboard.children||0);
    if($('sPending'))$('sPending').textContent=dashboard.pending_families||0;
    if($('sDietary'))$('sDietary').textContent=dashboard.dietary_records||0;
    if($('sPhotos'))$('sPhotos').textContent=dashboard.photos||0;

    fillSettings();
    renderGiftPresets();
    renderThemes();
    renderGuests();
    renderPhotos();

    const options=(tables||[]).map(table=>`<option value="${esc(table)}">${esc(table)}</option>`).join('');
    if($('tableSelect'))$('tableSelect').innerHTML=`<option value="">QR general</option>${options}`;
    if($('photoTableFilter'))$('photoTableFilter').innerHTML=`<option value="">Todas las mesas</option>${options}`;

    await qr('');
    await loadPlatformSummary();
    await loadAccountContext();

    status('Espacio de trabajo cargado.');
  }catch(error){
    console.error(error);
    status(error.message||'No se pudo cargar el espacio de trabajo.',false);
  }
}

function fillSettings(){$('partner1').value=settings.couple.partner1||'';$('partner2').value=settings.couple.partner2||'';$('displayName').value=settings.couple.displayName||'';$('dateTime').value=(settings.event.dateTime||'').slice(0,16);$('dateLabel').value=settings.event.dateLabel||'';$('heroMessage').value=settings.event.heroMessage||'';$('closingMessage').value=settings.event.closingMessage||'';$('venueName').value=settings.venue.name||'';$('ceremonyTime').value=settings.venue.ceremonyTime||'';$('receptionTime').value=settings.venue.receptionTime||'';$('venueAddress').value=settings.venue.address||'';$('mapsUrl').value=settings.venue.mapsUrl||'';$('venueNotes').value=settings.venue.notes||'';$('storyText').value=settings.story.text||'';$('dressTitle').value=settings.dressCode.title||'';$('dressDescription').value=settings.dressCode.description||'';$('menuSelectionEnabled').checked=!!settings.menus.selectionEnabled;$('adultMenus').value=(settings.menus.adultOptions||[]).join('\n');$('childMenus').value=(settings.menus.childOptions||[]).join('\n');$('menuInstructions').value=settings.menus.instructions||'';$('developerMode').checked=(settings.developer?.mode||'development')==='development';$('showDevBanner').checked=settings.developer?.showBanner!==false;$('headingFont').value=settings.typography?.heading||'georgia';$('bodyFont').value=settings.typography?.body||'system';const g=settings.gifts||{};$('giftMode').value=g.mode||'cash-envelopes';$('giftTitle').value=g.title||g.cashTitle||'';$('giftMessage').value=g.message||'';$('giftDescription').value=g.description||g.cashDescription||'';$('giftLink').value=g.link||'';$('giftLinkLabel').value=g.linkLabel||'';$('giftBankInfo').value=g.bankInfo||'';renderMedia('settingsGallery',settings.media.gallery||[],'gallery');renderMedia('dressSettingsGallery',settings.dressCode.referenceImages||[],'dress');}
function renderGiftPresets(){$('giftPresetGrid').innerHTML=giftPresets.map(x=>`<button type="button" class="gift-preset ${$('giftMode').value===x.mode?'selected':''}" data-mode="${x.mode}"><span>${x.icon}</span><strong>${x.name}</strong></button>`).join('');document.querySelectorAll('.gift-preset').forEach(b=>b.onclick=()=>{const p=giftPresets.find(x=>x.mode===b.dataset.mode);$('giftMode').value=p.mode;$('giftTitle').value=p.title;$('giftMessage').value=p.message;$('giftDescription').value=p.description;$('giftLinkLabel').value=p.linkLabel||'';renderGiftPresets();});}
function renderMedia(id,arr,type){$(id).innerHTML=arr.map(u=>`<figure class="gallery-admin-item"><img src="${u}"><button class="mini-btn delete-media" data-url="${u}" data-type="${type}">Quitar</button></figure>`).join('');document.querySelectorAll('.delete-media').forEach(b=>b.onclick=async()=>{await api('/api/admin/media/item',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:b.dataset.url,type:b.dataset.type})});await load();});}
function renderThemes(){$('themeGrid').innerHTML=themes.map(t=>`<article class="theme-card ${settings.themeId===t.id?'selected':''}"><div class="theme-preview ${t.className}"><span>${t.preview}</span><strong>${esc(t.name)}</strong></div><div class="theme-card-body"><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><button class="secondary-btn choose-theme" data-id="${t.id}">${settings.themeId===t.id?'Plantilla activa':'Aplicar plantilla'}</button></div></article>`).join('');document.querySelectorAll('.choose-theme').forEach(b=>b.onclick=async()=>{await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({themeId:b.dataset.id})});await load();status('Plantilla aplicada.');});}
function renderGuests(){
  const q=$('guestSearch').value.toLowerCase();
  const visible=guests.filter(g=>[g.family_name,g.phone,g.table_name,g.status].some(v=>String(v||'').toLowerCase().includes(q)));
  $('guestRows').innerHTML=visible.map(g=>`<tr class="${g.is_test?'test-row':''}">
    <td><input class="guest-select" type="checkbox" value="${g.id}" aria-label="Seleccionar ${esc(g.family_name)}"></td>
    <td>${g.is_test?'<span class="test-tag">PRUEBA</span> ':''}${esc(g.family_name)}</td>
    <td>${esc(g.phone)}</td><td>${esc(g.table_name)}</td>
    <td><span class="status-pill ${g.status}">${esc(g.status)}</span></td>
    <td>${g.adults??0}/${g.max_adults}</td><td>${g.children??0}/${g.max_children}</td>
    <td>${esc(g.dietary||g.special_needs||'')}</td>
    <td class="actions-cell">
      <a class="mini-btn" target="_blank" href="${g.invitation_url}">Abrir</a>
      ${g.whatsapp_url&&!g.is_test?`<a class="mini-btn whatsapp" target="_blank" href="${g.whatsapp_url}">WhatsApp</a>`:''}
      <button class="mini-btn copy" data-url="${g.invitation_url}">Copiar</button>
      <button class="mini-btn delete-guest" data-id="${g.id}" data-name="${esc(g.family_name)}">Eliminar</button>
    </td></tr>`).join('');
  document.querySelectorAll('.copy').forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.url);status('Enlace copiado.');});
  document.querySelectorAll('.delete-guest').forEach(b=>b.onclick=()=>deleteGuest(Number(b.dataset.id),b.dataset.name));
  document.querySelectorAll('.guest-select').forEach(c=>c.onchange=updateSelectedCount);
  updateSelectedCount();
}
async function deleteGuest(id,name){
  if(!confirm(`¿Eliminar la invitación de "${name}"? También se eliminará su confirmación asociada.`))return;
  const r=await api(`/api/admin/guests/${id}`,{method:'DELETE'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return status(d.error||'No se pudo eliminar.',false);
  status(`Invitación de ${name} eliminada.`);
  await load();
}
function renderPhotos(){const t=$('photoTableFilter').value;$('photoGrid').innerHTML=photos.filter(p=>!t||p.table_name===t).map(p=>`<figure class="photo-card"><a target="_blank" href="${p.url}"><img src="${p.url}"></a><figcaption>${esc(p.table_name||'Sin mesa')} · ${esc(p.uploaded_by||'Invitado')}</figcaption></figure>`).join('');}
async function qr(t){const r=await api(`/api/admin/qr?table=${encodeURIComponent(t)}`),d=await r.json();$('qrImage').src=d.dataUrl;$('qrUrl').textContent=d.url;}async function download(url,name){const r=await api(url);if(!r.ok)return status('No se pudo descargar.',false);const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
$('loginBtn').onclick=login;$('adminPassword').onkeydown=e=>{if(e.key==='Enter')login();};async function logout(){
  try{await api('/api/auth/logout',{method:'POST'});}catch{}
  localStorage.removeItem('authToken');
  localStorage.removeItem('eventId');
  authToken='';
  currentUser=null;
  location.replace('/admin.html');
}
$('logoutBtn').onclick=logout;
if($('topLogoutBtn'))$('topLogoutBtn').onclick=logout;$('eventSelect').onchange=async e=>{eventId=Number(e.target.value);localStorage.setItem('eventId',eventId);await load();};$('newEventBtn').onclick=async()=>{const name=prompt('Nombre del nuevo evento:');if(!name)return;const r=await api('/api/admin/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}),d=await r.json();if(r.ok){events=await(await api('/api/admin/events')).json();eventId=d.id;renderEvents();await load();}};
$('settingsForm').onsubmit=async e=>{e.preventDefault();const body={couple:{partner1:$('partner1').value,partner2:$('partner2').value,displayName:$('displayName').value},event:{dateTime:$('dateTime').value,dateLabel:$('dateLabel').value,heroMessage:$('heroMessage').value,closingMessage:$('closingMessage').value},venue:{name:$('venueName').value,ceremonyTime:$('ceremonyTime').value,receptionTime:$('receptionTime').value,address:$('venueAddress').value,mapsUrl:$('mapsUrl').value,notes:$('venueNotes').value},story:{text:$('storyText').value},dressCode:{title:$('dressTitle').value,description:$('dressDescription').value},menus:{selectionEnabled:$('menuSelectionEnabled').checked,adultOptions:$('adultMenus').value.split('\n').map(x=>x.trim()).filter(Boolean),childOptions:$('childMenus').value.split('\n').map(x=>x.trim()).filter(Boolean),instructions:$('menuInstructions').value},developer:{mode:$('developerMode').checked?'development':'production',showBanner:$('showDevBanner').checked},typography:{heading:$('headingFont').value,body:$('bodyFont').value}};body.venues={samePlace:$('samePlace').checked,ceremony:{title:'Ceremonia',name:$('ceremonyName').value,time:$('ceremonySeparateTime').value,address:$('ceremonyAddress').value,mapsUrl:$('ceremonyMaps').value,lat:$('ceremonyLat').value,lng:$('ceremonyLng').value,notes:''},reception:{title:'Celebración',name:$('receptionName').value,time:$('receptionSeparateTime').value,address:$('receptionAddress').value,mapsUrl:$('receptionMaps').value,lat:$('receptionLat').value,lng:$('receptionLng').value,notes:''}};
body.accessibility={enabled:true,options:$('accessibilityOptions').value.split('\n').map(x=>x.trim()).filter(Boolean),helpText:$('accessibilityHelp').value};
body.media={...(settings.media||{}),spotifyUrl:$('spotifyUrl').value};
const r=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});status(r.ok?'Configuración guardada.':'Error.',r.ok);if(r.ok)await load();};
$('saveGiftBtn').onclick=async()=>{const body={gifts:{mode:$('giftMode').value,title:$('giftTitle').value,message:$('giftMessage').value,description:$('giftDescription').value,link:$('giftLink').value,linkLabel:$('giftLinkLabel').value,bankInfo:$('giftBankInfo').value}};const r=await api('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});status(r.ok?'Modalidad de regalos guardada.':'No se pudo guardar.',r.ok);if(r.ok)await load();};
$('testInviteBtn').onclick=async()=>{const adults=Number(prompt('Adultos permitidos para la prueba:',2));const children=Number(prompt('Niños permitidos para la prueba:',1));const family=prompt('Nombre que verá la invitación:','Familia de prueba')||'Familia de prueba';const r=await api('/api/admin/developer/test-invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adults,children,family_name:family})}),d=await r.json();if(!r.ok)return status(d.error,false);$('testInviteResult').innerHTML=`<strong>Invitación de prueba lista</strong><div><a class="primary-btn" target="_blank" href="${d.url}">Abrir prueba</a><button class="secondary-btn" id="copyTestUrl">Copiar enlace</button></div>`;$('testInviteResult').classList.remove('hidden');$('copyTestUrl').onclick=async()=>{await navigator.clipboard.writeText(d.url);status('Enlace de prueba copiado.');};await load();};
function single(form,input,endpoint){$(form).onsubmit=async e=>{e.preventDefault();const f=$(input).files[0],d=new FormData();d.append('file',f);const r=await api(endpoint,{method:'POST',body:d});status(r.ok?'Archivo cargado.':'Error.',r.ok);if(r.ok){e.target.reset();await load();}};}single('heroForm','heroFile','/api/admin/media/hero');single('musicForm','musicFile','/api/admin/media/music');function multi(form,input,endpoint,field){$(form).onsubmit=async e=>{e.preventDefault();const d=new FormData();[...$(input).files].forEach(f=>d.append(field,f));const r=await api(endpoint,{method:'POST',body:d});status(r.ok?'Imágenes agregadas.':'Error.',r.ok);if(r.ok){e.target.reset();await load();}};}multi('galleryForm','galleryFiles','/api/admin/media/gallery','files');multi('dressForm','dressFiles','/api/admin/media/dress','files');
$('guestForm').onsubmit=async e=>{e.preventDefault();const body={code:$('gCode').value,family_name:$('gFamily').value,phone:$('gPhone').value,table_name:$('gTable').value,max_adults:Number($('gAdults').value),max_children:Number($('gChildren').value),custom_message:$('gMessage').value};const r=await api('/api/admin/guests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});status(r.ok?'Invitado guardado.':'No se pudo guardar.',r.ok);if(r.ok){e.target.reset();await load();}};$('importForm').onsubmit=async e=>{e.preventDefault();const d=new FormData();d.append('file',$('excelFile').files[0]);const r=await api('/api/admin/import',{method:'POST',body:d}),x=await r.json();status(r.ok?`Importados: ${x.imported}`:x.error,r.ok);if(r.ok)await load();};$('guestSearch').oninput=renderGuests;$('photoTableFilter').onchange=renderPhotos;$('generateQrBtn').onclick=()=>qr($('tableSelect').value);$('downloadQrBtn').onclick=()=>download(`/api/admin/qr.png?table=${encodeURIComponent($('tableSelect').value)}`,'qr.png');$('downloadQrSetBtn').onclick=()=>download('/api/admin/qr-set.pdf','set-completo-qr.pdf');$('templateBtn').onclick=()=>download('/api/admin/template.xlsx','plantilla_invitados.xlsx');$('venueReportBtn').onclick=()=>download('/api/admin/venue-report.xlsx','reporte_para_el_lugar.xlsx');

function selectedGuestIds(){return [...document.querySelectorAll('.guest-select:checked')].map(x=>Number(x.value));}
function updateSelectedCount(){$('selectedCount').textContent=`${selectedGuestIds().length} seleccionados`;}
document.addEventListener('change',e=>{if(e.target.classList.contains('guest-select'))updateSelectedCount();});
$('selectAllGuests')?.addEventListener('change',e=>{document.querySelectorAll('.guest-select').forEach(x=>x.checked=e.target.checked);updateSelectedCount();});
$('sendPendingBtn')?.addEventListener('click',()=>{document.querySelectorAll('.guest-select').forEach(x=>{const g=guests.find(y=>y.id===Number(x.value));x.checked=g?.status==='pending';});updateSelectedCount();});
$('sendSelectedBtn')?.addEventListener('click',async()=>{
  const ids=selectedGuestIds();if(!ids.length)return status('Selecciona al menos un invitado.',false);
  const r=await api(`/api/admin/guests/whatsapp-batch?ids=${ids.join(',')}`);const queue=await r.json();
  const box=$('whatsappQueue');box.classList.remove('hidden');
  box.innerHTML=`<h3>Cola de envío por WhatsApp</h3><p class="muted">Por seguridad, WhatsApp requiere confirmar cada envío. Abre uno, envíalo y continúa con el siguiente.</p>
    <div id="queueRows">${queue.map((x,i)=>`<div class="queue-row"><span>${i+1}. ${esc(x.family)}</span>${x.url?`<a class="mini-btn whatsapp queue-open" data-id="${x.id}" href="${x.url}" target="_blank">Abrir WhatsApp</a>`:'<span class="error">Sin teléfono</span>'}</div>`).join('')}</div>
    <button id="markQueueSent" class="secondary-btn">Marcar seleccionados como enviados</button>`;
  $('markQueueSent').onclick=async()=>{const mr=await api('/api/admin/guests/mark-sent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});if(mr.ok){status('Invitaciones marcadas como enviadas.');await load();}};
});
function spotifyEmbedUrl(url){const m=String(url||'').match(/open\.spotify\.com\/(track|playlist|album)\/([A-Za-z0-9]+)/);return m?`https://open.spotify.com/embed/${m[1]}/${m[2]}`:'';}
function renderSpotifyPreview(){const e=spotifyEmbedUrl($('spotifyUrl')?.value);if($('spotifyPreview'))$('spotifyPreview').innerHTML=e?`<iframe src="${e}" width="100%" height="152" frameborder="0" loading="lazy"></iframe>`:'<p class="muted">Pega un enlace válido de Spotify para ver la vista previa.</p>';}
$('spotifyUrl')?.addEventListener('input',renderSpotifyPreview);
const fontCss={georgia:'Georgia,serif',baskerville:'Baskerville,serif',garamond:'Garamond,serif',didot:'Didot,serif',system:'Inter,system-ui,sans-serif',humanist:'Trebuchet MS,sans-serif',classic:'Palatino Linotype,serif'};
function updateFontPreviews(){if($('headingFontPreview'))$('headingFontPreview').style.fontFamily=fontCss[$('headingFont')?.value]||fontCss.georgia;if($('bodyFontPreview'))$('bodyFontPreview').style.fontFamily=fontCss[$('bodyFont')?.value]||fontCss.system;}
$('headingFont')?.addEventListener('change',updateFontPreviews);$('bodyFont')?.addEventListener('change',updateFontPreviews);
async function loadUsers(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  const r=await api('/api/admin/users');if(!r.ok)return;
  const users=await r.json();
  $('uEvents').innerHTML=events.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
  $('userRows').innerHTML=users.map(u=>`<tr><td>${esc(u.display_name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.active?'Activo':'Inactivo'}</td></tr>`).join('');
}
$('userForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const eventIds=[...$('uEvents').selectedOptions].map(o=>Number(o.value));
  const r=await api('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:$('uName').value,email:$('uEmail').value,password:$('uPassword').value,role:$('uRole').value,eventIds})});
  const d=await r.json();status(r.ok?'Usuario creado.':d.error,r.ok);if(r.ok){e.target.reset();await loadUsers();}
});
const oldTab=tab;tab=function(n){oldTab(n);if(n==='users')loadUsers();};


function togglePassword(inputId,button){const input=$(inputId);if(!input)return;input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'Ver':'Ocultar';}
$('toggleLoginPassword')?.addEventListener('click',e=>togglePassword('adminPassword',e.currentTarget));
$('toggleRegisterPassword')?.addEventListener('click',e=>togglePassword('registerPassword',e.currentTarget));
$('showRegisterBtn')?.addEventListener('click',()=>{$('registerForm').classList.remove('hidden');$('showRegisterBtn').classList.add('hidden');});
$('cancelRegisterBtn')?.addEventListener('click',()=>{$('registerForm').classList.add('hidden');$('showRegisterBtn').classList.remove('hidden');});

async function loadPublicPlans(){
  const [plansRes,optsRes]=await Promise.all([fetch('/api/public/plans'),fetch('/api/public/auth-options')]);
  const plans=await plansRes.json(),opts=await optsRes.json();
  if($('registerPlan'))$('registerPlan').innerHTML=plans.map(p=>`<option value="${p.code}">${esc(p.name)} · $${(p.price_cents/100).toLocaleString('es-MX')} ${p.currency}</option>`).join('');
  const google=$('googleLoginBtn');if(google){google.disabled=!opts.googleEnabled;google.title=opts.googleEnabled?'Continuar con Google':'Configura GOOGLE_CLIENT_ID para habilitarlo';}
}
$('registerForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:$('registerName').value,email:$('registerEmail').value,phone:$('registerPhone').value,password:$('registerPassword').value,planCode:$('registerPlan').value})});
  const d=await r.json();
  if(!r.ok){$('registerStatus').textContent=d.error||'No se pudo crear la cuenta.';return;}
  authToken=d.token;currentUser=d.user;eventId=d.eventId;localStorage.setItem('authToken',authToken);localStorage.setItem('eventId',String(eventId));
  events=await(await api('/api/admin/events')).json();renderEvents();
      applyRoleUI();
      $('loginScreen').classList.add('hidden');
      $('adminApp').classList.remove('hidden');
      await load();tab('billing');
});
$('googleLoginBtn')?.addEventListener('click',async()=>{const r=await fetch('/api/auth/google',{method:'POST'});const d=await r.json();$('loginStatus').textContent=d.error||'Google no está configurado.';});

async function loadOwnerDashboard(){
  if(!['owner','developer'].includes(currentUser?.role))return;
  const [sRes,cRes]=await Promise.all([api('/api/admin/owner-summary'),api('/api/admin/clients')]);
  if(!sRes.ok)return;
  const s=await sRes.json(),clients=await cRes.json();
  $('oClients').textContent=s.clients||0;$('oActive').textContent=s.active_clients||0;$('oTrials').textContent=s.active_trials||0;$('oEvents').textContent=s.events||0;$('oRevenue').textContent=`$${((s.revenue_cents||0)/100).toLocaleString('es-MX')} MXN`;
  $('clientRows').innerHTML=clients.map(c=>`<tr><td>${esc(c.display_name)}</td><td>${esc(c.email)}<br>${esc(c.phone||'')}</td><td>${esc(c.plan_name||'Sin plan')}</td><td>${esc(c.subscription_status||'')}</td><td>${c.event_count||0}</td><td>${esc(c.last_login_at||'Nunca')}</td><td>$${((c.paid_cents||0)/100).toLocaleString('es-MX')}</td></tr>`).join('');
}
async function loadBilling(){
  const [bRes,pRes]=await Promise.all([api('/api/billing/me'),fetch('/api/public/plans')]);
  if(!bRes.ok)return;
  const b=await bRes.json(),plans=await pRes.json(),sub=b.subscription;
  $('subscriptionSummary').innerHTML=sub?`<div class="subscription-card"><strong>${esc(sub.name)}</strong><span>Estado: ${esc(sub.status)}</span><span>Vigencia: ${esc(sub.ends_at||'Sin fecha')}</span><span>Hasta ${sub.max_events} evento(s), ${sub.max_guests} invitados y ${sub.max_storage_mb} MB</span></div>`:'<p>Sin suscripción activa.</p>';
  $('billingPlans').innerHTML=plans.map(p=>`<article class="plan-card"><h3>${esc(p.name)}</h3><strong>$${(p.price_cents/100).toLocaleString('es-MX')} ${p.currency}</strong><p>${p.duration_days} días · ${p.max_events} evento(s) · ${p.max_guests} invitados</p><button class="primary-btn demo-checkout" data-plan="${p.code}">Elegir plan</button></article>`).join('');
  $('paymentHistory').innerHTML=`<h3>Historial</h3>${b.payments.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Referencia</th><th>Importe</th><th>Estado</th></tr></thead><tbody>${b.payments.map(x=>`<tr><td>${esc(x.created_at)}</td><td>${esc(x.provider_reference||'')}</td><td>$${(x.amount_cents/100).toLocaleString('es-MX')} ${x.currency}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Todavía no hay pagos.</p>'}`;
  document.querySelectorAll('.demo-checkout').forEach(btn=>btn.onclick=async()=>{if(!confirm('Este pago es sólo una simulación de desarrollo. ¿Continuar?'))return;const r=await api('/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planCode:btn.dataset.plan})});const d=await r.json();status(r.ok?d.message:d.error,r.ok);if(r.ok)await loadBilling();});
}
const originalTabForBusiness=tab;tab=function(name){originalTabForBusiness(name);if(name==='owner')loadOwnerDashboard();if(name==='billing')loadBilling();if(name==='users')loadUsers();};

async function restoreSession(){
  if(!authToken){loadPublicPlans();return;}
  const me=await api('/api/auth/me');if(!me.ok){localStorage.removeItem('authToken');authToken='';loadPublicPlans();return;}
  currentUser=await me.json();events=await(await api('/api/admin/events')).json();const savedEventId=Number(localStorage.getItem('eventId'));eventId=events.some(e=>e.id===savedEventId)?savedEventId:events[0]?.id;localStorage.setItem('eventId',String(eventId||''));renderEvents();
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
