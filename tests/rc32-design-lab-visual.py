#!/usr/bin/env python3
from __future__ import annotations
import json, urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
DESIGN=ROOT/'config'/'design'

recipes=json.loads((DESIGN/'recipes.json').read_text(encoding='utf-8'))['recipes']
components=json.loads((DESIGN/'components.json').read_text(encoding='utf-8'))['components']
assets=json.loads((DESIGN/'assets-manifest.json').read_text(encoding='utf-8'))['assets']
photos=json.loads((DESIGN/'photo_presentations.json').read_text(encoding='utf-8'))
motions=json.loads((DESIGN/'motion_timelines.json').read_text(encoding='utf-8'))
prints=json.loads((DESIGN/'print_layouts.json').read_text(encoding='utf-8'))
qrframes=json.loads((DESIGN/'qr_frames.json').read_text(encoding='utf-8'))
families=json.loads((DESIGN/'palette_families.json').read_text(encoding='utf-8'))
experiences=json.loads((ROOT/'config'/'experiences.json').read_text(encoding='utf-8'))
defaults=json.loads((ROOT/'config'/'default-settings.json').read_text(encoding='utf-8'))

harmonies=['monochromatic','analogous','complementary','split-complementary','triadic','tetradic','luxury','dark-luxury','pastel','high-contrast']
features=['invitation','locations','program','gallery','dressCode','rsvp','gifts','qrCards','music','templates','physicalInvitations']
state={'saved':0,'preview':0,'palette':0,'recommend':0,'apply':0,'revision':1}

