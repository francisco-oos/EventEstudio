#!/usr/bin/env python3
"""QA visual/funcional del estudio maestro de sobres RC30."""

import json
import os
import re
import statistics
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/"public"
EVIDENCE=ROOT/"docs"/"validation"/"evidence"
EVIDENCE.mkdir(parents=True,exist_ok=True)

HTML=(PUBLIC/"stationery-studio.html").read_text(encoding="utf-8")
ENGINE_CSS=(PUBLIC/"stationery-engine.css").read_text(encoding="utf-8")
STUDIO_CSS=(PUBLIC/"stationery-studio.css").read_text(encoding="utf-8")
SEAL_JS=(PUBLIC/"seal-renderer.js").read_text(encoding="utf-8")
ENGINE_JS=(PUBLIC/"stationery-engine.js").read_text(encoding="utf-8")
STUDIO_JS=(PUBLIC/"stationery-studio.js").read_text(encoding="utf-8")
STUDIO_JS_TEST=STUDIO_JS.replace('const requestedEventId=Number(query.get("eventId")||localStorage.getItem("eventId")||0);','const requestedEventId=7;')
STATIONERY=json.loads((ROOT/"config"/"stationery.json").read_text(encoding="utf-8"))
SEALS=json.loads((ROOT/"config"/"seals.json").read_text(encoding="utf-8"))
DEFAULTS=json.loads((ROOT/"config"/"default-settings.json").read_text(encoding="utf-8"))


def settings_payload():
    settings=json.loads(json.dumps(DEFAULTS))
    settings["couple"]={"partner1":"Andrea","partner2":"Mateo","displayName":"Andrea & Mateo"}
    settings["event"].update({"dateLabel":"18 de diciembre de 2026","title":"Celebración de Andrea y Mateo"})
    settings["typography"]["heading"]="cormorant"
    settings["presentation"]["openingStyle"]=STATIONERY["openingId"]
    settings["stationery"]={**STATIONERY["defaults"],"customized":False,"syncDesignTokens":False}
    settings["seal"]={**SEALS["defaults"],"customized":False}
    settings["_event"]={"id":7,"name":"Celebración de Andrea y Mateo","slug":"qa-studio-rc30"}
    settings["_stationeryCatalog"]=STATIONERY
    settings["_sealCatalog"]=SEALS
    return settings


def document_html(*,role="owner",templates=True):
    settings=settings_payload()
    features={"role":role,"features":[{"key":"templates","allowed":templates}]}
    prelude=f"""<script>
    window.__qaPuts=[];
    window.__qaSettings={json.dumps(settings,ensure_ascii=False)};
    window.__qaFeatures={json.dumps(features,ensure_ascii=False)};
    window.__qaStationery={json.dumps(STATIONERY,ensure_ascii=False)};
    window.__qaSeals={json.dumps(SEALS,ensure_ascii=False)};
    window.fetch=async(input,options={{}})=>{{
      const url=String(input),method=String(options.method||'GET').toUpperCase();
      const respond=value=>new Response(JSON.stringify(value),{{status:200,headers:{{'Content-Type':'application/json'}}}});
      if(url.includes('/api/public/stationery'))return respond(window.__qaStationery);
      if(url.includes('/api/public/seals'))return respond(window.__qaSeals);
      if(url.includes('/api/admin/features'))return respond(window.__qaFeatures);
      if(url.includes('/api/admin/settings')&&method==='PUT'){{
        const body=JSON.parse(options.body||'{{}}');window.__qaPuts.push(body);window.__qaSettings={{...window.__qaSettings,...body,_event:window.__qaSettings._event,_stationeryCatalog:window.__qaStationery,_sealCatalog:window.__qaSeals}};return respond({{ok:true,settings:window.__qaSettings}});
      }}
      if(url.includes('/api/admin/settings'))return respond(window.__qaSettings);
      return new Response(JSON.stringify({{error:'QA route not found'}}),{{status:404,headers:{{'Content-Type':'application/json'}}}});
    }};
    </script>"""
    doc=re.sub(r'<link rel="stylesheet" href="/stationery-engine\.css\?v=[^"]+">',lambda _m:f'<style>{ENGINE_CSS}</style>',HTML)
    doc=re.sub(r'<link rel="stylesheet" href="/stationery-studio\.css\?v=[^"]+">',lambda _m:f'<style>{STUDIO_CSS}</style>',doc)
    scripts=prelude+f"<script>{SEAL_JS}</script><script>{ENGINE_JS}</script><script>{STUDIO_JS_TEST}</script>"
    doc=re.sub(r'<script src="/seal-renderer\.js\?v=[^"]+"></script>\s*<script src="/stationery-engine\.js\?v=[^"]+"></script>\s*<script src="/stationery-studio\.js\?v=[^"]+"></script>',lambda _m:scripts,doc)
    return doc


