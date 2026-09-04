(function(global){
  "use strict";

  /*
     Motor compartido de papelería EventStudio.
     La misma salida vectorial se utiliza en la invitación pública y en el estudio
     avanzado para evitar divergencias entre la miniatura editada y el resultado
     persistido. Los colores y límites llegan de los catálogos públicos.
  */
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
  const escapeXml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]));
  const clamp=(value,min,max,fallback)=>{const numeric=Number(value);return Number.isFinite(numeric)?Math.min(max,Math.max(min,numeric)):fallback;};
  const collection=(catalog,key)=>Array.isArray(catalog?.[key])?catalog[key]:[];
  const selected=(catalog,key,id)=>collection(catalog,key).find(item=>item.id===id)||null;
  const validId=(catalog,key,id,fallback)=>selected(catalog,key,id)?.id||fallback;
  const safeHex=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value).toLowerCase():String(fallback||"").toLowerCase();
  const hexToRgb=hex=>{const n=parseInt(String(hex||"").replace(/^#/,""),16);return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};};
  const rgbToHex=(r,g,b)=>"#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
  const shiftColor=(hex,amount)=>{const {r,g,b}=hexToRgb(hex);return rgbToHex(r+amount,g+amount,b+amount);};
  const lightenColor=(hex,percent)=>shiftColor(hex,255*(Number(percent)||0)/100);
  const darkenColor=(hex,percent)=>shiftColor(hex,-255*(Number(percent)||0)/100);
  const hash=value=>{let h=2166136261;for(const ch of String(value||"")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};

  function legacyPreset(catalog,openingStyle){return collection(catalog,"legacyAliases").find(item=>item.openingId===openingStyle)?.presetId||null;}
  function preset(catalog,presetId){return selected(catalog,"presets",presetId);}

  function normalize(definition={},catalog={},context={}){
    const defaults=catalog.defaults||{};
    const legacyId=legacyPreset(catalog,context.openingStyle);
    const source=definition&&typeof definition==="object"?definition:{};
    const recipe=preset(catalog,legacyId)||preset(catalog,source.presetId)||preset(catalog,defaults.presetId)||{};
    const migrated=legacyId&&source.customized!==true?{...defaults,...recipe,enabled:source.enabled!==false,customized:false,syncDesignTokens:false,presetId:legacyId}:null;
    const next=migrated||(source.customized===true?{...defaults,...source}:{...defaults,...recipe,...source,presetId:legacyId||source.presetId||defaults.presetId});
    return {
      enabled:next.enabled!==false,
      customized:next.customized===true,
      syncDesignTokens:next.syncDesignTokens===true,
      presetId:validId(catalog,"presets",next.presetId,defaults.presetId),
      formatId:validId(catalog,"formats",next.formatId,defaults.formatId),
      materialId:validId(catalog,"materials",next.materialId,defaults.materialId),
      textureStrength:clamp(next.textureStrength,catalog.controls?.textureStrength?.min??0,catalog.controls?.textureStrength?.max??100,defaults.textureStrength||60),
      outerColor:safeHex(next.outerColor,defaults.outerColor),
      innerColor:safeHex(next.innerColor,defaults.innerColor),
      cardColor:safeHex(next.cardColor,defaults.cardColor),
      textColor:safeHex(next.textColor,defaults.textColor),
      ornamentColor:safeHex(next.ornamentColor,defaults.ornamentColor),
      sealColor:safeHex(next.sealColor,defaults.sealColor),
      linerId:validId(catalog,"liners",next.linerId,defaults.linerId),
      overlayId:validId(catalog,"overlays",next.overlayId,defaults.overlayId),
      stampId:validId(catalog,"stamps",next.stampId,defaults.stampId),
      frameId:validId(catalog,"frames",next.frameId,defaults.frameId),
      dividerId:validId(catalog,"dividers",next.dividerId,defaults.dividerId),
      fontMode:next.fontMode==="custom"?"custom":"event"
    };
  }

  function initials(displayName){
    const raw=String(displayName||"").trim();
    const groups=raw.split(/\s*(?:&|\+|\by\b|\be\b|\band\b)\s*/iu).filter(Boolean);
    const first=value=>String(value||"").match(/[\p{L}\p{N}]/u)?.[0]?.toLocaleUpperCase()||"";
    if(groups.length>=2)return `${first(groups[0])}${first(groups[1])}`;
    const words=raw.match(/[\p{L}\p{N}]+/gu)||[];
    return `${first(words[0])}${first(words[1])}`;
  }

  function buildTexturePattern(materialId,baseColor,accentColor,patternId){
    const base=baseColor,accent=accentColor,light=lightenColor(base,18),lighter=lightenColor(base,32),dark=darkenColor(base,18),darker=darkenColor(base,30),aLight=lightenColor(accent,18),aDark=darkenColor(accent,20);
    let width=64,height=64,content="";
    switch(materialId){
      case "floral-bloom":width=160;height=120;content=`<circle cx="28" cy="28" r="10" fill="${accent}" opacity=".42"/><circle cx="36" cy="22" r="7" fill="${lighter}" opacity=".35"/><ellipse cx="48" cy="42" rx="5" ry="11" transform="rotate(-42 48 42)" fill="${aDark}" opacity=".36"/><circle cx="132" cy="92" r="9" fill="${accent}" opacity=".34"/><ellipse cx="116" cy="82" rx="5" ry="12" transform="rotate(38 116 82)" fill="${aDark}" opacity=".34"/>`;break;
      case "cinematic-linen":width=24;height=24;content=`<path d="M-6 24 L24 -6 M4 30 L30 4" stroke="${lighter}" stroke-width="1" opacity=".18"/><path d="M0 6 H24 M0 18 H24" stroke="${darker}" stroke-width="1" opacity=".22"/>`;break;
      case "ivory-fiber":width=70;height=52;content=`<path d="M4 10 C18 7 25 15 39 11 M12 38 C25 33 42 42 62 36" stroke="${dark}" stroke-width=".7" opacity=".16" fill="none"/><path d="M8 22 C19 25 31 19 49 23" stroke="${lighter}" stroke-width="1" opacity=".24" fill="none"/><circle cx="58" cy="12" r="1.1" fill="${accent}" opacity=".18"/>`;break;
      case "newsprint":width=96;height=72;content=`<path d="M4 10 H92 M4 18 H42 M50 18 H92 M4 26 H42 M50 26 H92 M4 34 H42 M50 34 H92 M4 42 H92 M4 50 H42 M50 50 H92 M4 58 H92" stroke="${darker}" stroke-width="1" opacity=".23"/><path d="M46 12 V60" stroke="${dark}" stroke-width="1" opacity=".18"/>`;break;
      case "parchment":width=92;height=72;content=`<circle cx="14" cy="18" r="2" fill="${dark}" opacity=".16"/><circle cx="66" cy="52" r="3" fill="${darker}" opacity=".12"/><path d="M0 12 C20 20 32 2 54 10 S82 24 92 16 M0 58 C20 48 38 66 60 55 S80 42 92 50" stroke="${darker}" stroke-width=".9" opacity=".17" fill="none"/><path d="M8 34 H84" stroke="${lighter}" opacity=".16"/>`;break;
      case "olive-cosmos":width=100;height=90;content=`<circle cx="18" cy="16" r="1.4" fill="${aLight}"/><circle cx="72" cy="26" r="1" fill="${lighter}"/><circle cx="46" cy="68" r="1.3" fill="${aLight}"/><path d="M46 14 l2.2 6 6 2.2-6 2.2-2.2 6-2.2-6-6-2.2 6-2.2z" fill="${accent}" opacity=".42"/><path d="M16 70 Q38 46 70 58" fill="none" stroke="${accent}" opacity=".22"/>`;break;
      case "olive-nectar":width=150;height=110;content=`<ellipse cx="24" cy="22" rx="11" ry="5" transform="rotate(-35 24 22)" fill="${accent}" opacity=".32"/><ellipse cx="42" cy="34" rx="9" ry="4" transform="rotate(38 42 34)" fill="${aDark}" opacity=".3"/><ellipse cx="126" cy="88" rx="12" ry="5" transform="rotate(30 126 88)" fill="${accent}" opacity=".34"/><path d="M12 12 Q38 38 56 48 M138 98 Q116 74 98 64" stroke="${aDark}" stroke-width="1.1" opacity=".28" fill="none"/>`;break;
      case "blue-aurora":width=180;height=110;content=`<path d="M-20 28 C35 -2 86 64 200 18" fill="none" stroke="${lighter}" stroke-width="10" opacity=".24"/><path d="M-10 74 C54 38 102 108 195 62" fill="none" stroke="${accent}" stroke-width="4" opacity=".13"/><path d="M-10 52 C44 18 96 88 194 42" fill="none" stroke="${lighter}" stroke-width="2" opacity=".3"/>`;break;
      case "botanical-cosmos":width=130;height=110;content=`<path d="M14 96 Q52 52 96 20" fill="none" stroke="${accent}" stroke-width="1.2" opacity=".35"/><ellipse cx="40" cy="68" rx="12" ry="5" transform="rotate(-36 40 68)" fill="${aDark}" opacity=".36"/><ellipse cx="68" cy="42" rx="11" ry="5" transform="rotate(28 68 42)" fill="${accent}" opacity=".32"/><circle cx="112" cy="26" r="1.5" fill="${aLight}"/><circle cx="100" cy="84" r="1" fill="${lighter}"/>`;break;
      case "powder-blue":width=120;height=90;content=`<path d="M-20 80 L80 -20 M20 110 L140 -10" stroke="${lighter}" stroke-width="14" opacity=".16"/><circle cx="28" cy="28" r="2" fill="${lighter}" opacity=".38"/><circle cx="86" cy="62" r="1.5" fill="${accent}" opacity=".15"/>`;break;
      case "gala-velvet":width=72;height=72;content=`<rect width="12" height="72" fill="${lighter}" opacity=".13"/><rect x="12" width="12" height="72" fill="${darker}" opacity=".22"/><rect x="36" width="12" height="72" fill="${lighter}" opacity=".11"/><rect x="48" width="12" height="72" fill="${darker}" opacity=".24"/>`;break;
      case "constellation":width=120;height=100;content=`<circle cx="18" cy="18" r="1.5" fill="${lighter}"/><circle cx="72" cy="28" r="1.1" fill="${aLight}"/><circle cx="98" cy="74" r="1.7" fill="${lighter}"/><circle cx="38" cy="82" r="1" fill="${aLight}"/><path d="M18 18 L72 28 L98 74 L38 82 Z" fill="none" stroke="${accent}" stroke-width=".8" opacity=".28"/><path d="M58 48 l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="${accent}" opacity=".45"/>`;break;
      case "blush-paper":width=90;height=78;content=`<path d="M22 25 C22 16 35 16 35 25 C35 16 48 16 48 25 C48 35 35 42 35 42 C35 42 22 35 22 25 Z" fill="${accent}" opacity=".18"/><circle cx="70" cy="58" r="2" fill="${dark}" opacity=".2"/><circle cx="14" cy="62" r="1.4" fill="${lighter}" opacity=".32"/>`;break;
      case "reserve-stripe":width=30;height=30;content=`<path d="M-10 20 L20 -10 M0 30 L30 0 M10 40 L40 10" stroke="${darker}" stroke-width="5" opacity=".32"/><path d="M-8 16 L16 -8 M12 36 L36 12" stroke="${lighter}" stroke-width="1.4" opacity=".16"/>`;break;
      default:width=54;height=54;content=`<circle cx="8" cy="10" r=".9" fill="${lighter}" opacity=".3"/><circle cx="38" cy="34" r=".8" fill="${dark}" opacity=".2"/><path d="M4 44 C14 41 25 47 38 43" stroke="${dark}" stroke-width=".6" opacity=".14" fill="none"/>`;
    }
    return `<pattern id="${escapeXml(patternId)}" patternUnits="userSpaceOnUse" width="${width}" height="${height}">${content}</pattern>`;
  }

  function texturedPath(d,value,suffix,prefix){
    const patternId=`${prefix}-pattern-${suffix}-${hash(`${value.materialId}:${value.outerColor}:${value.ornamentColor}`)}`;
    const pattern=buildTexturePattern(value.materialId,value.outerColor,value.ornamentColor,patternId);
    return `<defs>${pattern}</defs><path d="${d}" fill="${value.outerColor}"/><path d="${d}" fill="url(#${patternId})" opacity="${(value.textureStrength/100).toFixed(2)}"/>`;
  }

  function geometry(value,prefix="stationery"){
    const w=480,h=320,c=value.outerColor,d1=darkenColor(c,10),d2=darkenColor(c,5);
    if(value.formatId==="card")return {topFlap:"",frontFlaps:""};
    if(value.formatId==="square"){
      const top=`M0,0 L${w},0 L${w},${h*.5} L0,${h*.5} Z`,left=`M0,${h} L0,20 L85,${h/2} L85,${h} Z`,right=`M${w},${h} L${w},20 L${w-85},${h/2} L${w-85},${h} Z`,bottom=`M0,${h} L0,${h*.45} L${w},${h*.45} L${w},${h} Z`;
      const part=(d,color,s)=>{const local={...value,outerColor:color};return texturedPath(d,local,s,prefix);};
      return {topFlap:`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${part(top,c,"sq-top")}</svg>`,frontFlaps:`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${part(left,d1,"sq-left")}${part(right,d2,"sq-right")}${part(bottom,c,"sq-bottom")}</svg>`};
    }
    if(value.formatId==="rustic"){
      const top=`M0,0 L${w},0 L${w},${h*.6} L${w/2},${h*.8} L0,${h*.6} Z`,left=`M0,${h} L0,0 L${w*.6},${h/2} L${w/2},${h} Z`,right=`M${w},${h} L${w},0 L${w*.4},${h/2} L${w/2},${h} Z`;
      const part=(d,color,s)=>{const local={...value,outerColor:color};return texturedPath(d,local,s,prefix);};
      return {topFlap:`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${part(top,c,"rustic-top")}</svg>`,frontFlaps:`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${part(left,d1,"rustic-left")}${part(right,d2,"rustic-right")}</svg>`};
    }
    const top=`M0,0 L${w},0 L${w/2},${h*.75} Z`,left=`M0,${h} L0,0 L${w/2+10},${h*.6} Z`,right=`M${w},${h} L${w},0 L${w/2-10},${h*.6} Z`,bottom=`M0,${h} L${w/2},${h*.5} L${w},${h} Z`;
    const part=(d,color,s)=>{const local={...value,outerColor:color};return texturedPath(d,local,s,prefix);};
    return {topFlap:`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${part(top,c,"v-top")}</svg>`,frontFlaps:`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${part(left,d1,"v-left")}${part(right,d2,"v-right")}${part(bottom,c,"v-bottom")}</svg>`};
  }

  function drawRose(cx,cy,scale,color){return `<g transform="translate(${cx},${cy}) scale(${scale})"><circle cx="0" cy="0" r="22" fill="${color}"/><path d="M-22,0 C-22,-22 0,-30 15,-15 C25,-5 20,20 0,22 C-20,20 -22,10 -22,0 Z" fill="${darkenColor(color,15)}"/><path d="M-10,5 C-15,-10 0,-15 10,-5 C15,10 0,15 -10,5 Z" fill="${darkenColor(color,30)}"/><path d="M-5,2 C-8,-5 0,-8 5,-2 C8,5 0,8 -5,2 Z" fill="${color}"/></g>`;}
  function drawLeaf(cx,cy,scale,rot,color){return `<g transform="translate(${cx},${cy}) rotate(${rot}) scale(${scale})"><path d="M0,0 C20,-20 40,-10 50,0 C40,10 20,20 0,0 Z" fill="${color}" opacity=".85"/></g>`;}

  function frameSvg(value,id,prefix="stationery"){
    if(id==="none")return "";
    const card=value.formatId==="card",w=card?440:350,h=card?700:224,c=value.ornamentColor,leaf=darkenColor(c,20);
    if(id==="vintage-calligraphy")return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><g stroke="${c}" stroke-width="1.5" fill="none"><path d="M15,60 C15,30 30,15 60,15 M25,45 C25,25 45,25 45,25 M15,15 C20,20 20,25 15,30 C10,25 10,20 15,15 Z"/><path d="M${w-15},60 C${w-15},30 ${w-30},15 ${w-60},15 M${w-25},45 C${w-25},25 ${w-45},25 ${w-45},25 M${w-15},15 C${w-20},20 ${w-20},25 ${w-15},30 C${w-10},25 ${w-10},20 ${w-15},15 Z"/><path d="M15,${h-60} C15,${h-30} 30,${h-15} 60,${h-15} M25,${h-45} C25,${h-25} 45,${h-25} 45,${h-25}"/><path d="M${w-15},${h-60} C${w-15},${h-30} ${w-30},${h-15} ${w-60},${h-15}"/><line x1="70" y1="15" x2="${w-70}" y2="15"/><line x1="70" y1="${h-15}" x2="${w-70}" y2="${h-15}"/></g></svg>`;
    if(id==="floral-corners")return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><rect x="20" y="20" width="${w-40}" height="${h-40}" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="4 4" opacity=".6"/>${drawLeaf(40,40,.7,135,leaf)}${drawLeaf(40,40,.7,45,leaf)}${drawRose(40,40,.9,c)}${drawLeaf(w-40,h-40,.7,-45,leaf)}${drawLeaf(w-40,h-40,.7,-135,leaf)}${drawRose(w-40,h-40,.9,lightenColor(c,20))}</svg>`;
    if(id==="half-moon-floral")return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><path d="M${w*.1},${h*.8} C${w*.1},${h*.4} ${w*.5},${h*.1} ${w*.9},${h*.2}" fill="none" stroke="${leaf}" stroke-width="1.5"/>${drawLeaf(w*.2,h*.7,.8,-60,leaf)}${drawLeaf(w*.3,h*.85,.6,-10,leaf)}${drawLeaf(w*.7,h*.15,.7,160,leaf)}${drawLeaf(w*.8,h*.3,.8,120,leaf)}${drawRose(w*.35,h*.75,1.2,c)}${drawRose(w*.22,h*.65,.8,lightenColor(c,20))}${drawRose(w*.48,h*.7,.7,darkenColor(c,10))}</svg>`;
    if(id==="corner-bouquet")return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><path d="M15,15 L15,${h-15} L${w-15},${h-15} L${w-15},15 Z" fill="none" stroke="${c}" stroke-width=".5"/>${drawLeaf(w-60,60,1,135,leaf)}${drawLeaf(w-40,90,.8,90,leaf)}${drawLeaf(w-90,40,.8,180,leaf)}${drawRose(w-50,50,1.4,c)}${drawRose(w-80,70,.9,lightenColor(c,15))}${drawRose(w-30,85,.7,darkenColor(c,15))}</svg>`;
    if(id==="celestial-ring")return `<svg viewBox="0 0 ${w} ${h}"><ellipse cx="${w/2}" cy="${h/2}" rx="${w*.43}" ry="${h*.39}" fill="none" stroke="${c}" stroke-width="1.2"/><ellipse cx="${w/2}" cy="${h/2}" rx="${w*.38}" ry="${h*.34}" fill="none" stroke="${c}" stroke-dasharray="3 5" opacity=".7"/><circle cx="${w*.18}" cy="${h*.25}" r="2" fill="${c}"/><circle cx="${w*.8}" cy="${h*.72}" r="2.5" fill="${c}"/></svg>`;
    if(id==="aurora-arch")return `<svg viewBox="0 0 ${w} ${h}"><path d="M25 ${h-24} V${h*.38} Q${w/2} ${h*.02} ${w-25} ${h*.38} V${h-24}" fill="none" stroke="${c}" stroke-width="1.5"/><path d="M35 ${h-30} V${h*.42} Q${w/2} ${h*.08} ${w-35} ${h*.42} V${h-30}" fill="none" stroke="${c}" stroke-width=".7" opacity=".65"/></svg>`;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><rect x="15" y="15" width="${w-30}" height="${h-30}" fill="none" stroke="${c}" stroke-width="2"/><rect x="22" y="22" width="${w-44}" height="${h-44}" fill="none" stroke="${c}" stroke-width=".8"/><circle cx="15" cy="15" r="4" fill="${c}"/><circle cx="${w-15}" cy="15" r="4" fill="${c}"/><circle cx="15" cy="${h-15}" r="4" fill="${c}"/><circle cx="${w-15}" cy="${h-15}" r="4" fill="${c}"/></svg>`;
  }

  function dividerSvg(value,id){
    if(id==="none")return "";const c=value.ornamentColor;
    if(id==="twin-vines")return `<svg viewBox="0 0 200 30"><g stroke="${c}" stroke-width="1.5" fill="none"><path d="M20,15 Q60,15 80,5 Q100,-5 100,15"/><path d="M180,15 Q140,15 120,5 Q100,-5 100,15"/><circle cx="100" cy="22" r="2" fill="${c}"/></g></svg>`;
    if(id==="botanical-heart")return `<svg viewBox="0 0 200 30"><g stroke="${c}" stroke-width="1.2" fill="none"><line x1="20" y1="15" x2="80" y2="15"/><line x1="120" y1="15" x2="180" y2="15"/><path d="M90,15 C90,5 100,5 100,15 C100,5 110,5 110,15 C110,25 100,30 100,30 C100,30 90,25 90,15 Z" fill="${c}" opacity=".3"/><circle cx="100" cy="15" r="3" fill="${c}"/></g></svg>`;
    if(id==="vintage-calligraphy-divider")return `<svg viewBox="0 0 200 40"><g stroke="${c}" stroke-width="1.2" fill="none"><path d="M50,20 C70,20 80,5 100,5 C120,5 130,20 150,20"/><path d="M80,20 C80,35 90,35 100,25 C110,35 120,35 120,20"/><path d="M65,12 C55,10 45,15 45,25"/><path d="M135,12 C145,10 155,15 155,25"/><circle cx="100" cy="15" r="1.5" fill="${c}"/></g></svg>`;
    if(id==="imperial-arrow")return `<svg viewBox="0 0 200 20"><g stroke="${c}" fill="${c}"><line x1="20" y1="10" x2="180" y2="10"/><polygon points="100,4 108,10 100,16 92,10"/><circle cx="70" cy="10" r="2.5"/><circle cx="130" cy="10" r="2.5"/><polygon points="20,10 30,6 30,14"/><polygon points="180,10 170,6 170,14"/></g></svg>`;
    if(id==="romantic-ribbon")return `<svg viewBox="0 0 200 30"><g stroke="${c}" stroke-width="1" fill="none"><line x1="10" y1="15" x2="70" y2="15"/><line x1="130" y1="15" x2="190" y2="15"/><path d="M70,15 C85,-5 100,35 115,15 C130,-5 115,-5 100,15 C85,35 70,35 85,15 Z"/></g></svg>`;
    if(id==="olive-branch")return `<svg viewBox="0 0 200 34"><g stroke="${c}" fill="none"><path d="M38 24 Q78 3 100 17 Q122 3 162 24" stroke-width="1.2"/><ellipse cx="70" cy="13" rx="9" ry="3.5" transform="rotate(-24 70 13)" fill="${c}" opacity=".55"/><ellipse cx="130" cy="13" rx="9" ry="3.5" transform="rotate(24 130 13)" fill="${c}" opacity=".55"/><circle cx="100" cy="17" r="2.4" fill="${c}"/></g></svg>`;
    if(id==="constellation-divider")return `<svg viewBox="0 0 200 32"><g stroke="${c}" fill="${c}"><path d="M20 20 L66 10 L100 18 L142 8 L180 20" fill="none" opacity=".7"/><circle cx="20" cy="20" r="2"/><circle cx="66" cy="10" r="2"/><circle cx="100" cy="18" r="3"/><circle cx="142" cy="8" r="2"/><circle cx="180" cy="20" r="2"/></g></svg>`;
    return `<svg viewBox="0 0 200 20"><g stroke="${c}" fill="none"><line x1="10" y1="10" x2="85" y2="10"/><line x1="115" y1="10" x2="190" y2="10"/><polygon points="100,5 105,10 100,15 95,10" fill="${c}"/></g></svg>`;
  }

  function linerSvg(value,id,prefix="stationery"){
    if(id==="none")return "";const c=value.ornamentColor,pid=`${prefix}-liner-${id}-${hash(c)}`;
    let body="";
    if(id==="botanical")body=`<path d="M0 20 Q20 0 40 20 T80 20" fill="none" stroke="${c}" stroke-width="1.4"/><circle cx="20" cy="10" r="2" fill="${c}"/><circle cx="20" cy="30" r="2" fill="${c}"/>`;
    else if(id==="constellation")body=`<path d="M17.5 7 L19 15 L27 17.5 L19 20 L17.5 28 L16 20 L8 17.5 L16 15 Z" fill="${c}"/><circle cx="5" cy="5" r="1" fill="${c}"/>`;
    else if(id==="damask")body=`<path d="M25,5 C35,15 45,20 25,45 C5,20 15,15 25,5 Z" fill="none" stroke="${c}"/><path d="M25,15 C30,20 30,30 25,35 C20,30 20,20 25,15 Z" fill="${c}" opacity=".5"/>`;
    else if(id==="newsprint")body=`<path d="M5 10 H91 M5 18 H42 M50 18 H91 M5 26 H42 M50 26 H91 M5 34 H91 M5 42 H42 M50 42 H91 M5 50 H91" stroke="${c}" stroke-width=".8" opacity=".45"/><path d="M46 12 V56" stroke="${c}" opacity=".3"/>`;
    else if(id==="parchment-fiber")body=`<path d="M0 12 C18 20 30 2 54 10 M10 46 C30 36 50 58 80 42" stroke="${c}" stroke-width=".8" opacity=".34" fill="none"/><circle cx="63" cy="18" r="2" fill="${c}" opacity=".25"/>`;
    else if(id==="floral-bloom")body=`<circle cx="24" cy="24" r="8" fill="${c}" opacity=".45"/><ellipse cx="40" cy="36" rx="4" ry="10" transform="rotate(-35 40 36)" fill="${darkenColor(c,18)}" opacity=".5"/><circle cx="72" cy="64" r="6" fill="${c}" opacity=".32"/>`;
    else if(id==="aurora-wave")body=`<path d="M-20 26 C30 -2 88 62 200 18" fill="none" stroke="${c}" stroke-width="7" opacity=".22"/><path d="M-10 70 C48 35 100 104 194 58" fill="none" stroke="${c}" stroke-width="2" opacity=".4"/>`;
    else body=`<path d="M15 0 L30 15 L15 30 L0 15 Z" fill="none" stroke="${c}" stroke-width="1.2"/><circle cx="15" cy="15" r="3.5" fill="${c}"/>`;
    const sizes={botanical:[40,40],constellation:[35,35],damask:[50,50],newsprint:[96,72],"parchment-fiber":[80,60],"floral-bloom":[90,80],"aurora-wave":[180,100],mudejar:[30,30]};const [w,h]=sizes[id]||sizes.mudejar;
    return `<svg width="100%" height="100%"><defs><pattern id="${pid}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern></defs><rect width="100%" height="100%" fill="url(#${pid})"/></svg>`;
  }

  function overlaySvg(value,id,prefix="stationery"){
    if(id==="none")return "";const c=value.ornamentColor,outer=value.outerColor,card=value.cardColor;
    if(id==="vellum")return `<svg viewBox="0 0 480 320"><rect x="0" y="100" width="480" height="120" fill="${card}" opacity=".6"/><line x1="0" y1="100" x2="480" y2="100" stroke="${card}" stroke-width="2" opacity=".8"/><line x1="0" y1="220" x2="480" y2="220" stroke="${card}" stroke-width="2" opacity=".8"/></svg>`;
    if(id==="victorian-feston"){const pid=`${prefix}-lace-${hash(c)}`;return `<svg viewBox="0 0 480 320"><defs><pattern id="${pid}" width="40" height="70" patternUnits="userSpaceOnUse"><path d="M0,35 Q10,18 20,35 T40,35" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="20" cy="35" r="4" fill="${c}"/><path d="M20,40 Q20,55 30,62 Q20,57 10,62 Z" fill="${c}" opacity=".7"/></pattern></defs><rect x="0" y="125" width="480" height="70" fill="url(#${pid})"/></svg>`;}
    if(id==="jute-band")return `<svg viewBox="0 0 480 320"><rect x="0" y="130" width="480" height="60" fill="${darkenColor(value.ornamentColor,18)}" opacity=".9"/><line x1="0" y1="135" x2="480" y2="135" stroke="${darkenColor(outer,24)}" stroke-dasharray="3 3"/><line x1="0" y1="185" x2="480" y2="185" stroke="${darkenColor(outer,24)}" stroke-dasharray="3 3"/><line x1="0" y1="160" x2="480" y2="160" stroke="${lightenColor(card,2)}" stroke-width="2.5"/></svg>`;
    if(id==="ceremonial-gold")return `<svg viewBox="0 0 480 320"><rect x="0" y="139" width="480" height="42" fill="${c}" opacity=".08"/><line x1="0" y1="139" x2="480" y2="139" stroke="${c}" stroke-width="2"/><line x1="0" y1="181" x2="480" y2="181" stroke="${c}" stroke-width="2"/><path d="M240 145 l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="${c}" opacity=".75"/></svg>`;
    if(id==="constellation-veil")return `<svg viewBox="0 0 480 320"><g fill="none" stroke="${c}" opacity=".55"><ellipse cx="240" cy="160" rx="205" ry="105" stroke-width="1"/><ellipse cx="240" cy="160" rx="170" ry="78" stroke-dasharray="4 6"/><path d="M70 105 L152 65 L260 92 L390 58"/></g><g fill="${c}"><circle cx="70" cy="105" r="3"/><circle cx="152" cy="65" r="2"/><circle cx="260" cy="92" r="3"/><circle cx="390" cy="58" r="2"/></g></svg>`;
    if(id==="botanical-corners")return `<svg viewBox="0 0 480 320"><g fill="none" stroke="${c}" opacity=".7"><path d="M12 82 Q70 30 142 22"/><path d="M468 238 Q410 290 338 298"/></g>${drawLeaf(48,54,.65,-35,c)}${drawLeaf(95,34,.5,8,c)}${drawLeaf(432,266,.65,145,c)}${drawLeaf(385,286,.5,188,c)}</svg>`;
    if(id==="aurora-veil")return `<svg viewBox="0 0 480 320"><path d="M0 0 H150 Q210 160 150 320 H0 Z" fill="${lightenColor(c,28)}" opacity=".18"/><path d="M480 0 H330 Q270 160 330 320 H480 Z" fill="${c}" opacity=".14"/></svg>`;
    if(id==="blush-heart-band")return `<svg viewBox="0 0 480 320"><rect x="0" y="126" width="480" height="68" fill="${lightenColor(c,28)}" opacity=".22"/><path d="M220 153 C220 134 240 134 240 153 C240 134 260 134 260 153 C260 172 240 184 240 184 C240 184 220 172 220 153 Z" fill="${c}" opacity=".72"/></svg>`;
    return `<svg viewBox="0 0 480 320"><rect x="0" y="124" width="480" height="72" fill="${darkenColor(outer,8)}" opacity=".58"/><line x1="0" y1="130" x2="480" y2="130" stroke="${c}"/><line x1="0" y1="190" x2="480" y2="190" stroke="${c}"/><text x="240" y="166" text-anchor="middle" font-family="serif" font-size="13" letter-spacing="6" fill="${c}">RESERVA</text></svg>`;
  }

  function stampSvg(value,id,context={}){
    if(id==="none")return "";const c=value.ornamentColor,card=value.cardColor,text=value.textColor,mono=initials(context.displayName||context.eventTitle),date=escapeXml(context.dateLabel||""),font=escapeXml(context.headingFont||"serif");
    if(id==="botanical-post")return `<svg viewBox="0 0 100 120"><rect x="5" y="5" width="90" height="110" fill="${card}" stroke="${c}" stroke-dasharray="4 4"/><path d="M50 30 C40 45 30 50 30 70 C30 90 50 95 50 105 C50 95 70 90 70 70 C70 50 60 45 50 30 Z" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="50" cy="70" r="5" fill="${c}"/><text x="50" y="22" font-family="sans-serif" font-size="7" fill="${text}" text-anchor="middle" font-weight="bold">AMOUR</text></svg>`;
    if(id==="airmail-cancel")return `<svg viewBox="0 0 120 80"><g stroke="${c}" stroke-width="1.5" fill="none"><circle cx="40" cy="40" r="35"/><circle cx="40" cy="40" r="25"/><text x="40" y="38" font-family="sans-serif" font-size="8" fill="${c}" stroke="none" text-anchor="middle">AIR MAIL</text><text x="40" y="50" font-family="${font}" font-size="12" fill="${c}" stroke="none" text-anchor="middle">${escapeXml(mono)}</text><path d="M80,30 Q90,20 100,30 T120,30"/><path d="M80,50 Q90,40 100,50 T120,50"/></g></svg>`;
    if(id==="gazette-special")return `<svg viewBox="0 0 100 120"><rect x="5" y="5" width="90" height="110" fill="${card}" stroke="${text}"/><line x1="14" y1="22" x2="86" y2="22" stroke="${text}" stroke-width="2"/><text x="50" y="18" font-family="serif" font-size="8" fill="${text}" text-anchor="middle" font-weight="bold">EVENT GAZETTE</text><text x="50" y="58" font-family="serif" font-size="13" fill="${text}" text-anchor="middle">SPECIAL</text><text x="50" y="72" font-family="serif" font-size="13" fill="${text}" text-anchor="middle">EDITION</text><text x="50" y="98" font-family="serif" font-size="7" fill="${text}" text-anchor="middle">${date}</text></svg>`;
    if(id==="reserve-post")return `<svg viewBox="0 0 100 120"><rect x="5" y="5" width="90" height="110" rx="4" fill="${darkenColor(value.outerColor,8)}" stroke="${c}" stroke-width="2"/><rect x="12" y="12" width="76" height="96" fill="none" stroke="${c}"/><text x="50" y="37" font-family="serif" font-size="8" fill="${c}" text-anchor="middle">GRAN</text><text x="50" y="54" font-family="serif" font-size="10" fill="${c}" text-anchor="middle">RESERVA</text><circle cx="50" cy="77" r="16" fill="none" stroke="${c}"/><text x="50" y="82" font-family="${font}" font-size="14" fill="${c}" text-anchor="middle">${escapeXml(mono)}</text></svg>`;
    if(id==="celestial-post")return `<svg viewBox="0 0 100 120"><rect x="5" y="5" width="90" height="110" rx="4" fill="${darkenColor(value.outerColor,12)}" stroke="${c}"/><path d="M20 30 L42 18 L70 34 L82 20" stroke="${c}" fill="none"/><circle cx="20" cy="30" r="2" fill="${c}"/><circle cx="42" cy="18" r="2" fill="${c}"/><circle cx="70" cy="34" r="2" fill="${c}"/><text x="50" y="82" font-family="${font}" font-size="24" fill="${c}" text-anchor="middle">${escapeXml(mono)}</text></svg>`;
    return `<svg viewBox="0 0 100 120"><rect x="5" y="5" width="90" height="110" fill="${card}" stroke="${c}" stroke-dasharray="4 4"/><circle cx="50" cy="50" r="25" fill="none" stroke="${c}"/><text x="50" y="58" font-family="${font}" font-size="20" fill="${c}" text-anchor="middle">${escapeXml(mono)}</text><text x="50" y="95" font-family="sans-serif" font-size="6" fill="${text}" text-anchor="middle">${date}</text></svg>`;
  }

  function materialPreviewSvg(materialId,value,catalog={},contextId="preview"){
    const normalized=normalize({...value,materialId},catalog),id=`${contextId}-${materialId}-${hash(`${normalized.outerColor}:${normalized.ornamentColor}:${normalized.textureStrength}`)}`,pattern=buildTexturePattern(materialId,normalized.outerColor,normalized.ornamentColor,id);
    return `<svg viewBox="0 0 320 100" preserveAspectRatio="none" aria-hidden="true"><defs>${pattern}</defs><rect width="320" height="100" fill="${normalized.outerColor}"/><rect width="320" height="100" fill="url(#${id})" opacity="${(normalized.textureStrength/100).toFixed(2)}"/></svg>`;
  }

  function formatIcon(id){
    if(id==="square")return '<path d="M10,20 L90,20 L90,80 L10,80 Z"/><path d="M10,20 L10,50 L90,50 L90,20"/>';
    if(id==="rustic")return '<path d="M10,20 L90,20 L90,80 L10,80 Z"/><path d="M10,80 L50,40 L90,80"/><path d="M10,20 L10,80 L50,50 Z"/><path d="M90,20 L90,80 L50,50 Z"/>';
    if(id==="card")return '<rect x="25" y="10" width="50" height="80" rx="4" fill="none"/><line x1="35" y1="30" x2="65" y2="30"/><line x1="40" y1="45" x2="60" y2="45"/>';
    return '<path d="M10,20 L90,20 L90,80 L10,80 Z"/><path d="M10,20 L50,60 L90,20"/>';
  }

  function resourceSvg(kind,id,value,context={},prefix="resource"){
    if(kind==="frames")return frameSvg(value,id,prefix);
    if(kind==="dividers")return dividerSvg(value,id);
    if(kind==="liners")return linerSvg(value,id,prefix);
    if(kind==="overlays")return overlaySvg(value,id,prefix);
    if(kind==="stamps")return stampSvg(value,id,context);
    return "";
  }

  function markup(value,context={},catalog={}){
    const name=escapeHtml(context.displayName||context.eventTitle||""),date=escapeHtml(context.dateLabel||""),prefix=context.idPrefix||`stationery-${hash(`${value.presetId}:${name}`)}`,geo=geometry(value,prefix);
    return `<div class="stationery-envelope envelope-container" data-format="${escapeHtml(value.formatId)}" data-material="${escapeHtml(value.materialId)}" data-liner="${escapeHtml(value.linerId)}" data-overlay="${escapeHtml(value.overlayId)}">
      <div class="stationery-back env-back-interior"><div class="stationery-liner env-liner-slot">${linerSvg(value,value.linerId,prefix)}</div></div>
      <article class="stationery-card envelope-card" data-frame="${escapeHtml(value.frameId)}"><div class="stationery-frame card-frame-slot">${frameSvg(value,value.frameId,prefix)}</div><div class="stationery-card-content card-content-wrapper"><strong class="names-display">${name}</strong><span class="stationery-divider divider-slot" aria-hidden="true">${dividerSvg(value,value.dividerId)}</span><small class="sub-display">${date}</small></div></article>
      <div class="stationery-front-flaps env-front-flaps" aria-hidden="true">${geo.frontFlaps}</div>
      <div class="stationery-stamp env-stamp-slot ${value.stampId==="none"?"is-hidden":""}" data-stamp="${escapeHtml(value.stampId)}" aria-hidden="true">${stampSvg(value,value.stampId,context)}</div>
      <div class="stationery-top-flap env-flap-top" aria-hidden="true">${geo.topFlap}</div>
      <div class="stationery-overlay env-overlay-slot ${value.overlayId==="none"?"is-hidden":""}" aria-hidden="true">${overlaySvg(value,value.overlayId,prefix)}</div>
      <div class="stationery-seal wax-seal-slot" aria-hidden="true"></div>
    </div>`;
  }

  function renderInto(host,definition={},context={},catalog={},sealDefinition={}){
    if(!host)return null;const value=normalize(definition,catalog,context);host.hidden=!value.enabled;host.classList.toggle("is-disabled",!value.enabled);host.style.setProperty("--st-outer",value.outerColor);host.style.setProperty("--st-inner",value.innerColor);host.style.setProperty("--st-card",value.cardColor);host.style.setProperty("--st-text",value.textColor);host.style.setProperty("--st-ornament",value.ornamentColor);host.style.setProperty("--st-seal",value.sealColor);host.style.setProperty("--st-texture-strength",String(value.textureStrength/100));host.style.setProperty("--st-heading-font",context.headingFont||"var(--font-heading, Georgia, serif)");host.dataset.format=value.formatId;host.innerHTML=markup(value,context,catalog);
    const seal=host.querySelector(".stationery-seal"),effectiveSeal={...sealDefinition,customColor:value.sealColor};
    if(seal&&effectiveSeal.enabled!==false&&global.EventStudioWaxSeal?.renderInto){global.EventStudioWaxSeal.renderInto(seal,effectiveSeal,{displayName:context.displayName||context.eventTitle||"",eventTitle:context.eventTitle||"",themeColor:value.sealColor,seed:context.seed||`${context.displayName||context.eventTitle||"event"}:${value.presetId}`,idPrefix:context.idPrefix||`stationery-seal-${value.presetId}`},context.sealCatalog||{});}else if(seal)seal.hidden=true;
    return {element:host.querySelector(".stationery-envelope"),value};
  }

  function applyPreset(definition={},presetId,catalog={}){const recipe=preset(catalog,presetId);if(!recipe)return {stationery:normalize(definition,catalog),seal:null};const {seal,...stationeryRecipe}=recipe;return {stationery:normalize({...definition,...stationeryRecipe,presetId,customized:true},catalog),seal:seal?{...seal,customized:true}:null};}
  function designTokens(definition,catalog={}){const value=normalize(definition,catalog);return {bg:value.outerColor,paper:value.cardColor,ink:value.textColor,muted:value.innerColor,accent:value.sealColor,gold:value.ornamentColor,line:value.innerColor};}
  function isLegacyOpening(openingStyle,catalog={}){return Boolean(legacyPreset(catalog,openingStyle));}

  global.EventStudioStationery=Object.freeze({normalize,renderInto,applyPreset,designTokens,isLegacyOpening,legacyPreset,initials,materialPreviewSvg,resourceSvg,formatIcon,geometry});
})(window);
