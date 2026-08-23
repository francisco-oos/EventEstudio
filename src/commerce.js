"use strict";

const db=require("./db");
const themes=require("../config/themes.json");
const {catalog:featureCatalog}=require("./features");

const PLAN_RANK={trial:0,express:1,starter:2,basic:3,premium:4,studio:5};
const ORIGIN_LABELS={
  plan:"Incluido en el plan",
  purchase:"Comprado",
  courtesy:"Cortesía",
  promotion:"Promoción",
  legacy:"Migrado de RC9"
};

function json(value,fallback=[]){
  try{
    const parsed=JSON.parse(value);
    return Array.isArray(parsed)?parsed:fallback;
  }catch{return fallback;}
}

function objectJson(value,fallback={}){
  try{
    const parsed=JSON.parse(value);
    return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:fallback;
  }catch{return fallback;}
}

function storeCategories(){
  return db.prepare(`
    SELECT id,code,name,description,icon,sort_order
    FROM store_categories WHERE active=1 ORDER BY sort_order,name,id
  `).all();
}

function categoriesForProduct(productId){
  return db.prepare(`
    SELECT c.id,c.code,c.name,c.icon,l.sort_order
    FROM product_category_links l
    JOIN store_categories c ON c.id=l.category_id
    WHERE l.product_id=? AND c.active=1
    ORDER BY l.sort_order,c.sort_order,c.name
  `).all(productId);
}


function profileIdsForProduct(productId){
  return db.prepare(`SELECT profile_id FROM product_profile_links WHERE product_id=? ORDER BY sort_order,profile_id`).all(productId).map(row=>Number(row.profile_id));
}

function productVisibleForProfile(product,profile){
  if(!product||!profile||String(profile.catalog_mode||"all")!=="curated")return true;
  return profileIdsForProduct(product.id).includes(Number(profile.profile_id||profile.id));
}

function productRow(row){
  if(!row)return null;
  return {
    ...row,
    public:Boolean(row.public),
    active:Boolean(row.active),
    grants:json(row.grants_json),
    dependencies:json(row.dependencies_json),
    eventTypes:json(row.event_types_json,["*"]),
    previewManifest:objectJson(row.preview_manifest_json,{}),
    price_cents:Number(row.price_cents||0),
    storage_mb:Number(row.storage_mb||0),
    categories:row.id?categoriesForProduct(row.id):[],
    profileIds:row.id?profileIdsForProduct(row.id):[]
  };
}

function allProducts(){
  return db.prepare(`
    SELECT * FROM product_catalog WHERE active=1
    ORDER BY sort_order,name,id
  `).all().map(productRow);
}

function productsByCodes(codes){
  const unique=[...new Set((codes||[]).filter(Boolean))];
  if(!unique.length)return [];
  const placeholders=unique.map(()=>"?").join(",");
  return db.prepare(`SELECT * FROM product_catalog WHERE active=1 AND code IN (${placeholders})`).all(...unique).map(productRow);
}

function expandProducts(products){
  const byCode=new Map(allProducts().map(product=>[product.code,product]));
  const expanded=new Map();
  const visit=product=>{
    if(!product||expanded.has(product.code))return;
    expanded.set(product.code,product);
    product.dependencies.forEach(code=>visit(byCode.get(code)));
  };
  products.forEach(visit);
  return [...expanded.values()];
}

function planProducts(planCode){
  return db.prepare(`
    SELECT pc.*
    FROM plan_products pp
    JOIN plans p ON p.id=pp.plan_id
    JOIN product_catalog pc ON pc.id=pp.product_id
    WHERE p.code=? AND p.active=1 AND pc.active=1
    ORDER BY pc.sort_order,pc.name
  `).all(planCode).map(productRow);
}

function activeGrantRows(eventId){
  return db.prepare(`
    SELECT eg.*,pc.code,pc.kind,pc.name,pc.description,pc.price_cents,pc.currency,
           pc.commercial_status,pc.public,pc.grants_json,pc.dependencies_json,
           pc.event_types_json,pc.storage_mb product_storage_mb,pc.sort_order,pc.active
    FROM event_grants eg
    JOIN product_catalog pc ON pc.id=eg.product_id
    WHERE eg.event_id=? AND eg.status='active'
      AND datetime(eg.starts_at)<=CURRENT_TIMESTAMP
      AND (eg.ends_at IS NULL OR datetime(eg.ends_at)>CURRENT_TIMESTAMP)
      AND (eg.usage_limit IS NULL OR eg.usage_used<eg.usage_limit)
      AND pc.active=1
    ORDER BY eg.created_at,eg.id
  `).all(eventId).map(row=>({
    ...productRow({...row,storage_mb:row.product_storage_mb}),
    grant_id:row.id,
    source:row.source,
    source_reference:row.source_reference,
    starts_at:row.starts_at,
    ends_at:row.ends_at,
    usage_limit:row.usage_limit,
    usage_used:row.usage_used,
    grant_storage_mb:Number(row.storage_mb||0),
    note:row.note
  }));
}

