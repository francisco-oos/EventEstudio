#!/usr/bin/env python3
"""Interacciones públicas críticas de EventStudio bajo Design Recipe v2."""
from __future__ import annotations
import json, os, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/'public'; DESIGN=ROOT/'config'/'design'
INDEX=(PUBLIC/'index.html').read_text(encoding='utf-8'); CSS=(PUBLIC/'styles.css').read_text(encoding='utf-8'); SCSS=(PUBLIC/'stationery-engine.css').read_text(encoding='utf-8'); DCSS=(PUBLIC/'design-engine.css').read_text(encoding='utf-8')
RENDERERS=(PUBLIC/'experience-renderers.js').read_text(encoding='utf-8'); SEAL=(PUBLIC/'seal-renderer.js').read_text(encoding='utf-8'); STATIONERY=(PUBLIC/'stationery-engine.js').read_text(encoding='utf-8'); COLORJS=(PUBLIC/'design-color-engine.js').read_text(encoding='utf-8'); DESIGNJS=(PUBLIC/'design-engine.js').read_text(encoding='utf-8')
APP=(PUBLIC/'app.js').read_text(encoding='utf-8')
APP=APP.replace("const token=new URLSearchParams(location.search).get('i');","const token='qa-token';")
APP=APP.replace('location.assign(url);','window.__qaAssigned=String(url);')
APP=APP.replace("const hasPersonalInvitation=Boolean(new URLSearchParams(location.search).get('i'));","const hasPersonalInvitation=true;")
APP=APP.replace("new URL(String(value||\"\").trim(),location.origin)","new URL(String(value||\"\").trim(),'https://eventstudio.test')")
DEFAULTS=json.loads((ROOT/'config'/'default-settings.json').read_text(encoding='utf-8')); EXPERIENCES=json.loads((ROOT/'config'/'experiences.json').read_text(encoding='utf-8')); SEALS=json.loads((ROOT/'config'/'seals.json').read_text(encoding='utf-8')); STATIONERY_CATALOG=json.loads((ROOT/'config'/'stationery.json').read_text(encoding='utf-8'))
RECIPE=json.loads((DESIGN/'recipes.json').read_text(encoding='utf-8'))['recipes'][0]; ASSETS=json.loads((DESIGN/'assets-manifest.json').read_text(encoding='utf-8'))['assets']; AB={a['id']:a for a in ASSETS}
BASE=re.sub(r'<link rel="stylesheet" href="/styles\.css\?v=[^"]+">',lambda _:f'<style>{CSS}</style>',INDEX); BASE=re.sub(r'<link rel="stylesheet" href="/stationery-engine\.css\?v=[^"]+">',lambda _:f'<style>{SCSS}</style>',BASE); BASE=re.sub(r'<link rel="stylesheet" href="/design-engine\.css\?v=[^"]+">',lambda _:f'<style>{DCSS}</style>',BASE)
BASE=re.sub(r'<script src="/experience-renderers\.js\?v=[^"]+"></script><script src="/seal-renderer\.js\?v=[^"]+"></script><script src="/stationery-engine\.js\?v=[^"]+"></script><script src="/design-color-engine\.js\?v=[^"]+"></script><script src="/design-engine\.js\?v=[^"]+"></script><script src="/app\.js\?v=[^"]+"></script>','__SCRIPTS__',BASE)
PIX='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="%23b59464"/%3E%3C/svg%3E'; WAV='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

