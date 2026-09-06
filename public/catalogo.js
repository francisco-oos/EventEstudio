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
let sealCatalogData=null;
let activeEventType='';
let heroRecipeIndex=0;

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

function recipeCatalogItems(){
  return Array.isArray(catalog?.recipes)&&catalog.recipes.length?catalog.recipes:(catalog?.themes||[]);
}

function renderThemes(){
  const search=String($('catalogSearch').value||'').trim().toLocaleLowerCase('es-MX');
  const plan=$('catalogPlanFilter').value;
  const recipes=recipeCatalogItems().filter(recipe=>{
    const haystack=[recipe.name,recipe.description,...(recipe.tags||[])].join(' ').toLocaleLowerCase('es-MX');
    return (!search||haystack.includes(search))
      &&(!plan||(recipe.minPlan||'starter')===plan)
      &&(!activeEventType||(recipe.eventTypes||[]).includes(activeEventType));
  });
  $('catalogThemeGrid').innerHTML=recipes.map(recipe=>{
    const suggestedEvent=activeEventType||(recipe.eventTypes||[])[0]||'custom';
    const level=recipe.minPlan||'starter';
    const design=recipe.design||{};
    const typography=design.typography||{};
    const harmony=design.colorTheory?.harmony||'coherente';
    const previewUrl=recipe.previewUrl||`/api/public/design/recipes/${encodeURIComponent(recipe.id)}/thumbnail?width=540&height=320`;
    return `<article class="catalog-theme-card" data-recipe-id="${esc(recipe.id)}">
      <div class="catalog-theme-visual catalog-recipe-visual">
        <img loading="lazy" decoding="async" src="${esc(previewUrl)}" alt="Vista previa de ${esc(recipe.name)}">
      </div>
      <div class="catalog-theme-copy">
        <div><span class="catalog-plan-pill">${esc(planNames[level]||level)}</span><h3>${esc(recipe.name)}</h3></div>
        <p>${esc(recipe.description)}</p>
        <div class="theme-structure-list"><span>${esc(design.layoutFamily||'classic')}</span><span>${esc(typography.heading||'tipografía adaptable')}</span><span>${esc(harmony)}</span></div>
        <div class="theme-tag-list">${(recipe.tags||[]).slice(0,4).map(tag=>`<span>${esc(tag)}</span>`).join('')}</div>
        <div class="catalog-theme-actions">
          <a class="secondary-btn" href="${sampleUrl(recipe,suggestedEvent)}">Ver muestra animada</a>
          <a class="primary-btn" href="${registerUrl({theme:recipe.id,eventType:suggestedEvent,plan:level})}">${catalog.registrationEnabled?'Personalizar':'Ingresar'}</a>
        </div>
      </div>
    </article>`;
  }).join('')||'<div class="catalog-empty"><strong>No hay diseños con esos filtros.</strong><span>Prueba otra búsqueda o celebración.</span></div>';
  $('catalogThemeGrid').querySelectorAll('.catalog-theme-card').forEach((card,index)=>{
    const recipe=recipes[index];if(!recipe)return;
    card.querySelector('.secondary-btn')?.addEventListener('click',()=>trackCatalog('template_previewed',{themeId:recipe.id,eventType:activeEventType||((recipe.eventTypes||[])[0]||'custom')}));
    card.querySelector('.primary-btn')?.addEventListener('click',()=>trackCatalog('catalog_view',{themeId:recipe.id,eventType:activeEventType||((recipe.eventTypes||[])[0]||'custom'),planCode:recipe.minPlan||'starter'}));
  });
}

function renderHeroRecipe(step=0){
  const items=recipeCatalogItems();
  if(!items.length)return;
  heroRecipeIndex=(heroRecipeIndex+step+items.length)%items.length;
  const recipe=items[heroRecipeIndex];
  const previewUrl=recipe.previewUrl||`/api/public/design/recipes/${encodeURIComponent(recipe.id)}/thumbnail?width=720&height=480`;
  const host=$('heroRecipePreview');
  host.innerHTML=`<img src="${esc(previewUrl)}" alt="Vista previa de ${esc(recipe.name)}" decoding="async" fetchpriority="high">`;
  $('heroRecipeName').textContent=recipe.name;
  const design=recipe.design||{};
  $('heroRecipeMeta').textContent=`${design.layoutFamily||'Layout adaptable'} · ${design.colorTheory?.harmony||'armonía cromática'} · editable`;
  const activeColor=design.palette?.accent||design.palette?.primary||'#7b4b56';
  if(/^#[0-9a-f]{6}$/i.test(activeColor))$('landingSealColor').value=activeColor;
  renderLandingSeal();
}

function renderLandingSeal(){
  const host=$('landingSealPreview');
  if(!host||!globalThis.EventStudioWaxSeal||!sealCatalogData)return;
  const raw=String($('landingSealInitials')?.value||'ES').trim().replace(/[^\p{L}\p{N}]/gu,'').slice(0,3)||'ES';
  const first=raw[0]||'E',second=raw.slice(1)||'S';
  const color=$('landingSealColor')?.value||'#7b4b56';
  const definition={...(sealCatalogData.defaults||{}),material:'custom',customColor:color,autoMonogram:false,initial1:first,initial2:second,quality:'balanced'};
  EventStudioWaxSeal.renderInto(host,definition,{displayName:`${first} & ${second}`,themeColor:color,seed:`landing-${raw}`},sealCatalogData);
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
  const [catalogResponse,sealResponse]=await Promise.all([
    fetch('/api/public/catalog',{headers:{Accept:'application/json'},cache:'no-store'}),
    fetch('/api/public/seals',{headers:{Accept:'application/json'},cache:'no-store'})
  ]);
  if(!catalogResponse.ok)throw new Error('No se pudo cargar el catálogo.');
  catalog=await catalogResponse.json();
  sealCatalogData=sealResponse.ok?await sealResponse.json():null;
  if($('catalogThemeCount'))$('catalogThemeCount').textContent=String(recipeCatalogItems().length);
  if($('catalogEventCount'))$('catalogEventCount').textContent=String(catalog.eventTypes.length);
  $('heroTrialCta').textContent='Diseñar mi invitación';
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
  $('heroRecipeNext')?.addEventListener('click',()=>{renderHeroRecipe(1);trackCatalog('catalog_view',{source:'hero-recipe-cycle'});});
  $('landingSealColor')?.addEventListener('input',renderLandingSeal);
  $('landingSealInitials')?.addEventListener('input',renderLandingSeal);
  renderEventChips();
  renderThemes();
  renderPlans();
  renderBuilder();
  renderHeroRecipe(0);
  trackCatalog('landing_view',{source:'catalogo'});
  trackCatalog('catalog_view',{resultCount:recipeCatalogItems().length,eventType:activeEventType||'all'});
}

loadCatalog().catch(error=>{
  $('catalogThemeGrid').innerHTML=`<div class="catalog-empty"><strong>${esc(error.message)}</strong><span>Intenta recargar la página.</span></div>`;
});