function activePromotionProducts(event,planCode){
  return db.prepare(`
    SELECT pc.*,pr.id promotion_id,pr.name promotion_name,pr.starts_at,pr.ends_at
    FROM promotions pr
    JOIN promotion_products pp ON pp.promotion_id=pr.id
    JOIN product_catalog pc ON pc.id=pp.product_id
    WHERE pr.status='active'
      AND (pr.starts_at IS NULL OR datetime(pr.starts_at)<=CURRENT_TIMESTAMP)
      AND (pr.ends_at IS NULL OR datetime(pr.ends_at)>CURRENT_TIMESTAMP)
      AND (pr.audience_plan_code IS NULL OR pr.audience_plan_code='' OR pr.audience_plan_code=?)
      AND (pr.event_type IS NULL OR pr.event_type='' OR pr.event_type=?)
      AND pc.active=1
    ORDER BY pr.id,pc.sort_order
  `).all(planCode||"",event.event_type||"custom").map(row=>({
    ...productRow(row),
    promotion_id:row.promotion_id,
    promotion_name:row.promotion_name,
    starts_at:row.starts_at,
    ends_at:row.ends_at
  }));
}

function accessForEvent(event,entitlement){
  const owner=event.owner_user_id?db.prepare("SELECT role FROM users WHERE id=?").get(event.owner_user_id):null;
  const platformOwned=!owner||["owner","developer"].includes(owner.role);
  const subscriptionUsable=entitlement&&["active","trial"].includes(entitlement.status)
    &&(!entitlement.ends_at||new Date(entitlement.ends_at).getTime()>Date.now());
  const planCode=platformOwned?"studio":(entitlement?.plan_code||"none");
  const plan=platformOwned||subscriptionUsable?expandProducts(planProducts(planCode)):[];
  const grants=activeGrantRows(event.id);
  const grantProducts=expandProducts(grants);
  const promotions=activePromotionProducts(event,planCode);
  const promotionProducts=expandProducts(promotions);
  const keys=new Set();
  [...plan,...grantProducts,...promotionProducts].forEach(product=>{
    keys.add(product.code);
    product.grants.forEach(key=>keys.add(key));
  });
  const planCodes=new Set(plan.map(product=>product.code));
  const origins=[];
  plan.forEach(product=>origins.push({
    origin:"plan",originLabel:ORIGIN_LABELS.plan,productId:product.id,
    code:product.code,name:product.name,endsAt:entitlement?.ends_at||null
  }));
  grants.forEach(product=>origins.push({
    origin:product.source,originLabel:ORIGIN_LABELS[product.source]||product.source,
    productId:product.id,grantId:product.grant_id,code:product.code,name:product.name,
    endsAt:product.ends_at||null,usageLimit:product.usage_limit,
    usageUsed:product.usage_used,note:product.note||""
  }));
  promotions.forEach(product=>origins.push({
    origin:"promotion",originLabel:ORIGIN_LABELS.promotion,
    productId:product.id,promotionId:product.promotion_id,
    code:product.code,name:product.name,endsAt:product.ends_at||null,
    note:product.promotion_name
  }));
  const extraStorageMb=plan.reduce((sum,item)=>sum+Number(item.storage_mb||0),0)
    +grants.reduce((sum,item)=>sum+Number(item.grant_storage_mb||item.storage_mb||0),0)
    +promotions.reduce((sum,item)=>sum+Number(item.storage_mb||0),0);
  return {planCode,keys,planCodes,origins,extraStorageMb,plan,grants,promotions};
}

function globalFeatureStates(){
  const rows=db.prepare(`
    SELECT code,commercial_status FROM product_catalog
    WHERE kind='feature' AND active=1
  `).all();
  return Object.fromEntries(rows.map(row=>[row.code.replace(/^feature:/,""),row.commercial_status]));
}

function featureContext(event,entitlement){
  const access=accessForEvent(event,entitlement);
  const planGrantKeys=new Set(access.plan.flatMap(product=>product.grants));
  const includedFeatures=featureCatalog.filter(item=>planGrantKeys.has(item.key)).map(item=>item.key);
  const grantedFeatures=featureCatalog.filter(item=>access.keys.has(item.key)).map(item=>item.key);
  return {
    planCode:access.planCode,
    includedFeatures,
    grantedFeatures,
    globalStates:globalFeatureStates(),
    access
  };
}

