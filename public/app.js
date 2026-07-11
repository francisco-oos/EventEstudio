let settings=null,currentGuest=null,galleryItems=[],galleryIndex=0;const $=id=>document.getElementById(id);function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function slug(){const m=location.pathname.match(/^\/e\/([^/]+)/);return m?decodeURIComponent(m[1]):"";}
const fontMap={georgia:'Georgia,"Times New Roman",serif',baskerville:'Baskerville,"Palatino Linotype",serif',garamond:'Garamond,"Times New Roman",serif',didot:'Didot,"Bodoni MT",serif',system:'Inter,system-ui,-apple-system,"Segoe UI",sans-serif',humanist:'Trebuchet MS,Segoe UI,sans-serif',classic:'Palatino Linotype,Book Antiqua,serif'};
async function load(){const s=slug();const r=await fetch(s?`/api/config/${encodeURIComponent(s)}`:"/api/config");settings=await r.json();document.body.className=`theme-${settings.themeId||"romantic-wine"}`;document.documentElement.style.setProperty('--font-heading',fontMap[settings.typography?.heading]||fontMap.georgia);document.documentElement.style.setProperty('--font-body',fontMap[settings.typography?.body]||fontMap.system);if(new URLSearchParams(location.search).get('preview')==='1'&&settings.developer?.mode==='development'&&settings.developer?.showBanner!==false)$('devBanner').classList.remove('hidden');$('coupleName').textContent=settings.couple.displayName;$('footerCouple').textContent=settings.couple.displayName;$('dateLabel').textContent=settings.event.dateLabel;$('heroMessage').textContent=settings.event.heroMessage;$('closingMessage').textContent=settings.event.closingMessage;$('storyTitle').textContent=settings.story.title;$('storyText').textContent=settings.story.text;$('venueTitle').textContent=settings.venue.title;$('venueName').textContent=settings.venue.name;$('ceremonyTime').textContent=settings.venue.ceremonyTime;$('receptionTime').textContent=settings.venue.receptionTime;$('venueAddress').textContent=settings.venue.address;$('venueNotes').textContent=settings.venue.notes||"";$('venueMaps').href=settings.venue.mapsUrl;
renderVenues();
renderAccessibility();
renderSpotify();
$('dressTitle').textContent=settings.dressCode.title;$('dressDescription').textContent=settings.dressCode.description;$('dressGallery').innerHTML=(settings.dressCode.referenceImages||[]).map(u=>`<img src="${u}" alt="Referencia de vestimenta">`).join('');renderGift();if(settings.media.heroImage)$('hero').style.backgroundImage=`linear-gradient(rgba(0,0,0,.33),rgba(0,0,0,.33)),url('${settings.media.heroImage}')`;if(settings.media.music){$('backgroundMusic').src=settings.media.music;$('musicBtn').classList.remove('hidden');}galleryItems=settings.media.gallery||[];if(galleryItems.length){$('gallerySection').classList.remove('hidden');renderGallery();}countdown();await invite();}

