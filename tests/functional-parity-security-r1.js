"use strict";
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {once}=require('node:events');

const root=path.join(__dirname,'..');
const ExcelJS=require('exceljs');
const storage=fs.mkdtempSync(path.join(os.tmpdir(),'eventstudio-functional-parity-'));
const port=5700+(process.pid%100);
const base=`http://127.0.0.1:${port}`;
let server;
const results={};
function mark(name,status,extra={}){results[name]={status,...extra};}
async function req(url,{token,eventId,json,body,method='GET',binary=false}={}){
  const headers={}; if(token)headers.Authorization=`Bearer ${token}`; if(eventId)headers['x-event-id']=String(eventId);
  if(json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(json);}
  const response=await fetch(base+url,{method,headers,body});
  let data;
  if(binary)data=Buffer.from(await response.arrayBuffer());
  else {const t=response.headers.get('content-type')||''; data=t.includes('application/json')?await response.json():await response.text();}
  return {response,data};
}
async function ok(name,url,opts={},expect=200){const r=await req(url,opts); if(r.response.status!==expect)throw new Error(`${name}: ${r.response.status} ${typeof r.data==='string'?r.data:JSON.stringify(r.data)}`); mark(name,r.response.status); return r;}
async function waitServer(){for(let i=0;i<80;i++){try{const r=await req('/api/health');if(r.response.ok)return;}catch{} await new Promise(r=>setTimeout(r,125));}throw new Error('server start timeout');}

