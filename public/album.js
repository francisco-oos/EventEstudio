const query=new URLSearchParams(location.search);
const tableName=query.get("mesa")||"";
const tableSig=query.get("mesaSig")||"";
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


function makeClientUploadKey(){
  /* randomUUID sólo está garantizado en contextos seguros (HTTPS/localhost).
     Para pruebas desde un teléfono por http://192.168.x.x usamos getRandomValues
     si está disponible y un fallback no criptográfico sólo como idempotency key;
     la autorización real sigue siendo responsabilidad del servidor. */
  try{
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    if(globalThis.crypto?.getRandomValues){
      const bytes=new Uint8Array(18);globalThis.crypto.getRandomValues(bytes);
      return `up_${[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('')}`;
    }
  }catch{}
  return `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,14)}`;
}


function albumTitleCase(value,locale='es-MX'){
  const minorWords=new Set(['y','e','de','del','la','las','los','familia']);let index=0;
  return String(value||'').trim().toLocaleLowerCase(locale).split(/([\s-]+)/).map(part=>{
    if(!part||/^[\s-]+$/.test(part))return part;const current=index++;
    if(current>0&&minorWords.has(part))return part;
    return part.replace(/^\p{L}/u,letter=>letter.toLocaleUpperCase(locale));
  }).join('');
}
function albumPresentedName(value,settings){
  const mode=settings?.typography?.nameCase||'title';const locale='es-MX';
  if(mode==='uppercase')return String(value||'').toLocaleUpperCase(locale);
  if(mode==='title'||mode==='small-caps')return albumTitleCase(value,locale);
  return String(value||'');
}

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
    const eventName=albumPresentedName(settings.couple?.displayName||settings.event?.title||'Evento',settings);
    document.title=`Fotos · ${eventName}`;
    document.getElementById('albumEventName').textContent=eventName||'Nuestro evento';
    document.getElementById('albumDate').textContent=settings.event?.dateLabel||'';
    document.getElementById('albumWelcome').textContent=`Comparte con ${eventName||'los anfitriones'} los momentos que capturaste.`;
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

async function optimizePhotoForUpload(file){
  const supported=new Set(['image/jpeg','image/png','image/webp']);
  if(!file||!supported.has(file.type)||file.size<2.5*1024*1024)return file;
  let bitmap=null,url='';
  try{
    if('createImageBitmap' in window)bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
    else{
      url=URL.createObjectURL(file);
      const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});
      bitmap=image;
    }
    const width=Number(bitmap.width||bitmap.naturalWidth||0),height=Number(bitmap.height||bitmap.naturalHeight||0);
    if(!width||!height)return file;
    const maxSide=2560,scale=Math.min(1,maxSide/Math.max(width,height));
    if(scale===1&&file.size<4*1024*1024)return file;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return file;
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));
    if(!blob||blob.size>=file.size*.94)return file;
    const base=String(file.name||'foto').replace(/\.[^.]+$/,'');
    return new File([blob],`${base}.webp`,{type:'image/webp',lastModified:file.lastModified||Date.now()});
  }catch{return file;}
  finally{try{bitmap?.close?.();}catch{}if(url)URL.revokeObjectURL(url);}
}
async function preparePhotosForUpload(files){
  const output=[];
  for(let index=0;index<files.length;index++){
    show(`Preparando fotografías… ${index+1} de ${files.length}`);
    output.push(await optimizePhotoForUpload(files[index]));
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return output;
}

form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(submit.disabled)return;
  const files=[...document.getElementById("photos").files];
  if(!files.length)return show("Selecciona al menos una fotografía.",true);
  if(files.length>20)return show("Puedes enviar hasta 20 fotografías por lote.",true);
  const accepted=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
  if(files.some(file=>!accepted.has(file.type)))return show("Una de las selecciones no tiene un formato de fotografía admitido.",true);
  submit.disabled=true;
  progress.hidden=false;
  progress.removeAttribute("value");
  try{
    const preparedFiles=await preparePhotosForUpload(files);
    const data=new FormData();
    data.append("uploadedBy",document.getElementById("uploadedBy").value);
    data.append("message",document.getElementById("photoMessage").value);
    data.append("tableName",tableName);
    if(tableSig)data.append("tableSig",tableSig);
    data.append("eventSlug",eventSlug);
    data.append("uploadKey",makeClientUploadKey());
    if(invitationToken)data.append("invitationToken",invitationToken);
    preparedFiles.forEach(file=>data.append("photos",file));
    const originalBytes=files.reduce((sum,file)=>sum+file.size,0),preparedBytes=preparedFiles.reduce((sum,file)=>sum+file.size,0);
    const saved=originalBytes>preparedBytes?Math.round((1-preparedBytes/originalBytes)*100):0;
    show(saved?`Fotografías optimizadas (${saved}% menos datos). Subiendo…`:'Subiendo fotografías… No cierres esta ventana.');
    const upload=()=>new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();let settled=false,stallTimer=0;
      const clearStall=()=>{if(stallTimer){clearTimeout(stallTimer);stallTimer=0;}};
      const armStall=()=>{
        clearStall();
        stallTimer=setTimeout(()=>{
          if(settled)return;settled=true;
          try{xhr.abort();}catch{}
          reject(Object.assign(new Error('La transferencia dejó de avanzar. EventStudio volverá a intentar el mismo lote.'),{network:true,stalled:true}));
        },45000);
      };
      xhr.open('POST','/api/photos',true);xhr.responseType='json';
      xhr.upload.onloadstart=armStall;
      xhr.upload.onprogress=event=>{armStall();if(event.lengthComputable){progress.max=100;progress.value=Math.round(event.loaded/event.total*100);show(`Subiendo fotografías… ${progress.value}%`);}};
      xhr.onload=()=>{if(settled)return;settled=true;clearStall();resolve({ok:xhr.status>=200&&xhr.status<300,status:xhr.status,result:xhr.response||{}});};
      xhr.onerror=()=>{if(settled)return;settled=true;clearStall();reject(Object.assign(new Error('La conexión se interrumpió. EventStudio volverá a intentar el mismo lote.'),{network:true}));};
      xhr.onabort=()=>{if(settled)return;settled=true;clearStall();reject(Object.assign(new Error('La transferencia fue cancelada.'),{aborted:true}));};
      xhr.send(data);
    });
    let response=null,lastError=null;
    for(let attempt=1;attempt<=3;attempt++){
      if(navigator.onLine===false){show('Sin conexión. Esperando a que vuelva la red…');await new Promise(resolve=>window.addEventListener('online',resolve,{once:true}));}
      try{response=await upload();if(response.ok||![408,425,429,499,500,502,503,504].includes(response.status))break;}catch(error){lastError=error;}
      if(attempt<3){show(`La conexión falló. Reintentando (${attempt}/2)…`);await new Promise(resolve=>setTimeout(resolve,900*attempt));}
    }
    if(!response?.ok)throw new Error(response?.result?.error||lastError?.message||'No se pudieron subir las fotografías.');
    const result=response.result||{};
    show(`${result.uploaded} fotografía(s) recibida(s)${result.tableName?` desde ${result.tableName}`:""}. ¡Gracias!`);
    form.reset();renderSelection();document.getElementById('uploadMorePhotos').classList.remove('hidden');
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