def settings(opening="unified-envelope"):
    s=json.loads(json.dumps(DEFAULTS)); s['couple']={'partner1':'Ariana','partner2':'Francisco','displayName':'Ariana y Francisco'}; s['event'].update({'title':'Ariana y Francisco','dateTime':'2026-12-14T18:00:00-06:00','dateLabel':'14 de diciembre de 2026','slug':'qa'})
    s['venue'].update({'name':'Hacienda EventStudio','address':'Calle QA 123','mapsUrl':'https://maps.google.com/?q=qa'}); s['venues']['ceremony'].update({'name':'Hacienda EventStudio','address':'Calle QA 123','mapsUrl':'https://maps.google.com/?q=qa','wazeUrl':'https://waze.com/ul?q=qa'}); s['venues']['reception'].update({'name':'Hacienda EventStudio','address':'Calle QA 123','mapsUrl':'https://maps.google.com/?q=qa','wazeUrl':'https://waze.com/ul?q=qa'})
    s.setdefault('agenda',{})['enabled']=False
    s['presentation'].update({'openingStyle':opening,'motionLevel':'still','galleryStyle':'classic'}); s['media'].update({'musicSource':'upload','music':WAV,'gallery':[PIX,PIX+'%23a',PIX+'%23b']})
    s['gifts'].update({'mode':'registry','link':'https://example.com/mesa','linkLabel':'Abrir mesa de regalos'}); s['gifts']['methods']['registry']['enabled']=True; s['gifts']['methods']['cashEnvelopes']['enabled']=False
    s['localization']={'defaultLocale':'es','enabledLocales':['es','en'],'contentTranslations':{}}
    s['_experiences']={'openings':EXPERIENCES['openings'],'galleries':EXPERIENCES['galleries'],'motionLevels':EXPERIENCES['motionLevels']}; s['_sealCatalog']=SEALS; s['_stationeryCatalog']=STATIONERY_CATALOG; s['_designRecipe']=RECIPE; used={a['assetId'] for a in RECIPE.get('assets',[])}; s['_assetManifest']={'assets':[AB[x] for x in used if x in AB]}; s['_palette']=RECIPE['design']['palette']; s['_surfaceTexture']=RECIPE['design']['texture']; s['_platform']={'branding':{'attributionEnabled':False}}
    s['features']={k:True for k in s['features']}; s['features']['guestPhotoMessages']=False
    return s

GUEST={'guest':{'token':'qa-token','family_name':'Familia Prueba','max_adults':2,'max_children':1,'table_name':'Mesa 4','custom_message':'Mensaje personalizado','phone':'9930000000'},'rsvp':None,'menus':{'serviceMode':'fixed','selectionEnabled':False,'adultOptions':[],'childOptions':[],'instructions':''}}

def doc(opening="unified-envelope"):
    config=json.dumps(settings(opening),ensure_ascii=False).replace('</','<\\/'); guest=json.dumps(GUEST,ensure_ascii=False).replace('</','<\\/')
    pre=f'''<script>window.__qa={{rsvp:0,assigned:""}};window.fetch=async(input,opt={{}})=>{{const u=String(input);if(u.includes('/api/config'))return new Response(JSON.stringify({config}),{{status:200,headers:{{'Content-Type':'application/json'}}}});if(u.includes('/api/invitation/token/'))return new Response(JSON.stringify({guest}),{{status:200,headers:{{'Content-Type':'application/json'}}}});if(u.includes('/api/rsvp')){{window.__qa.rsvp++;return new Response(JSON.stringify({{status:'confirmed',adults:1,children:0}}),{{status:200,headers:{{'Content-Type':'application/json'}}}});}}if(u.includes('/api/public/photo-messages'))return new Response('[]',{{status:200,headers:{{'Content-Type':'application/json'}}}});return new Response('{{}}',{{status:200,headers:{{'Content-Type':'application/json'}}}});}};Object.defineProperty(HTMLMediaElement.prototype,'paused',{{configurable:true,get:function(){{return !this.__qaPlaying;}}}});Object.defineProperty(HTMLMediaElement.prototype,'play',{{configurable:true,value:function(){{this.__qaPlaying=true;return Promise.resolve();}}}});Object.defineProperty(HTMLMediaElement.prototype,'pause',{{configurable:true,value:function(){{this.__qaPlaying=false;this.dispatchEvent(new Event('pause'));}}}});</script>'''
    scripts=pre+f'<script>{RENDERERS}</script><script>{SEAL}</script><script>{STATIONERY}</script><script>{COLORJS}</script><script>{DESIGNJS}</script><script>{APP}</script>'
    return BASE.replace('__SCRIPTS__',scripts)

