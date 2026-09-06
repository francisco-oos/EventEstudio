#!/usr/bin/env python3
"""RC39 visual contracts for parity, contrast and responsive editor feedback.

This suite is intentionally server-independent. It renders the production CSS in
Chromium so the most important QA reports can be measured even on a clean machine
where npm dependencies are unavailable.
"""
from __future__ import annotations
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
LAB_CSS=(ROOT/'public/design-lab.css').read_text(encoding='utf-8')
ENGINE_CSS=(ROOT/'public/design-engine.css').read_text(encoding='utf-8')
BASE_CSS=(ROOT/'public/styles.css').read_text(encoding='utf-8')
OUT=ROOT/'docs/validation/evidence/RC39_DESIGN_PARITY_VISUAL.json'

def rgb(value:str):
    value=value.strip()
    if value.startswith('color(srgb'):
        nums=[float(x) for x in re.findall(r'(?<![a-z])(?:0(?:\.\d+)?|1(?:\.0+)?)',value[len('color(srgb'):])[:3]]
        if len(nums)>=3:return [round(max(0,min(1,x))*255) for x in nums[:3]]
    nums=[int(x) for x in re.findall(r'\d+',value)[:3]]
    return nums if len(nums)==3 else [0,0,0]

def lum(c):
    def f(v):
        v=v/255
        return v/12.92 if v<=.03928 else ((v+.055)/1.055)**2.4
    r,g,b=(f(x) for x in c)
    return .2126*r+.7152*g+.0722*b

def ratio(a,b):
    x,y=lum(rgb(a)),lum(rgb(b))
    return (max(x,y)+.05)/(min(x,y)+.05)