function themeAllowed(theme,event,entitlement){
  if(!theme)return false;
  const access=accessForEvent(event,entitlement);
  if(access.keys.has(`theme:${theme.id}`))return true;
  const required=PLAN_RANK[theme.minPlan||"starter"]||2;
  return Object.entries(PLAN_RANK).some(([tier,rank])=>
    rank>=required&&access.keys.has(`themes:tier:${tier}`)
  );
}

function productOwnedForEvent(product,event,entitlement,access=accessForEvent(event,entitlement)){
  if(!product||product.kind==="storage")return false;
  if(access.keys.has(product.code))return true;
  if(product.kind==="template"&&String(product.code||"").startsWith("theme:")){
    const themeId=String(product.code).slice("theme:".length);
    const theme=themes.find(item=>item.id===themeId);
    if(theme&&themeAllowed(theme,event,entitlement))return true;
  }
  return product.grants.length>0&&product.grants.every(key=>access.keys.has(key));
}

function productOriginForEvent(product,event,entitlement,access=accessForEvent(event,entitlement)){
  if(!product||!event)return null;
  const grant=db.prepare(`
    SELECT source FROM event_grants
    WHERE event_id=? AND product_id=? AND status='active'
      AND (ends_at IS NULL OR datetime(ends_at)>CURRENT_TIMESTAMP)
    ORDER BY CASE source WHEN 'purchase' THEN 0 WHEN 'courtesy' THEN 1 WHEN 'promotion' THEN 2 ELSE 3 END,id DESC
    LIMIT 1
  `).get(event.id,product.id);
  if(grant?.source)return grant.source;
  const direct=access.origins.find(origin=>origin.code===product.code)?.origin;
  return direct||(productOwnedForEvent(product,event,entitlement,access)?"plan":null);
}

function relevantProducts(event,entitlement,{includeOwned=true,profile=null}={}){
  const access=accessForEvent(event,entitlement);
  return allProducts().filter(product=>
    product.public&&product.commercial_status==="available"
    &&product.readiness_status==="approved"
    &&product.kind!=="feature"
    &&(product.eventTypes.includes("*")||product.eventTypes.includes(event.event_type||"custom"))
    &&(productVisibleForProfile(product,profile)||productOwnedForEvent(product,event,entitlement,access))
    &&(includeOwned||!productOwnedForEvent(product,event,entitlement,access))
  ).map(product=>({
    ...product,
    owned:productOwnedForEvent(product,event,entitlement,access),
    origin:productOriginForEvent(product,event,entitlement,access)
  }));
}

function consumeLimitedGrant(eventId,featureKey){
  const directPlan=db.prepare(`
    SELECT 1
    FROM events e
    JOIN users u ON u.id=e.owner_user_id
    JOIN subscriptions s ON s.user_id=u.id AND s.status IN ('active','trial')
    JOIN plan_products pp ON pp.plan_id=s.plan_id
    JOIN product_catalog pc ON pc.id=pp.product_id
    WHERE e.id=?
      AND (s.ends_at IS NULL OR datetime(s.ends_at)>CURRENT_TIMESTAMP)
      AND EXISTS(SELECT 1 FROM json_each(pc.grants_json) WHERE value=?)
    LIMIT 1
  `).get(eventId,featureKey);
  if(directPlan)return {consumed:false,source:"plan"};
  const row=db.prepare(`
    SELECT eg.id
    FROM event_grants eg
    JOIN product_catalog pc ON pc.id=eg.product_id
    WHERE eg.event_id=? AND eg.status='active'
      AND eg.usage_limit IS NOT NULL AND eg.usage_used<eg.usage_limit
      AND (eg.ends_at IS NULL OR datetime(eg.ends_at)>CURRENT_TIMESTAMP)
      AND EXISTS(SELECT 1 FROM json_each(pc.grants_json) WHERE value=?)
    ORDER BY eg.ends_at IS NULL,eg.ends_at,eg.id
    LIMIT 1
  `).get(eventId,featureKey);
  if(!row)return {consumed:false,source:"unlimited-or-none"};
  db.prepare("UPDATE event_grants SET usage_used=usage_used+1 WHERE id=?").run(row.id);
  return {consumed:true,grantId:row.id};
}

module.exports={
  PLAN_RANK,ORIGIN_LABELS,allProducts,productRow,planProducts,accessForEvent,
  featureContext,themeAllowed,productOwnedForEvent,productOriginForEvent,relevantProducts,consumeLimitedGrant,storeCategories,categoriesForProduct,profileIdsForProduct,productVisibleForProfile
};
