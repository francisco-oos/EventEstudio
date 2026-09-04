#!/usr/bin/env python3
"""QA visual pública RC30: nombre, paleta y sustitución del lacre legado."""
import json, os, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
EVIDENCE=ROOT/'docs'/'validation'/'evidence'
EVIDENCE.mkdir(parents=True,exist_ok=True)

HTML=(PUBLIC/'index.html').read_text(encoding='utf-8')
CSS=(PUBLIC/'styles.css').read_text(encoding='utf-8')
STATIONERY_CSS=(PUBLIC/'stationery-engine.css').read_text(encoding='utf-8')
EXPERIENCE_JS=(PUBLIC/'experience-renderers.js').read_text(encoding='utf-8')
SEAL_JS=(PUBLIC/'seal-renderer.js').read_text(encoding='utf-8')
ENGINE_JS=(PUBLIC/'stationery-engine.js').read_text(encoding='utf-8')
APP_JS=(PUBLIC/'app.js').read_text(encoding='utf-8').replace(
    'function slug(){const m=location.pathname.match(/^\\/e\\/([^/]+)/);return m?decodeURIComponent(m[1]):"";}',
    'function slug(){return "qa";}'
)
DEFAULTS=json.loads((ROOT/'config'/'default-settings.json').read_text(encoding='utf-8'))
EXPERIENCES=json.loads((ROOT/'config'/'experiences.json').read_text(encoding='utf-8'))
STATIONERY=json.loads((ROOT/'config'/'stationery.json').read_text(encoding='utf-8'))
SEALS=json.loads((ROOT/'config'/'seals.json').read_text(encoding='utf-8'))

CUSTOM={
    'bg':'#203126','paper':'#f5f0df','ink':'#33402f','muted':'#0d1712',
    'accent':'#7a3344','gold':'#b49355','line':'#0d1712'
}

def payload(opening='unified-envelope'):
    s=json.loads(json.dumps(DEFAULTS))
    s['themeId']='storybook-seal'
    s['couple']={'partner1':'Ariana','partner2':'Francisco','displayName':'Ariana y Francisco'}
    s.setdefault('event',{}).update({'title':'Ariana y Francisco','dateLabel':'14 de diciembre de 2026','slug':'qa','eventId':2})
    s.setdefault('presentation',{}).update({'openingStyle':opening,'openButton':'Abrir invitación','motionLevel':'still'})
    s['stationery']={**STATIONERY['defaults'],
        'customized':True,'syncDesignTokens':True,'presetId':'olive-universe-orbit',
        'outerColor':CUSTOM['bg'],'innerColor':CUSTOM['muted'],'cardColor':CUSTOM['paper'],
        'textColor':CUSTOM['ink'],'ornamentColor':CUSTOM['gold'],'sealColor':CUSTOM['accent']}
    s['seal']={**SEALS['defaults'],'customized':True,'enabled':True,'material':'theme','color':CUSTOM['accent']}
    s['_palette']=CUSTOM if opening=='unified-envelope' else {
        'bg':'#eee8db','paper':'#fffdf8','ink':'#302d26','muted':'#766f63','accent':'#a77c12','gold':'#c8a551','line':'#ddd1bb'
    }
    s['_experiences']=EXPERIENCES
    s['_stationeryCatalog']=STATIONERY
    s['_sealCatalog']=SEALS
    s.setdefault('features',{})['guestPhotoMessages']=False
    s.setdefault('features',{})['music']=False
    s.setdefault('media',{}).update({'gallery':[],'musicSource':'none','music':'','spotifyUrl':'','heroImage':''})
    s['_platform']={'branding':{'attributionEnabled':False}}
    return s

