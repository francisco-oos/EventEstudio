"use strict";

(function(global){
  function normalizeHex(value){
    let hex=String(value||"").trim().replace(/^#/,"");
    if(hex.length===3)hex=[...hex].map(char=>char+char).join("");
    if(!/^[0-9a-f]{6}$/i.test(hex))return null;
    return `#${hex.toLowerCase()}`;
  }
  function relativeLuminance(value){
    const hex=normalizeHex(value);if(!hex)return 0;
    const channels=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255)
      .map(channel=>channel<=0.03928?channel/12.92:Math.pow((channel+0.055)/1.055,2.4));
    return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
  }
  function contrastRatio(first,second){
    const a=relativeLuminance(first),b=relativeLuminance(second);
    return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  }
  function blendHex(first,second,amount){
    const parse=value=>{const hex=normalizeHex(value);return hex?[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)):null;};
    const a=parse(first),b=parse(second);if(!a||!b)return normalizeHex(first)||"#1f1f1f";
    const mix=a.map((channel,index)=>Math.round(channel+(b[index]-channel)*amount));
    return `#${mix.map(channel=>Math.max(0,Math.min(255,channel)).toString(16).padStart(2,"0")).join("")}`;
  }
  function readableNeutral(background,{minimum=4.5,preferMuted=false}={}){
    const candidates=preferMuted
      ?["#5f5b56","#54514d","#4b4945","#707070","#333333","#ffffff"]
      :["#242321","#1f1f1f","#2b2b2b","#ffffff"];
    return candidates.find(candidate=>contrastRatio(candidate,background)>=minimum)||"#1f1f1f";
  }
  function accessibleAcrossSurfaces(foreground,surfaces,{minimum=4.5,preferMuted=false}={}){
    const original=normalizeHex(foreground)||(preferMuted?"#5f5b56":"#1f1f1f");
    const backgrounds=surfaces.map(normalizeHex).filter(Boolean);
    if(backgrounds.length&&backgrounds.every(background=>contrastRatio(original,background)>=minimum))return original;
    const candidates=[];
    for(const target of ["#000000","#ffffff"]){
      for(let step=1;step<=24;step++){
        const amount=step/24,candidate=blendHex(original,target,amount);
        if(backgrounds.every(background=>contrastRatio(candidate,background)>=minimum)){
          candidates.push({candidate,amount});break;
        }
      }
    }
    candidates.sort((left,right)=>left.amount-right.amount);
    if(candidates[0])return candidates[0].candidate;
    const neutralCandidates=preferMuted
      ?["#5f5b56","#4f4b47","#3f3d39","#2c2b29","#ffffff"]
      :["#242321","#171717","#ffffff"];
    return neutralCandidates.find(candidate=>backgrounds.every(background=>contrastRatio(candidate,background)>=minimum))
      ||readableNeutral(backgrounds[0]||"#ffffff",{minimum,preferMuted});
  }
  function ensureAccessiblePalette(input={}){
    const palette={...input};
    const paper=normalizeHex(palette.paper)||"#ffffff";
    const bg=normalizeHex(palette.bg)||paper;
    const surfaces=[paper,bg];
    const ink=normalizeHex(palette.ink)||readableNeutral(paper);
    const muted=normalizeHex(palette.muted)||ink;
    const accent=normalizeHex(palette.accent)||"#5f625e";
    const gold=normalizeHex(palette.gold)||"#a28d68";
    palette.bg=bg;palette.paper=paper;
    palette.ink=accessibleAcrossSurfaces(ink,surfaces,{minimum:4.5});
    palette.muted=accessibleAcrossSurfaces(muted,surfaces,{minimum:4.5,preferMuted:true});
    palette.headingColor=accessibleAcrossSurfaces(normalizeHex(palette.headingColor)||palette.ink,surfaces,{minimum:4.5});
    palette.bodyColor=accessibleAcrossSurfaces(normalizeHex(palette.bodyColor)||palette.muted,surfaces,{minimum:4.5,preferMuted:true});
    palette.accent=accent;
    palette.accentText=accessibleAcrossSurfaces(accent,surfaces,{minimum:4.5});
    palette.gold=gold;
    palette.goldText=accessibleAcrossSurfaces(gold,surfaces,{minimum:4.5});
    palette.paperContrast=contrastRatio(palette.ink,paper)>=4.5?palette.ink:readableNeutral(paper);
    palette.bgContrast=contrastRatio(palette.ink,bg)>=4.5?palette.ink:readableNeutral(bg);
    palette.accentContrast=contrastRatio("#ffffff",accent)>=4.5?"#ffffff":readableNeutral(accent);
    palette.goldContrast=contrastRatio("#ffffff",gold)>=4.5?"#ffffff":readableNeutral(gold);
    Object.assign(palette,{
      background:bg,textPrimary:palette.ink,textSecondary:palette.bodyColor,textMuted:palette.muted,
      accentSecondary:normalizeHex(palette["accent-dark"])||gold,textOnAccent:palette.accentContrast,
      textOnPaper:palette.paperContrast,textOnBackground:palette.bgContrast,highlight:gold,
      linkColor:palette.accentText,ctaBackground:accent,ctaText:palette.accentContrast,borderColor:normalizeHex(palette.line)||"#d8d2ca"
    });
    return palette;
  }
  global.EventStudioColorEngine={normalizeHex,contrastRatio,ensureAccessiblePalette};
})(window);