def sample_fps(page,milliseconds=700):
    return page.evaluate("""ms=>new Promise(resolve=>{const frames=[];let last=performance.now(),start=last;function next(now){frames.push(now-last);last=now;if(now-start>=ms){const data=frames.slice(2).sort((a,b)=>a-b),avg=data.reduce((a,b)=>a+b,0)/Math.max(data.length,1),p95=data[Math.floor(data.length*.95)]||0;resolve({fps:1000/avg,p95Interval:p95,frames:data.length})}else requestAnimationFrame(next)}requestAnimationFrame(next)})""",milliseconds)


def load(page,html):
    page.set_content(html,wait_until="load",timeout=10000)
    page.locator("#stationeryStudioMount .stationery-envelope").wait_for(state="visible",timeout=5000)
    page.wait_for_function("document.querySelector('#contextEvent')?.textContent.includes('Andrea')",timeout=5000)


def inherited_values(page):
    page.locator('[data-tab="settings"]').click()
    values=page.locator('#panel-container input[readonly]').evaluate_all("els=>els.map(el=>el.value)")
    return {"names":values[0] if len(values)>0 else "","date":values[1] if len(values)>1 else "","font":values[2] if len(values)>2 else ""}


def main():
    chromium_path=os.environ.get("EVENTSTUDIO_CHROMIUM_PATH","/usr/bin/chromium")
    if not Path(chromium_path).exists():
        raise SystemExit(f"Chromium obligatorio no encontrado: {chromium_path}")
    rows=[];failures=[]
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path=chromium_path,args=["--no-sandbox","--disable-dev-shm-usage"])
        for width,height in [(390,844),(1440,900)]:
            context=browser.new_context(viewport={"width":width,"height":height},reduced_motion="no-preference")
            page=context.new_page();errors=[]
            page.on("pageerror",lambda error,errors=errors:errors.append(str(error)))
            page.on("console",lambda message,errors=errors:errors.append(message.text) if message.type=="error" else None)
            load(page,document_html())
            inherited=inherited_values(page)
            page.locator('[data-tab="formats"]').click()
            preset_count=page.locator('[data-preset]').count()
            preset_svg_count=page.locator('[data-preset] .preset-swatch svg').count()
            preset_rendered=0
            for preset_id in [item["id"] for item in STATIONERY.get("presets",[])]:
                card=page.locator(f'[data-preset="{preset_id}"]')
                card.click()
                if card.evaluate("el=>el.classList.contains('active')") and page.locator('#stationeryStudioMount svg').count()>0:
                    preset_rendered+=1
            page.locator('[data-tab="materials"]').click()
            page.locator('[data-choice-key="materialId"]').first.wait_for()
            material_count=page.locator('[data-choice-key="materialId"]').count()
            material_svg_count=page.locator('[data-choice-key="materialId"] .material-chip svg').count()
            material_rendered=0
            for material_id in [item["id"] for item in STATIONERY.get("materials",[])]:
                choice=page.locator(f'[data-choice-key="materialId"][data-choice-id="{material_id}"]')
                choice.click()
                if choice.evaluate("el=>el.classList.contains('active')") and page.locator('#stationeryStudioMount svg').count()>0:
                    material_rendered+=1
            resource_specs=[
                ("frames","frameId","frames"),
                ("dividers","dividerId","dividers"),
                ("liners","linerId","liners"),
                ("laces","overlayId","overlays"),
                ("stamps","stampId","stamps"),
            ]
            resource_checks={}
            for tab_id,state_key,catalog_key in resource_specs:
                page.locator(f'[data-tab="{tab_id}"]').click()
                expected_items=STATIONERY.get(catalog_key,[])
                choices=page.locator(f'[data-choice-key="{state_key}"]')
                choice_count=choices.count()
                svg_count=page.locator(f'[data-choice-key="{state_key}"]:not([data-choice-id="none"]) .lib-preview svg').count()
                rendered=0
                for item in expected_items:
                    choice=page.locator(f'[data-choice-key="{state_key}"][data-choice-id="{item["id"]}"]')
                    choice.click()
                    if choice.evaluate("el=>el.classList.contains('active')") and page.locator('#stationeryStudioMount svg').count()>0:
                        rendered+=1
                resource_checks[catalog_key]={"choices":choice_count,"expected":len(expected_items),"svg":svg_count,"expectedSvg":len([item for item in expected_items if item["id"]!="none"]),"rendered":rendered}
            page.locator('[data-tab="settings"]').click()
            outer=page.locator('[data-key="outerColor"]');outer.evaluate("el=>{el.value='#123456';el.dispatchEvent(new Event('input',{bubbles:true}))}")
            seal_color=page.locator('[data-key="sealColor"]');seal_color.evaluate("el=>{el.value='#654321';el.dispatchEvent(new Event('input',{bubbles:true}))}")
            page.locator('[data-tab="seals"]').click();page.locator('[data-key="fontSize"]').wait_for()
            seal_svg=page.locator('#liveSealPreview svg').count()
            seal_material=page.locator('[data-key="material"]').input_value()
            page.locator('#stationeryStudioMount').click(position={"x":20,"y":20});fps=sample_fps(page)
            opened=page.locator('#stationeryStudioPreview').evaluate("el=>el.classList.contains('is-preview-open')")
            page.locator('#stationeryStudioMount').click(position={"x":20,"y":20})
            closed=not page.locator('#stationeryStudioPreview').evaluate("el=>el.classList.contains('is-preview-open')")
            page.locator('#stationeryStudioMount').click(position={"x":20,"y":20})
            page.locator('#applyStudioBtn').click();page.wait_for_function("window.__qaPuts.length===1",timeout=4000)
            put=page.evaluate("window.__qaPuts[0]")
            metrics=page.evaluate("() => ({overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,open:document.querySelector('#stationeryStudioPreview').classList.contains('is-preview-open'),dirty:document.querySelector('#studioDirtyState').textContent,outer:document.querySelector('#stationeryStudioMount').style.getPropertyValue('--st-outer')})")
            row={"viewport":[width,height],"inherited":inherited,"presetCount":preset_count,"presetSvgCount":preset_svg_count,"presetsRendered":preset_rendered,"materialCount":material_count,"materialSvgCount":material_svg_count,"materialsRendered":material_rendered,"resources":resource_checks,"sealSvg":seal_svg,"sealMaterial":seal_material,"fps":fps,"overflow":metrics["overflow"],"previewOpen":metrics["open"],"clickOpened":opened,"clickClosed":closed,"putKeys":sorted(put.keys()),"openingStyle":put.get("presentation",{}).get("openingStyle"),"customized":put.get("stationery",{}).get("customized"),"sync":put.get("stationery",{}).get("syncDesignTokens"),"outerColor":put.get("stationery",{}).get("outerColor"),"sealColor":put.get("stationery",{}).get("sealColor"),"errors":errors}
            row["ok"]=(inherited["names"]=="Andrea & Mateo" and inherited["date"]=="18 de diciembre de 2026" and "Cormorant" in inherited["font"] and preset_count==len(STATIONERY["presets"]) and preset_svg_count==len(STATIONERY["presets"]) and preset_rendered==len(STATIONERY["presets"]) and material_count==len(STATIONERY["materials"]) and material_svg_count==len(STATIONERY["materials"]) and material_rendered==len(STATIONERY["materials"]) and all(check["choices"]==check["expected"] and check["svg"]==check["expectedSvg"] and check["rendered"]==check["expected"] for check in resource_checks.values()) and seal_svg==1 and seal_material=="theme" and metrics["overflow"]<=2 and opened and closed and metrics["open"] and sorted(put.keys())==["presentation","seal","stationery"] and row["openingStyle"]==STATIONERY["openingId"] and row["customized"] is True and row["sync"] is True and row["outerColor"]=="#123456" and row["sealColor"]=="#654321" and not errors and fps["fps"]>=48 and fps["p95Interval"]<=40)
            rows.append(row)
            if not row["ok"]:failures.append(row)
            context.close()

        profile_matrix=[
            ("superadmin-propietario","owner",False,True),
            ("desarrollador","developer",False,True),
            ("cliente-pago-con-plantillas","client",True,True),
            ("cliente-gratuito-sin-plantillas","client",False,False),
            ("cliente-cortesia-con-concesion-plantillas","client",True,True),
        ]
        for profile_label,role,templates,expected in profile_matrix:
            context=browser.new_context(viewport={"width":1200,"height":800})
            page=context.new_page();errors=[];page.on("pageerror",lambda error,errors=errors:errors.append(str(error)))
            load(page,document_html(role=role,templates=templates))
            actual=not page.locator('#applyStudioBtn').is_disabled()
            check={"profile":profile_label,"role":role,"templates":templates,"canApply":actual,"expected":expected,"status":page.locator('#studioStatus').inner_text(),"errors":errors,"ok":actual==expected and not errors}
            if not check["ok"]:failures.append(check)
            rows.append({"profile":check})
            context.close()
        browser.close()
    perf_rows=[row for row in rows if "fps" in row]
    summary={"cases":len(perf_rows),"profileCases":len(profile_matrix),"failures":len(failures),"minFps":min((row["fps"]["fps"] for row in perf_rows),default=0),"avgFps":statistics.mean([row["fps"]["fps"] for row in perf_rows]) if perf_rows else 0,"maxP95IntervalMs":max((row["fps"]["p95Interval"] for row in perf_rows),default=0)}
    (EVIDENCE/"RC30_STATIONERY_INDEX_PARITY_VISUAL.json").write_text(json.dumps({"summary":summary,"rows":rows,"failures":failures},ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(summary,ensure_ascii=False))
    if failures:
        print(json.dumps(failures,ensure_ascii=False,indent=2));return 1
    return 0

if __name__=="__main__":
    sys.exit(main())
