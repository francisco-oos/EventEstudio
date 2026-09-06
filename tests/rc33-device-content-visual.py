#!/usr/bin/env python3
"""Valida Recipes representativas con contenido extremo desde móvil compacto hasta 4K."""
from __future__ import annotations
import importlib.util, json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("rc32_recipe",ROOT/"tests"/"rc32-recipe-visual.py")
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
RECIPES=mod.RECIPES
REPRESENTATIVE_IDS=['botanical-scroll','daisy-shadow-studio','photo-scrapbook','cinematic-vows','destination-passport','pixel-quest','family-memories','magazine-cover']
recipe_by_id={recipe['id']:recipe for recipe in RECIPES}
REPRESENTATIVE=[recipe_by_id[rid] for rid in REPRESENTATIVE_IDS]
DEVICES=[(320,568),(430,932),(768,1024),(1024,768),(1366,768),(1920,1080),(2560,1440),(3840,2160)]
LONG_NAME="Alejandra Fernanda de los Ángeles Montenegro Villaseñor & Maximiliano Sebastián de la Fuente Rodríguez"
LONG_ADDRESS="Salón Jardín de los Recuerdos, Avenida Extraordinariamente Larga de la Celebración Número 1845, Colonia Jardines del Horizonte, Municipio de San Pedro de las Flores, Estado de México, México"
LONG_STORY="Nuestra historia reúne muchos años, caminos compartidos, personas queridas y pequeños detalles que merecen contarse con suficiente espacio para comprobar que ningún marco ornamental, tarjeta o bloque editorial pierda legibilidad aunque el anfitrión escriba una dedicatoria considerablemente más extensa de lo habitual."


def html_for(recipe):
    cfg=mod.config_for(recipe)
    cfg['couple'].update({'partner1':'Alejandra Fernanda de los Ángeles Montenegro Villaseñor','partner2':'Maximiliano Sebastián de la Fuente Rodríguez','displayName':LONG_NAME})
    cfg['event'].update({'heroMessage':LONG_STORY,'closingMessage':LONG_STORY})
    cfg['venue'].update({'name':'Hacienda Internacional de Celebraciones y Jardines EventStudio','address':LONG_ADDRESS,'notes':LONG_STORY})
    cfg['venues']['ceremony'].update({'name':cfg['venue']['name'],'address':LONG_ADDRESS})
    cfg['venues']['reception'].update({'name':'Gran Salón Panorámico de Recepciones y Celebraciones Familiares','address':LONG_ADDRESS})
    cfg['story'].update({'title':'Una historia que continúa escribiéndose con cada recuerdo compartido','text':LONG_STORY})
    cfg['dressCode'].update({'title':'Formal de celebración con recomendaciones especiales','description':LONG_STORY})
    cfg['gifts'].update({'bankInfoEnabled':True,'bankInfo':'Institución bancaria de validación · Beneficiario con nombre extraordinariamente largo · CLABE 012345678901234567'})
    payload=json.dumps(cfg,ensure_ascii=False).replace('</','<\\/')
    prelude=f"""<script>window.fetch=async()=>new Response(JSON.stringify({payload}),{{status:200,headers:{{'Content-Type':'application/json'}}}});Object.defineProperty(HTMLMediaElement.prototype,'paused',{{configurable:true,get:function(){{return !this.__qaPlaying;}}}});Object.defineProperty(HTMLMediaElement.prototype,'play',{{configurable:true,value:function(){{this.__qaPlaying=true;return Promise.resolve();}}}});Object.defineProperty(HTMLMediaElement.prototype,'pause',{{configurable:true,value:function(){{this.__qaPlaying=false;this.dispatchEvent(new Event('pause'));}}}});</script>"""
    scripts=prelude+f'<script>{mod.RENDERERS}</script><script>{mod.SEAL_RENDERER}</script><script>{mod.STATIONERY_ENGINE}</script><script>{mod.DESIGN_ENGINE}</script><script>{mod.APP}</script>'
    return mod.BASE.replace('__SCRIPTS__',scripts)


def main():
    chromium=os.environ.get('EVENTSTUDIO_CHROMIUM_PATH','/usr/bin/chromium')
    failures=[]; rows=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=chromium,args=['--no-sandbox','--disable-dev-shm-usage'])
        for width,height in DEVICES:
            context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='no-preference')
            for recipe in REPRESENTATIVE:
                page=context.new_page(); errors=[]; page.on('pageerror',lambda e,errors=errors: errors.append(str(e)))
                page.set_content(html_for(recipe),wait_until='load',timeout=12000); page.wait_for_timeout(40)
                metrics=page.evaluate("""() => {
                  const viewport=document.documentElement.clientWidth;
                  const overflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-viewport;
                  const offenders=[...document.querySelectorAll('h1,h2,h3,p,strong,small,address,.event-location,.story-text')].filter(el=>{
                    const r=el.getBoundingClientRect(); if(!r.width||!r.height)return false;
                    const cs=getComputedStyle(el); if(cs.position==='fixed')return false;
                    return r.left < -2 || r.right > viewport+2 || el.scrollWidth > el.clientWidth+3;
                  }).slice(0,12).map(el=>({tag:el.tagName,cls:el.className,text:(el.textContent||'').trim().slice(0,70),rect:[el.getBoundingClientRect().left,el.getBoundingClientRect().right],sizes:[el.scrollWidth,el.clientWidth]}));
                  const music=document.getElementById('musicBtn')?.getBoundingClientRect();
                  const lang=document.querySelector('.public-language-switcher')?.getBoundingClientRect();
                  const overlaps=(a,b)=>a&&b&&a.width&&b.width&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
                  return {overflow,offenders,musicLanguageOverlap:overlaps(music,lang),recipe:document.body.dataset.designRecipe||'',failed:document.body.innerText.includes('No pudimos abrir')};
                }""")
                ok=metrics['overflow']<=2 and not metrics['offenders'] and not metrics['musicLanguageOverlap'] and not metrics['failed'] and not errors
                row={'recipe':recipe['id'],'layout':recipe['design'].get('layoutFamily'),'viewport':[width,height],**metrics,'errors':errors,'ok':ok}; rows.append(row)
                if not ok: failures.append(row)
                page.close()
            context.close()
        browser.close()
    evidence=ROOT/'docs'/'validation'/'evidence'; evidence.mkdir(parents=True,exist_ok=True)
    (evidence/'RC33_DEVICE_LONG_CONTENT.json').write_text(json.dumps({'devices':DEVICES,'representativeRecipes':len(REPRESENTATIVE),'cases':len(rows),'failures':failures,'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'layouts':len(REPRESENTATIVE),'devices':len(DEVICES),'cases':len(rows),'failures':len(failures)},ensure_ascii=False))
    if failures:
        print(json.dumps(failures[:6],ensure_ascii=False,indent=2)); return 1
    print('✓ RC33 long-content/device: sin overflow de textos ni colisión música/idioma desde 320 px hasta 4K.')
    return 0

if __name__=='__main__': sys.exit(main())