def svg(label='Recipe'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="360" height="210"><rect width="100%" height="100%" fill="#f7f2eb"/><text x="180" y="105" text-anchor="middle" fill="#302824">{label}</text></svg>'

def page_slice(items, query):
    offset=int(query.get('offset',['0'])[0] or 0); limit=int(query.get('limit',['24'])[0] or 24)
    q=(query.get('q',[''])[0] or '').lower(); cat=(query.get('category',[''])[0] or '')
    filtered=[]
    for item in items:
        hay=(item.get('name','')+' '+item.get('description','')+' '+' '.join(item.get('tags',[]))).lower()
        if q and q not in hay: continue
        if cat and item.get('category')!=cat: continue
        filtered.append(item)
    return filtered, offset, limit

def fulfill_json(route, data, status=200):
    route.fulfill(status=status,content_type='application/json',body=json.dumps(data,ensure_ascii=False))

def api_handler(route):
    req=route.request; u=urllib.parse.urlparse(req.url); path=u.path; query=urllib.parse.parse_qs(u.query); method=req.method
    if path=='/api/auth/me': return fulfill_json(route,{'user':{'id':1,'role':'developer','name':'QA Developer'}})
    if path=='/api/admin/events': return fulfill_json(route,[{'id':1,'name':'Ariana y Francisco','slug':'ariana-y-francisco','event_type':'wedding'}])
    if path=='/api/admin/settings':
        payload=json.loads(json.dumps(defaults)); payload.setdefault('couple',{})['displayName']='Ariana y Francisco'; payload.setdefault('event',{})['dateLabel']='14 de diciembre de 2026'; payload['_event']={'id':1,'name':'Ariana y Francisco','slug':'ariana-y-francisco','event_type':'wedding'}; payload['_experiences']=experiences; payload['_permissions']={'platformUser':True,'design':{'editDraft':True,'editStationery':True,'previewDraft':True,'apply':True,'saveTemplate':True,'publishCatalog':True,'manageCatalog':True}}; payload['_designAccess']={'opening':{},'gallery':{}}; payload.setdefault('media',{})['gallery']=['/uploads/qa-a.jpg','/uploads/qa-b.jpg']; payload['media']['music']='/uploads/qa.mp3'; payload['media']['heroImage']='/uploads/qa-hero.jpg'
        return fulfill_json(route,payload)
    if path=='/api/admin/features': return fulfill_json(route,{'features':[{'key':key,'allowed':True} for key in features],'designCapabilities':{'editDraft':True,'editStationery':True,'previewDraft':True,'apply':True,'saveTemplate':True,'publishCatalog':True,'manageCatalog':True}})
    if path=='/api/admin/design/recipe':
        if method=='PUT':
            state['saved']+=1; state['revision']+=1; body=json.loads(req.post_data or '{}'); selected=body.get('recipe') or next((item for item in recipes if item['id']==body.get('catalogRecipeId')),recipes[0]); return fulfill_json(route,{'ok':True,'recipe':selected,'hash':'qa','state':{'draftRevision':state['revision'],'activeRevision':1,'hasUnappliedChanges':True}})
        return fulfill_json(route,{'recipe':recipes[0],'hash':'qa','source':'catalog','state':{'draftRevision':state['revision'],'activeRevision':1,'hasUnappliedChanges':state['revision']>1}})
    if path=='/api/admin/design/apply':
        state['apply']+=1; return fulfill_json(route,{'ok':True,'recipe':recipes[0],'hash':'qa','state':{'draftRevision':state['revision'],'activeRevision':2,'hasUnappliedChanges':False},'pendingEntitlements':[]})
    if path=='/api/admin/design/catalog':
        filtered,offset,limit=page_slice(recipes,query)
        items=[{'id':r['id'],'name':r['name'],'description':r.get('description',''),'eventTypes':r.get('eventTypes',[]),'tags':r.get('tags',[]),'thumbnail':r.get('thumbnail',{}),'design':{'layoutFamily':r['design']['layoutFamily'],'palette':r['design']['palette']}} for r in filtered[offset:offset+limit]]
        return fulfill_json(route,{'schema':'eventstudio.design-catalog.v1','recipes':{'total':len(filtered),'offset':offset,'limit':limit,'items':items},'assetCategories':sorted(set(a['category'] for a in assets)),'components':components,'photoPresentations':photos,'motionTimelines':motions,'printLayouts':prints,'qrFrames':qrframes,'paletteFamilies':families,'colorHarmonies':harmonies,'qa':{'pass':True,'counts':{'recipes':65,'sectionStyles':103}}})
    if path=='/api/admin/design/assets':
        filtered,offset,limit=page_slice(assets,query)
        return fulfill_json(route,{'total':len(filtered),'offset':offset,'limit':limit,'categories':sorted(set(a['category'] for a in assets)),'items':filtered[offset:offset+limit]})
    if path.startswith('/api/admin/design/recipes/') and path.endswith('/thumbnail'):
        return route.fulfill(status=200,content_type='image/svg+xml',body=svg(path.split('/')[-2]))
    if path.startswith('/api/admin/design/recipes/'):
        rid=urllib.parse.unquote(path.rsplit('/',1)[-1]); r=next((x for x in recipes if x['id']==rid),None)
        return fulfill_json(route,{'recipe':r or recipes[0],'hash':'qa'})
    if path=='/api/admin/design/thumbnail': return route.fulfill(status=200,content_type='image/svg+xml',body=svg('live'))
    if path=='/api/admin/design/recommend-package':
        state['recommend']+=1; return fulfill_json(route,{'missingFeatures':['rsvp'],'individual':{'available':True,'addons':[],'priceCents':0,'uncovered':[]},'recommendation':{'code':'complete','name':'Evento Completo','priceCents':19900,'extraFeatures':['checkin'],'desiredCount':6}})
    if path=='/api/admin/design/palette':
        state['palette']+=1; body=json.loads(req.post_data or '{}'); seed=body.get('seed','#355b7a'); harmony=body.get('harmony','complementary')
        palette={'bg':'#f5f7f8','paper':'#ffffff','ink':'#18232b','muted':'#596a75','accent':'#274f6b','accent-dark':'#17384d','gold':'#9d7d42','line':'#d2dce2'}
        return fulfill_json(route,{'palette':palette,'audit':{'pass':True,'checks':[]},'colorTheory':{'seed':seed,'harmony':harmony}})
    if path=='/api/admin/preview-links': state['preview']+=1; return fulfill_json(route,{'url':'/e/qa-preview?preview=1'})
    return fulfill_json(route,{})

def build_inline_html():
    html=(PUBLIC/'design-lab.html').read_text(encoding='utf-8')
    css=(PUBLIC/'design-lab.css').read_text(encoding='utf-8') + "\n" + (PUBLIC/'design-engine.css').read_text(encoding='utf-8')
    js=(PUBLIC/'design-lab.js').read_text(encoding='utf-8')
    # about:blank has opaque localStorage in this sandbox; the harness fixes only that lookup.
    js=js.replace("Number(localStorage.getItem('eventId'))", "1")
    import re
    html=re.sub(r'<link[^>]+design-lab\.css[^>]*>', '', html)
    html=re.sub(r'<link[^>]+design-engine\.css[^>]*>', '', html)
    html=re.sub(r'<script[^>]+design-lab\.js[^>]*></script>', '', html)
    html=html.replace('<head>', '<head><base href="https://eventstudio.test/">', 1)
    html=html.replace('</head>', '<style>'+css+'</style></head>', 1)
    # The production script stays intact; only its transport is inlined for the isolated browser harness.
    prelude="<script>window.__opened=[];window.open=(url)=>{window.__opened.push(String(url));return null;};</script>"
    html=html.replace('</body>', prelude+'<script>'+js+'</script></body>', 1)
    return html

def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[]
        page.on('console',lambda msg: errors.append(msg.text) if msg.type=='error' else None)
        page.on('pageerror',lambda err: errors.append(str(err)))
        page.on('dialog',lambda dialog: dialog.accept())
        page.add_init_script("window.__opened=[]; window.open=(url)=>{window.__opened.push(String(url)); return null;};")
        # Register the catch-all first; Playwright evaluates newer routes first.
        page.route('https://eventstudio.test/**',lambda route: route.abort())
        page.route('https://eventstudio.test/design-assets/**',lambda route: route.fulfill(status=200,content_type='image/svg+xml',body=svg('asset')) )
        page.route('https://eventstudio.test/api/**',api_handler)
        page.set_content(build_inline_html(),wait_until='domcontentloaded')
        page.wait_for_selector('[data-recipe]')
        assert 'Ariana y Francisco' in page.locator('#eventLabel').inner_text()
        assert page.locator('[data-recipe]').count()>=1

        # Navegación completa del laboratorio.
        for name in ['recipes','assets','sections','opening','presentation','colors']:
            btn=page.locator(f'.lab-nav button[data-panel="{name}"]'); btn.click(); assert btn.get_attribute('class') and 'active' in btn.get_attribute('class')

        # Recipes: selección, búsqueda y paginación.
        page.locator('.lab-nav button[data-panel="recipes"]').click()
        first_recipe=page.locator('[data-recipe]').first; first_recipe.click(); page.wait_for_timeout(80)
        # RC39: seleccionar una Recipe persiste inmediatamente el DRAFT; el estado
        # pendiente vive en publicationState hasta que el usuario pulsa Aplicar.
        assert 'punto de partida' in page.locator('#saveState').inner_text().lower()
        assert 'pendiente' in page.locator('#publicationState').inner_text().lower()
        page.locator('#recipeSearch').fill('botánico'); page.wait_for_timeout(80)
        page.locator('#recipeSearch').fill(''); page.wait_for_timeout(80)
        if page.locator('#moreRecipesBtn').is_visible(): page.locator('#moreRecipesBtn').click(); page.wait_for_timeout(80)

        # Assets: búsqueda, filtro, inserción, drag, transforms y eliminación.
        page.locator('.lab-nav button[data-panel="assets"]').click(); page.wait_for_selector('[data-asset]')
        page.locator('#assetSearch').fill('');
        if page.locator('#assetCategory option').count()>1:
            page.locator('#assetCategory').select_option(index=1); page.wait_for_timeout(80); page.locator('#assetCategory').select_option(''); page.wait_for_timeout(80)
        page.locator('[data-asset]').first.click(); page.wait_for_timeout(60)
        asset=page.locator('.canvas-asset.selected'); assert asset.count()==1
        box=asset.bounding_box(); assert box
        page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2); page.mouse.down(); page.mouse.move(box['x']+box['width']/2+30,box['y']+box['height']/2+20); page.mouse.up(); page.wait_for_timeout(50)
        for control,value in [('assetX','72'),('assetY','44'),('assetScale','1.35'),('assetRotation','27'),('assetZ','9'),('assetOpacity','.65')]:
            page.locator('#'+control).evaluate("(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))}",value)
        page.locator('#assetTone').select_option('gold'); page.locator('#assetMotion').select_option('float-soft'); page.wait_for_timeout(60)
        page.locator('#removeAssetBtn').click(); page.wait_for_timeout(40)
        if page.locator('#moreAssetsBtn').is_visible(): page.locator('#moreAssetsBtn').click(); page.wait_for_timeout(50)

        # Bloques: todos los botones subir/bajar y visibilidad producen reacción sin excepción.
        page.locator('.lab-nav button[data-panel="sections"]').click(); cards=page.locator('#sectionList [data-section]'); assert cards.count()>=10
        for i in range(cards.count()):
            card=cards.nth(i)
            select=card.locator('[data-style]')
            if select.locator('option').count()>1: select.select_option(index=1)
            card.locator('[data-up]').click(); card=page.locator('#sectionList [data-section]').nth(min(i,page.locator('#sectionList [data-section]').count()-1));
            if card.locator('[data-down]').count(): card.locator('[data-down]').click()
        first_visible=page.locator('#sectionList [data-visible]').first; first_visible.uncheck(); first_visible.check()

        # Apertura y herramientas de presentación. RC35 integra Stationery dentro del mismo Design Studio.
        page.locator('.lab-nav button[data-panel="opening"]').click(); opening=page.locator('#openingSelect'); assert opening.locator('option').count()>1
        opening.select_option('unified-envelope'); page.wait_for_timeout(40)
        assert page.locator('#openStationeryBtn').is_visible()
        page.locator('#openStationeryBtn').click(); page.wait_for_timeout(60)
        assert page.locator('#stationeryWorkspace').is_visible()
        assert 'embedded=1' in (page.locator('#stationeryFrame').get_attribute('src') or '')
        page.locator('#closeStationeryBtn').click(); assert page.locator('#stationeryWorkspace').is_hidden()
        page.locator('.lab-nav button[data-panel="presentation"]').click()
        if page.locator('#layoutFamilySelect option').count()>1: page.locator('#layoutFamilySelect').select_option(index=1)
        if page.locator('#headingFontSelect option').count()>1: page.locator('#headingFontSelect').select_option(index=1)
        if page.locator('#bodyFontSelect option').count()>1: page.locator('#bodyFontSelect').select_option(index=1)
        page.locator('#typographyScaleSelect').select_option('large'); page.locator('#nameCaseSelect').select_option('uppercase')
        page.locator('#textureSelect').select_option('linen'); page.locator('#motionPresetSelect').select_option('dynamic')
        if page.locator('#motionTimelineSelect option').count()>1: page.locator('#motionTimelineSelect').select_option(index=1)
        if page.locator('#photoPresentationSelect option').count()>1: page.locator('#photoPresentationSelect').select_option(index=1)
        assert page.locator('#designCanvas').get_attribute('data-surface-texture')=='linen'
        assert page.locator('#designCanvas').get_attribute('data-typography-scale')=='large'
        assert page.locator('#designCanvas').get_attribute('data-name-case')=='uppercase'

        # Color Studio: armonía, contraste y edición manual.
        page.locator('.lab-nav button[data-panel="colors"]').click(); page.locator('#colorTheorySeed').evaluate("el=>{el.value='#356a8a';el.dispatchEvent(new Event('input',{bubbles:true}))}")
        page.locator('#colorHarmonySelect').select_option('triadic'); page.locator('#generatePaletteBtn').click(); page.wait_for_timeout(100)
        assert state['palette']>=1; assert 'ink/paper' in page.locator('#contrastReport').inner_text()
        page.locator('[data-color="accent"]').evaluate("el=>{el.value='#304f68';el.dispatchEvent(new Event('input',{bubbles:true}))}")

        # Viewports, historial, save y preview.
        page.locator('[data-device="desktop"]').click(); assert 'desktop' in page.locator('#designCanvas').get_attribute('class')
        page.locator('[data-device="phone"]').click(); assert 'phone' in page.locator('#designCanvas').get_attribute('class')
        page.locator('#undoBtn').click(); page.locator('#redoBtn').click(); page.locator('#applyBtn').click(); page.wait_for_timeout(140); assert state['saved']>=1; assert state['apply']>=1
        page.locator('#previewBtn').click(); page.wait_for_timeout(80); assert page.locator('#previewWorkspace').is_visible(); assert 'designMode=draft' in (page.locator('#previewFrame').get_attribute('src') or '')
        assert state['recommend']>=1

        # Fluidez/overflow en las dos vistas del constructor.
        for viewport in [(360,800),(1440,1000)]:
            page.set_viewport_size({'width':viewport[0],'height':viewport[1]}); page.wait_for_timeout(60)
            overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
            assert overflow<=2, f'overflow horizontal {viewport}: {overflow}'
        actionable=[e for e in errors if not e.startswith('Failed to load resource: net::ERR_FAILED')]
        assert not actionable, 'Errores de navegador: '+' | '.join(actionable)
        browser.close()
    print(f"✓ RC32/RC38 Design Lab visual: navegación, Recipes, Assets, drag/transforms, bloques, apertura, presentación, teoría del color, undo/redo, autosave/apply y preview DRAFT. API calls save={state['saved']} apply={state['apply']} palette={state['palette']} recommend={state['recommend']}.")

if __name__=='__main__': main()
