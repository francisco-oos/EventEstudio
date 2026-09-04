#!/usr/bin/env python3
"""Matriz adicional de dispositivos para las cinco aperturas/plantillas RC22-RC23."""
import json
import os
import runpy
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
qa=runpy.run_path(str(ROOT/"tests"/"visual-acceptance.py"))
document_html=qa["document_html"]
geometry=qa["geometry"]
critical_overlap=qa["critical_overlap"]
EVIDENCE=ROOT/"docs"/"validation"/"evidence"
PAIRS=[
    ("powder-blue-letter","powder-blue-seal"),
    ("gala-marquee","gala-curtain"),
    ("celestial-constellation","constellation-veil"),
    ("blush-heart-letter","blush-heart-emblem"),
    ("gran-reserva","reserve-uncork")
]
DEVICES=[(320,568),(360,800),(390,844),(412,915),(768,1024),(1440,900)]

def main():
    chromium_path=os.environ.get("EVENTSTUDIO_CHROMIUM_PATH","/usr/bin/chromium")
    if not Path(chromium_path).exists(): raise SystemExit(f"Chromium obligatorio no encontrado: {chromium_path}")
    rows=[]; failures=[]
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path=chromium_path,args=["--no-sandbox","--disable-dev-shm-usage"])
        for theme,opening in PAIRS:
            for width,height in DEVICES:
                context=browser.new_context(viewport={"width":width,"height":height},reduced_motion="reduce")
                page=context.new_page(); errors=[]
                page.on("pageerror",lambda error,errors=errors:errors.append(str(error)))
                page.on("console",lambda message,errors=errors:errors.append(message.text) if message.type=="error" else None)
                page.set_content(document_html(theme,opening),wait_until="load",timeout=8000)
                page.locator("#invitationOpening").wait_for(state="visible",timeout=3000)
                metrics=geometry(page); overflow=metrics["scrollWidth"]-metrics["clientWidth"]
                row={"theme":theme,"opening":opening,"viewport":[width,height],"overflow":overflow,"overlap":critical_overlap(metrics),"errors":errors}
                row["ok"]=overflow<=2 and not row["overlap"] and not errors
                rows.append(row)
                if not row["ok"]: failures.append(row)
                context.close()
        browser.close()
    output={"summary":{"deviceMatrix":[list(item) for item in DEVICES],"cases":len(rows),"failures":len(failures),"maxOverflow":max((row["overflow"] for row in rows),default=0)},"results":rows,"failures":failures}
    (EVIDENCE/"RC23_NEW_TEMPLATES_DEVICE_MATRIX.json").write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(output["summary"],ensure_ascii=False))
    return 1 if failures else 0

if __name__=="__main__": sys.exit(main())