def document(settings):
    doc=re.sub(r'<link rel="stylesheet" href="/styles\.css\?v=[^"]+">',lambda _:f'<style>{CSS}</style>',HTML)
    doc=re.sub(r'<link rel="stylesheet" href="/stationery-engine\.css\?v=[^"]+">',lambda _:f'<style>{STATIONERY_CSS}</style>',doc)
    prelude=f'''<script>window.__qaConfig={json.dumps(settings,ensure_ascii=False)};window.fetch=async(input)=>{{const u=String(input);if(u.includes('/api/config'))return new Response(JSON.stringify(window.__qaConfig),{{status:200,headers:{{'Content-Type':'application/json'}}}});if(u.includes('/api/public/photo-messages'))return new Response('[]',{{status:200,headers:{{'Content-Type':'application/json'}}}});return new Response('{{}}',{{status:404,headers:{{'Content-Type':'application/json'}}}});}};</script>'''
    scripts=prelude+f'<script>{EXPERIENCE_JS}</script><script>{SEAL_JS}</script><script>{ENGINE_JS}</script><script>{APP_JS}</script>'
    doc=re.sub(r'<script src="/experience-renderers\.js\?v=[^"]+"></script><script src="/seal-renderer\.js\?v=[^"]+"></script><script src="/stationery-engine\.js\?v=[^"]+"></script><script src="/app\.js\?v=[^"]+"></script>',lambda _:scripts,doc)
    return doc

def run_case(page, opening):
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content(document(payload(opening)),wait_until='load',timeout=15000)
    page.wait_for_function("document.title.includes('Ariana')",timeout=5000)
    result={'opening':opening,'errors':errors}
    if opening=='unified-envelope':
        page.locator('#stationeryOpeningMount .stationery-envelope').wait_for(state='visible',timeout=5000)
        result['cardName']=page.locator('#stationeryOpeningMount .names-display').inner_text()
        result['cta']=page.locator('#openingActionLabel').inner_text()
        result['vars']=page.evaluate("() => Object.fromEntries(['bg','paper','ink','muted','accent','gold','line'].map(k=>[k,getComputedStyle(document.body).getPropertyValue('--'+k).trim()]))")
        page.locator('#openingEnvelopeButton').click()
        page.wait_for_timeout(900)  # motionLevel still -> salida accesible de 520 ms
        result['invitationOpen']=page.evaluate("document.body.classList.contains('invitation-open')")
        result['heroSealCount']=page.locator('#heroWaxSeal svg').count()
        result['legacySealDisplay']=page.evaluate("getComputedStyle(document.querySelector('#heroContent'),'::after').display")
        result['heroBg']=page.evaluate("getComputedStyle(document.querySelector('#heroContent')).backgroundColor")
        result['ok']=(result['cardName']=='Ariana y Francisco' and result['cta']=='Abrir invitación' and result['vars']==CUSTOM and result['invitationOpen'] and result['heroSealCount']==1 and result['legacySealDisplay']=='none' and not errors)
    else:
        result['vars']=page.evaluate("() => Object.fromEntries(['bg','paper','ink','muted','accent','gold','line'].map(k=>[k,getComputedStyle(document.body).getPropertyValue('--'+k).trim()]))")
        expected=payload(opening)['_palette']
        result['ok']=(result['vars']==expected and not errors)
    return result

def main():
    chromium=os.environ.get('EVENTSTUDIO_CHROMIUM_PATH','/usr/bin/chromium')
    if not Path(chromium).exists():
        print(json.dumps({'skipped':True,'reason':f'Chromium no encontrado: {chromium}'},ensure_ascii=False));return 2
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=chromium,args=['--no-sandbox','--disable-dev-shm-usage'])
        for opening in ('unified-envelope','gala-curtain'):
            context=browser.new_context(viewport={'width':1365,'height':768},reduced_motion='no-preference')
            page=context.new_page()
            results.append(run_case(page,opening))
            context.close()
        browser.close()
    summary={'cases':len(results),'failures':sum(not r['ok'] for r in results),'results':results}
    (EVIDENCE/'RC30_PUBLIC_ENVELOPE_VISUAL.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    return 1 if summary['failures'] else 0

if __name__=='__main__':sys.exit(main())
