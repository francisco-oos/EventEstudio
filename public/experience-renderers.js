/* EventStudio Experience Renderers
   Motores locales, sin código ejecutable procedente de la base de datos. */
(()=>{
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const validMotion=new Set(['still','subtle','balanced','dynamic']);
  const hexRgb=value=>{const match=/^#([0-9a-f]{6})$/i.exec(String(value||''));if(!match)return null;const n=parseInt(match[1],16);return [(n>>16)&255,(n>>8)&255,n&255];};
  const mixHex=(a,b,t)=>{const ar=hexRgb(a),br=hexRgb(b);if(!ar||!br)return a;const c=ar.map((v,i)=>Math.round(v+(br[i]-v)*clamp(t,0,1)));return `#${c.map(v=>v.toString(16).padStart(2,'0')).join('')}`;};
  const motionProfile=level=>({
    still:{animate:false,particleScale:0,durationScale:0},
    /* El nivel cambia riqueza/intensidad, no debe acelerar una escena hasta
       volverla imperceptible en equipos rápidos. */
    subtle:{animate:true,particleScale:.62,durationScale:1.2},
    balanced:{animate:true,particleScale:1,durationScale:1.08},
    dynamic:{animate:true,particleScale:1.16,durationScale:.98}
  })[validMotion.has(level)?level:'balanced'];
  const prefersReducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const saveDataRequested=()=>navigator.connection?.saveData===true;
  const heartPoint=t=>({x:16*Math.sin(t)**3/18,y:-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/18});

  class MotionRuntime{
    constructor({motionLevel='balanced',forceMotion=false}={}){
      this.motionLevel=validMotion.has(motionLevel)?motionLevel:'balanced';
      this.forceMotion=Boolean(forceMotion);
      /* Una vista previa forzada debe ser realmente visible. Si la invitación
         está guardada en "still", usamos la cadencia balanced sólo durante
         esa previsualización; la visita pública conserva el estado estático. */
      this.profile=motionProfile(this.forceMotion&&this.motionLevel==='still'?'balanced':this.motionLevel);
      this.reduceMotion=!this.forceMotion&&prefersReducedMotion();
      this.saveData=saveDataRequested();
    }
    get animated(){return this.forceMotion||(this.profile.animate&&!this.reduceMotion);}
    duration(ms){return this.animated?Math.max(1,Math.round(ms*this.profile.durationScale)):0;}
    particleCount(base,min=90,max=520){
      if(!this.animated)return 0;
      const dataScale=this.saveData?.7:1;
      return clamp(Math.round(base*this.profile.particleScale*dataScale),min,max);
    }
    dpr(){return clamp(window.devicePixelRatio||1,1,this.saveData?1.5:2);}
  }

  class ParticleTraceScene{
    constructor(canvas,{preset='heart',forceMotion=false,motionLevel='balanced'}={}){
      this.canvas=canvas;this.ctx=canvas?.getContext?.('2d')||null;this.preset=preset;
      this.runtime=new MotionRuntime({forceMotion,motionLevel});
      this.frame=0;this.startedAt=0;this.pausedAt=0;this.width=0;this.height=0;this.dpr=1;this.particles=[];this.cachedPalette=null;this.drawing=null;this.active=false;
      this.resize=this.resize.bind(this);this.tick=this.tick.bind(this);this.visibility=this.visibility.bind(this);
    }
    pathPoint(t){return heartPoint(t);}
    palette(){const styles=getComputedStyle(document.body);return {accent:styles.getPropertyValue('--accent').trim()||'#9e4058',gold:styles.getPropertyValue('--gold').trim()||'#d8ad61'};}
    measureDrawingFrame(){
      const fallback={centerX:this.width*.5,centerY:this.height*(this.width<620?.55:.52),spread:Math.min(this.width*.36,this.height*.28)};
      const host=this.canvas?.closest?.('.invitation-opening'),copy=host?.querySelector?.('.opening-copy'),action=host?.querySelector?.('.opening-envelope-button');
      if(!host||!copy||!action)return fallback;
      const canvasRect=this.canvas.getBoundingClientRect(),copyRect=copy.getBoundingClientRect(),actionRect=action.getBoundingClientRect();
      const safeTop=Math.max(0,copyRect.bottom-canvasRect.top+18),safeBottom=Math.min(this.height,actionRect.top-canvasRect.top-18);
      const safeHeight=safeBottom-safeTop;
      if(safeHeight<180)return fallback;
      return {centerX:this.width*.5,centerY:(safeTop+safeBottom)/2,spread:Math.min(this.width*.43,safeHeight*.68)};
    }
    resize(){
      if(!this.canvas||!this.ctx)return;
      const rect=this.canvas.getBoundingClientRect();
      this.dpr=this.runtime.dpr();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);
      const targetWidth=Math.round(this.width*this.dpr),targetHeight=Math.round(this.height*this.dpr);
      if(this.canvas.width!==targetWidth||this.canvas.height!==targetHeight){this.canvas.width=targetWidth;this.canvas.height=targetHeight;}
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.cachedPalette=this.palette();this.drawing=this.measureDrawingFrame();this.buildParticles();
      if(!this.runtime.animated)this.drawStatic();
    }
    buildParticles(){
      const base=Math.round((this.width*this.height)/3600);
      const count=this.runtime.particleCount(base,110,520);
      const frame=this.drawing||this.measureDrawingFrame(),spread=frame.spread,center={x:frame.centerX,y:frame.centerY};
      this.particles=Array.from({length:count},(_,index)=>{const t=(index/Math.max(1,count))*Math.PI*2,p=this.pathPoint(t);return {t,x:center.x+(Math.random()-.5)*this.width*.86,y:center.y+(Math.random()-.5)*this.height*.76,tx:center.x+p.x*spread*.68,ty:center.y+p.y*spread*.68,size:.8+Math.random()*2.2,phase:Math.random()*Math.PI*2};});
    }
    start(){
      if(!this.ctx||this.active)return;this.active=true;this.canvas.hidden=false;
      window.addEventListener('resize',this.resize,{passive:true});document.addEventListener('visibilitychange',this.visibility);this.resize();
      if(!this.runtime.animated)return;
      this.startedAt=performance.now();this.frame=requestAnimationFrame(this.tick);
    }
    visibility(){
      if(!this.active||!this.runtime.animated)return;
      if(document.visibilityState==='hidden'){if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.pausedAt=performance.now();return;}
      if(!this.frame){if(this.pausedAt)this.startedAt+=performance.now()-this.pausedAt;this.pausedAt=0;this.frame=requestAnimationFrame(this.tick);}
    }
    tick(now){
      if(!this.ctx||!this.active||document.visibilityState==='hidden'){this.frame=0;return;}
      const elapsed=(now-this.startedAt)/1000,progress=clamp(elapsed/(2.7*this.runtime.profile.durationScale),0,1),eased=1-(1-progress)**3,{accent,gold}=this.cachedPalette||this.palette();
      this.ctx.clearRect(0,0,this.width,this.height);this.ctx.save();this.ctx.globalCompositeOperation='lighter';
      this.particles.forEach((particle,index)=>{const wobble=(1-eased)*Math.sin(elapsed*2+particle.phase)*8,x=particle.x+(particle.tx-particle.x)*eased+wobble,y=particle.y+(particle.ty-particle.y)*eased+wobble*.35;this.ctx.globalAlpha=.12+.72*eased;this.ctx.fillStyle=index%5===0?gold:accent;this.ctx.beginPath();this.ctx.arc(x,y,particle.size*(.75+.3*eased),0,Math.PI*2);this.ctx.fill();});
      const tracerT=(elapsed*.42)%(Math.PI*2),point=this.pathPoint(tracerT),frame=this.drawing||this.measureDrawingFrame(),spread=frame.spread,tx=frame.centerX+point.x*spread*.68,ty=frame.centerY+point.y*spread*.68;
      const glow=this.ctx.createRadialGradient(tx,ty,0,tx,ty,34);glow.addColorStop(0,'rgba(255,255,255,.95)');glow.addColorStop(.22,gold);glow.addColorStop(1,'rgba(255,255,255,0)');this.ctx.globalAlpha=.9;this.ctx.fillStyle=glow;this.ctx.beginPath();this.ctx.arc(tx,ty,34,0,Math.PI*2);this.ctx.fill();this.ctx.restore();
      this.frame=requestAnimationFrame(this.tick);
    }
    drawStatic(){
      if(!this.ctx)return;const {accent,gold}=this.cachedPalette||this.palette();this.ctx.clearRect(0,0,this.width,this.height);const frame=this.drawing||this.measureDrawingFrame(),spread=frame.spread;this.ctx.save();this.ctx.lineWidth=2.2;this.ctx.strokeStyle=accent;this.ctx.globalAlpha=.72;this.ctx.beginPath();
      for(let index=0;index<=180;index++){const p=this.pathPoint(index/180*Math.PI*2),x=frame.centerX+p.x*spread*.68,y=frame.centerY+p.y*spread*.68;if(index===0)this.ctx.moveTo(x,y);else this.ctx.lineTo(x,y);}this.ctx.stroke();const center=this.pathPoint(Math.PI*.05);this.ctx.fillStyle=gold;this.ctx.globalAlpha=.8;this.ctx.beginPath();this.ctx.arc(frame.centerX+center.x*spread*.68,frame.centerY+center.y*spread*.68,4,0,Math.PI*2);this.ctx.fill();this.ctx.restore();
    }
    destroy(){this.active=false;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;window.removeEventListener('resize',this.resize);document.removeEventListener('visibilitychange',this.visibility);if(this.ctx)this.ctx.clearRect(0,0,this.width,this.height);if(this.canvas)this.canvas.hidden=true;}
  }

  class BloomSceneBase{
    constructor(host,{forceMotion=false,motionLevel='balanced'}={}){this.host=host;this.root=null;this.timers=[];this.runtime=new MotionRuntime({forceMotion,motionLevel});this.started=false;}
    later(fn,ms){if(!this.runtime.animated){fn();return 0;}const id=setTimeout(fn,this.runtime.duration(ms));this.timers.push(id);return id;}
    nextPaint(fn){if(!this.runtime.animated){fn();return;}requestAnimationFrame(()=>requestAnimationFrame(()=>this.root&&fn()));}
    destroy(){this.timers.forEach(clearTimeout);this.timers=[];this.root?.remove();this.root=null;this.started=false;}
  }

  class RoseBloomScene extends BloomSceneBase{
    constructor(host,{petalColor='',forceMotion=false,motionLevel='balanced'}={}){super(host,{forceMotion,motionLevel});this.petalColor=String(petalColor||'').trim();}
    start({autoplay=true}={}){
      if(!this.host)return;this.destroy();const root=document.createElement('div');root.className='rose-bloom-scene';root.setAttribute('aria-hidden','true');root.innerHTML='<div class="rose-ambient"></div><div class="rose-stage"><div class="rose-plant"><div class="rose-stem"><i></i></div><span class="rose-leaf left"></span><span class="rose-leaf right"></span><div class="rose-calyx"></div><div class="rose-head"><div class="rose-inner-glow"></div></div></div></div><div class="rose-falling-petals"></div>';this.host.prepend(root);this.root=root;if(this.runtime.forceMotion)root.classList.add('force-motion');
      if(/^#[0-9a-f]{6}$/i.test(this.petalColor)){const base=this.petalColor;root.style.setProperty('--rose-petal-light',mixHex(base,'#ffffff',.12));root.style.setProperty('--rose-petal-mid',mixHex(base,'#000000',.28));root.style.setProperty('--rose-petal-dark',mixHex(base,'#000000',.58));root.style.setProperty('--rose-petal-deep',mixHex(base,'#000000',.84));root.style.setProperty('--rose-petal-glow',mixHex(base,'#ffffff',.32));}
      const head=root.querySelector('.rose-head'),calyx=root.querySelector('.rose-calyx'),layers=[[4,24,46,78,0],[5,34,58,65,.20],[6,46,72,48,.45],[7,58,88,22,.72],[8,72,104,-5,1.02],[9,86,118,-25,1.35],[10,98,130,-48,1.72]];
      for(let l=0;l<layers.length;l++){const [count,w,h,curl,base]=layers[l];for(let i=0;i<count;i++){const p=document.createElement('span');p.className=`rose-petal layer-${l}`;p.style.cssText=`--angle:${(l*23+i*360/count+(Math.random()-.5)*5).toFixed(2)}deg;--curl:${(curl+(Math.random()-.5)*6).toFixed(2)}deg;--delay:${(base+i*.045).toFixed(2)}s;--tz:${l*11}px;--petal-w:${w}px;--petal-h:${h}px;--scale:${(.94+Math.random()*.12).toFixed(2)}`;head.appendChild(p);}}
      for(let i=0;i<5;i++){const sepal=document.createElement('span');sepal.className='rose-sepal';sepal.style.cssText=`--sepal-angle:${i*72}deg;--sepal-delay:${(.25+i*.06).toFixed(2)}s`;calyx.appendChild(sepal);}
      if(!this.runtime.animated){root.classList.add('growing','leaves-visible','bloomed');this.started=true;return;}if(autoplay)this.bloom();
    }
    bloom(){if(!this.root||this.started)return;this.started=true;this.nextPaint(()=>this.root?.classList.add('growing'));this.later(()=>this.root?.classList.add('leaves-visible'),760);this.later(()=>this.root?.classList.add('bloomed'),2050);this.later(()=>this.startFalling(),4100);}
    startFalling(){if(!this.root||!this.runtime.animated)return;const container=this.root.querySelector('.rose-falling-petals'),endAt=performance.now()+Math.min(16000,this.runtime.duration(16000));const spawn=()=>{if(!container||container.children.length>9||performance.now()>endAt)return;const p=document.createElement('i');p.className='rose-falling-petal';p.style.cssText=`--x:${20+Math.random()*60}vw;--drift:${-70+Math.random()*140}px;--dur:${5+Math.random()*3}s;--delay:${Math.random()*.3}s;--size:${10+Math.random()*10}px`;container.appendChild(p);this.later(()=>p.remove(),9000);};for(let i=0;i<3;i++)this.later(spawn,i*260);const loop=()=>{if(!this.root||performance.now()>endAt)return;spawn();this.later(loop,1900);};this.later(loop,1900);}
  }

  class DaisyBloomScene extends BloomSceneBase{
    constructor(host,{petalColor='#f7f3de',centerColor='#d8ad61',forceMotion=false,motionLevel='balanced'}={}){super(host,{forceMotion,motionLevel});this.petalColor=/^#[0-9a-f]{6}$/i.test(petalColor)?petalColor:'#f7f3de';this.centerColor=/^#[0-9a-f]{6}$/i.test(centerColor)?centerColor:'#d8ad61';}
    start({autoplay=true}={}){
      if(!this.host)return;this.destroy();const root=document.createElement('div');root.className='daisy-bloom-scene';root.setAttribute('aria-hidden','true');root.style.setProperty('--daisy-petal',this.petalColor);root.style.setProperty('--daisy-center',this.centerColor);root.innerHTML='<div class="daisy-halo"></div><div class="daisy-plant"><div class="daisy-stem"></div><span class="daisy-leaf left"></span><span class="daisy-leaf right"></span><div class="daisy-head"><div class="daisy-petals"></div><div class="daisy-center"></div></div></div>';this.host.prepend(root);this.root=root;if(this.runtime.forceMotion)root.classList.add('force-motion');
      const petals=root.querySelector('.daisy-petals');for(let i=0;i<16;i++){const p=document.createElement('i');p.style.setProperty('--angle',`${i*22.5}deg`);p.style.setProperty('--delay',`${(.14+i*.045).toFixed(2)}s`);petals.appendChild(p);}
      if(!this.runtime.animated){root.classList.add('growing','bloomed');this.started=true;return;}if(autoplay)this.bloom();
    }
    bloom(){if(!this.root||this.started)return;this.started=true;this.nextPaint(()=>this.root?.classList.add('growing'));this.later(()=>this.root?.classList.add('bloomed'),1050);}
  }

  /* Adaptación propia de la referencia "Animated Flower" entregada por el
     propietario. El renderer conserva el contrato start/bloom/destroy y no
     incrusta HTML, scripts ni estilos ejecutables externos. */
  class LuminousGardenScene extends BloomSceneBase{
    constructor(host,{petalColor='#8fe8de',centerColor='#f6d85d',forceMotion=false,motionLevel='balanced'}={}){
      super(host,{forceMotion,motionLevel});
      this.petalColor=/^#[0-9a-f]{6}$/i.test(petalColor)?petalColor:'#8fe8de';
      this.centerColor=/^#[0-9a-f]{6}$/i.test(centerColor)?centerColor:'#f6d85d';
    }
    start({autoplay=true}={}){
      if(!this.host)return;
      this.destroy();
      const root=document.createElement('div');
      root.className='luminous-garden-scene';
      root.setAttribute('aria-hidden','true');
      root.style.setProperty('--garden-petal',this.petalColor);
      root.style.setProperty('--garden-center',this.centerColor);
      root.innerHTML='<div class="garden-night"></div><div class="garden-stars"></div><div class="garden-flowers"></div><div class="garden-lights"></div>';
      this.host.prepend(root);this.root=root;
      if(this.runtime.forceMotion)root.classList.add('force-motion');
      const flowers=root.querySelector('.garden-flowers');
      const layouts=[
        {x:50,scale:1,lean:0,delay:0,petals:14},
        {x:31,scale:.74,lean:-13,delay:.28,petals:12},
        {x:69,scale:.8,lean:14,delay:.52,petals:12}
      ];
      layouts.forEach((layout,index)=>{
        const flower=document.createElement('div');
        flower.className=`garden-flower garden-flower-${index+1}`;
        flower.style.cssText=`--garden-x:${layout.x}%;--garden-scale:${layout.scale};--garden-lean:${layout.lean}deg;--garden-delay:${layout.delay}s`;
        flower.innerHTML='<div class="garden-stem"><i class="garden-leaf left"></i><i class="garden-leaf right"></i></div><div class="garden-head"><div class="garden-petals"></div><b class="garden-center"></b></div>';
        const petals=flower.querySelector('.garden-petals');
        for(let petalIndex=0;petalIndex<layout.petals;petalIndex++){
          const petal=document.createElement('i');
          petal.style.cssText=`--garden-angle:${petalIndex*360/layout.petals}deg;--petal-delay:${(layout.delay+.52+petalIndex*.035).toFixed(3)}s`;
          petals.appendChild(petal);
        }
        flowers.appendChild(flower);
      });
      const stars=root.querySelector('.garden-stars');
      for(let index=0;index<18;index++){
        const star=document.createElement('i');
        star.style.cssText=`--star-x:${7+(index*37)%88}%;--star-y:${6+(index*23)%62}%;--star-delay:${(index%6)*.22}s;--star-size:${2+(index%3)}px`;
        stars.appendChild(star);
      }
      const lights=root.querySelector('.garden-lights');
      for(let index=0;index<12;index++){
        const light=document.createElement('i');
        light.style.cssText=`--light-x:${12+(index*29)%76}%;--light-delay:${(index%5)*.3}s;--light-drift:${-32+(index*17)%64}px`;
        lights.appendChild(light);
      }
      if(!this.runtime.animated){root.classList.add('growing','bloomed','lights-visible');this.started=true;return;}
      if(autoplay)this.bloom();
    }
    bloom(){
      if(!this.root||this.started)return;
      this.started=true;
      this.nextPaint(()=>this.root?.classList.add('growing'));
      this.later(()=>this.root?.classList.add('bloomed'),1450);
      this.later(()=>this.root?.classList.add('lights-visible'),2450);
    }
  }

  /* Reinterpretación local de la composición visual original entregada: tres
     flores de cuatro pétalos, pradera y luces ascendentes. No ejecuta ni copia
     el HTML/CSS externo y conserva los controles de color y movimiento. */
  class OriginalNightFlowerScene extends BloomSceneBase{
    constructor(host,{petalColor='#5de6db',centerColor='#f4f7df',forceMotion=false,motionLevel='balanced'}={}){
      super(host,{forceMotion,motionLevel});
      this.petalColor=/^#[0-9a-f]{6}$/i.test(petalColor)?petalColor:'#5de6db';
      this.centerColor=/^#[0-9a-f]{6}$/i.test(centerColor)?centerColor:'#f4f7df';
    }
    start({autoplay=true}={}){
      if(!this.host)return;
      this.destroy();
      const root=document.createElement('div');
      root.className='original-night-flower-scene';root.setAttribute('aria-hidden','true');
      root.style.setProperty('--original-petal',this.petalColor);root.style.setProperty('--original-center',this.centerColor);
      root.innerHTML='<div class="original-night-sky"></div><div class="original-meadow"></div><div class="original-flower-field"></div><div class="original-fireflies"></div>';
      this.host.prepend(root);this.root=root;if(this.runtime.forceMotion)root.classList.add('force-motion');
      const field=root.querySelector('.original-flower-field');
      [
        {x:50,scale:1,lean:0,delay:0},
        {x:35,scale:.78,lean:-11,delay:.32},
        {x:66,scale:.84,lean:12,delay:.56}
      ].forEach((layout,index)=>{
        const flower=document.createElement('div');flower.className=`original-flower original-flower-${index+1}`;
        flower.style.cssText=`--original-x:${layout.x}%;--original-scale:${layout.scale};--original-lean:${layout.lean}deg;--original-delay:${layout.delay}s`;
        flower.innerHTML='<div class="original-stem"><i class="original-leaf left"></i><i class="original-leaf right"></i></div><div class="original-flower-head"><div class="original-petals"></div><b class="original-flower-center"></b></div>';
        const petals=flower.querySelector('.original-petals');
        for(let petalIndex=0;petalIndex<4;petalIndex++){
          const petal=document.createElement('i');petal.style.cssText=`--original-angle:${petalIndex*90}deg;--original-petal-delay:${(layout.delay+.76+petalIndex*.12).toFixed(2)}s`;petals.appendChild(petal);
        }
        field.appendChild(flower);
      });
      const meadow=root.querySelector('.original-meadow');
      for(let index=0;index<22;index++){
        const blade=document.createElement('i');blade.style.cssText=`--blade-x:${3+(index*17)%94}%;--blade-height:${42+(index*23)%112}px;--blade-lean:${-18+(index*13)%36}deg;--blade-delay:${(index%7)*.08}s`;meadow.appendChild(blade);
      }
      const fireflies=root.querySelector('.original-fireflies');
      for(let index=0;index<14;index++){
        const light=document.createElement('i');light.style.cssText=`--firefly-x:${8+(index*31)%84}%;--firefly-delay:${(index%7)*.28}s;--firefly-drift:${-34+(index*19)%68}px`;fireflies.appendChild(light);
      }
      if(!this.runtime.animated){root.classList.add('growing','meadow-visible','bloomed','lights-visible');this.started=true;return;}
      if(autoplay)this.bloom();
    }
    bloom(){
      if(!this.root||this.started)return;this.started=true;
      this.nextPaint(()=>this.root?.classList.add('growing'));
      this.later(()=>this.root?.classList.add('meadow-visible'),620);
      this.later(()=>this.root?.classList.add('bloomed'),1750);
      this.later(()=>this.root?.classList.add('lights-visible'),2850);
    }
  }

  window.EventStudioExperiences=Object.freeze({MotionRuntime,ParticleTraceScene,RoseBloomScene,DaisyBloomScene,LuminousGardenScene,OriginalNightFlowerScene});
})();
