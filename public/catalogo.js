const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
const money=(cents,currency='MXN')=>`$${(Number(cents||0)/100).toLocaleString('es-MX')} ${currency}`;
const planNames={express:'Express',starter:'Esencial',basic:'Plus',premium:'Premium'};
const featureNames={
  invitation:'Invitación digital',rsvp:'Confirmación RSVP',guests:'Gestión de invitados',
  whatsappManual:'Envío manual por WhatsApp',locations:'Ubicaciones y mapas',templates:'Plantillas',
  thematicExperience:'Recorrido temático animado',
  music:'Música y apertura',program:'Programa del evento',dressCode:'Vestimenta',gifts:'Regalos',
  gallery:'Galería',reports:'Reportes',guestPhotoUpload:'Álbum colaborativo',
  guestPhotoMessages:'Mensajes con fotografías',qrCards:'QR e impresión',
  physicalInvitations:'Invitaciones físicas',seating:'Plano y mesas',menus:'Menús y restricciones',
  premiumTemplates:'Plantillas Premium'
};
let catalog=null;
let activeEventType='';

const campaignParams=new URLSearchParams(location.search);
const campaignSource=(campaignParams.get('utm_source')||campaignParams.get('ref')||'catalogo').slice(0,30);
function catalogSessionKey(){
  let key=sessionStorage.getItem('eventstudio_public_session');
  if(!key){key=(globalThis.crypto?.randomUUID?.()||`public-${Date.now()}-${Math.random().toString(36).slice(2)}`);sessionStorage.setItem('eventstudio_public_session',key);}
  return key;
}
function campaignMetadata(extra={}){
  let referrerHost='';
  try{referrerHost=document.referrer?new URL(document.referrer).hostname:'';}catch{}
  return {campaign:(campaignParams.get('utm_campaign')||'').slice(0,120),medium:(campaignParams.get('utm_medium')||'').slice(0,120),referrerHost:referrerHost.slice(0,120),...extra};
}
function trackCatalog(eventName,metadata={}){
  fetch('/api/analytics/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventName,sessionKey:catalogSessionKey(),source:campaignSource,metadata:campaignMetadata(metadata)})}).catch(()=>{});
}

function registerUrl({theme='',eventType='',plan='basic'}={}){
  if(catalog&&!catalog.registrationEnabled)return '/admin.html';
  const params=new URLSearchParams({register:'1',plan});
  if(theme)params.set('theme',theme);
  if(eventType)params.set('eventType',eventType);
  return `/admin.html?${params.toString()}`;
}

function sampleUrl(theme,eventType){
  const params=new URLSearchParams({theme:theme.id,event:eventType});
  return `/muestra.html?${params.toString()}`;
}

function renderEventChips(){
  const container=$('catalogEventChips');
  container.innerHTML=`<button class="${activeEventType?'':'active'}" type="button" data-event="">Todas</button>${catalog.eventTypes.map(type=>`
    <button class="${activeEventType===type.id?'active':''}" type="button" data-event="${esc(type.id)}">${type.icon} ${esc(type.name)}</button>
  `).join('')}`;
  container.querySelectorAll('[data-event]').forEach(button=>button.addEventListener('click',()=>{
    activeEventType=button.dataset.event;
    trackCatalog('catalog_view',{eventType:activeEventType||'all'});
    renderEventChips();
    renderThemes();
  }));
}

function renderThemes(){
  const search=String($('catalogSearch').value||'').trim().toLocaleLowerCase('es-MX');
  const plan=$('catalogPlanFilter').value;
  const themes=catalog.themes.filter(theme=>{
    const haystack=[theme.name,theme.description,...(theme.tags||[])].join(' ').toLocaleLowerCase('es-MX');
    return (!search||haystack.includes(search))
      &&(!plan||(theme.minPlan||'starter')===plan)
      &&(!activeEventType||(theme.eventTypes||[]).includes(activeEventType));
  });
  $('catalogThemeGrid').innerHTML=themes.map(theme=>{
    const suggestedEvent=activeEventType||(theme.eventTypes||[])[0]||'custom';
    const level=theme.minPlan||'starter';
    return `<article class="catalog-theme-card">
      <div class="catalog-theme-visual ${esc(theme.className)}" data-layout="${esc(theme.layoutFamily)}" data-photo-style="${esc(theme.photoStyle)}" data-motif="${esc(theme.motif)}"><span>${theme.preview}</span><strong>${esc(theme.name)}</strong><small>${esc(theme.layoutLabel)}</small></div>
      <div class="catalog-theme-copy">
        <div><span class="catalog-plan-pill">${esc(planNames[level]||level)}</span><h3>${esc(theme.name)}</h3></div>
        <p>${esc(theme.description)}</p>
        <div class="theme-structure-list"><span>${esc(theme.layoutLabel)}</span><span>${esc(theme.photoStyleLabel)}</span><span>${esc(theme.motionLabel)}</span></div>
        <div class="theme-tag-list">${(theme.tags||[]).slice(0,4).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>
        <div class="catalog-theme-actions">
          <a class="secondary-btn" href="${sampleUrl(theme,suggestedEvent)}">Ver muestra animada</a>
          <a class="primary-btn" href="${registerUrl({theme:theme.id,eventType:suggestedEvent,plan:level})}">${catalog.registrationEnabled?'Elegir':'Ingresar'}</a>
        </div>
      </div>
    </article>`;
  }).join('')||'<div class="catalog-empty"><strong>No hay diseños con esos filtros.</strong><span>Prueba otra búsqueda o celebración.</span></div>';
  $('catalogThemeGrid').querySelectorAll('.catalog-theme-card').forEach((card,index)=>{
    const theme=themes[index];if(!theme)return;
    card.querySelector('.secondary-btn')?.addEventListener('click',()=>trackCatalog('template_previewed',{themeId:theme.id,eventType:activeEventType||((theme.eventTypes||[])[0]||'custom')}));
    card.querySelector('.primary-btn')?.addEventListener('click',()=>trackCatalog('catalog_view',{themeId:theme.id,eventType:activeEventType||((theme.eventTypes||[])[0]||'custom'),planCode:theme.minPlan||'starter'}));
  });
}

function renderPlans(){
  $('catalogPlanGrid').innerHTML=catalog.plans.map(plan=>`
    <article class="catalog-plan-card ${plan.featured?'featured':''}">
      ${plan.featured?'<span class="catalog-featured-label">Más elegido</span>':''}
      <p class="eyebrow">${esc(planNames[plan.code]||plan.code)}</p>
      <h3>${esc(plan.name)}</h3>
      <strong class="catalog-price">${money(plan.price_cents,plan.currency)}</strong>
      <p>${esc(plan.tagline)}</p>
      <ul>${(plan.included||[]).filter(key=>featureNames[key]).slice(0,plan.includesAllAvailable?9:12).map(key=>`<li>✓ ${esc(featureNames[key])}</li>`).join('')}</ul>
      ${plan.includesAllAvailable?'<p class="plan-all-note">Incluye todo módulo disponible para clientes.</p>':''}
      <small>${plan.max_guests?`${plan.max_guests} invitados`:'Sin gestión RSVP'} · ${plan.duration_days} días · ${plan.max_storage_mb} MB</small>
      <a class="primary-btn" href="${registerUrl({plan:plan.code,eventType:activeEventType||'wedding'})}">${catalog.registrationEnabled?'Probar este plan':'Ingresar'}</a>
    </article>
  `).join('');
}

function renderBuilder(){
  const selectedCode=$('builderPlan').value||catalog.plans[0]?.code;
  const plan=catalog.plans.find(item=>item.code===selectedCode)||catalog.plans[0];
  const included=new Set(plan?.included||[]);
  $('builderAddons').innerHTML=catalog.addons.map(addon=>{
    const alreadyIncluded=plan?.includesAllAvailable||included.has(addon.key);
    return `<label class="builder-addon ${alreadyIncluded?'included':''}">
      <input type="checkbox" value="${esc(addon.key)}" data-price="${Number(addon.price_cents||0)}" ${alreadyIncluded?'checked disabled':''}>
      <span><strong>${esc(addon.name)}</strong><small>${esc(addon.description)}</small></span>
      <b>${alreadyIncluded?'Incluido':money(addon.price_cents,addon.currency)}</b>
    </label>`;
  }).join('');
  $('builderAddons').querySelectorAll('input').forEach(input=>input.addEventListener('change',updateBuilderTotal));
  updateBuilderTotal();
}

function updateBuilderTotal(){
  const plan=catalog.plans.find(item=>item.code===$('builderPlan').value)||catalog.plans[0];
  const extras=[...document.querySelectorAll('#builderAddons input:checked:not(:disabled)')];
  const total=Number(plan?.price_cents||0)+extras.reduce((sum,input)=>sum+Number(input.dataset.price||0),0);
  $('builderTotal').textContent=money(total,plan?.currency);
  $('builderDescription').textContent=extras.length
    ?`${plan.name} + ${extras.length} complemento(s) seleccionado(s).`
    :`${plan.name}, sin complementos adicionales.`;
  $('builderCta').href=registerUrl({plan:plan.code,eventType:activeEventType||'wedding'});
}

async function loadCatalog(){
  const response=await fetch('/api/public/catalog',{headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('No se pudo cargar el catálogo.');
  catalog=await response.json();
  if($('catalogThemeCount'))$('catalogThemeCount').textContent=String(catalog.themes.length);
  if($('catalogEventCount'))$('catalogEventCount').textContent=String(catalog.eventTypes.length);
  $('heroTrialCta').textContent='Crea tu diseño ahora';
  $('heroTrialCta').href='/sandbox.html';
  $('builderTrialNote').textContent=`${catalog.trialDays} días, evento privado y sin cobro automático.`;
  if(!catalog.registrationEnabled){
    $('heroTrialCta').textContent='Explorar diseños';
    $('heroTrialCta').href='/sandbox.html';
    $('registrationNotice').textContent='El registro público está cerrado temporalmente; las cuentas existentes pueden ingresar normalmente.';
    $('registrationNotice').classList.remove('hidden');
    $('builderCta').textContent='Ingresar a EventStudio';
  }
  $('builderPlan').innerHTML=catalog.plans.map(plan=>`<option value="${esc(plan.code)}">${esc(plan.name)} · ${money(plan.price_cents,plan.currency)}</option>`).join('');
  $('builderPlan').value=catalog.plans.some(plan=>plan.code==='express')?'express':catalog.plans[0]?.code;
  $('builderPlan').addEventListener('change',renderBuilder);
  $('catalogSearch').addEventListener('input',renderThemes);
  $('catalogPlanFilter').addEventListener('change',renderThemes);
  renderEventChips();
  renderThemes();
  renderPlans();
  renderBuilder();
  trackCatalog('landing_view',{source:'catalogo'});
  trackCatalog('catalog_view',{resultCount:catalog.themes.length,eventType:activeEventType||'all'});
}

loadCatalog().catch(error=>{
  $('catalogThemeGrid').innerHTML=`<div class="catalog-empty"><strong>${esc(error.message)}</strong><span>Intenta recargar la página.</span></div>`;
});