results={"cases":{},"failures":[]}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    # 1) Countdown: reproduce the reported dark exterior / cream cards palette.
    page=browser.new_page(viewport={"width":1366,"height":768})
    page.set_content(f'''<!doctype html><style>
      :root{{--bg:#1b382e;--paper:#f6efd9;--ink:#ffffff;--muted:#6b655c;--accent:#b58e3d;--line:#cdbd92;--paper-contrast:#242321;--body-color:#5f5b56}}
      *{{box-sizing:border-box}}html,body{{margin:0}}{BASE_CSS}{ENGINE_CSS}
      </style><body class="theme-recipe"><section data-es-type="countdown" data-es-style="countdown-roman" style="padding:30px;background:var(--bg)">
      <div class="countdown"><div><strong>101</strong><span>Días</span></div><div><strong>0</strong><span>Horas</span></div><div><strong>39</strong><span>Minutos</span></div><div><strong>59</strong><span>Segundos</span></div></div>
      <a class="secondary-btn calendar-link">Agregar al calendario</a></section></body>''')
    strong=page.locator('.countdown strong').first.evaluate('(e)=>{const s=getComputedStyle(e);return {color:s.color,bg:getComputedStyle(e.parentElement).backgroundColor}}')
    link=page.locator('.calendar-link').evaluate('(e)=>{const s=getComputedStyle(e);return {color:s.color,bg:s.backgroundColor,border:s.borderColor}}')
    strong_ratio=ratio(strong['color'],strong['bg']); link_ratio=ratio(link['color'],link['bg'])
    ok=strong_ratio>=4.5 and link_ratio>=4.5
    results['cases']['countdownContrast']={"pass":ok,"numberRatio":round(strong_ratio,2),"ctaRatio":round(link_ratio,2),"number":strong,"cta":link}
    if not ok: results['failures'].append('countdownContrast')
    page.close()

    # 2) Design Lab inspector must produce an obvious, measurable title-size change.
    page=browser.new_page(viewport={"width":900,"height":700})
    page.set_content(f'''<!doctype html><style>{LAB_CSS}</style><body><main class="design-canvas desktop">
      <section class="canvas-section" id="section" style="--section-heading-size:.8"><h2 id="title">Confirmación</h2><p>Formulario RSVP</p></section>
      </main></body>''')
    small=page.locator('#title').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')
    page.locator('#section').evaluate("e=>e.style.setProperty('--section-heading-size','1.6')")
    large=page.locator('#title').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')
    ok=large>small*1.8
    results['cases']['liveInspectorTitleSize']={"pass":ok,"smallPx":small,"largePx":large,"ratio":round(large/small,2)}
    if not ok: results['failures'].append('liveInspectorTitleSize')
    page.close()

    # 3) Disabled/hidden services must collapse completely, never reserve a blank card.
    page=browser.new_page(viewport={"width":900,"height":700})
    page.set_content(f'''<!doctype html><style>{BASE_CSS}</style><body><main>
      <section id="before" style="height:100px">Antes</section>
      <section id="rsvp" class="section hidden" style="min-height:500px;padding:120px">RSVP</section>
      <section id="after" style="height:100px">Después</section>
      </main></body>''')
    hidden=page.locator('#rsvp').evaluate('(e)=>{const r=e.getBoundingClientRect();return {display:getComputedStyle(e).display,height:r.height}}')
    before=page.locator('#before').bounding_box(); after=page.locator('#after').bounding_box()
    gap=round(after['y']-(before['y']+before['height']),2)
    ok=hidden['display']=='none' and hidden['height']==0 and abs(gap)<1
    results['cases']['hiddenServiceCollapses']={"pass":ok,"computed":hidden,"gapPx":gap}
    if not ok: results['failures'].append('hiddenServiceCollapses')
    page.close()

    # 4) Public Recipe title multiplier must also be visible, not only the editor.
    page=browser.new_page(viewport={"width":900,"height":700})
    page.set_content(f'''<!doctype html><style>:root{{--ink:#242321;--heading-color:#242321;--body-color:#5f5b56}}{BASE_CSS}{ENGINE_CSS}</style>
      <body class="theme-recipe"><section data-es-type="rsvp" id="public" style="--es-heading-size:.8"><h2 id="pt">Confirmación</h2></section></body>''')
    a=page.locator('#pt').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')
    page.locator('#public').evaluate("e=>e.style.setProperty('--es-heading-size','1.6')")
    b=page.locator('#pt').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')
    ok=b>a*1.8
    results['cases']['publicTitleSizeParity']={"pass":ok,"smallPx":a,"largePx":b,"ratio":round(b/a,2)}
    if not ok: results['failures'].append('publicTitleSizeParity')
    page.close()

    # 5) Narrow viewport: countdown and CTA remain inside the viewport.
    for width,height in [(320,568),(390,844)]:
        page=browser.new_page(viewport={"width":width,"height":height})
        page.set_content(f'''<!doctype html><style>:root{{--bg:#1b382e;--paper:#f6efd9;--ink:#242321;--muted:#5f5b56;--accent:#b58e3d;--line:#cdbd92;--paper-contrast:#242321;--body-color:#5f5b56}}*{{box-sizing:border-box}}html,body{{margin:0;width:100%}}{BASE_CSS}{ENGINE_CSS}</style><body class="theme-recipe"><section data-es-type="countdown" style="--es-section-width:92%;width:92%;margin:auto"><div class="countdown"><div><strong>101</strong><span>Días</span></div><div><strong>0</strong><span>Horas</span></div><div><strong>39</strong><span>Minutos</span></div><div><strong>59</strong><span>Segundos</span></div></div><a class="secondary-btn calendar-link">Agregar al calendario</a></section></body>''')
        metrics=page.evaluate('''()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,boxes:[...document.querySelectorAll('.countdown>div,.calendar-link')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}})})''')
        ok=metrics['scrollWidth']<=width+2 and all(x['left']>=-2 and x['right']<=width+2 for x in metrics['boxes'])
        results['cases'][f'narrow{width}']={"pass":ok,**metrics}
        if not ok: results['failures'].append(f'narrow{width}')
        page.close()

    browser.close()

results['pass']=not results['failures']
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results,ensure_ascii=False))
if results['failures']: raise SystemExit(1)
print('✓ RC39 visual: contraste contextual, sliders visibles, servicios sin huecos y responsive verificados.')