function renderVenues(){
  const v=settings.venues;
  if(!v)return;
  const c=v.ceremony||{}, r=v.reception||{};
  if(v.samePlace){
    $('venueTitle').textContent=settings.venue?.title||'Ceremonia y celebración';
    $('venueName').textContent=c.name||settings.venue?.name||'';
    $('ceremonyTime').textContent=c.time||settings.venue?.ceremonyTime||'';
    $('receptionTime').textContent=r.time||settings.venue?.receptionTime||'';
    $('venueAddress').textContent=c.address||settings.venue?.address||'';
    $('venueMaps').href=c.mapsUrl||settings.venue?.mapsUrl||'#';
    return;
  }
  $('venuesContainer').innerHTML=[c,r].map((x,i)=>`
    <article class="event-card centered">
      <p class="eyebrow">${esc(x.title|| (i===0?'Ceremonia':'Celebración'))}</p>
      <h2>${esc(x.name||'')}</h2><p><strong>Hora:</strong> ${esc(x.time||'')}</p>
      <p>${esc(x.address||'')}</p><p class="muted">${esc(x.notes||'')}</p>
      <a class="secondary-btn" href="${esc(x.mapsUrl||'#')}" target="_blank">Cómo llegar</a>
    </article>`).join('');
}
function renderAccessibility(){
  const a=settings.accessibility||{};
  const options=a.options||[];
  if(!a.enabled||!options.length)return;
  $('accessibilityField').classList.remove('hidden');
  $('accessibilityOptions').innerHTML=options.map((o,i)=>`
    <label class="choice-card"><input type="checkbox" name="accessibility" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('');
  if(a.helpText)$('accessibilityField').insertAdjacentHTML('afterbegin',`<p class="muted">${esc(a.helpText)}</p>`);
}
function spotifyEmbedUrl(url){
  const m=String(url||'').match(/open\.spotify\.com\/(track|playlist|album)\/([A-Za-z0-9]+)/);
  return m?`https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`:'';
}
function renderSpotify(){
  const url=settings.media?.spotifyUrl||'';
  const embed=spotifyEmbedUrl(url);
  if(!embed)return;
  $('spotifySection').classList.remove('hidden');
  $('spotifyPlayer').innerHTML=`<iframe style="border-radius:16px" src="${embed}" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}

function renderGift(){const g=settings.gifts||{};$('giftTitle').textContent=g.title||'Regalos';$('giftMessage').textContent=g.message||'';$('giftDescription').textContent=g.description||'';$('bankInfo').textContent=g.mode==='bank-transfer'||g.mode==='mixed'?(g.bankInfo||''):'';if(g.link&&(g.mode==='registry'||g.mode==='mixed')){$('giftLink').href=g.link;$('giftLink').textContent=g.linkLabel||'Ver mesa de regalos';$('giftLink').classList.remove('hidden');}else $('giftLink').classList.add('hidden');if(g.mode==='no-gifts')$('giftSection').classList.add('no-gifts');}
function renderGallery(){const ordered=[...galleryItems.slice(galleryIndex),...galleryItems.slice(0,galleryIndex)];$('gallery').innerHTML=ordered.map((u,i)=>`<button class="gallery-item ${i===0?'featured':''}" data-original-index="${(galleryIndex+i)%galleryItems.length}"><img src="${u}" alt="Fotografía de la pareja"></button>`).join('');document.querySelectorAll('.gallery-item').forEach(b=>b.onclick=()=>openLightbox(Number(b.dataset.originalIndex)));}
function moveGallery(step){galleryIndex=(galleryIndex+step+galleryItems.length)%galleryItems.length;renderGallery();}
function openLightbox(i){galleryIndex=i;$('lightboxImage').src=galleryItems[i];$('lightbox').classList.remove('hidden');document.body.classList.add('no-scroll');}
function closeLightbox(){$('lightbox').classList.add('hidden');document.body.classList.remove('no-scroll');}
function countdown(){const target=new Date(settings.event.dateTime).getTime();const tick=()=>{const d=Math.max(0,target-Date.now());$('days').textContent=Math.floor(d/86400000);$('hours').textContent=Math.floor(d/3600000)%24;$('minutes').textContent=Math.floor(d/60000)%60;$('seconds').textContent=Math.floor(d/1000)%60;};tick();setInterval(tick,1000);}
async function invite(){const token=new URLSearchParams(location.search).get('i');if(!token)return;const r=await fetch(`/api/invitation/token/${encodeURIComponent(token)}`),d=await r.json();if(!r.ok){$('guestGreeting').textContent=d.error;return;}currentGuest=d.guest;$('personalWelcome').classList.remove('hidden');$('guestName').textContent=d.guest.family_name;const p=[];if(d.guest.max_adults)p.push(`${d.guest.max_adults} adulto(s)`);if(d.guest.max_children)p.push(`${d.guest.max_children} niño(s)`);$('reservedPlaces').textContent=`Hemos reservado ${p.join(' y ')} para ustedes.`;$('customMessage').textContent=d.guest.custom_message||'';$('guestGreeting').textContent=`Confirma cuántas personas de ${d.guest.family_name} asistirán.`;const hasAdults=d.guest.max_adults>0,hasChildren=d.guest.max_children>0;$('adultCountField').classList.toggle('hidden',!hasAdults);$('childCountField').classList.toggle('hidden',!hasChildren);$('adults').max=d.guest.max_adults;$('children').max=d.guest.max_children;$('adults').value=hasAdults?(d.rsvp?.adults??Math.min(1,d.guest.max_adults)):0;$('children').value=hasChildren?(d.rsvp?.children??Math.min(1,d.guest.max_children)):0;$('attendeeNames').value=d.rsvp?.attendee_names||'';$('dietary').value=d.rsvp?.dietary||'';$('specialNeeds').value=d.rsvp?.special_needs||'';$('contactPhone').value=d.rsvp?.contact_phone||d.guest.phone||'';$('message').value=d.rsvp?.message||'';$('attending').value=d.rsvp?.attending===0?'no':'yes';buildMenus(d.menus,d.rsvp,hasAdults,hasChildren);$('rsvpForm').classList.remove('hidden');}
function buildMenus(m,r,hasAdults,hasChildren){$('menuInfo').textContent=m.instructions||'';if(!m.selectionEnabled){$('adultMenuFields').innerHTML='';$('childMenuFields').innerHTML='';return;}let am={},cm={};try{am=JSON.parse(r?.adult_menu_counts||'{}')}catch{}try{cm=JSON.parse(r?.child_menu_counts||'{}')}catch{}const fields=(opts,prefix,obj,title)=>opts?.length?`<h3>${title}</h3>${opts.map(o=>`<label>${esc(o)}<input type="number" min="0" value="${Number(obj[o]||0)}" data-menu="${prefix}" data-name="${esc(o)}"></label>`).join('')}`:'';$('adultMenuFields').innerHTML=hasAdults?fields(m.adultOptions,'adult',am,'Menús para adultos'):'';$('childMenuFields').innerHTML=hasChildren?fields(m.childOptions,'child',cm,'Menús infantiles'):'';}
function menuCounts(type){const o={};document.querySelectorAll(`[data-menu="${type}"]`).forEach(i=>o[i.dataset.name]=Number(i.value||0));return o;}
$('galleryPrev').onclick=()=>moveGallery(-1);$('galleryNext').onclick=()=>moveGallery(1);$('lightboxClose').onclick=closeLightbox;$('lightboxPrev').onclick=()=>openLightbox((galleryIndex-1+galleryItems.length)%galleryItems.length);$('lightboxNext').onclick=()=>openLightbox((galleryIndex+1)%galleryItems.length);$('lightbox').onclick=e=>{if(e.target===$('lightbox'))closeLightbox();};
$('openInvitationBtn').onclick=async()=>{$('invitation').scrollIntoView({behavior:'smooth'});try{await $('backgroundMusic').play();$('musicBtn').textContent='❚❚';}catch{}};$('musicBtn').onclick=async()=>{const a=$('backgroundMusic');if(a.paused){await a.play();$('musicBtn').textContent='❚❚';}else{a.pause();$('musicBtn').textContent='♫';}};
$('rsvpForm').onsubmit=async e=>{e.preventDefault();const payload={token:currentGuest.token,attending:$('attending').value==='yes',adults:Number($('adults').value||0),children:Number($('children').value||0),attendee_names:$('attendeeNames').value,dietary:$('dietary').value,special_needs:$('specialNeeds').value,adult_menu_counts:menuCounts('adult'),child_menu_counts:menuCounts('child'),message:$('message').value,contact_phone:$('contactPhone').value,accessibility_options:[...document.querySelectorAll('input[name="accessibility"]:checked')].map(x=>x.value),accessibility_other:$('accessibilityOther')?.value||''};const r=await fetch('/api/rsvp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),d=await r.json();$('rsvpStatus').textContent=r.ok?'Confirmación guardada. ¡Gracias!':d.error;};load();