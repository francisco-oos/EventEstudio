#!/usr/bin/env python3
"""Renderiza todas las Design Recipes v2 con el renderer público real."""
from __future__ import annotations
import json, os, re, statistics, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'; DESIGN=ROOT/'config'/'design'; EVIDENCE=ROOT/'docs'/'validation'/'evidence'; EVIDENCE.mkdir(parents=True,exist_ok=True)
RECIPES=json.loads((DESIGN/'recipes.json').read_text(encoding='utf-8'))['recipes']
ASSETS=json.loads((DESIGN/'assets-manifest.json').read_text(encoding='utf-8'))['assets']
ASSET_BY_ID={a['id']:a for a in ASSETS}
DEFAULTS=json.loads((ROOT/'config'/'default-settings.json').read_text(encoding='utf-8'))
EXPERIENCES=json.loads((ROOT/'config'/'experiences.json').read_text(encoding='utf-8'))
SEALS=json.loads((ROOT/'config'/'seals.json').read_text(encoding='utf-8'))
INDEX=(PUBLIC/'index.html').read_text(encoding='utf-8')
CSS=(PUBLIC/'styles.css').read_text(encoding='utf-8'); STATIONERY_CSS=(PUBLIC/'stationery-engine.css').read_text(encoding='utf-8'); DESIGN_CSS=(PUBLIC/'design-engine.css').read_text(encoding='utf-8')
RENDERERS=(PUBLIC/'experience-renderers.js').read_text(encoding='utf-8'); SEAL_RENDERER=(PUBLIC/'seal-renderer.js').read_text(encoding='utf-8'); STATIONERY_ENGINE=(PUBLIC/'stationery-engine.js').read_text(encoding='utf-8'); DESIGN_COLOR_ENGINE=(PUBLIC/'design-color-engine.js').read_text(encoding='utf-8'); DESIGN_ENGINE=(PUBLIC/'design-engine.js').read_text(encoding='utf-8'); APP=(PUBLIC/'app.js').read_text(encoding='utf-8')
BASE=re.sub(r'<link rel="stylesheet" href="/styles\.css\?v=[^"]+">',lambda _:f'<style>{CSS}</style>',INDEX)
BASE=re.sub(r'<link rel="stylesheet" href="/stationery-engine\.css\?v=[^"]+">',lambda _:f'<style>{STATIONERY_CSS}</style>',BASE)
BASE=re.sub(r'<link rel="stylesheet" href="/design-engine\.css\?v=[^"]+">',lambda _:f'<style>{DESIGN_CSS}</style>',BASE)
BASE=re.sub(r'<script src="/experience-renderers\.js\?v=[^"]+"></script><script src="/seal-renderer\.js\?v=[^"]+"></script><script src="/stationery-engine\.js\?v=[^"]+"></script><script src="/design-color-engine\.js\?v=[^"]+"></script><script src="/design-engine\.js\?v=[^"]+"></script><script src="/app\.js\?v=[^"]+"></script>','__SCRIPTS__',BASE)
SILENT_WAV='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='


def config_for(recipe):
    cfg=json.loads(json.dumps(DEFAULTS)); cfg['themeId']=recipe['id']; cfg['couple']={'partner1':'Ariana','partner2':'Francisco','displayName':'Ariana & Francisco'}
    cfg['event'].update({'dateTime':'2026-12-14T18:00:00-06:00','dateLabel':'14 de diciembre de 2026','heroMessage':'Celebramos una historia construida con recuerdos y detalles.','closingMessage':'Gracias por acompañarnos.','slug':'qa-recipe'})
    cfg['venue'].update({'title':'Ceremonia y celebración','name':'Hacienda EventStudio','ceremonyTime':'18:00','receptionTime':'20:00','address':'Dirección de validación con longitud suficiente para comprobar el flujo responsive.','notes':'Entrada principal.'})
    cfg['venues']['ceremony'].update({'name':'Hacienda EventStudio','time':'18:00','address':cfg['venue']['address']}); cfg['venues']['reception'].update({'name':'Hacienda EventStudio','time':'20:00','address':cfg['venue']['address']})
    cfg['story'].update({'title':'Nuestra historia','text':'Contenido realista suficientemente largo para validar la composición de cada Recipe sin utilizar texto fijo del renderer.'})
    cfg['dressCode'].update({'title':'Formal','description':'Indicaciones configuradas desde los datos del evento.'}); cfg['gifts'].update({'mode':'bank-transfer','bankInfoEnabled':True,'bankInfo':'Banco QA · CLABE 012345678901234567','openpay':{'enabled':False,'suggestedAmountCents':100000,'allowCustomAmount':True,'messageEnabled':True}})
    cfg['media'].update({'musicSource':'upload','music':SILENT_WAV,'gallery':[]}); cfg['presentation'].update({'openingStyle':'none','motionLevel':recipe['design'].get('motionPreset','subtle'),'experienceMode':'auto','galleryStyle':'classic'})
    cfg['_experiences']={'openings':EXPERIENCES['openings'],'galleries':EXPERIENCES['galleries'],'motionLevels':EXPERIENCES['motionLevels']}; cfg['_sealCatalog']=SEALS
    cfg['_designRecipe']=recipe; used={a['assetId'] for a in recipe.get('assets',[])}; cfg['_assetManifest']={'assets':[ASSET_BY_ID[x] for x in used if x in ASSET_BY_ID]}; cfg['_palette']=recipe['design']['palette']; cfg['_surfaceTexture']=recipe['design'].get('texture','none'); cfg['_revision']='qa-rc32'; cfg['_platform']={'branding':{'attributionEnabled':False,'attributionOnInvitation':False,'attributionLabel':'EventStudio','attributionUrl':''}}
    cfg['features']={k:True for k in cfg.get('features',{})}; cfg['features']['guestPhotoMessages']=False
    return cfg


