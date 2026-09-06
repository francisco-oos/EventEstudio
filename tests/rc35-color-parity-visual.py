#!/usr/bin/env python3
"""RC35: la paleta cruda de cada Recipe produce los mismos tokens legibles en publicación."""
from __future__ import annotations
import importlib.util, json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'docs'/'validation'/'evidence';EVIDENCE.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('rc32_recipe_visual',ROOT/'tests'/'rc32-recipe-visual.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
RECIPES=base.RECIPES
original=base.config_for

def config_for(recipe):
    cfg=original(recipe)
    cfg['media']['heroImage']=''
    cfg['presentation']['openingStyle']='none'
    cfg['couple']['displayName']='Alexandra Fernanda y Maximiliano Sebastián'
    # Intencional: enviamos la paleta cruda, sin tokens semánticos del servidor.
    # El renderer público debe proteger por sí mismo la legibilidad igual que el Design Lab.
    cfg['_palette']=dict(recipe['design']['palette'])
    return cfg
base.config_for=config_for

def main():
    chromium=os.environ.get('EVENTSTUDIO_CHROMIUM_PATH','/usr/bin/chromium')
    if not Path(chromium).exists():raise SystemExit(f'Chromium obligatorio no encontrado: {chromium}')
    rows=[];failures=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=chromium,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in [(360,800),(1440,900)]:
            context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
            for recipe in RECIPES:
                page=context.new_page();errors=[];page.on('pageerror',lambda e,errors=errors:errors.append(str(e)))
                page.set_content(base.html_for(recipe),wait_until='load',timeout=10000);page.wait_for_timeout(35)
                metrics=page.evaluate("""()=>{
                  const root=getComputedStyle(document.documentElement),name=document.getElementById('coupleName'),nameCss=getComputedStyle(name);
                  function rgb(v){const m=String(v).match(/rgba?\\((\\d+)[ ,]+(\\d+)[ ,]+(\\d+)/);return m?[+m[1],+m[2],+m[3]]:null}
                  function ary(v){if(/^#[0-9a-f]{6}$/i.test(v)){return [parseInt(v.slice(1,3),16),parseInt(v.slice(3,5),16),parseInt(v.slice(5,7),16)]}return rgb(v)}
                  function lum(v){const a=ary(v);if(!a)return NaN;const q=a.map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return q[0]*.2126+q[1]*.7152+q[2]*.0722}
                  function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
                  const paper=root.getPropertyValue('--paper').trim(),paperContrast=root.getPropertyValue('--paper-contrast').trim();
                  const accent=root.getPropertyValue('--accent').trim(),accentContrast=root.getPropertyValue('--accent-contrast').trim();
                  const hero=document.querySelector('[data-es-type="hero"]');
                  return {paper,paperContrast,accent,accentContrast,nameColor:nameCss.color,namePaperRatio:ratio(nameCss.color,paper),paperRatio:ratio(paperContrast,paper),accentRatio:ratio(accentContrast,accent),wordBreak:nameCss.wordBreak,overflowWrap:nameCss.overflowWrap,hyphens:nameCss.hyphens,noMedia:hero?.classList.contains('es-hero-no-media'),overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth};
                }""")
                ok=(metrics['paperRatio']>=4.5 and metrics['accentRatio']>=4.5 and metrics['namePaperRatio']>=4.5 and metrics['wordBreak']!='break-all' and metrics['overflowWrap']!='anywhere' and metrics['noMedia'] and metrics['overflow']<=2 and not errors)
                row={'recipe':recipe['id'],'viewport':[width,height],**metrics,'errors':errors,'ok':ok};rows.append(row)
                if not ok:failures.append(row)
                page.close()
            context.close()
        browser.close()
    summary={'recipes':len(RECIPES),'cases':len(rows),'failures':len(failures),'minPaperContrast':min((r['paperRatio'] for r in rows),default=0),'minNameContrast':min((r['namePaperRatio'] for r in rows),default=0),'minAccentContrast':min((r['accentRatio'] for r in rows),default=0),'maxOverflow':max((r['overflow'] for r in rows),default=0)}
    (EVIDENCE/'RC35_COLOR_PARITY_VISUAL.json').write_text(json.dumps({'summary':summary,'failures':failures,'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if failures:
        print(json.dumps(failures[:8],ensure_ascii=False,indent=2));return 1
    print('✓ RC35 color visual: 64 Recipes con paleta cruda mantienen contraste AA en publicación móvil/escritorio.')
    return 0
if __name__=='__main__':sys.exit(main())
