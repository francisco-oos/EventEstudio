#!/usr/bin/env python3
"""RC38 browser geometry regression tests for reported clipping/overflow issues.

Runs without EventStudio server: injects the production CSS into small fixtures and
measures actual browser layout at desktop/mobile viewports.
"""
from __future__ import annotations
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CSS=(ROOT/'public/styles.css').read_text(encoding='utf-8')
VIEWPORTS=[(320,568),(390,844),(1366,768)]
results=[]
failures=[]

def contained(box, viewport_w, tolerance=2):
    return box and box['x'] >= -tolerance and box['x']+box['width'] <= viewport_w+tolerance

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width,height in VIEWPORTS:
        page=browser.new_page(viewport={'width':width,'height':height})
        page.set_content(f'''<!doctype html><html><head><meta charset="utf-8"><style>
        :root{{--bg:#f5eddb;--paper:#fffaf1;--ink:#34382e;--muted:#706b61;--accent:#7b4b56;--accent-dark:#58343d;--gold:#bd8b2e;--line:#d9cbb8;--shadow:0 12px 30px #0001}}
        *{{box-sizing:border-box}}html,body{{margin:0;width:100%;min-height:100%;font-family:Arial,sans-serif}}
        {CSS}
        </style></head><body class="theme-recipe">
        <div class="invitation-opening opening-reserve-uncork" id="opening">
          <div class="opening-copy" id="openingCopy"><p class="eyebrow">UNA INVITACIÓN PARA TI</p><h1>Alexandria Fernanda y Maximiliano Francisco</h1><p>Tenemos algo especial que compartir contigo</p></div>
          <button class="opening-envelope-button"><span class="opening-envelope"></span><strong>Abrir invitación</strong></button>
        </div>
        </body></html>''', wait_until='domcontentloaded')
        copy_box=page.locator('#openingCopy').bounding_box()
        heading_box=page.locator('#openingCopy h1').bounding_box()
        opening_metrics=page.evaluate('''() => ({scrollWidth:document.documentElement.scrollWidth, innerWidth:innerWidth, scrollHeight:document.documentElement.scrollHeight, innerHeight:innerHeight})''')
        opening_ok=contained(copy_box,width) and contained(heading_box,width) and opening_metrics['scrollWidth'] <= width+2

        # Countdown fixture: deliberately inject legacy 290px cells. RC38 responsive
        # contract must override their fixed dimensions on narrow screens.
        page.set_content(f'''<!doctype html><html><head><meta charset="utf-8"><style>
        :root{{--bg:#f8f3eb;--paper:#fff;--ink:#2e2023;--muted:#74666a;--accent:#7b4b56;--line:#ddcfd1}}
        *{{box-sizing:border-box}}html,body{{margin:0;width:100%;font-family:Arial,sans-serif}}{CSS}
        .legacy-circle{{width:290px;height:290px;border-radius:50%!important}}
        </style></head><body class="theme-recipe"><main style="width:100%;padding:8px">
        <section data-es-type="countdown" id="countSection" style="--es-section-width:92%;width:92%;margin:auto"><h2>FALTAN</h2><div class="countdown" id="countdown">
        <div class="legacy-circle"><strong>101</strong><span>Días</span></div><div class="legacy-circle"><strong>5</strong><span>Horas</span></div><div class="legacy-circle"><strong>58</strong><span>Minutos</span></div><div class="legacy-circle"><strong>12</strong><span>Segundos</span></div>
        </div></section></main></body></html>''', wait_until='domcontentloaded')
        section_box=page.locator('#countSection').bounding_box()
        count_box=page.locator('#countdown').bounding_box()
        cells=page.locator('#countdown>div').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height,right:r.right}})')
        count_metrics=page.evaluate('''() => ({scrollWidth:document.documentElement.scrollWidth, innerWidth:innerWidth})''')
        count_ok=contained(section_box,width) and contained(count_box,width) and all(c['x']>=-2 and c['right']<=width+2 for c in cells) and count_metrics['scrollWidth']<=width+2

        # Admin opening controls must not collapse descriptive copy into a vertical
        # sliver as happened when a Store opening was selected.
        page.set_content(f'''<!doctype html><html><head><meta charset="utf-8"><style>
        :root{{--paper:#fffaf3;--ink:#2b2622;--muted:#6e665f;--accent:#873642;--line:#daccc1}}
        *{{box-sizing:border-box}}html,body{{margin:0;width:100%;font-family:Arial,sans-serif}}{CSS}
        body{{padding:12px}}select,input{{max-width:100%}}
        </style></head><body><div class="opening-style-control" id="control">
        <div class="opening-style-copy" id="openingStyleCopy"><strong>Apertura animada</strong><small>Selecciona una experiencia para recomendar diseños afines. Si eliges un sobre, puedes usarlo tal cual o abrir su estudio avanzado.</small></div>
        <label>Apertura<select><option>Jardín luminoso · Store</option></select></label>
        <label>Color de pétalos florales<input type="color" value="#fbf7f0"></label>
        <p id="openingCompatibilitySummary">39 diseños compatibles ordenados para “Jardín luminoso”.</p>
        </div></body></html>''', wait_until='domcontentloaded')
        control_box=page.locator('#control').bounding_box(); text_box=page.locator('#openingStyleCopy').bounding_box()
        admin_metrics=page.evaluate('''() => ({scrollWidth:document.documentElement.scrollWidth, innerWidth:innerWidth})''')
        minimum_text_width = 180 if width < 720 else 240
        admin_ok=contained(control_box,width) and text_box and text_box['width']>=minimum_text_width and admin_metrics['scrollWidth']<=width+2

        row={'viewport':[width,height],'openingContained':bool(opening_ok),'countdownContained':bool(count_ok),'openingControlContained':bool(admin_ok),'openingCopyWidth':round(copy_box['width'],2) if copy_box else None,'adminCopyWidth':round(text_box['width'],2) if text_box else None,'countCellWidths':[round(c['width'],2) for c in cells]}
        results.append(row)
        if not all((opening_ok,count_ok,admin_ok)): failures.append(row)
        page.close()
    browser.close()

payload={'viewports':len(VIEWPORTS),'cases':len(VIEWPORTS)*3,'failures':len(failures),'results':results}
out=ROOT/'docs/validation/evidence/RC38_RESPONSIVE_VISUAL.json'
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(payload,ensure_ascii=False))
if failures: raise SystemExit(1)
print('✓ RC38 responsive visual: apertura, countdown y panel de apertura contenidos en 320/390/1366 px.')