def main():
    chromium=os.environ.get('EVENTSTUDIO_CHROMIUM_PATH','/usr/bin/chromium'); assert Path(chromium).exists(); failures=[]
    with sync_playwright() as pw:
        b=pw.chromium.launch(headless=True,executable_path=chromium,args=['--no-sandbox','--disable-dev-shm-usage']); c=b.new_context(viewport={'width':390,'height':844}); p=c.new_page(); errors=[]; p.on('pageerror',lambda e:errors.append(str(e))); p.set_content(doc(),wait_until='load',timeout=15000); p.wait_for_timeout(120)
        # Apertura: omitir debe llevar a la invitación y conservar el DOM productivo.
        p.locator('#invitationOpening').wait_for(state='visible'); p.locator('#skipOpeningButton').click(); p.wait_for_timeout(250); assert p.evaluate("document.body.classList.contains('invitation-open')")
        # Música real (mock de media, lógica real de EventStudio).
        p.locator('#musicBtn').click(); p.wait_for_timeout(20); assert 'Pausar' in p.locator('#musicBtn').get_attribute('aria-label'); p.locator('#musicBtn').click(); assert 'Reproducir' in p.locator('#musicBtn').get_attribute('aria-label')
        # Links configurados y traducción disponible.
        assert p.locator('#calendarLink').get_attribute('href'); assert p.locator('#venueMaps').get_attribute('href'); assert p.locator('#venueWaze').get_attribute('href'); assert p.locator('#giftLink').get_attribute('href')=='https://example.com/mesa'
        sel=p.locator('#publicLanguageSelect'); assert sel.locator('option').count()==2; sel.select_option('en'); p.wait_for_timeout(20); assert p.evaluate('window.__qaAssigned||""').endswith('lang=en')
        # Galería: en escritorio los botones anterior/siguiente son visibles; en móvil se usa swipe.
        p.set_viewport_size({'width':900,'height':900}); p.wait_for_timeout(30)
        assert p.locator('#gallery .gallery-item').count()==3; first_src=p.locator('#gallery .gallery-item img').first.get_attribute('src'); p.locator('#galleryNext').click(); assert p.locator('#gallery .gallery-item img').first.get_attribute('src')!=first_src; p.locator('#galleryPrev').click(); p.locator('#gallery .gallery-item').first.click(); assert not p.locator('#lightbox').get_attribute('class').endswith('hidden'); p.locator('#lightboxNext').click(); p.locator('#lightboxPrev').click(); p.locator('#lightboxClose').click(); assert 'hidden' in p.locator('#lightbox').get_attribute('class')
        # RSVP: carga invitado, cambios condicionales y envío.
        p.locator('#rsvpForm').wait_for(state='visible'); p.locator('#attending').select_option('yes'); p.locator('#hasDietary').check(); assert not p.locator('#dietaryField').is_hidden(); p.locator('#dietary').fill('Sin nuez'); p.locator('#hasSpecialNeeds').check(); p.locator('#adults').fill('1'); p.locator('#children').fill('0'); p.locator('#rsvpSubmitBtn').click(); p.wait_for_timeout(50); assert p.evaluate('window.__qa.rsvp')==1; assert 'guard' in p.locator('#rsvpStatus').inner_text().lower() or 'confirm' in p.locator('#rsvpStatus').inner_text().lower()
        # Validación de que los principales botones visibles tienen reacción/callback asignado.
        expected={'musicBtn','galleryPrev','galleryNext','rsvpSubmitBtn','lightboxClose','lightboxPrev','lightboxNext'}
        handler_state=p.evaluate("ids=>Object.fromEntries(ids.map(id=>[id,typeof document.getElementById(id)?.onclick==='function'||document.getElementById(id)?.getAttribute('type')==='submit']))",list(expected))
        assert all(handler_state.values()), handler_state
        # Sin opening, el CTA principal del hero debe abrir la invitación y disparar música.
        p2=c.new_page(); p2.set_content(doc('none'),wait_until='load',timeout=15000); p2.wait_for_timeout(100); hero=p2.locator('#openInvitationBtn'); hero.wait_for(state='visible'); hero.click(); p2.wait_for_timeout(30); assert p2.evaluate("document.body.classList.contains('invitation-open')"); assert 'Pausar' in p2.locator('#musicBtn').get_attribute('aria-label'); p2.close()
        p.set_viewport_size({'width':390,'height':844}); p.wait_for_timeout(20)
        overflow=p.evaluate('Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth'); assert overflow<=2
        actionable=[e for e in errors if 'ResizeObserver loop' not in e]; assert not actionable, actionable
        c.close(); b.close()
    print('✓ RC32 público: apertura/skip, música, links, idioma, galería/lightbox y RSVP reaccionan con el renderer Recipe v2.')
    return 0
if __name__=='__main__':sys.exit(main())
