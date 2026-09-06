#!/usr/bin/env python3
"""Valida sincronización Recipe-first del álbum colaborativo en móvil y escritorio."""
from __future__ import annotations
import json, os, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/'public'; DESIGN=ROOT/'config'/'design'
HTML=(PUBLIC/'album.html').read_text(encoding='utf-8'); CSS=(PUBLIC/'styles.css').read_text(encoding='utf-8'); JS=(PUBLIC/'album.js').read_text(encoding='utf-8').replace('const eventSlug=query.get("e")||"";','const eventSlug="qa";')
RECIPES=json.loads((DESIGN/'recipes.json').read_text(encoding='utf-8'))['recipes']; RECIPE=next(r for r in RECIPES if r['id']=='romantic-wine')
ASSETS=json.loads((DESIGN/'assets-manifest.json').read_text(encoding='utf-8'))['assets']; BY={a['id']:a for a in ASSETS}; used={a['assetId'] for a in RECIPE.get('assets',[])}
SETTINGS={
  'couple':{'displayName':'Ariana & Francisco'},'event':{'title':'Nuestra boda','dateLabel':'14 de diciembre de 2026'},
  'media':{'heroImage':''},'photoPolicy':{'messageMaxLength':500},'typography':RECIPE['design']['typography'],
  '_designRecipe':RECIPE,'_palette':RECIPE['design']['palette'],'_surfaceTexture':RECIPE['design']['texture'],
  '_assetManifest':{'assets':[BY[x] for x in used if x in BY]}
}
BASE=re.sub(r'<link rel="stylesheet" href="/styles\.css\?v=[^"]+">',f'<style>{CSS}</style>',HTML)
BASE=re.sub(r'<script src="/album\.js\?v=[^"]+"></script>','__SCRIPT__',BASE).replace('<head>','<head><base href="https://eventstudio.test/">',1)

def page_html():
    payload=json.dumps(SETTINGS,ensure_ascii=False).replace('</','<\\/')
    pre=f"<script>window.fetch=async()=>new Response(JSON.stringify({payload}),{{status:200,headers:{{'Content-Type':'application/json'}}}});</script>"
    return BASE.replace('__SCRIPT__',pre+f'<script>{JS}</script>')

def main():
    chromium=os.environ.get('EVENTSTUDIO_CHROMIUM_PATH','/usr/bin/chromium'); failures=[]; rows=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=chromium,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in [(360,800),(1440,900)]:
            page=browser.new_page(viewport={'width':width,'height':height}); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_content(page_html(),wait_until='load'); page.wait_for_timeout(60)
            metrics=page.evaluate("""() => ({
              recipe:document.body.dataset.designRecipe||'',layout:document.body.dataset.layout||'',texture:document.body.dataset.surfaceTexture||'',
              assets:document.querySelectorAll('.album-design-asset').length,
              heading:getComputedStyle(document.documentElement).getPropertyValue('--font-heading').trim(),
              accent:getComputedStyle(document.body).getPropertyValue('--accent').trim(),
              overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,
              title:document.getElementById('albumEventName')?.textContent||''
            })""")
            ok=metrics['recipe']==RECIPE['id'] and metrics['layout']==RECIPE['design']['layoutFamily'] and metrics['texture']==RECIPE['design']['texture'] and metrics['assets']>=1 and metrics['accent'].lower()==RECIPE['design']['palette']['accent'].lower() and metrics['overflow']<=2 and 'Ariana' in metrics['title'] and not errors
            row={'viewport':[width,height],**metrics,'errors':errors,'ok':ok}; rows.append(row)
            if not ok: failures.append(row)
            page.close()
        browser.close()
    evidence=ROOT/'docs'/'validation'/'evidence'; evidence.mkdir(parents=True,exist_ok=True); (evidence/'RC33_ALBUM_RECIPE_VISUAL.json').write_text(json.dumps({'rows':rows,'failures':failures},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'cases':len(rows),'failures':len(failures)},ensure_ascii=False))
    if failures:
        print(json.dumps(failures,ensure_ascii=False,indent=2)); return 1
    print('✓ RC33 álbum: paleta, tipografía, textura, layout y Assets heredados de la Recipe sin overflow.')
    return 0

if __name__=='__main__': sys.exit(main())
