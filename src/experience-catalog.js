const catalog=require('../config/experiences.json');

function unique(items,name){
  const ids=new Set();
  for(const item of items){
    if(!item||typeof item.id!=='string'||!item.id)throw new Error(`Experiencia inválida en ${name}.`);
    if(ids.has(item.id))throw new Error(`Experiencia duplicada: ${item.id}.`);
    ids.add(item.id);
  }
  return ids;
}

const openingIds=unique(catalog.openings,'openings');
const galleryIds=unique(catalog.galleries,'galleries');
const motionLevelIds=unique(catalog.motionLevels,'motionLevels');

function grantMap(items){
  return Object.freeze(Object.fromEntries(items.filter(item=>item.commercial&&item.grant).map(item=>[item.id,item.grant])));
}
function productMap(items){
  return Object.freeze(Object.fromEntries(items.filter(item=>item.productCode).map(item=>[item.id,item.productCode])));
}

module.exports=Object.freeze({
  catalog,
  openingIds,
  galleryIds,
  motionLevelIds,
  openingGrantMap:grantMap(catalog.openings),
  galleryGrantMap:grantMap(catalog.galleries),
  openingProductMap:productMap(catalog.openings),
  galleryProductMap:productMap(catalog.galleries),
  publicCatalog:Object.freeze({
    openings:catalog.openings.filter(item=>!item.hidden).map(({id,label,commercial,colorControl,colorControls,editor,seal})=>({
      id,label,commercial:Boolean(commercial),colorControl:colorControl||null,
      colorControls:Array.isArray(colorControls)?Object.freeze([...colorControls]):(colorControl?Object.freeze([colorControl]):Object.freeze([])),
      editor:editor&&typeof editor==="object"?Object.freeze({...editor}):null,
      seal:seal&&typeof seal==="object"?Object.freeze({...seal}):null
    })),
    galleries:catalog.galleries.map(({id,label,commercial})=>({id,label,commercial:Boolean(commercial)})),
    motionLevels:catalog.motionLevels.map(({id,label})=>({id,label}))
  })
});
