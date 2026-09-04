#!/usr/bin/env python3
"""QA visual reproducible para plantillas y aperturas públicas de EventStudio."""

import json
import os
import re
import statistics
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError as exc:
    raise SystemExit("Playwright de Python es obligatorio para esta prueba visual.") from exc

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/"public"
EVIDENCE=ROOT/"docs"/"validation"/"evidence"
EVIDENCE.mkdir(parents=True,exist_ok=True)

THEMES=json.loads((ROOT/"config"/"themes.json").read_text(encoding="utf-8"))
EXPERIENCES=json.loads((ROOT/"config"/"experiences.json").read_text(encoding="utf-8"))
DEFAULTS=json.loads((ROOT/"config"/"default-settings.json").read_text(encoding="utf-8"))
SEALS=json.loads((ROOT/"config"/"seals.json").read_text(encoding="utf-8"))
CSS=(PUBLIC/"styles.css").read_text(encoding="utf-8")
STATIONERY_CSS=(PUBLIC/"stationery-engine.css").read_text(encoding="utf-8")
RENDERERS=(PUBLIC/"experience-renderers.js").read_text(encoding="utf-8")
SEAL_RENDERER=(PUBLIC/"seal-renderer.js").read_text(encoding="utf-8")
STATIONERY_ENGINE=(PUBLIC/"stationery-engine.js").read_text(encoding="utf-8")
APP=(PUBLIC/"app.js").read_text(encoding="utf-8")
INDEX=(PUBLIC/"index.html").read_text(encoding="utf-8")

BASE=re.sub(r'<link rel="stylesheet" href="/styles\.css\?v=[^"]+">',lambda _match:f"<style>{CSS}</style>",INDEX)
BASE=re.sub(r'<link rel="stylesheet" href="/stationery-engine\.css\?v=[^"]+">',lambda _match:f"<style>{STATIONERY_CSS}</style>",BASE)
BASE=re.sub(r'<script src="/experience-renderers\.js\?v=[^"]+"></script><script src="/seal-renderer\.js\?v=[^"]+"></script><script src="/stationery-engine\.js\?v=[^"]+"></script><script src="/app\.js\?v=[^"]+"></script>',"__SCRIPTS__",BASE)
PALETTE={"bg":"#f7f2eb","paper":"#fffdf9","ink":"#302824","muted":"#766a62","accent":"#7b2331","accentText":"#7b2331","gold":"#b59464","line":"#dfd3c7","accentContrast":"#ffffff"}


def qa_config(theme_id,opening_id):
    theme=next(item for item in THEMES if item["id"]==theme_id)
    config=json.loads(json.dumps(DEFAULTS))
    config["themeId"]=theme_id
    config["couple"]={"partner1":"Alejandra Fernanda","partner2":"Maximiliano Sebastián","displayName":"Alejandra Fernanda & Maximiliano Sebastián"}
    config["event"].update({"dateTime":"2027-12-14T18:30:00-06:00","dateLabel":"Martes 14 de diciembre de 2027","heroMessage":"Una celebración construida con detalles, recuerdos y una historia que queremos compartir con ustedes.","closingMessage":"Gracias por acompañarnos en un momento que recordaremos siempre.","slug":"qa-event"})
    config["venue"].update({"title":"Ceremonia y celebración","name":"Hacienda de los Jardines de Santa María","ceremonyTime":"18:30","receptionTime":"20:00","address":"Avenida de la Celebración 1234, Colonia Centro, Villahermosa, Tabasco","notes":"Acceso principal por el jardín norte."})
    config["venues"]["ceremony"].update({"name":config["venue"]["name"],"time":"18:30","address":config["venue"]["address"]})
    config["venues"]["reception"].update({"name":config["venue"]["name"],"time":"20:00","address":config["venue"]["address"]})
    config["story"].update({"title":"Nuestra historia y el comienzo de una nueva etapa","text":"Texto deliberadamente extenso para validar contenido real sin cortes, traslapes ni desbordamientos inesperados."})
    config["dressCode"].update({"title":"Formal de noche","description":"Vestimenta formal. Evita tonos reservados para los anfitriones."})
    config["gifts"].update({"mode":"bank-transfer","bankInfoEnabled":True,"bankInfo":"Banco de prueba · CLABE 012345678901234567","openpay":{"enabled":False,"suggestedAmountCents":100000,"allowCustomAmount":True,"messageEnabled":True}})
    config["presentation"].update({"openingStyle":opening_id,"motionLevel":"balanced","experienceMode":"auto","galleryStyle":"classic"})
    config["media"]["gallery"]=[]
    config["_experiences"]={"openings":EXPERIENCES["openings"],"galleries":EXPERIENCES["galleries"],"motionLevels":EXPERIENCES["motionLevels"]}
    config["_sealCatalog"]=SEALS
    config["_theme"]={"id":theme_id,"layoutFamily":theme.get("layoutFamily","classic"),"motionPreset":theme.get("motionPreset","subtle"),"photoStyle":theme.get("photoStyle","cards"),"motif":theme.get("motif","spark"),"defaultExperience":theme.get("defaultExperience","classic")}
    config["_palette"]=PALETTE
    config["_surfaceTexture"]="none"
    config["_revision"]="qa-rc23"
    config["_platform"]={"branding":{"attributionEnabled":False,"attributionOnInvitation":False,"attributionLabel":"EventStudio","attributionUrl":""}}
    config["features"]={key:True for key in config.get("features",{})}
    config["features"]["guestPhotoMessages"]=False
    return config


