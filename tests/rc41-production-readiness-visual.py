#!/usr/bin/env python3
"""RC41 visual QA sin servidor: asset público visible + portada móvil/escritorio + dataset real recuperable."""
from __future__ import annotations
import json, re, sqlite3, urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=(ROOT/'public/styles.css').read_text(encoding='utf-8')
CSS=(ROOT/'public/design-engine.css').read_text(encoding='utf-8')
ENGINE=(ROOT/'public/design-engine.js').read_text(encoding='utf-8')
OUT=ROOT/'docs/validation/evidence/RC41_PRODUCTION_READINESS_VISUAL.json'
results={'cases':{},'failures':[]}
def record(name,ok,details):
    results['cases'][name]={'pass':bool(ok),**details}
    if not ok: results['failures'].append(name)

# Confirma el caso concreto que motivó la reconciliación: la BD apunta a un JPG
# faltante, pero el ZIP contiene un único JPG con el mismo nombre original.
try:
    con=sqlite3.connect(ROOT/'data/wedding.db')
    row=con.execute('select settings_json from events where id=2').fetchone(); con.close()
    st=json.loads(row[0]) if row else {}
    hero=str(st.get('media',{}).get('heroImage',''))
    base=urllib.parse.unquote(Path(hero).name)
    m=re.match(r'^\d{10,}-[0-9a-f]{6,}-(.+)$',base,re.I)
    original=m.group(1) if m else ''
    folder=ROOT/'uploads/site-media'
    candidates=[]
    if original and folder.exists():
        for f in folder.iterdir():
            mm=re.match(r'^\d{10,}-[0-9a-f]{6,}-(.+)$',f.name,re.I)
            if f.is_file() and mm and mm.group(1).lower()==original.lower(): candidates.append(f.name)
    exact=(ROOT/hero.lstrip('/')).exists() if hero.startswith('/uploads/') else False
    record('heroDatasetRecoverable',bool(hero and not exact and len(candidates)==1),{'hero':hero,'exactExists':exact,'original':original,'candidates':candidates})
except Exception as exc:
    record('heroDatasetRecoverable',False,{'error':str(exc)})

IMG='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="900"%3E%3Crect width="800" height="900" fill="%235a745e"/%3E%3Ccircle cx="400" cy="360" r="210" fill="%23e9d9b9"/%3E%3C/svg%3E'
ASSET='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 100"%3E%3Crect width="800" height="100" fill="black"/%3E%3C/svg%3E'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    # Asset colorizable en countdown: antes tenía altura 0 en público.
    page=browser.new_page(viewport={'width':1000,'height':800})
    page.set_content(f'''<!doctype html><style>:root{{--bg:#f5f0e8;--paper:#fffaf3;--ink:#2d2924;--muted:#625e55;--accent:#7b4b56;--gold:#a98034;--line:#c9b68a;--heading-color:#2d2924;--body-color:#625e55;--paper-contrast:#2d2924}}*{{box-sizing:border-box}}html,body{{margin:0}}{BASE}{CSS}</style><body class="theme-recipe invitation-open"><main id="invitation"><header id="hero"><div class="hero-content"><h1>Ariana y Francisco</h1></div></header><section id="countdownSection" style="position:relative;min-height:300px"><p id="countdownEyebrow">Faltan</p></section></main><button id="musicBtn"></button><section id="designQrSection" class="hidden"><a></a></section></body>''')
    page.add_script_tag(content=ENGINE)
    settings={'media':{},'_assetManifest':{'assets':[{'id':'asset-test','url':ASSET,'colorizable':True,'aspectRatio':8}]},'_designRecipe':{'id':'rc41-asset','design':{'layoutFamily':'classic','heroMedia':{'enabled':False}},'sections':[{'type':'hero','visible':True,'order':0,'styleId':'hero-classic','props':{}},{'type':'countdown','visible':True,'order':1,'styleId':'countdown-default','props':{}}],'assets':[{'uid':'a1','assetId':'asset-test','anchor':'countdown','x':50,'y':50,'scale':1,'rotation':0,'zIndex':2,'opacity':1,'tone':'accent','motion':'none'}]}}
    page.evaluate('(s)=>window.EventStudioDesignEngine.apply(s)',settings)
    met=page.evaluate('''()=>{const n=document.querySelector('.es-design-asset'),r=n.getBoundingClientRect(),h=document.querySelector('#countdownSection').getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,hostW:h.width,hostH:h.height,ratio:getComputedStyle(n).aspectRatio,scrollWidth:document.documentElement.scrollWidth,innerWidth};}''')
    record('publicAssetHasBox',met['w']>40 and met['h']>5 and met['scrollWidth']<=met['innerWidth']+2,met)
    page.close()

    # Portada usa encuadre independiente por viewport.
    for name,width,expected in [('mobile',390,'18% 27%'),('desktop',1366,'82% 73%')]:
        page=browser.new_page(viewport={'width':width,'height':844 if width<650 else 768})
        page.set_content(f'''<!doctype html><style>:root{{--bg:#193426;--paper:#f5eed9;--ink:#242321;--muted:#625e55;--accent:#9d7433;--line:#c7b48c;--paper-contrast:#242321;--heading-color:#242321;--body-color:#625e55}}*{{box-sizing:border-box}}html,body{{margin:0}}{BASE}{CSS}</style><body class="theme-recipe invitation-open"><main id="invitation"><header id="hero"><div class="hero-content"><h1>Ariana y Francisco</h1></div></header></main><button id="musicBtn"></button><section id="designQrSection" class="hidden"><a></a></section></body>''')
        page.add_script_tag(content=ENGINE)
        st={'media':{'heroImage':IMG},'_assetManifest':{'assets':[]},'_designRecipe':{'id':'rc41-hero','design':{'layoutFamily':'classic','heroMedia':{'enabled':True,'layout':'split-left','fit':'cover','mobilePositionX':18,'mobilePositionY':27,'desktopPositionX':82,'desktopPositionY':73,'mobileFit':'contain','desktopFit':'cover','overlay':.1}},'sections':[{'type':'hero','visible':True,'order':0,'styleId':'hero-classic','props':{}}]}}
        page.evaluate('(s)=>window.EventStudioDesignEngine.apply(s)',st)
        met=page.evaluate('''()=>{const img=document.querySelector('.es-hero-media-panel img');return {objectPosition:img.style.objectPosition,objectFit:img.style.objectFit,scrollWidth:document.documentElement.scrollWidth,innerWidth};}''')
        good=met['objectPosition']==expected and met['objectFit']==('contain' if name=='mobile' else 'cover') and met['scrollWidth']<=met['innerWidth']+2
        record(f'heroDevice-{name}',good,met)
        page.close()
    browser.close()
results['pass']=not results['failures']
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
if results['failures']: raise SystemExit(1)
print('✓ RC41 visual: asset público visible y encuadre de portada móvil/escritorio verificados.')
