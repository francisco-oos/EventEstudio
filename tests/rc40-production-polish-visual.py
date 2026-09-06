#!/usr/bin/env python3
"""RC40 visual QA: portada real, defer por apertura y scroll independiente."""
from __future__ import annotations
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BASE=(ROOT/'public/styles.css').read_text(encoding='utf-8')
CSS=(ROOT/'public/design-engine.css').read_text(encoding='utf-8')
ENGINE=(ROOT/'public/design-engine.js').read_text(encoding='utf-8')
LAB=(ROOT/'public/design-lab.css').read_text(encoding='utf-8')
OUT=ROOT/'docs/validation/evidence/RC40_PRODUCTION_POLISH_VISUAL.json'
results={'cases':{},'failures':[]}

def record(name, ok, details):
    results['cases'][name]={'pass':bool(ok),**details}
    if not ok: results['failures'].append(name)

# Data URI avoids any filesystem/network dependency and exercises the real browser image path.
IMAGE='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="900"%3E%3Crect width="800" height="900" fill="%235a745e"/%3E%3Ccircle cx="400" cy="360" r="210" fill="%23e9d9b9"/%3E%3C/svg%3E'

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for layout in ('split-left','split-right'):
        page=browser.new_page(viewport={'width':1366,'height':768})
        page.set_content(f'''<!doctype html><style>
        :root{{--bg:#193426;--paper:#f5eed9;--ink:#242321;--muted:#625e55;--accent:#9d7433;--line:#c7b48c;--paper-contrast:#242321;--heading-color:#242321;--body-color:#625e55;--accent-text:#6f4e18;--accent-contrast:#fff}}
        *{{box-sizing:border-box}}html,body{{margin:0}}{BASE}{CSS}</style>
        <body class="theme-recipe invitation-open"><main id="invitation"><header id="hero"><div class="overlay"></div><div class="hero-content"><p class="eyebrow">NUESTRA BODA</p><h1>Ariana y Francisco</h1><p>14 de diciembre de 2026</p></div></header></main><button id="musicBtn"></button><section id="designQrSection" class="hidden"><a></a></section></body>''')
        page.add_script_tag(content=ENGINE)
        settings={'media':{'heroImage':IMAGE},'_assetManifest':{'assets':[]},'_designRecipe':{'id':'rc40-hero','design':{'layoutFamily':'classic','heroMedia':{'enabled':True,'layout':layout,'fit':'cover','positionX':50,'positionY':50,'overlay':.12}},'sections':[{'type':'hero','visible':True,'order':0,'styleId':'hero-classic','props':{'headingTone':'heading','bodyTone':'body'}}]}}
        page.evaluate('(s)=>window.EventStudioDesignEngine.apply(s)',settings)
        metrics=page.evaluate('''()=>{const h=document.querySelector('#hero').getBoundingClientRect(),p=document.querySelector('.es-hero-media-panel').getBoundingClientRect(),c=document.querySelector('.hero-content').getBoundingClientRect(),img=document.querySelector('.es-hero-media-panel img');return {scrollWidth:document.documentElement.scrollWidth,innerWidth,left:p.left,right:p.right,contentLeft:c.left,contentRight:c.right,heroLeft:h.left,heroRight:h.right,imgSrc:img.getAttribute('src'),classes:document.querySelector('#hero').className}}''')
        if layout=='split-left': relation=metrics['right'] <= metrics['contentLeft']+2
        else: relation=metrics['contentRight'] <= metrics['left']+2
        ok=metrics['scrollWidth']<=1368 and relation and str(metrics['imgSrc'] or '').startswith('data:image/svg+xml') and f'es-hero-media-{layout}' in metrics['classes']
        record(f'heroDesktop-{layout}',ok,metrics)
        page.close()

    # On mobile split hero must stack instead of causing horizontal overflow.
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content(f'''<!doctype html><style>:root{{--bg:#193426;--paper:#f5eed9;--ink:#242321;--muted:#625e55;--accent:#9d7433;--line:#c7b48c;--paper-contrast:#242321;--heading-color:#242321;--body-color:#625e55;--accent-text:#6f4e18;--accent-contrast:#fff}}*{{box-sizing:border-box}}html,body{{margin:0}}{BASE}{CSS}</style><body class="theme-recipe invitation-open"><main id="invitation"><header id="hero"><div class="overlay"></div><div class="hero-content"><p class="eyebrow">NUESTRA BODA</p><h1>Ariana y Francisco</h1><p>14 de diciembre de 2026</p></div></header></main><button id="musicBtn"></button><section id="designQrSection" class="hidden"><a></a></section></body>''')
    page.add_script_tag(content=ENGINE)
    settings={'media':{'heroImage':IMAGE},'_assetManifest':{'assets':[]},'_designRecipe':{'id':'rc40-mobile','design':{'layoutFamily':'classic','heroMedia':{'enabled':True,'layout':'split-left','fit':'cover','positionX':50,'positionY':50,'overlay':.1}},'sections':[{'type':'hero','visible':True,'order':0,'styleId':'hero-classic','props':{'headingTone':'heading','bodyTone':'body'}}]}}
    page.evaluate('(s)=>window.EventStudioDesignEngine.apply(s)',settings)
    metrics=page.evaluate('''()=>{const p=document.querySelector('.es-hero-media-panel').getBoundingClientRect(),c=document.querySelector('.hero-content').getBoundingClientRect();return {innerWidth,scrollWidth:document.documentElement.scrollWidth,panel:{x:p.x,y:p.y,w:p.width,h:p.height},content:{x:c.x,y:c.y,w:c.width,h:c.height}}}''')
    ok=metrics['scrollWidth']<=392 and metrics['panel']['w']<=390.5 and metrics['content']['w']<=390.5 and metrics['content']['y']>=metrics['panel']['y']+metrics['panel']['h']-3
    record('heroMobileStack',ok,metrics)
    page.close()

    # When an opening is visible, image decode is deferred until invitation opens.
    page=browser.new_page(viewport={'width':900,'height':700})
    page.set_content(f'''<!doctype html><style>:root{{--bg:#193426;--paper:#f5eed9;--ink:#242321;--muted:#625e55;--accent:#9d7433;--line:#c7b48c;--paper-contrast:#242321;--heading-color:#242321;--body-color:#625e55}}{BASE}{CSS}</style><body class="theme-recipe opening-visible"><main id="invitation"><header id="hero"><div class="overlay"></div><div class="hero-content"><h1>Ariana y Francisco</h1></div></header></main><button id="musicBtn"></button><section id="designQrSection" class="hidden"><a></a></section></body>''')
    page.add_script_tag(content=ENGINE)
    settings={'media':{'heroImage':IMAGE},'presentation':{'openingStyle':'unified-envelope'},'_assetManifest':{'assets':[]},'_designRecipe':{'id':'rc40-defer','design':{'layoutFamily':'classic','heroMedia':{'enabled':True,'layout':'split-left'}},'sections':[{'type':'hero','visible':True,'order':0,'styleId':'hero-classic','props':{}}]}}
    page.evaluate('(s)=>window.EventStudioDesignEngine.apply(s)',settings)
    before=page.evaluate('''()=>({attr:document.querySelector('.es-hero-media-panel img').getAttribute('src'),deferred:document.querySelector('#hero').dataset.esDeferredHeroPanelSrc||''})''')
    page.evaluate('()=>window.EventStudioDesignEngine.activateDeferredHeroMedia()')
    after=page.evaluate('''()=>({attr:document.querySelector('.es-hero-media-panel img').getAttribute('src'),deferred:document.querySelector('#hero').dataset.esDeferredHeroPanelSrc||''})''')
    ok=(before['attr'] in (None,'')) and str(before['deferred']).startswith('data:image/svg+xml') and str(after['attr'] or '').startswith('data:image/svg+xml') and not after['deferred']
    record('heroDeferredUntilOpening',ok,{'before':before,'after':after})
    page.close()

    # Three desktop areas keep their own scroll position.
    page=browser.new_page(viewport={'width':1366,'height':768})
    filler=''.join('<div style="height:120px">fila</div>' for _ in range(12))
    page.set_content(f'''<!doctype html><style>{LAB}</style><body><div class="lab-topbar"><strong>Studio</strong></div><div class="lab-shell"><nav class="lab-nav"></nav><aside class="lab-panel" id="left">{filler}</aside><div class="lab-stage-wrap"><div class="lab-stage-toolbar"></div><main class="lab-stage" id="stage"><div style="height:2200px;width:390px;background:#eee"></div></main></div><aside class="lab-inspector" id="right">{filler}</aside></div></body>''')
    page.locator('#left').evaluate('(e)=>e.scrollTop=400')
    page.locator('#right').evaluate('(e)=>e.scrollTop=250')
    page.locator('#stage').evaluate('(e)=>e.scrollTop=700')
    vals=page.evaluate('''()=>({body:document.scrollingElement.scrollTop,left:document.querySelector('#left').scrollTop,right:document.querySelector('#right').scrollTop,stage:document.querySelector('#stage').scrollTop,bodyOverflow:getComputedStyle(document.body).overflow})''')
    ok=vals['body']==0 and vals['left']>=390 and vals['right']>=240 and vals['stage']>=690 and vals['bodyOverflow']=='hidden'
    record('independentDesktopScroll',ok,vals)
    page.close()
    browser.close()

results['pass']=not results['failures']
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
if results['failures']: raise SystemExit(1)
print('✓ RC40 visual: portada izquierda/derecha, móvil, defer y scroll independiente verificados.')
