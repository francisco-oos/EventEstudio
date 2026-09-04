#!/usr/bin/env python3
"""Validación visual del módulo de Regalos RC25 con métodos combinables."""

import json
import os
import re
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

DEFAULTS=json.loads((ROOT/"config"/"default-settings.json").read_text(encoding="utf-8"))
EXPERIENCES=json.loads((ROOT/"config"/"experiences.json").read_text(encoding="utf-8"))
SEALS=json.loads((ROOT/"config"/"seals.json").read_text(encoding="utf-8"))
MESSAGE_CATALOG=json.loads((ROOT/"config"/"gift-message-presets.json").read_text(encoding="utf-8"))
PERSUASION_CATALOG=json.loads((ROOT/"config"/"gift-persuasion-presets.json").read_text(encoding="utf-8"))
CSS=(PUBLIC/"styles.css").read_text(encoding="utf-8")
STATIONERY_CSS=(PUBLIC/"stationery-engine.css").read_text(encoding="utf-8")
RENDERERS=(PUBLIC/"experience-renderers.js").read_text(encoding="utf-8")
SEAL_RENDERER=(PUBLIC/"seal-renderer.js").read_text(encoding="utf-8")
STATIONERY_ENGINE=(PUBLIC/"stationery-engine.js").read_text(encoding="utf-8")
APP=(PUBLIC/"app.js").read_text(encoding="utf-8")
INDEX=(PUBLIC/"index.html").read_text(encoding="utf-8")

BASE=re.sub(r'<link rel="stylesheet" href="/styles\.css\?v=[^"]+">',lambda _m:f"<style>{CSS}</style>",INDEX)
BASE=re.sub(r'<link rel="stylesheet" href="/stationery-engine\.css\?v=[^"]+">',lambda _m:f"<style>{STATIONERY_CSS}</style>",BASE)
BASE=re.sub(r'<script src="/experience-renderers\.js\?v=[^"]+"></script><script src="/seal-renderer\.js\?v=[^"]+"></script><script src="/stationery-engine\.js\?v=[^"]+"></script><script src="/app\.js\?v=[^"]+"></script>',"__SCRIPTS__",BASE)


def public_config(*,cash=False,registry=False,bank=False,openpay=False,persuasion="",message_enabled=True,bank_payload=True):
    config=json.loads(json.dumps(DEFAULTS))
    config["themeId"]="romantic-wine"
    config["couple"]={"partner1":"Ariana","partner2":"Francisco","displayName":"Ariana & Francisco"}
    config["event"].update({"dateTime":"2027-12-14T18:30:00-06:00","dateLabel":"14 de diciembre de 2027","slug":"qa-rc25-gifts"})
    config["gifts"].update({
        "title":"Regalos",
        "message":"Su presencia es lo más importante para nosotros.",
        "description":"",
        "methods":{
            "cashEnvelopes":{"enabled":cash,"instructions":"Durante la celebración encontrarás un buzón especial para depositar tu sobre."},
            "registry":{"enabled":registry},
            "bankTransfer":{"enabled":bank}
        },
        "link":"https://example.com/mesa-regalos" if registry else "",
        "linkLabel":"Ver mesa de regalos",
        "bankInfoEnabled":bank,
        "bank":{
            "bankName":"BBVA" if bank_payload else "",
            "accountHolder":"Ariana y Francisco" if bank_payload else "",
            "clabe":"012345678901234567" if bank_payload else "",
            "accountNumber":"99887766" if bank_payload else "",
            "referenceConcept":"Regalo de boda - Familia Pérez" if bank_payload else "",
            "instructions":"Usar el apellido como referencia" if bank_payload else "",
            "motivationalMessage":persuasion
        },
        "openpay":{
            "enabled":openpay,
            "suggestedAmountCents":None,
            "allowCustomAmount":True,
            "messageEnabled":message_enabled
        }
    })
    config["_experiences"]=EXPERIENCES
    config["_sealCatalog"]=SEALS
    config["_giftMessagePresets"]=[
        {"id":item["id"],"label":item["label"],"text":item["text"]}
        for item in MESSAGE_CATALOG["presets"][:4]
    ]
    config["_theme"]={"id":"romantic-wine","layoutFamily":"classic","motionPreset":"subtle","photoStyle":"cards","motif":"spark","defaultExperience":"classic"}
    config["_palette"]={"bg":"#f7f2eb","paper":"#fffdf9","ink":"#302824","muted":"#766a62","accent":"#7b2331","accentText":"#7b2331","gold":"#b59464","line":"#dfd3c7","accentContrast":"#ffffff"}
    config["_surfaceTexture"]="none"
    config["_platform"]={"branding":{"attributionEnabled":False,"attributionOnInvitation":False,"attributionLabel":"EventStudio","attributionUrl":""}}
    config["features"]={key:True for key in config.get("features",{})}
    return config


def document_html(config):
    payload=json.dumps(config,ensure_ascii=False).replace("</","<\\/")
    observer="""<script>window.__giftCls=0;if('PerformanceObserver' in window){try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(!e.hadRecentInput)window.__giftCls+=e.value;}}).observe({type:'layout-shift',buffered:true});}catch{}}</script>"""
    prelude=f"<script>window.fetch=async()=>new Response(JSON.stringify({payload}),{{status:200,headers:{{'Content-Type':'application/json'}}}});</script>"
    scripts=observer+prelude+f"<script>{RENDERERS}</script><script>{SEAL_RENDERER}</script><script>{STATIONERY_ENGINE}</script><script>{APP}</script>"
    return BASE.replace("__SCRIPTS__",scripts)


