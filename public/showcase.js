'use strict';
const grid=document.getElementById('publicShowcaseGrid');
let showcaseItems=[],activeFilter='all';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
function sessionKey(){let key=localStorage.getItem('eventstudioAnalyticsSession');if(!key){key=`es-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;localStorage.setItem('eventstudioAnalyticsSession',key);}return key;}
function track(eventName,metadata={}){fetch('/api/analytics/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventName,sessionKey:sessionKey(),source:'showcase',metadata})}).catch(()=>{});}
function render(){
  const items=activeFilter==='all'?showcaseItems:showcaseItems.filter(item=>item.event_type===activeFilter||(activeFilter==='custom'&&!['wedding','xv','corporate'].includes(item.event_type)));
  grid.innerHTML=items.map(item=>{
    const demo=item.source_type==='demo'||item.snapshot?.demo;
    const url=`/muestra.html?theme=${encodeURIComponent(item.theme_id||'')}&event=${encodeURIComponent(item.event_type||'wedding')}`;
    return `<article class="public-showcase-card"><a href="${url}" data-theme="${esc(item.theme_id)}"><div class="public-showcase-art">${item.asset_url?`<img src="${esc(item.asset_url)}" alt="${esc(item.title||'Muestra de EventStudio')}" loading="lazy" decoding="async">`:''}<span class="showcase-source-badge">${demo?'Demo editorial':'Muestra autorizada'}</span></div><div class="public-showcase-copy"><small>${esc(item.event_type||'Evento')}</small><h2>${esc(item.title)}</h2><p>${esc(item.subtitle||'')}</p><span>Ver diseño →</span></div></a></article>`;
  }).join('')||'<p class="muted">No hay muestras para este filtro.</p>';
  grid.querySelectorAll('a[data-theme]').forEach(link=>link.addEventListener('click',()=>track('template_previewed',{themeId:link.dataset.theme})));
}
document.querySelectorAll('[data-showcase-filter]').forEach(button=>button.addEventListener('click',()=>{activeFilter=button.dataset.showcaseFilter;document.querySelectorAll('[data-showcase-filter]').forEach(item=>item.classList.toggle('active',item===button));render();}));
fetch(`/api/public/showcase?_=${Date.now()}`,{cache:'no-store'}).then(response=>response.json()).then(data=>{showcaseItems=Array.isArray(data)?data:[];render();track('showcase_view',{resultCount:showcaseItems.length});}).catch(()=>{grid.innerHTML='<p class="muted">No fue posible cargar la galería en este momento.</p>';});
