(function(global){
  "use strict";

  const CX=250,CY=250,NS="http://www.w3.org/2000/svg";
  const escapeXml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]));
  const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};
  const safeHex=(value,fallback="")=>/^#[0-9a-f]{6}$/i.test(String(value||""))?String(value).toLowerCase():(/^#[0-9a-f]{6}$/i.test(String(fallback||""))?String(fallback).toLowerCase():"");
  const hexToRgb=hex=>{const n=parseInt(safeHex(hex).slice(1),16);return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};};
  const rgbToHex=(r,g,b)=>"#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
  const shift=(hex,amount)=>{const {r,g,b}=hexToRgb(hex);return rgbToHex(r+amount,g+amount,b+amount);};
  const hash=value=>{let h=2166136261;for(const ch of String(value||"")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  const phase=(seed,index)=>((hash(`${seed}:${index}`)%6283)/1000);

  function catmull(points){
    let d="";const n=points.length;
    for(let i=0;i<n;i++){
      const p0=points[(i-1+n)%n],p1=points[i],p2=points[(i+1)%n],p3=points[(i+2)%n];
      const c1x=p1.x+(p2.x-p0.x)/6,c1y=p1.y+(p2.y-p0.y)/6,c2x=p2.x-(p3.x-p1.x)/6,c2y=p2.y-(p3.y-p1.y)/6;
      if(i===0)d+=`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} `;
      d+=`C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `;
    }
    return d+"Z";
  }

  function blobPath(style="organic",seed="eventstudio",pointCount=64){
    const definitions={classic:[[6,.006],[11,.004]],organic:[[3,.028],[5,.02],[8,.012],[13,.006]],melted:[[2,.03],[4,.024],[7,.014],[11,.008]]};
    const waves=definitions[style]||definitions.organic,points=[];
    for(let i=0;i<pointCount;i++){
      const angle=i/pointCount*Math.PI*2;let radius=186;
      waves.forEach(([freq,amp],index)=>{radius+=Math.sin(angle*freq+phase(seed,index))*amp*186;});
      if(style==="melted"){
        const dripAngle=3.9+((hash(seed)%100)/1000),width=.45,delta=Math.atan2(Math.sin(angle-dripAngle),Math.cos(angle-dripAngle));
        radius+=Math.exp(-(delta*delta)/(2*width*width))*18.6;
      }
      points.push({x:CX+Math.cos(angle)*radius,y:CY+Math.sin(angle)*radius});
    }
    return catmull(points);
  }

  function laurelLeaf(x,y,angle,size,color){
    const lx=Math.cos(angle),ly=Math.sin(angle),px=-ly,py=lx,tipX=x+lx*size,tipY=y+ly*size,baseX=x-lx*size*.15,baseY=y-ly*size*.15;
    const c1x=x+px*size*.42+lx*size*.25,c1y=y+py*size*.42+ly*size*.25,c2x=x-px*size*.42+lx*size*.25,c2y=y-py*size*.42+ly*size*.25;
    return `<path d="M ${baseX.toFixed(1)} ${baseY.toFixed(1)} Q ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${baseX.toFixed(1)} ${baseY.toFixed(1)} Z" fill="${color}"/>`;
  }
  function laurel(color){
    let out="<g>";
    for(const [start,end,mirror] of [[90,200,false],[90,-20,true]]){
      for(let i=0;i<7;i++){
        const t=i/6,deg=start+(end-start)*t,rad=deg*Math.PI/180,x=CX+Math.cos(rad)*158,y=CY+Math.sin(rad)*158;
        out+=laurelLeaf(x,y,rad+Math.PI/2+(mirror?-.55:.55),9+(i%2===0?1.5:0),color);
      }
      const sx=CX+Math.cos(start*Math.PI/180)*158,sy=CY+Math.sin(start*Math.PI/180)*158,ex=CX+Math.cos(end*Math.PI/180)*158,ey=CY+Math.sin(end*Math.PI/180)*158;
      out+=`<path d="M ${sx.toFixed(1)} ${sy.toFixed(1)} A 158 158 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
    }
    return out+"</g>";
  }
  function star(cx,cy,outer=6,inner=2.6){let d="";for(let i=0;i<10;i++){const r=i%2?inner:outer,a=-Math.PI/2+i*Math.PI/5,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;d+=(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1)+" ";}return d+"Z";}
  function ornamentMarkup(type,color){
    if(type==="laurel")return laurel(color);
    if(type==="fleur")return `<path d="M 0,-40 C -12,-40 -18,-28 -14,-18 C -18,-14 -22,-6 -18,2 C -24,4 -30,-2 -34,-14 C -38,-4 -34,10 -22,16 C -26,20 -30,26 -26,32 C -18,26 -10,26 -6,32 L -6,50 L 6,50 L 6,32 C 10,26 18,26 26,32 C 30,26 26,20 22,16 C 34,10 38,-4 34,-14 C 30,-2 24,4 18,2 C 22,-6 18,-14 14,-18 C 18,-28 12,-40 0,-40 Z" transform="translate(250 346) scale(.62)" fill="${color}"/>`;
    if(type==="stars")return `<g>${[-24,0,24].map(dx=>`<path d="${star(CX+dx,CY-92)}" fill="${color}"/>`).join("")}</g>`;
    if(type==="quadrant")return `<g stroke="${color}" stroke-width="1.4" fill="none"><line x1="106" y1="250" x2="394" y2="250"/><line x1="250" y1="106" x2="250" y2="394"/></g>`;
    return "";
  }

  function materialFor(definition,themeColor,catalog){
    const fallbackColor=safeHex(catalog?.defaults?.customColor);
    if(definition.material==="theme"){
      const mid=safeHex(themeColor||definition.customColor,fallbackColor);return {light:shift(mid,34),mid,dark:shift(mid,-40),metallic:false};
    }
    if(definition.material==="custom"){
      const mid=safeHex(definition.customColor,fallbackColor);return {light:shift(mid,28),mid,dark:shift(mid,-32),metallic:false};
    }
    const fromCatalog=(catalog?.materials||[]).find(item=>item.id===definition.material&&item.mid);
    const configuredFallback=(catalog?.materials||[]).find(item=>item.mid)||null;
    if(fromCatalog||configuredFallback)return fromCatalog||configuredFallback;
    const mid=safeHex(definition.customColor,fallbackColor);
    return {light:shift(mid,28),mid,dark:shift(mid,-32),metallic:false};
  }

  function monogram(definition,context={}){
    const clean=value=>String(value||"").trim().match(/[\p{L}\p{N}]/u)?.[0]||"";
    if(!definition.autoMonogram)return {first:clean(definition.initial1),second:clean(definition.initial2)};
    const raw=String(context.displayName||context.eventTitle||"").trim();
    const split=raw.split(/\s*(?:&|\+|\by\b|\be\b|\band\b)\s*/iu).filter(Boolean);
    if(split.length>=2)return {first:clean(split[0]),second:clean(split[1])};
    const words=raw.match(/[\p{L}\p{N}]+/gu)||[];
    return {first:clean(words[0]),second:clean(words[1])};
  }

  function normalize(definition={},catalog={}){
    const defaults=catalog.defaults||{};const next={...defaults,...definition};
    const range=(key,min,max,fallback)=>({min:catalog.controls?.[key]?.min??min,max:catalog.controls?.[key]?.max??max,fallback});
    const fontSize=range("fontSize",40,170,104),kerning=range("kerning",-4,22,1.5),verticalOffset=range("verticalOffset",-60,60,0),reliefDepth=range("reliefDepth",2,16,7),specular=range("specular",10,100,55);
    return {...next,fontSize:clamp(next.fontSize,fontSize.min,fontSize.max,fontSize.fallback),kerning:clamp(next.kerning,kerning.min,kerning.max,kerning.fallback),verticalOffset:clamp(next.verticalOffset,verticalOffset.min,verticalOffset.max,verticalOffset.fallback),reliefDepth:clamp(next.reliefDepth,reliefDepth.min,reliefDepth.max,reliefDepth.fallback),specular:clamp(next.specular,specular.min,specular.max,specular.fallback),quality:["lite","balanced","full"].includes(next.quality)?next.quality:"balanced"};
  }

  function svgString(definition={},context={},catalog={}){
    const def=normalize(definition,catalog),mat=materialFor(def,context.themeColor,catalog),detail=shift(mat.dark,-6),ids=context.idPrefix||`seal-${hash(context.seed||context.displayName||"eventstudio")}`;
    const connectorText=String(def.connector??"").trim();
    const initials=monogram(def,context),connector=connectorText&&connectorText!=="none"?` ${connectorText} `:" ",center=initials.first&&initials.second?`${initials.first}${connector}${initials.second}`:(initials.first||initials.second||"");
    const surfaceScale=(def.reliefMode==="engraved"?-1:1)*def.reliefDepth,spec=Math.max(.05,def.specular/100*(mat.metallic?1.3:1)).toFixed(2),fontFamily=(catalog.fonts||[]).find(item=>item.id===def.font)?.family||`${def.font||"Cormorant Garamond"}, Georgia, serif`;
    const heavy=def.quality!=="lite",full=def.quality==="full";
    const grain=heavy?`<filter id="${ids}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${full?.9:.55}" numOctaves="${full?2:1}" seed="7" result="noise"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/></filter>`:"";
    const texture=heavy?`<g clip-path="url(#${ids}-clip)"><rect width="500" height="500" filter="url(#${ids}-grain)" opacity="${full?.1:.055}"/></g>`:"";
    const top=escapeXml(String(def.topText||"").trim().toUpperCase()),bottom=escapeXml(String(def.bottomText||"").trim().toUpperCase());
    return `<svg class="wax-seal-svg" viewBox="0 0 500 500" xmlns="${NS}" role="img" aria-label="Sello de cera ${escapeXml(center)}"><defs><radialGradient id="${ids}-wax" cx="32%" cy="26%" r="80%"><stop offset="0%" stop-color="${mat.light}"/><stop offset="55%" stop-color="${mat.mid}"/><stop offset="100%" stop-color="${mat.dark}"/></radialGradient><filter id="${ids}-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="9" stdDeviation="12" flood-color="#0a0704" flood-opacity=".46"/></filter><filter id="${ids}-bevel" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="blur"/><feDiffuseLighting in="blur" surfaceScale="${surfaceScale}" diffuseConstant=".9" lighting-color="#fff3d6" result="diffuse"><feDistantLight azimuth="235" elevation="52"/></feDiffuseLighting><feComposite in="diffuse" in2="SourceAlpha" operator="in" result="diffuseClip"/><feBlend in="SourceGraphic" in2="diffuseClip" mode="multiply" result="shaded"/><feSpecularLighting in="blur" surfaceScale="${surfaceScale}" specularConstant="${spec}" specularExponent="14" lighting-color="#fff8e9" result="spec"><feDistantLight azimuth="235" elevation="58"/></feSpecularLighting><feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip"/><feComposite in="specClip" in2="shaded" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/></filter>${grain}<clipPath id="${ids}-clip"><path d="${blobPath(def.borderStyle,context.seed||center)}"/></clipPath><path id="${ids}-top" d="M 128 250 A 122 122 0 0 1 372 250"/><path id="${ids}-bottom" d="M 128 250 A 122 122 0 0 0 372 250"/></defs><path d="${blobPath(def.borderStyle,context.seed||center)}" fill="url(#${ids}-wax)" filter="url(#${ids}-shadow)"/>${texture}<g filter="url(#${ids}-bevel)" fill="${detail}" stroke="${detail}"><circle cx="250" cy="250" r="166" fill="none" stroke-width="3.4"/><circle cx="250" cy="250" r="150" fill="none" stroke-width="2.2"/>${ornamentMarkup(def.ornament,detail)}<text x="250" y="${250+Number(def.verticalOffset||0)}" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(fontFamily)}" font-size="${def.fontSize}" letter-spacing="${def.kerning}" fill="${detail}" stroke="none">${escapeXml(center)}</text>${top?`<text font-family="${escapeXml(fontFamily)}" font-size="15" letter-spacing="2.4" fill="${detail}" stroke="none"><textPath href="#${ids}-top" startOffset="50%" text-anchor="middle">${top}</textPath></text>`:""}${bottom?`<text font-family="${escapeXml(fontFamily)}" font-size="15" letter-spacing="2.4" fill="${detail}" stroke="none"><textPath href="#${ids}-bottom" startOffset="50%" text-anchor="middle">${bottom}</textPath></text>`:""}</g></svg>`;
  }

  function renderInto(host,definition,context,catalog){if(!host)return null;host.innerHTML=svgString(definition,context,catalog);return host.querySelector("svg");}
  global.EventStudioWaxSeal=Object.freeze({svgString,renderInto,blobPath,monogram,normalize});
})(window);
