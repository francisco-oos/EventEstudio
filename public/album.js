const query=new URLSearchParams(location.search);
const tableName=query.get("mesa")||"";
const eventSlug=query.get("e")||"";
const invitationToken=query.get("i")||"";
const form=document.getElementById("photoForm");
const status=document.getElementById("photoStatus");
const submit=document.getElementById("photoSubmit");
const progress=document.getElementById("photoProgress");
document.getElementById("tableLabel").textContent=tableName||"Álbum general";
const photoInput=document.getElementById("photos");
const preview=document.getElementById("selectedPhotoPreview");
let previewUrls=[];
const fontMap={georgia:'Georgia,"Times New Roman",serif',baskerville:'Baskerville,"Palatino Linotype",serif',garamond:'Garamond,"Times New Roman",serif',didot:'Didot,"Bodoni MT",serif',system:'Inter,system-ui,-apple-system,"Segoe UI",sans-serif',humanist:'Trebuchet MS,Segoe UI,sans-serif',classic:'Palatino Linotype,Book Antiqua,serif','great-vibes':'Great Vibes,Georgia,cursive',cormorant:'Cormorant Garamond,Georgia,serif',playfair:'Playfair Display,Georgia,serif',cinzel:'Cinzel,Georgia,serif',lora:'Lora,Georgia,serif',montserrat:'Montserrat,Inter,system-ui,sans-serif'};

async function loadAlbumTheme(){
  if(!eventSlug)return;
  try{
    const response=await fetch(`/api/config/${encodeURIComponent(eventSlug)}`);
    if(!response.ok)return;
    const settings=await response.json();
    document.body.className=`simple-page album-page theme-${settings.themeId||'romantic-wine'}`;
    document.documentElement.style.setProperty('--font-heading',fontMap[settings.typography?.heading]||fontMap.georgia);
    document.documentElement.style.setProperty('--font-body',fontMap[settings.typography?.body]||fontMap.system);
    document.body.style.fontFamily='var(--font-body)';
    document.title=`Fotos · ${settings.couple?.displayName||settings.event?.title||'Evento'}`;
    document.getElementById('albumEventName').textContent=settings.couple?.displayName||settings.event?.title||'Nuestro evento';
    document.getElementById('albumDate').textContent=settings.event?.dateLabel||'';
    document.getElementById('albumWelcome').textContent=`Comparte con ${settings.couple?.displayName||'los anfitriones'} los momentos que capturaste.`;
    if(settings.media?.heroImage)document.getElementById('albumHero').style.backgroundImage=`linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.58)),url('${settings.media.heroImage}')`;
    const max=Math.max(0,Math.min(2000,Number(settings.photoPolicy?.messageMaxLength||500)));
    document.getElementById('photoMessage').maxLength=max;
  }catch{}
}

function renderSelection(){
  previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];
  const files=[...photoInput.files];
  if(!files.length){preview.innerHTML='';return;}
  previewUrls=files.filter(file=>file.type.startsWith('image/')).slice(0,8).map(URL.createObjectURL);
  preview.innerHTML=`<div class="selection-summary"><strong>${files.length} fotografía(s) seleccionada(s)</strong><small>${files.length>8?'Mostrando las primeras 8':''}</small></div>${previewUrls.map((url,index)=>`<img src="${url}" alt="Vista previa ${index+1}">`).join('')}`;
}
photoInput.addEventListener('change',renderSelection);

function show(message,isError=false){
  status.textContent=message;
  status.classList.toggle("error",isError);
}

form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(submit.disabled)return;
  const files=[...document.getElementById("photos").files];
  if(!files.length)return show("Selecciona al menos una fotografía.",true);
  if(files.length>20)return show("Puedes enviar hasta 20 fotografías por lote.",true);
  const accepted=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
  if(files.some(file=>!accepted.has(file.type)))return show("Una de las selecciones no tiene un formato de fotografía admitido.",true);
  const data=new FormData();
  data.append("uploadedBy",document.getElementById("uploadedBy").value);
  data.append("message",document.getElementById("photoMessage").value);
  data.append("tableName",tableName);
  data.append("eventSlug",eventSlug);
  data.append("uploadKey",crypto.randomUUID());
  if(invitationToken)data.append("invitationToken",invitationToken);
  files.forEach(file=>data.append("photos",file));
  submit.disabled=true;
  progress.hidden=false;
  progress.removeAttribute("value");
  show("Subiendo fotografías… No cierres esta ventana.");
  try{
    const response=await fetch("/api/photos",{method:"POST",body:data});
    const type=response.headers.get("content-type")||"";
    const result=type.includes("application/json")?await response.json():{error:"El servidor devolvió una respuesta inesperada."};
    if(!response.ok)throw new Error(result.error||"No se pudieron subir las fotografías.");
    show(`${result.uploaded} fotografía(s) recibida(s). ¡Gracias!`);
    form.reset();
    renderSelection();
    document.getElementById('uploadMorePhotos').classList.remove('hidden');
  }catch(error){
    show(error.message||"La conexión se interrumpió. Intenta nuevamente.",true);
  }finally{
    submit.disabled=false;
    progress.hidden=true;
    progress.value=0;
  }
});
document.getElementById('uploadMorePhotos').addEventListener('click',()=>{document.getElementById('uploadMorePhotos').classList.add('hidden');photoInput.click();});
loadAlbumTheme();
