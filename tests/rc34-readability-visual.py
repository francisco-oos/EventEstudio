#!/usr/bin/env python3
"""RC34: legibilidad de nombres y contraste semántico de las 64 Recipes."""
from __future__ import annotations
import importlib.util, json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'docs'/'validation'/'evidence'; EVIDENCE.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('rc32_recipe_visual',ROOT/'tests'/'rc32-recipe-visual.py')
base=importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
RECIPES=base.RECIPES
original_config_for=base.config_for
ACTIVE_NAME='Ariana y Francisco'

def contrast_color(hex_value):
    value=str(hex_value or '#ffffff').lstrip('#')
    if len(value)!=6:return '#1f1f1f'
    rgb=[int(value[i:i+2],16)/255 for i in (0,2,4)]
    linear=[x/12.92 if x<=.03928 else ((x+.055)/1.055)**2.4 for x in rgb]
    lum=.2126*linear[0]+.7152*linear[1]+.0722*linear[2]
    black=(lum+.05)/.05; white=1.05/(lum+.05)
    return '#000000' if black>=white else '#ffffff'

def custom_config(recipe):
    cfg=original_config_for(recipe)
    cfg['couple']['displayName']=ACTIVE_NAME
    cfg['couple']['partner1']='Ariana Jiménez Gonzales'
    cfg['couple']['partner2']='Francisco Alejandro Alvarado Leyva'
    cfg['media']['heroImage']=''
    cfg['presentation']['openingStyle']='none'
    palette=dict(cfg.get('_palette') or recipe['design']['palette'])
    palette['paperContrast']=contrast_color(palette.get('paper'))
    palette['bgContrast']=contrast_color(palette.get('bg'))
    cfg['_palette']=palette
    return cfg
base.config_for=custom_config

def word_rect_counts(page,selector):
    return page.eval_on_selector(selector,"""el=>{
      const node=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE)||el.firstChild;
      if(!node)return [];
      const text=node.textContent||''; const out=[]; const re=/\\S+/g; let m;
      while((m=re.exec(text))){const r=document.createRange();r.setStart(node,m.index);r.setEnd(node,m.index+m[0].length);out.push({word:m[0],rects:r.getClientRects().length});}
      return out;
    }""")

def main():
    chromium=os.environ.get('EVENTSTUDIO_CHROMIUM_PATH','/usr/bin/chromium')
    if not Path(chromium).exists(): raise SystemExit(f'Chromium obligatorio no encontrado: {chromium}')
    scenarios=[((320,568),'Ariana y Francisco'),((390,844),'Alexandra Fernanda y Maximiliano Sebastián')]
    rows=[]; failures=[]
    with sync_playwright() as pw:
      browser=pw.chromium.launch(headless=True,executable_path=chromium,args=['--no-sandbox','--disable-dev-shm-usage'])
      for (width,height),name in scenarios:
        global ACTIVE_NAME; ACTIVE_NAME=name
        context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
        for recipe in RECIPES:
          page=context.new_page(); errors=[]; page.on('pageerror',lambda e,errors=errors:errors.append(str(e)))
          page.set_content(base.html_for(recipe),wait_until='load',timeout=10000);page.wait_for_timeout(90)
          metrics=page.evaluate("""()=>{
            const el=document.getElementById('coupleName');const cs=getComputedStyle(el);const root=getComputedStyle(document.documentElement);
            function rgb(v){const m=String(v).match(/rgba?\\((\\d+)[ ,]+(\\d+)[ ,]+(\\d+)/);return m?[+m[1],+m[2],+m[3]]:null}
            function hex(v){if(/^#[0-9a-f]{6}$/i.test(v)){return [parseInt(v.slice(1,3),16),parseInt(v.slice(3,5),16),parseInt(v.slice(5,7),16)]}return rgb(v)}
            function lum(v){const a=hex(v);if(!a)return NaN;const q=a.map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return q[0]*.2126+q[1]*.7152+q[2]*.0722}
            function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
            const paper=root.getPropertyValue('--paper').trim(),paperContrast=root.getPropertyValue('--paper-contrast').trim();
            const bg=root.getPropertyValue('--bg').trim(),bgContrast=root.getPropertyValue('--bg-contrast').trim();
            return {overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,fontSize:parseFloat(cs.fontSize),wordBreak:cs.wordBreak,overflowWrap:cs.overflowWrap,hyphens:cs.hyphens,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,rects:el.getClientRects().length,paperRatio:ratio(paperContrast,paper),bgRatio:ratio(bgContrast,bg),text:el.textContent};
          }""")
          words=word_rect_counts(page,'#coupleName')
          broken=[item for item in words if item['rects']>1]
          ok=(metrics['overflow']<=2 and not broken and metrics['wordBreak']!='break-all' and metrics['overflowWrap']!='anywhere' and metrics['fontSize']>=19 and metrics['paperRatio']>=4.5 and metrics['bgRatio']>=4.5 and not errors)
          row={'recipe':recipe['id'],'viewport':[width,height],'name':name,**metrics,'brokenWords':broken,'errors':errors,'ok':ok};rows.append(row)
          if not ok:failures.append(row)
          page.close()
        context.close()
      browser.close()
    summary={'recipes':len(RECIPES),'cases':len(rows),'failures':len(failures),'maxOverflow':max((x['overflow'] for x in rows),default=0),'minFontSize':min((x['fontSize'] for x in rows),default=0),'minPaperContrast':min((x['paperRatio'] for x in rows),default=0),'minBgContrast':min((x['bgRatio'] for x in rows),default=0)}
    (EVIDENCE/'RC34_READABILITY_VISUAL.json').write_text(json.dumps({'summary':summary,'failures':failures,'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if failures:
      print(json.dumps(failures[:8],ensure_ascii=False,indent=2));return 1
    print('✓ RC34 visual: 64 Recipes, nombres largos sin corte dentro de palabra y contraste semántico AA.')
    return 0
if __name__=='__main__':sys.exit(main())
