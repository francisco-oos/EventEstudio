#!/usr/bin/env python3
"""Valida desmontaje DOM y layout de combinaciones complejas de servicios."""
from __future__ import annotations
import importlib.util, json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('rc32_recipe',ROOT/'tests'/'rc32-recipe-visual.py')
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
COMPONENTS=json.loads((ROOT/'config'/'design'/'components.json').read_text(encoding='utf-8'))['components']
BY_TYPE={c['type']:c for c in COMPONENTS}
SOURCE=next(r for r in mod.RECIPES if r['id']=='romantic-wine')
OPTIONAL=['locations','program','gallery','dressCode','rsvp','gifts','qrCards','music']
HOSTS={'venues':'venuesSection','agenda':'agendaSection','gallery':'gallerySection','dress-code':'dressSection','rsvp':'rsvpSection','gifts':'giftSection','qr':'designQrSection'}
PATTERNS=[0,(1<<len(OPTIONAL))-1]
PATTERNS += [1<<i for i in range(len(OPTIONAL))]
PATTERNS += [0b01010101,0b10101010,0b00111100,0b11000011,0b01100110,0b10011001]
PATTERNS=sorted(set(PATTERNS))


def projected_recipe(mask):
    recipe=json.loads(json.dumps(SOURCE)); features={'invitation':True}
    for i,name in enumerate(OPTIONAL): features[name]=bool(mask&(1<<i))
    recipe['sections']=[s for s in recipe['sections'] if features.get(BY_TYPE.get(s['type'],{}).get('requiredFeature'),True)]
    anchors={'hero','footer',*(s['type'] for s in recipe['sections'])}
    recipe['assets']=[a for a in recipe.get('assets',[]) if a.get('anchor') in anchors]
    return recipe,features


def html_for(mask):
    recipe,features=projected_recipe(mask); cfg=mod.config_for(recipe); cfg['features'].update(features); cfg['_designRecipe']=recipe
    payload=json.dumps(cfg,ensure_ascii=False).replace('</','<\\/')
    prelude=f"""<script>window.fetch=async()=>new Response(JSON.stringify({payload}),{{status:200,headers:{{'Content-Type':'application/json'}}}});Object.defineProperty(HTMLMediaElement.prototype,'paused',{{configurable:true,get:function(){{return !this.__qaPlaying;}}}});Object.defineProperty(HTMLMediaElement.prototype,'play',{{configurable:true,value:function(){{this.__qaPlaying=true;return Promise.resolve();}}}});Object.defineProperty(HTMLMediaElement.prototype,'pause',{{configurable:true,value:function(){{this.__qaPlaying=false;}}}});</script>"""
    scripts=prelude+f'<script>{mod.RENDERERS}</script><script>{mod.SEAL_RENDERER}</script><script>{mod.STATIONERY_ENGINE}</script><script>{mod.DESIGN_ENGINE}</script><script>{mod.APP}</script>'
    return mod.BASE.replace('__SCRIPTS__',scripts),features


def main():
    chromium=os.environ.get('EVENTSTUDIO_CHROMIUM_PATH','/usr/bin/chromium'); failures=[]; rows=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=chromium,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in [(360,800),(1440,900)]:
            context=browser.new_context(viewport={'width':width,'height':height})
            for mask in PATTERNS:
                page=context.new_page(); html,features=html_for(mask); errors=[]
                handler=lambda e: errors.append(str(e)); page.on('pageerror',handler)
                page.set_content(html,wait_until='load',timeout=12000); page.wait_for_timeout(35)
                metrics=page.evaluate("""() => ({overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,residual:document.querySelectorAll('.es-recipe-hidden').length,ids:[...document.querySelectorAll('[id]')].map(x=>x.id)})""")
                disabledTypes=[c['type'] for c in COMPONENTS if c.get('requiredFeature') in features and features[c['requiredFeature']] is False]
                forbiddenIds=[HOSTS[t] for t in disabledTypes if t in HOSTS]
                missing=[id for id in forbiddenIds if id in metrics['ids']]
                if features.get('music') is False:
                    missing += [id for id in ('musicBtn','spotifyMusicBtn') if id in metrics['ids']]
                ok=metrics['overflow']<=2 and metrics['residual']==0 and not missing and not errors
                row={'mask':mask,'viewport':[width,height],'features':features,'overflow':metrics['overflow'],'residualHiddenNodes':metrics['residual'],'forbiddenStillInDom':missing,'errors':errors,'ok':ok};rows.append(row)
                if not ok: failures.append(row)
                page.close()
            context.close()
        browser.close()
    evidence=ROOT/'docs'/'validation'/'evidence';evidence.mkdir(parents=True,exist_ok=True)
    (evidence/'RC33_FEATURE_MATRIX_VISUAL.json').write_text(json.dumps({'patterns':PATTERNS,'cases':len(rows),'failures':failures,'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'patterns':len(PATTERNS),'cases':len(rows),'failures':len(failures)},ensure_ascii=False))
    if failures:
        print(json.dumps(failures[:6],ensure_ascii=False,indent=2));return 1
    print('✓ RC33 feature matrix visual: módulos deshabilitados desmontados del DOM, sin contenedores residuales ni overflow.')
    return 0

if __name__=='__main__':sys.exit(main())