def html_for(recipe):
    payload=json.dumps(config_for(recipe),ensure_ascii=False).replace('</','<\\/')
    prelude=f"""<script>window.__qaErrors=[];window.fetch=async()=>new Response(JSON.stringify({payload}),{{status:200,headers:{{'Content-Type':'application/json'}}}});Object.defineProperty(HTMLMediaElement.prototype,'paused',{{configurable:true,get:function(){{return !this.__qaPlaying;}}}});Object.defineProperty(HTMLMediaElement.prototype,'play',{{configurable:true,value:function(){{this.__qaPlaying=true;return Promise.resolve();}}}});Object.defineProperty(HTMLMediaElement.prototype,'pause',{{configurable:true,value:function(){{this.__qaPlaying=false;this.dispatchEvent(new Event('pause'));}}}});</script>"""
    scripts=prelude+f'<script>{RENDERERS}</script><script>{SEAL_RENDERER}</script><script>{STATIONERY_ENGINE}</script><script>{DESIGN_COLOR_ENGINE}</script><script>{DESIGN_ENGINE}</script><script>{APP}</script>'
    return BASE.replace('__SCRIPTS__',scripts)


def main():
    chromium=os.environ.get('EVENTSTUDIO_CHROMIUM_PATH','/usr/bin/chromium'); failures=[]; rows=[]; fps=[]
    if not Path(chromium).exists(): raise SystemExit(f'Chromium obligatorio no encontrado: {chromium}')
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=chromium,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in [(360,800),(1440,900)]:
            context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='no-preference')
            for recipe in RECIPES:
                page=context.new_page(); errors=[]; page.on('pageerror',lambda e,errors=errors: errors.append(str(e)))
                page.set_content(html_for(recipe),wait_until='load',timeout=10000); page.wait_for_timeout(35)
                expected_sections=sum(1 for s in recipe['sections'] if s.get('visible',True)); expected_assets=sum(1 for a in recipe.get('assets',[]) if a.get('assetId') in ASSET_BY_ID)
                m=page.evaluate("""() => ({overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,recipe:document.body.dataset.designRecipe||'',layout:document.body.dataset.layout||'',texture:document.body.dataset.surfaceTexture||'',timeline:document.body.dataset.designTimeline||'',assets:document.querySelectorAll('.es-design-asset').length,styled:document.querySelectorAll('[data-es-style]').length,musicVisible:!document.getElementById('musicBtn').classList.contains('hidden')&&!document.getElementById('musicBtn').classList.contains('es-recipe-hidden'),failed:document.body.innerText.includes('No pudimos abrir')})""")
                row={'recipe':recipe['id'],'viewport':[width,height],**m,'expectedAssets':expected_assets,'expectedSections':expected_sections,'errors':errors}
                row['ok']=m['overflow']<=2 and m['recipe']==recipe['id'] and m['layout']==recipe['design']['layoutFamily'] and m['texture']==recipe['design'].get('texture','none') and m['timeline']==recipe['design'].get('motionTimelineId','') and m['assets']==expected_assets and m['styled']>=max(8,expected_sections-2) and m['musicVisible'] and not m['failed'] and not errors
                rows.append(row)
                if not row['ok']: failures.append(row)
                page.close()
            context.close()
        # Functional check for the preserved music button under a Recipe.
        context=browser.new_context(viewport={'width':390,'height':844}); page=context.new_page(); page.set_content(html_for(RECIPES[0]),wait_until='load',timeout=10000); page.wait_for_timeout(50)
        btn=page.locator('#musicBtn'); assert btn.is_visible(), 'El botón de música debe renderizarse cuando existe pista y entitlement.'
        before=btn.get_attribute('aria-label'); btn.click(); page.wait_for_timeout(20); after=btn.get_attribute('aria-label'); assert before!=after and 'Pausar' in after, 'El botón de música no reaccionó al reproducir.'
        btn.click(); page.wait_for_timeout(20); assert 'Reproducir' in btn.get_attribute('aria-label'), 'El botón de música no reaccionó al pausar.'
        context.close(); browser.close()
    summary={'recipes':len(RECIPES),'cases':len(rows),'failures':len(failures),'maxOverflow':max((r['overflow'] for r in rows),default=0),'viewports':[[360,800],[1440,900]]}
    (EVIDENCE/'RC32_RECIPE_VISUAL.json').write_text(json.dumps({'summary':summary,'rows':rows,'failures':failures},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if failures:
        print(json.dumps(failures[:8],ensure_ascii=False,indent=2)); return 1
    print('✓ RC32 Recipe visual: 64 Recipes renderizadas en móvil/escritorio, assets, texturas, timelines, estilos y música operativa.')
    return 0

if __name__=='__main__': sys.exit(main())
