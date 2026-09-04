#!/usr/bin/env python3
"""Validación visual aislada del módulo de Regalos RC24 sin llamadas externas."""

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


def config_for(bank_enabled=True,openpay_enabled=True,suggested=None,message_enabled=True):
    config=json.loads(json.dumps(DEFAULTS))
    config["themeId"]="romantic-wine"
    config["couple"]={"partner1":"Ariana","partner2":"Francisco","displayName":"Ariana & Francisco"}
    config["event"].update({"dateTime":"2027-12-14T18:30:00-06:00","dateLabel":"14 de diciembre de 2027","slug":"qa-rc24-gifts"})
    config["gifts"].update({
        "mode":"bank-transfer",
        "methods":{
            "cashEnvelopes":{"enabled":False,"instructions":""},
            "registry":{"enabled":False},
            "bankTransfer":{"enabled":bank_enabled}
        },
        "bankInfoEnabled":bank_enabled,
        "bank":{
            "bankName":"BBVA",
            "accountHolder":"Ariana y Francisco",
            "clabe":"012345678901234567",
            "accountNumber":"99887766",
            "instructions":"Usar el nombre del invitado como referencia"
        },
        "openpay":{
            "enabled":openpay_enabled,
            "suggestedAmountCents":suggested,
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
    prelude=f"<script>window.fetch=async()=>new Response(JSON.stringify({payload}),{{status:200,headers:{{'Content-Type':'application/json'}}}});</script>"
    scripts=prelude+f"<script>{RENDERERS}</script><script>{SEAL_RENDERER}</script><script>{STATIONERY_ENGINE}</script><script>{APP}</script>"
    return BASE.replace("__SCRIPTS__",scripts)


def snapshot(page):
    return page.evaluate("""() => ({
      bankVisible:!document.querySelector('#bankInfoWrap').classList.contains('hidden'),
      bankRows:[...document.querySelectorAll('#bankInfoList dt,#bankInfoList dd')].map(node=>node.textContent),
      openpayVisible:!document.querySelector('#openpayGiftWrap').classList.contains('hidden'),
      amount:document.querySelector('#openpayGiftAmount').value,
      amountPlaceholder:document.querySelector('#openpayGiftAmount').placeholder,
      messageVisible:!document.querySelector('#openpayGiftMessageField').classList.contains('hidden'),
      suggestions:[...document.querySelectorAll('.gift-message-suggestion')].map(node=>node.textContent),
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
    })""")


def main():
    chromium_path=os.environ.get("EVENTSTUDIO_CHROMIUM_PATH","/usr/bin/chromium")
    if not Path(chromium_path).exists():
        raise SystemExit(f"Chromium obligatorio no encontrado: {chromium_path}")
    cases=[]
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path=chromium_path,args=["--no-sandbox","--disable-dev-shm-usage"])
        for viewport in [(390,844),(1440,900)]:
            for name,config in [
                ("bank-only",config_for(openpay_enabled=False)),
                ("openpay-empty-suggestion",config_for(openpay_enabled=True,suggested=None,message_enabled=True)),
                ("openpay-fixed-suggestion",config_for(openpay_enabled=True,suggested=150000,message_enabled=True)),
                ("messages-disabled",config_for(openpay_enabled=True,suggested=None,message_enabled=False)),
                ("bank-disabled",config_for(bank_enabled=False,openpay_enabled=False))
            ]:
                page=browser.new_page(viewport={"width":viewport[0],"height":viewport[1]})
                errors=[]
                page.on("pageerror",lambda error,errors=errors:errors.append(str(error)))
                page.set_content(document_html(config),wait_until="load",timeout=8000)
                page.wait_for_timeout(100)
                row={"name":name,"viewport":list(viewport),**snapshot(page),"errors":errors}
                if name=="bank-only": row["ok"]=row["bankVisible"] and not row["openpayVisible"]
                elif name=="openpay-empty-suggestion": row["ok"]=row["bankVisible"] and row["openpayVisible"] and row["amount"]=="" and len(row["suggestions"])==5
                elif name=="openpay-fixed-suggestion": row["ok"]=row["openpayVisible"] and row["amount"]=="1500"
                elif name=="messages-disabled": row["ok"]=row["openpayVisible"] and not row["messageVisible"] and not row["suggestions"]
                else: row["ok"]=not row["bankVisible"] and not row["openpayVisible"]
                row["ok"]=bool(row["ok"] and row["overflow"]<=2 and not row["errors"])
                cases.append(row)
                page.close()
        browser.close()
    output={"cases":cases,"failures":[row for row in cases if not row["ok"]]}
    (EVIDENCE/"RC24_GIFTS_BROWSER_QA.json").write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"cases":len(cases),"failures":len(output["failures"]),"maxOverflow":max((row["overflow"] for row in cases),default=0)},ensure_ascii=False))
    return 1 if output["failures"] else 0


if __name__=="__main__":
    sys.exit(main())
