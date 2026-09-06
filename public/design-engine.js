"use strict";

(function(global){
  const TYPE_HOSTS={
    hero:"hero",countdown:"countdownEyebrow",story:"storyEyebrow",venues:"venuesSection",agenda:"agendaSection",
    gallery:"gallerySection","dress-code":"dressSection",rsvp:"rsvpSection",gifts:"giftSection",qr:"designQrSection",footer:"eventStudioFooter"
  };
  const COLOR_VAR={primary:"--accent",accent:"--accent",gold:"--gold",ink:"--ink",muted:"--muted",paper:"--paper"};
  const FONT_MAP={georgia:'Georgia,"Times New Roman",serif',baskerville:'Baskerville,"Palatino Linotype",serif',garamond:'Garamond,"Times New Roman",serif',didot:'Didot,"Bodoni MT",serif',system:'Inter,system-ui,-apple-system,"Segoe UI",sans-serif',humanist:'"Trebuchet MS","Segoe UI",sans-serif',classic:'"Palatino Linotype","Book Antiqua",serif','great-vibes':'"Great Vibes",Georgia,cursive',cormorant:'"Cormorant Garamond",Georgia,serif',playfair:'"Playfair Display",Georgia,serif',cinzel:'Cinzel,Georgia,serif',lora:'Lora,Georgia,serif',montserrat:'Montserrat,Inter,system-ui,sans-serif','segoe-script':'"Segoe Script","Lucida Handwriting",cursive','lucida-calligraphy':'"Lucida Calligraphy","Segoe Script",cursive','brush-script':'"Brush Script MT","Segoe Script",cursive',bodoni:'"Bodoni MT",Didot,Georgia,serif',century:'"Century Schoolbook",Century,Georgia,serif',candara:'Candara,Calibri,"Segoe UI",sans-serif',bookman:'"Bookman Old Style",Georgia,serif'};
  const SAFE_HEX=/^#[0-9a-f]{6}$/i;
  function hostFor(type){const id=TYPE_HOSTS[type];const node=id?document.getElementById(id):null;return type==="countdown"?node?.closest("section"):node;}
  function removePrevious(){
    document.querySelectorAll(".es-design-asset,.es-hero-media-panel").forEach(node=>node.remove());
    const hero=document.getElementById("hero");if(hero){hero.classList.remove("es-hero-media-split","es-hero-media-split-left","es-hero-media-split-right");delete hero.dataset.esHeroMediaLayout;delete hero.dataset.esDeferredHeroPanelSrc;hero.style.removeProperty("--es-hero-media-overlay");}
    document.querySelectorAll(".es-recipe-hidden").forEach(node=>node.classList.remove("es-recipe-hidden"));
    document.querySelectorAll("[data-es-style]").forEach(node=>{delete node.dataset.esStyle;delete node.dataset.esType;delete node.dataset.esPhoto;for(const key of ["--es-order","--es-section-spacing","--es-section-width","--es-heading-size","--es-body-size","--es-heading-weight","--es-body-weight","--es-line-height","--es-letter-spacing","--es-heading-color","--es-body-color"]){node.style.removeProperty(key);}node.style.removeProperty("text-align");delete node.dataset.esHeadingCase;delete node.dataset.esSurface;});
    document.body.classList.remove("es-layout-classic","es-layout-editorial","es-layout-cinematic","es-layout-botanical","es-layout-minimal","es-layout-storybook","es-layout-passport","es-layout-poster","es-layout-layered","es-layout-split","es-layout-carousel","es-layout-watercolor","es-layout-celestial");
  }
  function palette(settings,recipe){
    const source=settings?._palette||recipe?.design?.palette||{};
    const p=global.EventStudioColorEngine?.ensureAccessiblePalette?global.EventStudioColorEngine.ensureAccessiblePalette(source):source;
    Object.entries({bg:"--bg",paper:"--paper",ink:"--ink",muted:"--muted",accent:"--accent",gold:"--gold",line:"--line",headingColor:"--heading-color",bodyColor:"--body-color",accentText:"--accent-text",goldText:"--gold-text",accentContrast:"--accent-contrast",goldContrast:"--gold-contrast",paperContrast:"--paper-contrast",bgContrast:"--bg-contrast",background:"--background",textPrimary:"--text-primary",textSecondary:"--text-secondary",textMuted:"--text-muted",accentSecondary:"--accent-secondary",textOnAccent:"--text-on-accent",textOnPaper:"--text-on-paper",textOnBackground:"--text-on-background",highlight:"--highlight",linkColor:"--link-color",ctaBackground:"--cta-background",ctaText:"--cta-text",borderColor:"--border-color"}).forEach(([key,css])=>{
      if(/^#[0-9a-f]{6}$/i.test(String(p[key]||"")))document.documentElement.style.setProperty(css,p[key]);
    });
    if(/^#[0-9a-f]{6}$/i.test(String(source["accent-dark"]||"")))document.documentElement.style.setProperty("--accent-dark",source["accent-dark"]);
  }
  function typography(settings,recipe){
    const t=recipe?.design?.typography||settings?.typography||{};
    document.documentElement.style.setProperty("--font-heading",FONT_MAP[t.heading]||FONT_MAP.georgia);
    document.documentElement.style.setProperty("--font-body",FONT_MAP[t.body]||FONT_MAP.system);
    document.body.dataset.typographyScale=t.scale||"comfortable";
    document.body.dataset.nameCase=t.nameCase||"title";
  }
  function styleSections(recipe){
    const invitation=document.getElementById("invitation");
    if(invitation)invitation.classList.add("es-recipe-flow");
    const present=new Set((recipe.sections||[]).filter(section=>section.visible!==false).map(section=>section.type));
    Object.keys(TYPE_HOSTS).forEach(type=>{const host=hostFor(type);if(!host)return;if(!present.has(type)){host.remove();return;}host.classList.remove("es-recipe-hidden");});
    [...(recipe.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0)).forEach(section=>{
      const host=hostFor(section.type);if(!host)return;
      host.dataset.esType=section.type;host.dataset.esStyle=section.styleId||"default";host.style.setProperty("--es-order",String(section.order||0));
      const props=section.props||{},toneVar={heading:"--heading-color",body:"--body-color",ink:"--ink",muted:"--muted",accent:"--accent-text",gold:"--gold-text",paper:"--paper-contrast"};
      host.style.textAlign=["left","center","right"].includes(props.textAlign)?props.textAlign:"center";
      host.style.setProperty("--es-section-spacing",`${Math.max(12,Math.min(120,Number(props.spacing)||36))}px`);
      host.style.setProperty("--es-section-width",`${Math.max(40,Math.min(100,Number(props.width)||92))}%`);
      host.style.setProperty("--es-heading-size",String(Math.max(.75,Math.min(3,Number(props.headingSize)||1))));
      host.style.setProperty("--es-body-size",String(Math.max(.75,Math.min(2,Number(props.bodySize)||1))));
      host.style.setProperty("--es-heading-weight",String([400,500,600,700,800].includes(Number(props.headingWeight))?Number(props.headingWeight):700));
      host.style.setProperty("--es-body-weight",String([400,500,600,700].includes(Number(props.bodyWeight))?Number(props.bodyWeight):400));
      host.style.setProperty("--es-line-height",String(Math.max(1,Math.min(2.2,Number(props.lineHeight)||1.55))));
      host.style.setProperty("--es-letter-spacing",`${Math.max(-.05,Math.min(.2,Number(props.letterSpacing)||0))}em`);
      const directHeading=SAFE_HEX.test(String(props.headingColor||""))?String(props.headingColor):"";
      const directBody=SAFE_HEX.test(String(props.bodyColor||""))?String(props.bodyColor):"";
      host.style.setProperty("--es-heading-color",directHeading||`var(${toneVar[props.headingTone]||"--heading-color"})`);
      host.style.setProperty("--es-body-color",directBody||`var(${toneVar[props.bodyTone]||"--body-color"})`);
      host.dataset.esHeadingCase=["uppercase","lowercase","capitalize"].includes(props.headingCase)?props.headingCase:"inherit";
      host.dataset.esSurface=["transparent","accent-soft"].includes(props.surface)?props.surface:"paper";
    });
  }
  function assetHost(anchor){
    if(anchor==="hero")return document.getElementById("hero");
    if(anchor==="footer")return document.getElementById("eventStudioFooter");
    return hostFor(anchor);
  }
  function addAssets(recipe,manifest){
    const byId=new Map((manifest?.assets||[]).map(item=>[item.id,item]));
    for(const instance of recipe.assets||[]){
      const asset=byId.get(instance.assetId);const host=assetHost(instance.anchor);if(!asset||!host)continue;
      host.classList.add("es-asset-anchor");
      const node=document.createElement(asset.colorizable?"span":"img");node.className=`es-design-asset es-motion-${instance.motion||"none"}`;
      if(asset.colorizable){node.classList.add("is-colorizable");node.style.setProperty("--es-asset-url",`url("${String(asset.url||"").replace(/["\\]/g,"")}")`);}else{node.src=asset.url;node.alt="";node.loading="lazy";node.decoding="async";}
      node.setAttribute("aria-hidden","true");node.dataset.assetId=asset.id;node.style.left=`${instance.x}%`;node.style.top=`${instance.y}%`;node.style.setProperty("--es-scale",String(instance.scale||1));node.style.setProperty("--es-rotation",`${instance.rotation||0}deg`);node.style.setProperty("--es-asset-ratio",String(Number(asset.aspectRatio)||1));node.style.zIndex=String(instance.zIndex||1);node.style.opacity=String(instance.opacity??1);node.style.color=`var(${COLOR_VAR[instance.tone]||"--accent"})`;node.style.filter="var(--es-asset-filter, none)";host.appendChild(node);
    }
  }
  function styleHeroMedia(settings,recipe){
    const hero=document.getElementById("hero");if(!hero)return;
    const media=recipe?.design?.heroMedia||{},layout=["split-left","split-right"].includes(media.layout)?media.layout:"background";
    hero.classList.remove("es-hero-media-split","es-hero-media-split-left","es-hero-media-split-right");
    hero.dataset.esHeroMediaLayout=layout;
    const mobile=global.matchMedia?.("(max-width: 650px)")?.matches;
    const positionX=Math.max(0,Math.min(100,Number(mobile?(media.mobilePositionX??media.positionX??50):(media.desktopPositionX??media.positionX??50))));
    const positionY=Math.max(0,Math.min(100,Number(mobile?(media.mobilePositionY??media.positionY??50):(media.desktopPositionY??media.positionY??50))));
    const fit=(mobile?(media.mobileFit||media.fit):(media.desktopFit||media.fit))==="contain"?"contain":"cover";
    hero.style.backgroundSize=fit;
    hero.style.backgroundPosition=`${positionX}% ${positionY}%`;
    hero.style.backgroundRepeat="no-repeat";
    const enabled=media.enabled!==false;
    const hasMedia=Boolean(enabled&&settings?.media?.heroImage);
    hero.classList.toggle("es-hero-has-media",hasMedia);
    hero.classList.toggle("es-hero-no-media",!hasMedia);
    hero.querySelectorAll(".es-hero-media-panel").forEach(node=>node.remove());
    delete hero.dataset.esDeferredHeroPanelSrc;
    if(!hasMedia){
      hero.style.removeProperty("background-image");
      delete hero.dataset.esDeferredHeroImage;
      // Las Recipes prediseñadas nunca deben dejar «papel sobre papel» en una
      // portada sin fotografía. Los colores directos del usuario se respetan.
      const heroSection=(recipe?.sections||[]).find(item=>item.type==="hero"&&item.visible!==false);
      const props=heroSection?.props||{};
      if(!SAFE_HEX.test(String(props.headingColor||""))&&props.headingTone==="paper")hero.style.setProperty("--es-heading-color","var(--heading-color,var(--ink))");
      if(!SAFE_HEX.test(String(props.bodyColor||""))&&props.bodyTone==="paper")hero.style.setProperty("--es-body-color","var(--body-color,var(--muted))");
      return;
    }
    const url=String(settings.media.heroImage).replace(/["\\]/g,"");
    const overlay=Math.max(0,Math.min(.8,Number(media.overlay??.33)));
    const openingVisible=document.body.classList.contains("opening-visible")||!document.body.classList.contains("invitation-open")&&settings?.presentation?.openingStyle&&settings.presentation.openingStyle!=="none";
    if(layout==="background"){
      const safeOverlay=Math.max(.32,overlay);
      const background=`linear-gradient(rgba(0,0,0,${safeOverlay}),rgba(0,0,0,${safeOverlay})),url("${url}")`;
      if(openingVisible){hero.dataset.esDeferredHeroImage=background;hero.style.removeProperty("background-image");}
      else{hero.style.backgroundImage=background;delete hero.dataset.esDeferredHeroImage;}
      return;
    }
    hero.style.removeProperty("background-image");delete hero.dataset.esDeferredHeroImage;
    hero.classList.add("es-hero-media-split",`es-hero-media-${layout}`);
    hero.style.setProperty("--es-hero-media-overlay",String(overlay));
    const panel=document.createElement("div");panel.className="es-hero-media-panel";panel.setAttribute("aria-hidden","true");
    const img=document.createElement("img");img.alt="";img.decoding="async";img.loading=openingVisible?"lazy":"eager";img.style.objectFit=fit;img.style.objectPosition=`${positionX}% ${positionY}%`;
    if(openingVisible)hero.dataset.esDeferredHeroPanelSrc=url;else img.src=url;
    panel.appendChild(img);
    const overlayNode=hero.querySelector(".overlay");if(overlayNode?.nextSibling)hero.insertBefore(panel,overlayNode.nextSibling);else hero.prepend(panel);
  }
  function activateDeferredHeroMedia(){
    const hero=document.getElementById("hero");if(!hero)return;
    const background=hero.dataset?.esDeferredHeroImage;
    if(background){hero.style.backgroundImage=background;delete hero.dataset.esDeferredHeroImage;}
    const panelSrc=hero.dataset?.esDeferredHeroPanelSrc;
    if(panelSrc){const img=hero.querySelector(".es-hero-media-panel img");if(img&&!img.src)img.src=panelSrc;delete hero.dataset.esDeferredHeroPanelSrc;}
  }
  function styleMusic(recipe){
    const section=(recipe.sections||[]).find(item=>item.type==="music"&&item.visible!==false);
    for(const id of ["musicBtn","spotifyMusicBtn"]){
      const node=document.getElementById(id);if(!node)continue;
      if(!section){node.remove();continue;}
      node.classList.remove("es-recipe-hidden");node.dataset.esType="music";node.dataset.esStyle=section.styleId||"music-minimal-link";
    }
  }
  function configureQr(settings,recipe){
    const section=document.getElementById("designQrSection");if(!section)return;
    const present=recipe.sections?.some(item=>item.type==="qr");
    const allowed=settings?.features?.qrCards!==false;
    section.classList.toggle("hidden",!(present&&allowed));
    if(present&&allowed){
      const link=section.querySelector("a");if(link){link.href=location.href.split("?")[0];link.textContent=location.host||"Abrir invitación";}
    }
  }
  function apply(settings){
    const recipe=settings?._designRecipe;if(!recipe)return;
    removePrevious();palette(settings,recipe);typography(settings,recipe);
    const layout=String(recipe.design?.layoutFamily||"classic").replace(/[^a-z0-9-]/gi,"-");document.body.classList.add(`es-layout-${layout}`);document.body.dataset.designRecipe=recipe.id||"custom";
    document.body.dataset.layout=layout;document.body.dataset.designMotion=recipe.design?.motionPreset||"subtle";document.body.dataset.surfaceTexture=settings?._surfaceTexture||recipe.design?.texture||document.body.dataset.surfaceTexture||"none";
    styleSections(recipe);
    const galleryHost=hostFor("gallery");if(galleryHost)galleryHost.dataset.esPhoto=String(recipe.design?.photoPresentationId||"arch-clean").replace(/[^a-z0-9-]/gi,"-");
    document.body.dataset.designTimeline=String(recipe.design?.motionTimelineId||"").replace(/[^a-z0-9-]/gi,"-");
    styleHeroMedia(settings,recipe);addAssets(recipe,settings?._assetManifest||{assets:[]});styleMusic(recipe);configureQr(settings,recipe);
  }
  global.EventStudioDesignEngine={apply,activateDeferredHeroMedia};
})(window);