def snapshot(page):
    return page.evaluate("""() => {
      const ids=['cashEnvelopeWrap','giftRegistryWrap','bankInfoWrap','openpayGiftWrap'];
      const visible=id=>{const el=document.getElementById(id);return Boolean(el&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none');};
      const rects=ids.filter(visible).map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};}).sort((a,b)=>a.top-b.top);
      const overlaps=[];
      for(let i=1;i<rects.length;i++){if(rects[i].top < rects[i-1].bottom-1)overlaps.push([rects[i-1].id,rects[i].id,rects[i-1].bottom-rects[i].top]);}
      return {
        giftVisible:visible('giftSection'),
        cashVisible:visible('cashEnvelopeWrap'),
        registryVisible:visible('giftRegistryWrap'),
        bankVisible:visible('bankInfoWrap'),
        openpayVisible:visible('openpayGiftWrap'),
        persuasionVisible:visible('bankPersuasionMessage'),
        persuasionText:document.getElementById('bankPersuasionMessage')?.textContent||'',
        guestMessageFieldVisible:visible('openpayGiftMessageField'),
        bankRows:[...document.querySelectorAll('#bankInfoList dt,#bankInfoList dd')].map(node=>node.textContent),
        overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),
        cls:Number(window.__giftCls||0),
        overlaps
      };
    }""")


def main():
    chromium_path=os.environ.get("EVENTSTUDIO_CHROMIUM_PATH","/usr/bin/chromium")
    if not Path(chromium_path).exists():
        raise SystemExit(f"Chromium obligatorio no encontrado: {chromium_path}")
    motivation=PERSUASION_CATALOG["presets"][0]["text"]
    definitions=[
        ("cash-only",dict(cash=True),lambda r:r["cashVisible"] and not r["registryVisible"] and not r["bankVisible"] and not r["openpayVisible"]),
        ("bank-only",dict(bank=True,persuasion=motivation),lambda r:r["bankVisible"] and r["persuasionVisible"] and r["persuasionText"]==motivation and "Concepto sugerido" in r["bankRows"]),
        ("bank-custom-message",dict(bank=True,persuasion="Gracias por acompañarnos; si deseas sumar a este comienzo, puedes hacerlo por este medio."),lambda r:r["bankVisible"] and r["persuasionVisible"] and "sumar a este comienzo" in r["persuasionText"]),
        ("bank-enabled-empty",dict(bank=True,persuasion=motivation,bank_payload=False),lambda r:not r["bankVisible"] and not r["persuasionVisible"]),
        ("cash-bank",dict(cash=True,bank=True,persuasion=motivation),lambda r:r["cashVisible"] and r["bankVisible"] and not r["registryVisible"]),
        ("cash-bank-registry",dict(cash=True,bank=True,registry=True,persuasion=motivation),lambda r:r["cashVisible"] and r["bankVisible"] and r["registryVisible"]),
        ("all-methods",dict(cash=True,bank=True,registry=True,openpay=True,persuasion=motivation),lambda r:r["cashVisible"] and r["bankVisible"] and r["registryVisible"] and r["openpayVisible"] and r["guestMessageFieldVisible"]),
        ("openpay-only",dict(openpay=True),lambda r:r["openpayVisible"] and not r["cashVisible"] and not r["bankVisible"] and not r["registryVisible"]),
        ("none",dict(),lambda r:not r["giftVisible"] and not r["cashVisible"] and not r["bankVisible"] and not r["registryVisible"] and not r["openpayVisible"])
    ]
    cases=[]
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path=chromium_path,args=["--no-sandbox","--disable-dev-shm-usage"])
        for viewport in [(320,568),(390,844),(1440,900)]:
            for name,kwargs,expect in definitions:
                page=browser.new_page(viewport={"width":viewport[0],"height":viewport[1]})
                errors=[]
                page.on("pageerror",lambda error,errors=errors:errors.append(str(error)))
                page.set_content(document_html(public_config(**kwargs)),wait_until="load",timeout=10000)
                page.wait_for_timeout(180)
                if kwargs.get("registry"):
                    page.evaluate("""() => { safeExternalUrl=value=>{try{return new URL(String(value||'').trim(),'https://qa.eventstudio.test').href;}catch{return '';}}; renderGift(); }""")
                    page.wait_for_timeout(30)
                row={"name":name,"viewport":list(viewport),**snapshot(page),"errors":errors}
                row["ok"]=bool(expect(row) and row["overflow"]<=2 and row["cls"]<=0.02 and not row["overlaps"] and not errors)
                cases.append(row)
                page.close()
        browser.close()
    output={"cases":cases,"failures":[row for row in cases if not row["ok"]]}
    (EVIDENCE/"RC25_GIFTS_MODULAR_BROWSER_QA.json").write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({
        "cases":len(cases),
        "failures":len(output["failures"]),
        "maxOverflow":max((row["overflow"] for row in cases),default=0),
        "maxCls":max((row["cls"] for row in cases),default=0),
        "maxOverlaps":max((len(row["overlaps"]) for row in cases),default=0)
    },ensure_ascii=False))
    return 1 if output["failures"] else 0

if __name__=="__main__":
    sys.exit(main())
