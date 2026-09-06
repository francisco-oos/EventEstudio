#!/usr/bin/env python3
"""RC39: todas las Recipes mantienen texto legible en el canvas real del Design Lab.

La regresión manual de QA mostraba títulos blancos sobre papel claro al cambiar entre
plantillas oscuras. Este harness abre el constructor real, carga las 65 Recipes mediante
el mismo contrato catalogRecipeId y valida contraste/overflow de la portada sin foto.
"""
from __future__ import annotations
import copy, importlib.util, json, urllib.parse, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'docs'/'validation'/'evidence'; EVIDENCE.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('rc32_lab',ROOT/'tests'/'rc32-design-lab-visual.py')
base=importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
recipes=base.recipes
state={'recipe':recipes[0],'revision':1}

def settings_payload():
    payload=copy.deepcopy(base.defaults)
    payload.setdefault('couple',{})['displayName']='Alexandra Fernanda y Maximiliano Sebastián'
    payload.setdefault('event',{})['dateLabel']='14 de diciembre de 2026'
    payload['_event']={'id':1,'name':'Ariana y Francisco','slug':'ariana-y-francisco','event_type':'wedding'}
    payload['_experiences']=base.experiences
    payload['_permissions']={'platformUser':True,'design':{'editDraft':True,'editStationery':True,'previewDraft':True,'apply':True,'saveTemplate':True,'publishCatalog':True,'manageCatalog':True}}
    payload['_designAccess']={'opening':{},'gallery':{}}
    # Sin portada para cubrir específicamente el caso que antes quedaba blanco/blanco.
    payload.setdefault('media',{})['heroImage']=''
    payload['media']['gallery']=[]; payload['media']['music']=''
    payload['_mediaHealth']={'missing':[]}
    return payload

def handler(route):
    req=route.request; u=urllib.parse.urlparse(req.url); path=u.path; method=req.method
    if path=='/api/admin/settings': return base.fulfill_json(route,settings_payload())
    if path=='/api/admin/design/recipe':
        if method=='PUT':
            body=json.loads(req.post_data or '{}')
            selected=body.get('recipe') or next((r for r in recipes if r['id']==body.get('catalogRecipeId')),state['recipe'])
            state['recipe']=copy.deepcopy(selected); state['revision']+=1
            return base.fulfill_json(route,{'ok':True,'recipe':state['recipe'],'hash':'qa','state':{'draftRevision':state['revision'],'activeRevision':1,'hasUnappliedChanges':True}})
        return base.fulfill_json(route,{'recipe':state['recipe'],'hash':'qa','source':'catalog','state':{'draftRevision':state['revision'],'activeRevision':1,'hasUnappliedChanges':state['revision']>1}})
    return base.api_handler(route)

def main():
    rows=[]; failures=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
        errors=[]; page.on('pageerror',lambda err: errors.append(str(err)))
        page.route('https://eventstudio.test/**',lambda route: route.abort())
        page.route('https://eventstudio.test/design-assets/**',lambda route: route.fulfill(status=200,content_type='image/svg+xml',body=base.svg('asset')))
        page.route('https://eventstudio.test/api/**',handler)
        page.set_content(base.build_inline_html(),wait_until='domcontentloaded')
        page.wait_for_selector('[data-recipe]')
        page.locator('.lab-nav button[data-panel="recipes"]').click()
        # Carga todo el catálogo una sola vez.
        while page.locator('#moreRecipesBtn').is_visible():
            before=page.locator('[data-recipe]').count(); page.locator('#moreRecipesBtn').click(); page.wait_for_timeout(35)
            if page.locator('[data-recipe]').count()<=before: break
        assert page.locator('[data-recipe]').count()==len(recipes), f'Catálogo incompleto: {page.locator("[data-recipe]").count()}/{len(recipes)}'

        for recipe in recipes:
            page.locator(f'[data-recipe="{recipe["id"]}"]').click()
            page.wait_for_timeout(24)
            metrics=page.evaluate("""()=>{
              const hero=document.querySelector('.canvas-section.hero'), h=hero?.querySelector('h1'), body=hero?.querySelector('p:not(.eyebrow)');
              function ary(v){v=String(v).trim();if(/^#[0-9a-f]{6}$/i.test(v))return [parseInt(v.slice(1,3),16),parseInt(v.slice(3,5),16),parseInt(v.slice(5,7),16)];const m=v.match(/rgba?\\((\\d+)[ ,]+(\\d+)[ ,]+(\\d+)/);return m?[+m[1],+m[2],+m[3]]:null}
              function lum(v){const a=ary(v);if(!a)return NaN;const q=a.map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return q[0]*.2126+q[1]*.7152+q[2]*.0722}
              function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
              const canvas=document.getElementById('designCanvas'), tokens=getComputedStyle(canvas), hc=getComputedStyle(h), bc=getComputedStyle(body);
              const paper=tokens.getPropertyValue('--paper').trim(), bg=tokens.getPropertyValue('--bg').trim(), ink=tokens.getPropertyValue('--ink').trim();
              const layout=canvas?.dataset?.layout||'';
              // La portada sin foto termina sobre papel salvo en el layout cinematográfico,
              // cuyo degradado inferior está dominado por tinta oscura.
              const surface=layout==='cinematic'?bg:paper;
              return {heading:hc.color,body:bc.color,paper,bg,ink,layout,surface,headingRatio:ratio(hc.color,surface),bodyRatio:ratio(bc.color,surface),overflow:Math.max(document.documentElement.scrollWidth-document.documentElement.clientWidth,0),title:h?.textContent||''};
            }""")
            ok=metrics['headingRatio']>=4.5 and metrics['bodyRatio']>=4.5 and metrics['overflow']<=2 and bool(metrics['title'].strip())
            row={'recipe':recipe['id'],**metrics,'ok':ok}; rows.append(row)
            if not ok: failures.append(row)
        actionable=[e for e in errors if 'ERR_FAILED' not in e]
        browser.close()
    if actionable: failures.append({'browserErrors':actionable})
    summary={'recipes':len(recipes),'cases':len(rows),'failures':len(failures),'minHeadingContrast':min((r['headingRatio'] for r in rows),default=0),'minBodyContrast':min((r['bodyRatio'] for r in rows),default=0),'maxOverflow':max((r['overflow'] for r in rows),default=0)}
    (EVIDENCE/'RC39_DESIGN_LAB_CATALOG_VISUAL.json').write_text(json.dumps({'summary':summary,'failures':failures,'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if failures:
        print(json.dumps(failures[:8],ensure_ascii=False,indent=2)); return 1
    print('✓ RC39 Design Lab catálogo: 65 Recipes legibles y contenidas sin fotografía de portada.')
    return 0

if __name__=='__main__': sys.exit(main())