async function main(){
  const env={...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),SITE_URL:base,STORAGE_ROOT:storage,PAYMENT_PROVIDER:'disabled',ALLOW_PUBLIC_REGISTRATION:'true'};
  execFileSync(process.execPath,[path.join(root,'src/seed.js')],{cwd:root,env,stdio:'ignore'});
  server=spawn(process.execPath,[path.join(root,'src/server.js')],{cwd:root,env,stdio:'ignore'}); await waitServer();
  const owner=(await ok('login_owner','/api/auth/login',{method:'POST',json:{email:'owner@eventstudio.local',password:'Cambiar123!'}})).data;
  const token=owner.token;
  const events=(await ok('events_list','/api/admin/events',{token})).data;
  const event=events.find(e=>e.slug==='boda-demostracion')||events[0]; if(!event)throw new Error('no event');
  const eid=event.id;

  // Ensure publication for public photo flow.
  await ok('event_publish',`/api/admin/events/${eid}/publication`,{method:'PATCH',token,eventId:eid,json:{published:true}});

  await ok('dashboard','/api/admin/dashboard',{token,eventId:eid});
  const types=await ok('event_types','/api/admin/event-types',{token,eventId:eid}); mark('event_types',200,{count:types.data.length});
  const tables=await ok('tables','/api/admin/tables',{token,eventId:eid}); mark('tables',200,{count:tables.data.length});
  const platformEvents=await ok('platform_events','/api/admin/platform-events',{token}); mark('platform_events',200,{count:platformEvents.data.length});
  await ok('commercial_controls','/api/admin/commercial-controls',{token});
  await ok('commercial_settings_update','/api/admin/platform-settings/commercial',{method:'PUT',token,json:{publicationMode:'manual_owner',proofWatermarkEnabled:false,attributionEnabled:true,attributionLabel:'Creado con EventStudio',attributionUrl:'',attributionOnInvitation:true,attributionOnPrint:false,attributionOnQr:false}});

  await ok('analytics_track','/api/analytics/track',{method:'POST',json:{eventName:'template_previewed',sessionKey:'parity-session-001',eventSlug:event.slug,source:'qa',metadata:{themeId:'romantic-wine'}}},202);
  const funnel=await ok('analytics_funnel','/api/admin/analytics/funnel?days=30',{token}); mark('analytics_funnel',200,{hasCounts:Array.isArray(funnel.data.counts)});

  const publicShow=await ok('showcase_public','/api/public/showcase'); mark('showcase_public',200,{count:publicShow.data.length});
  const adminShow=await ok('showcase_admin','/api/admin/showcase',{token}); mark('showcase_admin',200,{count:adminShow.data.length});
  if(adminShow.data.length){await ok('showcase_patch',`/api/admin/showcase/${adminShow.data[0].id}`,{method:'PATCH',token,json:{status:'published',sortOrder:0}});}
  else mark('showcase_patch',204,{skipped:true});

  const catCode=`qa-${process.pid}`;
  await ok('category_create','/api/admin/commerce/categories',{method:'POST',token,json:{name:'QA Parity',code:catCode,description:'Temporal',icon:'Q',sortOrder:999}},201);
  const catalog=(await ok('commerce_catalog','/api/admin/commerce/catalog',{token})).data;
  const category=catalog.categories.find(c=>c.code===catCode); if(!category)throw new Error('category not found');
  await ok('category_update',`/api/admin/commerce/categories/${category.id}`,{method:'PUT',token,json:{name:'QA Parity Updated',description:'Temporal 2',icon:'Q',sortOrder:998,active:true}});

  const google=await req('/api/auth/google',{method:'POST',json:{}}); if(![501,503].includes(google.response.status))throw new Error('google status '+google.response.status); mark('google_oauth_unconfigured',google.response.status);

  const domainName=`qa-${process.pid}.example.test`;
  const domainPost=await ok('domain_create','/api/admin/domains',{method:'POST',token,eventId:eid,json:{hostname:domainName}});
  const domains=await ok('domains_list','/api/admin/domains',{token,eventId:eid});
  const dom=domains.data.aliases.find(d=>d.hostname===domainName); if(!dom)throw new Error('domain missing');
  await ok('domain_delete',`/api/admin/domains/${dom.id}`,{method:'DELETE',token,eventId:eid});

  let guests=(await ok('guests_list','/api/admin/guests',{token,eventId:eid})).data;
  let guest=guests.find(g=>!g.is_test);
  if(!guest){await ok('guest_create','/api/admin/guests',{method:'POST',token,eventId:eid,json:{code:'QA-PARITY',family_name:'Familia QA',phone:'5512345678',max_adults:2,max_children:0,table_name:''}});guests=(await ok('guests_list2','/api/admin/guests',{token,eventId:eid})).data;guest=guests.find(g=>g.code==='QA-PARITY');}
  await ok('guest_mark_sent','/api/admin/guests/mark-sent',{method:'POST',token,eventId:eid,json:{ids:[guest.id]}});
  await ok('whatsapp_status','/api/admin/whatsapp/status',{token});

  await ok('publication_status','/api/publication/status',{token,eventId:eid});
  await ok('audit_list','/api/admin/audit',{token});
  await ok('storage_orphans','/api/admin/storage/orphans',{token});

  // Legitimate XLSX through the same multipart gate hardened by security-r1.
  const wb=new ExcelJS.Workbook(); const sh=wb.addWorksheet('Invitados'); sh.addRow(['FAMILIA','ADULTOS','NIÑOS','TELEFONO','MESA']); sh.addRow(['Familia Import QA',2,0,'5511223344','Mesa QA']);
  const xlsx=Buffer.from(await wb.xlsx.writeBuffer()); const importForm=new FormData(); importForm.append('file',new Blob([xlsx],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'invitados.xlsx');
  const imported=await ok('xlsx_import','/api/admin/import',{method:'POST',token,eventId:eid,body:importForm}); mark('xlsx_import',200,{inserted:Number(imported.data.inserted||0),errors:(imported.data.errors||[]).length});

  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
  async function upload(endpoint,field,name,mime,bytes){const f=new FormData();f.append(field,new Blob([bytes],{type:mime}),name);return ok(endpoint,endpoint,{method:'POST',token,eventId:eid,body:f});}
  const hero=await upload('/api/admin/media/hero','file','hero.png','image/png',png); mark('media_hero',200,{url:hero.data.url?.startsWith('/uploads/site-media/')});
  const musicBytes=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(128,0)]); const music=await upload('/api/admin/media/music','file','music.mp3','audio/mpeg',musicBytes); mark('media_music',200,{url:music.data.url?.startsWith('/uploads/site-media/')});
  const gallery=await upload('/api/admin/media/gallery','files','gallery.png','image/png',png); const galleryUrl=gallery.data.gallery.at(-1); mark('media_gallery',200,{count:gallery.data.gallery.length});
  const dress=await upload('/api/admin/media/dress','files','dress.png','image/png',png); const dressUrl=dress.data.referenceImages.at(-1); mark('media_dress',200,{count:dress.data.referenceImages.length});
  await ok('media_gallery_delete','/api/admin/media/item',{method:'DELETE',token,eventId:eid,json:{type:'gallery',url:galleryUrl}});
  await ok('media_dress_delete','/api/admin/media/item',{method:'DELETE',token,eventId:eid,json:{type:'dress',url:dressUrl}});
  await ok('media_music_delete','/api/admin/media/music',{method:'DELETE',token,eventId:eid,json:{source:'upload'}});

  // Public guest photo upload uses the other Multer instance.
  const photoForm=new FormData(); photoForm.append('eventSlug',event.slug); photoForm.append('invitationToken',guest.token); photoForm.append('uploadKey',`qa_upload_${process.pid}`); photoForm.append('message','QA parity'); photoForm.append('photos',new Blob([png],{type:'image/png'}),'guest.png');
  const photo=await ok('guest_photo_upload','/api/photos',{method:'POST',body:photoForm}); mark('guest_photo_upload',200,{uploaded:Number(photo.data.uploaded||0)});
  const photoZip=await req('/api/admin/photos-export.zip?status=all',{token,eventId:eid,binary:true}); if(photoZip.response.status!==200||!String(photoZip.response.headers.get('content-type')||'').includes('application/zip')||photoZip.data.length<20)throw new Error(`photos_export_zip: ${photoZip.response.status} ${photoZip.response.headers.get('content-type')}`); mark('photos_export_zip',200,{bytes:true});

  // Backup create/download/inspect, then exercise restore multipart route safely with missing confirmation.
  const backup=await ok('backup_create','/api/admin/backups',{method:'POST',token,json:{reason:'qa-parity'}},201);
  const bid=backup.data.backup.id;
  const download=await req(`/api/admin/backups/${bid}/download`,{token,binary:true}); if(download.response.status!==200||download.data.length<100)throw new Error('backup download failed'); mark('backup_download',200,{bytes:true});
  const inspectForm=new FormData(); inspectForm.append('backup',new Blob([download.data],{type:'application/zip'}),'backup.zip'); await ok('backup_inspect','/api/admin/backups/inspect',{method:'POST',token,body:inspectForm});
  const restoreForm=new FormData(); restoreForm.append('confirmation','NO'); restoreForm.append('backup',new Blob([download.data],{type:'application/zip'}),'backup.zip'); const rr=await req('/api/admin/backups/restore',{method:'POST',token,body:restoreForm}); if(rr.response.status!==409)throw new Error('restore confirmation expected 409 got '+rr.response.status); mark('backup_restore_guard',409);

  // Final health confirms all legitimate uploads/exports left the process healthy.
  await ok('health_final','/api/health');
  console.log(`✓ Paridad funcional extendida: ${Object.keys(results).length} controles, multimedia/importación/backups/Store/analítica/exportación ZIP verificados`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(server&&!server.killed){server.kill('SIGTERM');await once(server,'exit').catch(()=>{});}fs.rmSync(storage,{recursive:true,force:true});});
