const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
const copy={
  es:{opening:'Una invitación para ti',photo:'Protagonista',date:'Reserva la fecha',place:'Te esperamos',placeName:'Lugar del evento',placeNote:'Consulta la ubicación desde tu invitación.',closing:'Comparte este momento',closingText:'Tu presencia hará especial esta celebración.',pause:'Pausar',play:'Continuar',cta:'Usar este diseño'},
  en:{opening:'An invitation for you',photo:'Meet the star',date:'Save the date',place:'Join us',placeName:'Event venue',placeNote:'Open directions from your invitation.',closing:'Share this moment',closingText:'Your presence will make this celebration special.',pause:'Pause',play:'Continue',cta:'Use this design'},
  pt:{opening:'Um convite para você',photo:'Protagonista',date:'Reserve a data',place:'Esperamos você',placeName:'Local do evento',placeNote:'Abra a localização pelo convite.',closing:'Compartilhe este momento',closingText:'Sua presença tornará esta celebração especial.',pause:'Pausar',play:'Continuar',cta:'Usar este design'}
};
const params=new URLSearchParams(location.search);
let catalog=null,theme=null,eventType=null,scene=0,playing=true,timer=0;

function language(){
  return copy[$('sampleLanguage')?.value]||copy.es;
}

function renderLanguage(){
  const text=language();
  document.documentElement.lang=$('sampleLanguage').value;
  $('sampleOpeningLabel').textContent=text.opening;
  $('samplePhotoLabel').textContent=text.photo;
  $('sampleDateLabel').textContent=text.date;
  $('samplePlaceLabel').textContent=text.place;
  $('samplePlace').textContent=text.placeName;
  $('samplePlaceNote').textContent=text.placeNote;
  $('sampleClosingLabel').textContent=text.closing;
  $('sampleClosingText').textContent=text.closingText;
  $('samplePlay').textContent=playing?text.pause:text.play;
  $('sampleCta').textContent=text.cta;
}

function showScene(next){
  const scenes=[...document.querySelectorAll('.sample-scene')];
  scene=(next+scenes.length)%scenes.length;
  scenes.forEach((item,index)=>item.classList.toggle('is-active',index===scene));
  document.querySelectorAll('.sample-progress button').forEach((button,index)=>{
    button.classList.toggle('is-active',index===scene);
    button.setAttribute('aria-current',index===scene?'step':'false');
  });
}

function schedule(){
  clearInterval(timer);
  if(!playing||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  timer=window.setInterval(()=>showScene(scene+1),4200);
}

function renderAtmosphere(){
  const symbols={paw:'●',dino:'▲',rocket:'✦',wave:'◌',rainbow:'⌒',block:'■',wheel:'○',tent:'△',butterfly:'◇',pixel:'▪',teddy:'●',stork:'⌁',garden:'❀',daisy:'✿',camera:'□',stamp:'◎',light:'✦',frame:'□',moon:'☾',cross:'✧',cloud:'☁',spark:'✦',confetti:'◆',leaf:'❧',paper:'◻',sun:'◉',plane:'✈',rose:'❀',petal:'◇',milestone:'◆',branch:'⌁'};
  const symbol=symbols[theme.motif]||'✦';
  $('sampleAtmosphere').innerHTML=Array.from({length:8},(_,index)=>`<span style="--motif-index:${index}">${esc(symbol)}</span>`).join('');
  document.querySelectorAll('.sample-character').forEach(item=>{item.textContent=symbol;});
}

function renderDemo(){
  const sample=eventType.catalogSample||{};
  const sandboxName=params.get('name')||sample.name||eventType.name;
  const sandboxDate=params.get('dateLabel')||sample.date||'Fecha por confirmar';
  $('sampleThemeName').textContent=theme.name;
  $('sampleThemeDescription').textContent=theme.description;
  $('sampleName').textContent=sandboxName;
  $('samplePhotoName').textContent=sandboxName;
  $('sampleClosingName').textContent=sandboxName;
  $('sampleMilestone').textContent=sample.milestone||eventType.name;
  $('sampleDate').textContent=sandboxDate;
  $('samplePhone').className=`sample-phone ${theme.className}`;
  $('samplePhone').dataset.layout=theme.layoutFamily;
  $('samplePhone').dataset.motion=theme.motionPreset;
  $('samplePhone').dataset.photoStyle=theme.photoStyle;
  $('samplePhone').dataset.motif=theme.motif;
  $('sampleStructure').innerHTML=`<span>${esc(theme.layoutLabel)}</span><span>${esc(theme.photoStyleLabel)}</span><span>${esc(theme.motionLabel)}</span>`;
  $('sampleProgress').innerHTML=Array.from({length:5},(_,index)=>`<button type="button" data-index="${index}" aria-label="Ver escena ${index+1}"></button>`).join('');
  $('sampleProgress').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
    showScene(Number(button.dataset.index));
    schedule();
  }));
  const plan=theme.minPlan||'express';
  $('sampleCta').href=`/admin.html?register=1&plan=${encodeURIComponent(plan)}&theme=${encodeURIComponent(theme.id)}&eventType=${encodeURIComponent(eventType.id)}`;
  renderAtmosphere();
  renderLanguage();
  showScene(0);
  schedule();
}

async function loadSample(){
  const response=await fetch('/api/public/catalog',{headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('No se pudo cargar la muestra.');
  catalog=await response.json();
  theme=catalog.themes.find(item=>item.id===params.get('theme'))||catalog.themes[0];
  const preferredEvent=params.get('event');
  eventType=catalog.eventTypes.find(item=>item.id===preferredEvent)
    ||catalog.eventTypes.find(item=>(theme.eventTypes||[]).includes(item.id))
    ||catalog.eventTypes[0];
  renderDemo();
}

$('sampleLanguage').addEventListener('change',renderLanguage);
$('samplePrevious').addEventListener('click',()=>{showScene(scene-1);schedule();});
$('sampleNext').addEventListener('click',()=>{showScene(scene+1);schedule();});
$('samplePlay').addEventListener('click',()=>{
  playing=!playing;
  renderLanguage();
  schedule();
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)clearInterval(timer);
  else schedule();
});

loadSample().catch(error=>{
  $('sampleThemeName').textContent=error.message;
  $('sampleThemeDescription').textContent='Regresa al catálogo e inténtalo nuevamente.';
});