def document_html(theme_id,opening_id):
    payload=json.dumps(qa_config(theme_id,opening_id),ensure_ascii=False).replace("</","<\\/")
    prelude=f"""<script>window.__qaShifts=[];try{{new PerformanceObserver(l=>{{for(const e of l.getEntries())if(!e.hadRecentInput)window.__qaShifts.push(e.value)}}).observe({{type:'layout-shift',buffered:true}})}}catch{{}};window.fetch=async()=>new Response(JSON.stringify({payload}),{{status:200,headers:{{'Content-Type':'application/json'}}}});</script>"""
    scripts=prelude+f"<script>{RENDERERS}</script><script>{SEAL_RENDERER}</script><script>{STATIONERY_ENGINE}</script><script>{APP}</script>"
    return BASE.replace("__SCRIPTS__",scripts)


def geometry(page):
    return page.evaluate("""() => {const rect=s=>{const n=document.querySelector(s);if(!n)return null;const x=n.getBoundingClientRect();return {l:x.left,t:x.top,r:x.right,b:x.bottom,w:x.width,h:x.height}};return {copy:rect('.opening-copy'),envelope:rect('.opening-envelope'),action:rect('.opening-envelope-button>strong'),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}}""")


def critical_overlap(g):
    envelope=g.get("envelope"); copy=g.get("copy"); action=g.get("action")
    visible=bool(envelope and envelope.get("w",0)>1 and envelope.get("h",0)>1)
    return bool(visible and copy and copy["b"]>envelope["t"]+4) or bool(visible and action and envelope["b"]>action["t"]+4)


def sample_fps(page,milliseconds=450):
    return page.evaluate("""ms=>new Promise(resolve=>{const frames=[];let last=performance.now(),start=last;function next(now){frames.push(now-last);last=now;if(now-start>=ms){const data=frames.slice(2).sort((a,b)=>a-b),avg=data.reduce((a,b)=>a+b,0)/Math.max(data.length,1),p95=data[Math.floor(data.length*.95)]||0;resolve({fps:1000/avg,p95Interval:p95,frames:data.length})}else requestAnimationFrame(next)}requestAnimationFrame(next)})""",milliseconds)


def main():
    chromium_path=os.environ.get("EVENTSTUDIO_CHROMIUM_PATH","/usr/bin/chromium")
    if not Path(chromium_path).exists():
        raise SystemExit(f"Chromium obligatorio no encontrado: {chromium_path}")
    template_rows=[]; opening_rows=[]; failures=[]
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path=chromium_path,args=["--no-sandbox","--disable-dev-shm-usage"])
        for width,height in [(390,844),(1440,900)]:
            context=browser.new_context(viewport={"width":width,"height":height},reduced_motion="no-preference")
            page=context.new_page()
            for theme in THEMES:
                page.set_content(document_html(theme["id"],"none"),wait_until="load",timeout=8000)
                page.wait_for_timeout(40)
                metrics=page.evaluate("() => ({scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),clientWidth:document.documentElement.clientWidth,failed:document.body.innerText.includes('No pudimos abrir')})")
                row={"theme":theme["id"],"viewport":[width,height],"overflow":metrics["scrollWidth"]-metrics["clientWidth"],"ok":metrics["scrollWidth"]<=metrics["clientWidth"]+2 and not metrics["failed"]}
                template_rows.append(row)
                if not row["ok"]: failures.append(row)
            context.close()
        context=browser.new_context(viewport={"width":390,"height":844},reduced_motion="no-preference")
        for opening in [item for item in EXPERIENCES["openings"] if item["id"]!="none"]:
            page=context.new_page(); errors=[]
            page.on("pageerror",lambda error,errors=errors:errors.append(str(error)))
            page.on("console",lambda message,errors=errors:errors.append(message.text) if message.type=="error" else None)
            page.set_content(document_html("romantic-wine",opening["id"]),wait_until="load",timeout=8000)
            page.locator("#invitationOpening").wait_for(state="visible",timeout=3000)
            before=geometry(page); page.locator("#openingEnvelopeButton").click(); frame_metrics=sample_fps(page); after=geometry(page)
            cls=page.evaluate("window.__qaShifts.reduce((sum,value)=>sum+value,0)")
            overflow=max(before["scrollWidth"]-before["clientWidth"],after["scrollWidth"]-after["clientWidth"])
            row={"opening":opening["id"],"overflow":overflow,"overlap":critical_overlap(before),"cls":cls,"fps":frame_metrics,"errors":errors}
            row["ok"]=overflow<=2 and not row["overlap"] and not errors and cls<=0.05 and frame_metrics["fps"]>=48 and frame_metrics["p95Interval"]<=40
            opening_rows.append(row)
            if not row["ok"]: failures.append(row)
            page.close()
        context.close(); browser.close()
    fps_values=[row["fps"]["fps"] for row in opening_rows]
    summary={
        "templateViewports":[[390,844],[1440,900]],
        "templateCases":len(template_rows),"templateFailures":sum(not row["ok"] for row in template_rows),"maxTemplateOverflow":max((row["overflow"] for row in template_rows),default=0),
        "openingCases":len(opening_rows),"openingFailures":sum(not row["ok"] for row in opening_rows),"minOpeningFps":min(fps_values) if fps_values else 0,"avgOpeningFps":statistics.mean(fps_values) if fps_values else 0,
        "maxOpeningP95IntervalMs":max((row["fps"]["p95Interval"] for row in opening_rows),default=0),"maxOpeningCls":max((row["cls"] for row in opening_rows),default=0),"maxOpeningOverflow":max((row["overflow"] for row in opening_rows),default=0)
    }
    output={"summary":summary,"templates":template_rows,"openings":opening_rows,"failures":failures}
    (EVIDENCE/"RC23_VISUAL_ACCEPTANCE.json").write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(summary,ensure_ascii=False))
    if failures:
        print(json.dumps(failures[:10],ensure_ascii=False,indent=2))
        return 1
    return 0


if __name__=="__main__":
    sys.exit(main())
