#!/usr/bin/env python3
"""Valida landing Recipe-first, CTA, filtros y sello interactivo en móvil/escritorio."""
from __future__ import annotations
import json, os, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/'public'
HTML=(PUBLIC/'catalogo.html').read_text(encoding='utf-8'); CSS=(PUBLIC/'styles.css').read_text(encoding='utf-8'); JS=(PUBLIC/'catalogo.js').read_text(encoding='utf-8'); SEAL=(PUBLIC/'seal-renderer.js').read_text(encoding='utf-8')
SEALS=json.loads((ROOT/'config'/'seals.json').read_text(encoding='utf-8'))
RECIPES=json.loads((ROOT/'config'/'design'/'recipes.json').read_text(encoding='utf-8'))['recipes'][:6]

def thumb(name,color):
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 320"><rect width="540" height="320" rx="28" fill="#f8f4ed"/><rect x="34" y="28" width="472" height="264" rx="24" fill="white" stroke="{color}"/><circle cx="430" cy="80" r="52" fill="{color}" opacity=".18"/><text x="270" y="152" text-anchor="middle" font-family="Georgia" font-size="32" fill="#25221f">{name}</text><text x="270" y="192" text-anchor="middle" font-family="Arial" font-size="14" fill="{color}">Recipe editable</text></svg>'
    import urllib.parse
    return 'data:image/svg+xml,'+urllib.parse.quote(svg)

recipe_payload=[]
for r in RECIPES:
    p=r['design']['palette']; recipe_payload.append({'id':r['id'],'name':r['name'],'description':r['description'],'eventTypes':r.get('eventTypes',[]),'tags':r.get('tags',[]),'minPlan':'starter','previewUrl':thumb(r['name'],p['accent']),'design':{'layoutFamily':r['design'].get('layoutFamily'),'palette':p,'typography':r['design'].get('typography',{}),'colorTheory':r['design'].get('colorTheory',{})}})
CATALOG={'trialDays':7,'registrationEnabled':True,'recipes':recipe_payload,'themes':[],'eventTypes':[{'id':'wedding','name':'Boda','icon':'♡'},{'id':'kids-party','name':'Fiesta infantil','icon':'★'}],'plans':[{'code':'express','name':'Express','tagline':'Invitación digital','price_cents':19900,'currency':'MXN','included':['invitation'],'duration_days':30,'max_storage_mb':250,'max_guests':0,'featured':False},{'code':'basic','name':'Plus','tagline':'Invitación y operación','price_cents':49900,'currency':'MXN','included':['invitation','rsvp','gallery'],'duration_days':120,'max_storage_mb':2048,'max_guests':200,'featured':True}],'addons':[{'key':'gallery','name':'Galería','description':'Fotografías del evento','price_cents':9900,'currency':'MXN'}]}
BASE=re.sub(r'<link rel="stylesheet" href="/styles\.css\?v=[^"]+">',f'<style>{CSS}</style>',HTML)
BASE=re.sub(r'<script src="/seal-renderer\.js\?v=[^"]+"></script>\s*<script src="/catalogo\.js\?v=[^"]+"></script>','__SCRIPTS__',BASE)
BASE=BASE.replace('<head>','<head><base href="https://eventstudio.test/">',1)

def page_html():
    return BASE.replace('__SCRIPTS__',f'<script>const __qaSession={{}};Object.defineProperty(window,\"sessionStorage\",{{configurable:true,value:{{getItem:k=>__qaSession[k]??null,setItem:(k,v)=>{{__qaSession[k]=String(v);}},removeItem:k=>{{delete __qaSession[k];}}}}}});</script><script>{SEAL}</script><script>{JS}</script>')

def main():
    chromium=os.environ.get('EVENTSTUDIO_CHROMIUM_PATH','/usr/bin/chromium'); failures=[]; rows=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=chromium,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in [(360,800),(1440,900)]:
            page=browser.new_page(viewport={'width':width,'height':height}); errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
            def route_handler(route):
                url=route.request.url
                if '/api/public/catalog' in url:return route.fulfill(status=200,content_type='application/json',body=json.dumps(CATALOG))
                if '/api/public/seals' in url:return route.fulfill(status=200,content_type='application/json',body=json.dumps(SEALS))
                if '/api/analytics/track' in url:return route.fulfill(status=200,content_type='application/json',body='{}')
                return route.abort()
            page.route('https://eventstudio.test/**',route_handler)
            page.set_content(page_html(),wait_until='domcontentloaded'); page.wait_for_selector('#catalogThemeGrid .catalog-theme-card'); page.wait_for_timeout(80)
            initial=page.locator('#heroRecipeName').inner_text(); page.locator('#heroRecipeNext').click(); page.wait_for_timeout(30); changed=page.locator('#heroRecipeName').inner_text(); assert initial!=changed
            seal_before=page.locator('#landingSealPreview').inner_html(); page.locator('#landingSealColor').evaluate("el=>{el.value='#245b7a';el.dispatchEvent(new Event('input',{bubbles:true}))}"); page.locator('#landingSealInitials').fill('AB'); page.wait_for_timeout(30); seal_after=page.locator('#landingSealPreview').inner_html(); assert seal_before!=seal_after and '#245b7a' in seal_after.lower() and page.locator('#landingSealInitials').input_value()=='AB'
            count_before=page.locator('#catalogThemeGrid .catalog-theme-card').count(); page.locator('#catalogSearch').fill('zzzz-no-existe'); page.wait_for_timeout(25); empty=page.locator('.catalog-empty').count(); page.locator('#catalogSearch').fill(''); page.wait_for_timeout(25); count_after=page.locator('#catalogThemeGrid .catalog-theme-card').count(); assert count_before==count_after and empty==1
            page.locator('#catalogEventChips [data-event="wedding"]').click(); page.wait_for_timeout(25); page.locator('#catalogEventChips [data-event=""]').click()
            metrics=page.evaluate("""() => {const hero=document.querySelector('.catalog-hero').getBoundingClientRect();const cta=document.getElementById('heroTrialCta').getBoundingClientRect();return {overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,heroTop:hero.top,ctaVisible:cta.width>0&&cta.height>=40,recipeImage:Boolean(document.querySelector('#heroRecipePreview img')),sealSvg:Boolean(document.querySelector('#landingSealPreview svg')),remoteHeroImages:[...document.querySelectorAll('.catalog-hero img')].map(x=>x.src).filter(src=>/^https?:/.test(src)&&!src.startsWith(location.origin)).length};}""")
            ok=metrics['overflow']<=2 and metrics['heroTop']<100 and metrics['ctaVisible'] and metrics['recipeImage'] and metrics['sealSvg'] and metrics['remoteHeroImages']==0 and not errors
            rows.append({'viewport':[width,height],**metrics,'errors':errors,'ok':ok});
            if not ok: failures.append(rows[-1])
            page.close()
        browser.close()
    evidence=ROOT/'docs'/'validation'/'evidence';evidence.mkdir(parents=True,exist_ok=True);(evidence/'RC33_LANDING_VISUAL.json').write_text(json.dumps({'rows':rows,'failures':failures},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'cases':len(rows),'failures':len(failures)},ensure_ascii=False))
    if failures: print(json.dumps(failures,ensure_ascii=False,indent=2));return 1
    print('✓ RC33 landing: Recipe interactiva, lacre configurable, filtros, CTA above-the-fold y sin assets remotos en hero.')
    return 0

if __name__=='__main__':sys.exit(main())
