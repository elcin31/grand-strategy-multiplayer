"""APK smoke test on an emulator. No Metro, no production-room writes.

Verifies cold launch, landscape, offline campaign map, restart, and fatal logs.
Evidence is uploaded by CI. This is not a physical-device FPS claim.
"""
import os
import json
import atexit
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from map_paint_check import assert_map_painted
PACKAGE = 'com.elcin31.grandstrategymultiplayer'
OUT = Path('android-smoke'); OUT.mkdir(exist_ok=True)
def adb(*args): return subprocess.check_output(['adb', *args], text=True)
def save_logs():
    try: (OUT/'logcat.txt').write_text(adb('logcat','-d'))
    except (OSError, subprocess.CalledProcessError): pass
atexit.register(save_logs)
def hierarchy(name):
    adb('shell','uiautomator','dump','/sdcard/window.xml')
    xml = adb('shell','cat','/sdcard/window.xml')
    (OUT / (name+'.xml')).write_text(xml)
    return ET.fromstring(xml)
def screenshot(name):
    with (OUT / (name+'.png')).open('wb') as f: subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def launch():
    adb('shell','am','force-stop',PACKAGE)
    with (OUT/'startup.txt').open('a') as f: f.write(adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity'))
    time.sleep(12)
def click_text(root, text):
    node = next((n for n in root.iter('node') if n.get('text') == text or n.get('content-desc') == text), None)
    assert node is not None, 'Missing control: '+text
    nums = [int(n) for n in re.findall(r'\d+',node.get('bounds',''))]
    assert len(nums)==4
    print('Tap:',text,node.get('bounds'),flush=True)
    x,y=str((nums[0]+nums[2])//2),str((nums[1]+nums[3])//2)
    adb('shell','input','swipe',x,y,x,y,'100')
def map_menu(opened):
    for attempt in range(12):
        root=hierarchy('map-menu-'+str(opened)+'-'+str(attempt))
        visible=any(n.get('text') in ('РЕЖИМ КАРТЫ','КАЧЕСТВО ГРАФИКИ') for n in root.iter('node'))
        if visible==opened:return root
        # After process/device restore the campaign HUD can mount before the deferred
        # world map finishes preparing. Wait for the actual map toolbar instead of
        # treating the loading shell as a missing-control failure.
        map_settings=next((n for n in root.iter('node') if n.get('content-desc')=='Настройки карты'),None)
        if map_settings is None:
            time.sleep(2)
            continue
        click_text(root,'Настройки карты')
        time.sleep(2)
    raise AssertionError('Map menu did not reach requested state: '+str(opened))
def navigate(section):
    for attempt in range(5):
        root=hierarchy('navigation-'+section+'-'+str(attempt))
        if any(n.get('content-desc')=='Раздел '+section and n.get('selected')=='true' for n in root.iter('node')):return
        click_text(root,'Раздел '+section);time.sleep(1)
    raise AssertionError('Navigation did not select section: '+section)
def click_scrolling(text):
    sections={'Экономика':'Экономика','Правительство':'Правительство','Религия':'Религия','Технологии':'Технологии','Дипломатия':'Дипломатия'}
    if text.endswith(' ▾') and text[:-2] in sections:
        navigate(sections[text[:-2]]);return
    if text.endswith(' ▴') and text[:-2] in sections:
        navigate('Страна');return
    if text.startswith('Стабильность ·'):navigate('Страна')
    for attempt in range(14):
        root = hierarchy('flow-'+str(attempt))
        node = next((n for n in root.iter('node') if n.get('text') == text or n.get('content-desc') == text), None)
        if node is not None:
            nums = [int(n) for n in re.findall(r'\d+',node.get('bounds',''))]
            if len(nums) == 4 and nums[2] > nums[0] and 70 <= nums[1] and nums[3]-nums[1]>=14 and nums[3]<=640:
                click_text(root,text); time.sleep(1); return
        # Collapsing a policy card can leave its next control ABOVE the viewport.
        # Start a missing-control search at the top, then advance in small steps.
        if attempt == 0:
            for _ in range(5): adb('shell','input','swipe','1080','220','1080','570','350')
        else:
            adb('shell','input','swipe','1080','530','1080','320','350')
    raise AssertionError('Missing usable control: '+text)
def read_scrolling(prefix):
    for _ in range(5): adb('shell','input','swipe','1080','220','1080','570','350')
    for attempt in range(14):
        root = hierarchy('read-'+str(attempt))
        for node in root.iter('node'):
            if node.get('text','').startswith(prefix):
                bounds = [int(n) for n in re.findall(r'\d+',node.get('bounds',''))]
                if len(bounds) == 4 and 70 <= bounds[1] and bounds[3]-bounds[1]>=12 and bounds[3]<=640:
                    return node.get('text')
        adb('shell','input','swipe','1080','530','1080','320','350')
    raise AssertionError('Missing readable state: '+prefix)
def set_speed(speed):
    navigate('Страна')
    label = 'Пауза' if speed == 0 else f'Скорость {speed}×'
    for attempt in range(4):
        click_scrolling(label)
        root = hierarchy(f'speed-{speed}-{attempt}')
        if any(n.get('content-desc') == label and n.get('selected') == 'true' for n in root.iter('node')):
            return root
    raise AssertionError('Speed command did not become active: '+label)
def advance_campaign_months(months):
    root = set_speed(4)
    def tick(tree):
        text = next(n.get('text') for n in tree.iter('node') if n.get('text','').startswith('Ход '))
        return int(re.match(r'Ход (\d+)', text).group(1))
    target = tick(root) + months
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        time.sleep(2)
        if tick(hierarchy('population-growing')) >= target:
            set_speed(0); return
    raise AssertionError('Campaign clock did not advance enough months')
def province_army_text(root):
    texts = [n.get('text','') for n in root.iter('node') if n.get('text')]
    assert not any('Действие отклонено' in text for text in texts), 'Recruitment was rejected: '+str(texts)
    assert 'DEU' in texts, 'Province army row is missing: '+str(texts)
    owner = texts.index('DEU')
    return next(t for t in texts[owner+1:] if re.fullmatch(r'\d+K',t))
adb('install','-r',sys.argv[1])
adb('logcat','-c')
adb('shell','wm','size','720x1280')
adb('shell','wm','density','160')
adb('shell','svc','wifi','disable')
adb('shell','svc','data','disable')
launch()
root = hierarchy('01-entry'); screenshot('01-entry')
assert any(n.get('text')=='DOMINION' for n in root.iter('node')), 'Standalone app did not mount'
rotation = adb('shell','dumpsys','input')
(OUT/'input.txt').write_text(rotation)
# Verify rendered hierarchy is landscape, rather than trusting requested orientation.
bounds = [int(n) for n in re.findall(r'\d+', root[0].get('bounds',''))]
assert bounds[2]-bounds[0] > bounds[3]-bounds[1], 'App is not landscape'
painting=next(n for n in root.iter('node') if n.get('content-desc')=='Иллюстрация Dominion: main-menu')
art_bounds=list(map(int,re.findall(r'\d+',painting.get('bounds',''))))
assert art_bounds[2]-art_bounds[0]>=bounds[2]-bounds[0], 'Menu painting leaves uncovered landscape width'
assert art_bounds[3]-art_bounds[1]>=bounds[3]-bounds[1]-80, 'Menu painting leaves uncovered landscape height'
assert next(n for n in root.iter('node') if n.get('content-desc')=='Продолжить').get('enabled')=='false', 'Continue should be disabled without a save'
click_text(root,'Новая кампания'); time.sleep(1)
root=hierarchy('01-new-campaign'); screenshot('01-new-campaign')
assert any(n.get('text')=='Начать кампанию' for n in root.iter('node'))
for number in ['195','2 924']:
    stat=next(n for n in root.iter('node') if n.get('text')==number)
    b=list(map(int,re.findall(r'\d+',stat.get('bounds',''))))
    assert b[3]-b[1]>=24, 'Campaign number clipped by text line height: '+number
adb('shell','input','keyevent','4'); time.sleep(1)
root=hierarchy('01-menu-back')
click_text(root,'Мультиплеер'); time.sleep(1)
root=hierarchy('01-multiplayer'); screenshot('01-multiplayer')
assert any(n.get('content-desc')=='Код комнаты' for n in root.iter('node'))
adb('shell','input','keyevent','4');time.sleep(1)
root=hierarchy('01-menu-load'); click_text(root,'Загрузить игру');time.sleep(1)
root=hierarchy('01-load'); screenshot('01-load')
assert any(n.get('text')=='Хроника кампаний' for n in root.iter('node'))
adb('shell','input','keyevent','4');time.sleep(1)
root=hierarchy('01-menu-settings'); click_text(root,'Настройки');time.sleep(1)
screenshot('01-settings');adb('shell','input','keyevent','4');time.sleep(1)
root=hierarchy('01-menu-launch')
launch_time=time.monotonic()
click_text(root,'Одиночная игра')
root=hierarchy('01-campaign-loading');screenshot('01-campaign-loading')
assert any('Загрузка кампании' in n.get('text','') for n in root.iter('node')) or any('Политическая' in n.get('text','') for n in root.iter('node')), 'One tap produced no visible loading or campaign'
time.sleep(15)
(OUT/'menu-to-campaign-seconds.txt').write_text(str(time.monotonic()-launch_time)+'\nIncludes UI dump/screenshot and fixed smoke wait; not startup latency.\n')
root = hierarchy('02-map'); screenshot('02-map')
assert_map_painted(OUT/'02-map.png')
assert any('Политическая' in n.get('text','') for n in root.iter('node')), 'GPU map screen did not mount'
# Exercise real offline commands in the release bundle, not only a mounted canvas.
# Select through the real searchable picker; no dependency on synthetic demo geometry.
click_text(root,'СТРАНЫ · 195')
root = hierarchy('country-picker'); screenshot('country-picker')
node = next(n for n in root.iter('node') if n.get('content-desc') == 'Поиск государства')
nums = [int(n) for n in re.findall(r'\d+',node.get('bounds',''))]
adb('shell','input','tap',str((nums[0]+nums[2])//2),str((nums[1]+nums[3])//2))
adb('shell','input','text','Germany'); time.sleep(1)
root = hierarchy('country-search'); click_text(root,'Германия'); time.sleep(2)

click_scrolling('ИГРАТЬ ЗА ЭТУ СТРАНУ')
click_text(hierarchy('ready-dock'),'Я ГОТОВ')
for attempt in range(12):
    root=hierarchy('start-enabled-'+str(attempt))
    button=next((n for n in root.iter('node') if n.get('content-desc')=='Начать игру'),None)
    if button is not None and button.get('enabled')=='true':break
    time.sleep(1)
assert button is not None and button.get('enabled')=='true', 'Start never became enabled'
click_text(root,'Начать игру')
for attempt in range(4):
    time.sleep(3)
    root=hierarchy('02-running');screenshot('02-running')
    if any(n.get('text','').startswith('Ход ') for n in root.iter('node')):break
    assert not any(n.get('text')=='Действие отклонено' for n in root.iter('node')), 'Start command rejected'
    # Wait for the first command; a second tap would hide a product regression.
assert any(n.get('text','').startswith('Ход ') for n in root.iter('node')), 'Campaign did not start after visible start control'
set_speed(0)
root = hierarchy('02-paused')
assert any(n.get('content-desc')=='Портрет вымышленного правителя' for n in root.iter('node')), 'Painted ruler portrait missing'
# Country preview centers the camera on Berlin; city/counter hit testing selects its real province.
navigate('Армия')
root=hierarchy('army-list')
army_row=next(n.get('text') for n in root.iter('node') if n.get('text','').startswith('Берлин · '))
click_text(root,army_row);time.sleep(1)
# Scroll the command card into view and capture the actual army size before recruitment.
for _ in range(12):
    root = hierarchy('02-command')
    if any(n.get('text') == 'DEU' for n in root.iter('node')): break
    adb('shell','input','swipe','1080','570','1080','220','450')
before = province_army_text(root)
click_scrolling('+25K · $500M')
root = hierarchy('02-recruited'); screenshot('02-recruited')
assert province_army_text(root) == str(int(before[:-1])+25)+'K', 'Recruitment command did not update the army'
# Assign a real free commander, then verify its painted portrait and state text.
commander_label=None
for _ in range(5): adb('shell','input','swipe','1080','220','1080','570','350')
for attempt in range(18):
    tree=hierarchy('find-commander-'+str(attempt))
    for node in tree.iter('node'):
        label=node.get('content-desc','');bounds=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
        if label.startswith('Полководец ') and node.get('enabled')=='true' and len(bounds)==4 and 70<=bounds[1] and bounds[3]<=640 and bounds[3]-bounds[1]>=20:
            commander_label=label;break
    if commander_label:break
    adb('shell','input','swipe','1080','530','1080','320','350')
assert commander_label, 'No usable illustrated commander card'
click_scrolling(commander_label)
commander_name=commander_label.removeprefix('Полководец ')
assert commander_name in read_scrolling('Командир: '), 'Commander assignment did not apply'
root=hierarchy('commander-art');screenshot('commander-art')
assert any(n.get('content-desc')=='Портрет вымышленного полководца: '+commander_name for n in root.iter('node')), 'Assigned commander portrait missing'
# Expansion 2.0: actual Canvas marker/flag touch regression, independent of row commands.
click_scrolling('ПЕРЕМЕСТИТЬ')
ordered_text=read_scrolling('Командир: ')
assert 'Цель:' in ordered_text, 'A real neighbor order did not persist'
root=hierarchy('selected-with-order');screenshot('selected-with-order')
click_text(root,'ЗАКРЫТЬ ПАНЕЛЬ');time.sleep(1)
def set_overlay(wanted):
    map_menu(True)
    text='Performance overlay: '+('Выкл' if wanted else 'Вкл')
    for attempt in range(12):
        tree=hierarchy('overlay-control-'+str(attempt))
        node=next((n for n in tree.iter('node') if n.get('text')==text),None)
        if node is not None:
            rect=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(rect)==4 and rect[3]-rect[1]>=14 and 70<=rect[1] and rect[3]<=570:
                click_text(tree,text);time.sleep(1);map_menu(False);return
        adb('shell','input','swipe','250','500','250','240','350')
    raise AssertionError('Overlay toggle not reachable')
set_overlay(True);time.sleep(2)
def camera_targets():
    root=hierarchy('map-touch-targets')
    raw=next(n.get('content-desc') for n in root.iter('node') if n.get('content-desc','').startswith('DOMINION_CAMERA '))
    metrics=json.loads(raw.removeprefix('DOMINION_CAMERA '))
    canvas=next(n for n in root.iter('node') if n.get('content-desc')=='Карта Dominion')
    bounds=list(map(int,re.findall(r'\d+',canvas.get('bounds',''))))
    assert len(bounds)==4, 'Canvas touch bounds missing'
    return root,metrics,bounds

def touch_target(target,bounds):
    x,y=round(bounds[0]+target['x']),round(bounds[1]+target['y'])
    assert bounds[0]<x<bounds[2] and bounds[1]<y<bounds[3], 'Painted target outside map'
    adb('shell','input','swipe',str(x),str(y),str(x),str(y),'100');time.sleep(2)

root,metrics,bounds=camera_targets()
marker=next(t for t in json.loads(metrics['armyTargets']) if t['selected'])
touch_target(marker,bounds)
root=hierarchy('army-repeated-tap-deselected');screenshot('army-repeated-tap-deselected')
assert not any(n.get('text')=='СНЯТЬ ВЫБОР' for n in root.iter('node')), 'Repeated marker tap did not clear army selection'
root,metrics,bounds=camera_targets()
marker=next(t for t in json.loads(metrics['armyTargets']) if 'germany' in t['ownerIds'] and abs(t['x']-marker['x'])<50 and abs(t['y']-marker['y'])<50)
touch_target(marker,bounds)
assert 'Цель:' in read_scrolling('Командир: '), 'Deselect silently cancelled movement'
root=hierarchy('selected-before-back')
adb('shell','input','keyevent','4');time.sleep(1)
root=hierarchy('army-back-deselected')
assert not any(n.get('text')=='СНЯТЬ ВЫБОР' for n in root.iter('node')), 'Android Back left army selected'
# Explicit country flag must open diplomacy even with an army selected.
root,metrics,bounds=camera_targets();touch_target(marker,bounds)
root=hierarchy('selected-before-foreign-flag');click_text(root,'ЗАКРЫТЬ ПАНЕЛЬ');time.sleep(1)
click_text(root,'Обзор мира');time.sleep(2)
root,metrics,bounds=camera_targets()
foreign=next(t for t in json.loads(metrics['countryTargets']) if t['countryId']!='germany' and 30<t['x']<bounds[2]-bounds[0]-60 and 70<t['y']<bounds[3]-bounds[1]-130)
touch_target(foreign,bounds)
root=hierarchy('foreign-flag-diplomacy');screenshot('foreign-flag-diplomacy')
assert any(n.get('content-desc')=='Раздел Дипломатия' and n.get('selected')=='true' for n in root.iter('node')), 'Foreign flag did not open diplomacy'
assert not any(n.get('text')=='СНЯТЬ ВЫБОР' for n in root.iter('node')), 'Foreign flag left the army capturing future map taps'
set_overlay(False)
navigate('Армия');root=hierarchy('army-list-after-diplomacy');click_text(root,army_row);time.sleep(1)
assert 'Цель:' in read_scrolling('Командир: '), 'Foreign diplomacy cancelled the retained order'
# Cancel is a separate authoritative command; clear it before inherited scenario checks.
click_scrolling('Отменить приказ')
assert 'Цель:' not in read_scrolling('Командир: '), 'Explicit movement cancellation did not apply'
click_scrolling('Строить')
root=hierarchy('construction-art');screenshot('construction-art')
assert any(n.get('content-desc')=='Иллюстрация здания: Ферма' for n in root.iter('node')), 'Construction painting missing'
click_scrolling('Построить Ферма')
assert 'Ферма' in read_scrolling('Строится: '), 'Construction did not start from the catalogue'
screenshot('construction-queued')
# Government is a real paid command, with a frozen 24-month cooldown on pause.
click_scrolling('Экономика ▾')
root = hierarchy('economy-before'); screenshot('economy-before')
assert read_scrolling('Налоги: ').startswith('Налоги: 30%'), 'Initial tax policy missing'
assert 'Ресурсы: $0M' not in read_scrolling('Ресурсы: '), 'Resource income missing'
screenshot('economy-resources')
click_scrolling('Налоги +5%')
root = hierarchy('economy-tax')
assert read_scrolling('Налоги: ').startswith('Налоги: 35%'), 'Tax command did not apply'
click_scrolling('Кредит $100M')
root = hierarchy('economy-loan'); screenshot('economy-loan')
assert read_scrolling('Долг: ').startswith('Долг: $100M'), 'Loan command did not create debt'
click_scrolling('Погасить $100M')
root = hierarchy('economy-repaid')
assert read_scrolling('Долг: ').startswith('Долг: $0M'), 'Repayment did not clear debt'
click_scrolling('Налоги −5%')
click_scrolling('Экономика ▴')
for _ in range(5): adb('shell','input','swipe','1080','220','1080','570','350')
click_scrolling('Правительство ▾')
root = hierarchy('government-before');screenshot('government-art')
assert any(n.get('content-desc')=='Иллюстрация формы правления' for n in root.iter('node')), 'Government painting missing'
header = next(n.get('text') for n in root.iter('node') if 'ФОРМА ПРАВЛЕНИЯ · ' in n.get('text',''))
power_before = int(re.search(r'(\d+) PP',header).group(1))
click_scrolling('Parliamentary Republic')
root = hierarchy('government-after'); screenshot('government-after')
texts = [n.get('text','') for n in root.iter('node')]
assert not any('Действие отклонено' in t for t in texts), 'Government command was rejected'
header = next(t for t in texts if 'ФОРМА ПРАВЛЕНИЯ · ' in t)
assert int(re.search(r'(\d+) PP',header).group(1)) == power_before - 80, 'Government did not spend 80 PP'
assert 'Следующая смена через 24 мес.' in texts, 'Government cooldown missing'
# Accumulate political power through the actual running campaign, then pause before payment assertions.
for _ in range(5): adb('shell','input','swipe','1080','220','1080','570','350')
navigate('Страна')
population_root = hierarchy('population-before')
population_before = next(n.get('text') for n in population_root.iter('node') if n.get('text','').startswith('Население: ')).split(' · ')[0]
advance_campaign_months(20)
population_root = hierarchy('population-after'); screenshot('population-after')
population_after = next(n.get('text') for n in population_root.iter('node') if n.get('text','').startswith('Население: ')).split(' · ')[0]
assert population_after != population_before, 'Actual campaign population did not grow'
click_scrolling('Правительство ▴')
click_scrolling('Религия ▾')
root = hierarchy('religion-before');screenshot('religion-art')
assert any(n.get('content-desc')=='Иллюстрация религиозной архитектуры' for n in root.iter('node')), 'Religion painting missing'
header = next(n.get('text') for n in root.iter('node') if 'ГОСУДАРСТВЕННАЯ РЕЛИГИЯ · ' in n.get('text',''))
religion_power = int(re.search(r'(\d+) PP',header).group(1))
assert religion_power >= 120, 'Campaign did not accumulate enough political power'
# Germany's original scenario starts Protestant; choose the visible Catholic option.
click_scrolling('Католицизм')
root = hierarchy('religion-after'); screenshot('religion-after')
texts = [n.get('text','') for n in root.iter('node')]
assert not any('Действие отклонено' in t for t in texts), 'Religion command was rejected'
header = next(t for t in texts if 'ГОСУДАРСТВЕННАЯ РЕЛИГИЯ · ' in t)
assert int(re.search(r'(\d+) PP',header).group(1)) == religion_power - 120, 'Religion did not spend 120 PP'
assert 'Следующая смена религии через 36 мес.' in texts, 'Religion cooldown missing'
assert any('Religious Unity:' in t for t in texts), 'Religious Unity is missing'
# Five-phase UI regression: real research and diplomatic agreement in the release APK.
click_scrolling('Религия ▴')
click_scrolling('Технологии ▾')
root=hierarchy('technology-art');screenshot('technology-art')
assert any(n.get('content-desc')=='Иллюстрация технологий: университет' for n in root.iter('node')), 'Technology painting missing'
click_scrolling('Исследовать Экономика')
assert '0.0 / 6' in read_scrolling('Экономика: '), 'Research did not queue while paused'
screenshot('research-queued')
advance_campaign_months(7)
navigate('Технологии')
assert read_scrolling('Экономика · 1/5'), 'Research did not complete through the real game clock'
screenshot('research-complete')
click_scrolling('Технологии ▴')
click_scrolling('Дипломатия ▾')
click_scrolling('Поиск страны для дипломатии')
adb('shell','input','text','bra'); adb('shell','input','keyevent','4')
click_scrolling('Бразилия')
click_scrolling('Улучшить отношения · 10 PP')
assert 'отношения 15' in read_scrolling('Бразилия · отношения ')
click_scrolling('Предложить: Ненападение')
assert 'Ненападение' in read_scrolling('Договоры: ')
screenshot('diplomacy-treaty')
click_scrolling('Дипломатия ▴')
click_scrolling('Стабильность · восстаний 0 ▾')
click_scrolling('Умиротворить · 50M + 10 PP')
root = hierarchy('stability-pacified'); screenshot('stability-pacified')
assert not any('Действие отклонено' in n.get('text','') for n in root.iter('node')), 'Pacification was rejected'
adb('shell','input','keyevent','4')
for _ in range(6):
    time.sleep(1);root=hierarchy('map-controls')
    if any(n.get('text')=='УПРАВЛЕНИЕ' for n in root.iter('node')):break
assert any(n.get('text')=='УПРАВЛЕНИЕ' for n in root.iter('node')), 'Back did not close campaign panel'
map_menu(True)
for quality in ['Performance','Balanced','High','Ultra']:
    root = hierarchy('graphics-'+quality)
    click_text(root, quality)
    time.sleep(1)
    screenshot('graphics-'+quality)
root = hierarchy('graphics-close')
map_menu(False)
for label in ['Правительство','Религия','Экономика','Население','Армии','Ресурсы','Рельеф','Стабильность','Дипломатия','Отношения','Развитие','Политическая']:
    root = hierarchy('mode-open')
    root = map_menu(True)
    click_text(root,"Режим "+label)
    time.sleep(2)
    root=map_menu(False)
    assert any(n.get('text','').startswith(label+' · Ultra') for n in root.iter('node')), 'Map mode did not switch: '+label
    screenshot('mode-'+str(['Правительство','Религия','Экономика','Население','Армии','Ресурсы','Рельеф','Стабильность','Дипломатия','Отношения','Развитие','Политическая'].index(label)))
# Exercise camera before taking evidence. Animation is on the native UI thread.
adb('shell','dumpsys','gfxinfo',PACKAGE,'reset')
for _ in range(4):
    adb('shell','input','swipe','350','340','680','340','600')
    adb('shell','input','swipe','680','340','350','340','600')
(OUT/'gfxinfo.txt').write_text(adb('shell','dumpsys','gfxinfo',PACKAGE,'framestats'))
time.sleep(1)
adb('shell','input','tap','500','320'); adb('shell','input','tap','500','320')
time.sleep(1)
screenshot('03-camera')
assert_map_painted(OUT/'03-camera.png')
# GPU surface resize/layout across target widths.
for width, height in [(1600,720),(1920,1080),(2340,1080),(1280,800)]:
    adb('shell','wm','size',f'{height}x{width}')
    time.sleep(3)
    screenshot(f'layout-{width}x{height}')
# Save before configuration changes, which Android may handle by recreating the app.
root=hierarchy('save-before-configuration');click_text(root,'СОХРАНИТЬ');time.sleep(3)
saved_tick=next(n.get('text') for n in root.iter('node') if n.get('text','').startswith('Ход '))
def restore_after_configuration(name):
    root=hierarchy(name)
    if not any(n.get('text','').startswith('Ход ') for n in root.iter('node')):
        sizes=re.findall(r'(\d+)x(\d+)',adb('shell','wm','size'))
        width,height=sorted(map(int,sizes[-1]),reverse=True)
        for attempt in range(8):
            usable=False
            for node in root.iter('node'):
                if node.get('content-desc')!='Продолжить':continue
                bounds=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
                usable=len(bounds)==4 and bounds[3]-bounds[1]>=30 and bounds[1]>=0 and bounds[3]<=height-40
                if usable:break
            if usable:break
            adb('shell','input','swipe',str(width//2),str(int(height*.8)),str(width//2),str(int(height*.35)),'350')
            root=hierarchy(name+'-list-'+str(attempt))
        assert usable, 'No usable saved campaign after configuration change'
        click_text(root,'Продолжить')
        for attempt in range(12):
            time.sleep(1);root=hierarchy(name+'-restore-'+str(attempt))
            if any(n.get('text','').startswith('Ход ') for n in root.iter('node')):break
    assert any(n.get('text')==saved_tick for n in root.iter('node')), 'Paused campaign changed across recreation: '+name
    return root
# Real phone density: verify the compact selector remains scrollable inside safe area.
adb('shell','wm','size','1080x2340');adb('shell','wm','density','320');time.sleep(3)
restore_after_configuration('dense-phone');map_menu(True);screenshot('dense-phone-menu')
adb('shell','input','keyevent','4');time.sleep(1)
cutout='com.android.internal.display.cutout.emulation.corner'
if cutout in adb('shell','cmd','overlay','list'):
    adb('shell','cmd','overlay','enable',cutout);time.sleep(3)
    restore_after_configuration('cutout');screenshot('cutout-landscape')
    adb('shell','cmd','overlay','disable',cutout);time.sleep(3)
    restore_after_configuration('cutout-disabled')
adb('shell','wm','density','160');adb('shell','wm','size','720x1280');time.sleep(3)
restore_after_configuration('density-reset')
# Kill the process and explicitly load the same paused campaign from the entry menu.
launch();screenshot('04-restart')
root=restore_after_configuration('campaign-restored');screenshot('campaign-restored')
navigate('Экономика');adb('shell','input','keyevent','4');time.sleep(1)
root=hierarchy('back-closed-panel');assert any(n.get('text')=='УПРАВЛЕНИЕ' for n in root.iter('node')), 'Back did not close secondary panel'
adb('shell','input','keyevent','4');time.sleep(1)
root=hierarchy('exit-confirmation');assert any(n.get('text')=='Выйти из кампании?' for n in root.iter('node')), 'Back skipped exit confirmation'
click_text(root,'ОСТАТЬСЯ');time.sleep(1)
root=hierarchy('exit-cancelled')
assert any(n.get('text')=='DOMINION' for n in root.iter('node')), 'Restart failed without Metro'
# Reboot with persisted app data and network still disabled; no Metro is running.
(OUT/'meminfo-before-reboot.txt').write_text(adb('shell','dumpsys','meminfo',PACKAGE))
adb('reboot')
subprocess.run(['adb','wait-for-device'],check=True,timeout=60)
for attempt in range(60):
    if adb('shell','getprop','sys.boot_completed').strip()=='1':break
    time.sleep(2)
else: raise AssertionError('Emulator did not finish reboot')
adb('shell','input','keyevent','82');time.sleep(3)
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
launch();restore_after_configuration('campaign-after-reboot');screenshot('campaign-after-reboot')
(OUT/'meminfo-after-reboot.txt').write_text(adb('shell','dumpsys','meminfo',PACKAGE))
assert 'Metro' not in adb('shell','ps','-A'), 'Unexpected Metro process'
logs = adb('logcat','-d'); (OUT/'logcat.txt').write_text(logs)
assert 'FATAL EXCEPTION' not in logs and 'Fatal signal' not in logs, 'Native crash detected'
assert 'Unable to load script' not in logs, 'Standalone JS load failed'
print('PASS: network-disabled cold launch, landscape, 195-country world selection/search/start/pause/recruitment, population growth, government/religion cost/cooldown and Unity, 4 presets, 12 modes, camera inputs, 5 layouts, persistent campaign restore, Back priority, restart and device reboot, no fatal logs')

# Exercise the built-in benchmark on the actual release renderer.
def map_control(text):
    map_menu(True)
    for attempt in range(12):
        root=hierarchy('developer-control-'+str(attempt))
        screen=[int(n) for n in re.findall(r'\d+',root[0].get('bounds',''))]
        height=screen[3]-screen[1] if len(screen)==4 else 720
        node=next((n for n in root.iter('node') if n.get('text')==text or n.get('content-desc')==text),None)
        if node is not None:
            nums=[int(n) for n in re.findall(r'\d+',node.get('bounds',''))]
            # Controls clipped against the ScrollView bottom can look clickable to
            # uiautomator while the ScrollView consumes the gesture. Move them into
            # a safe interior band before tapping.
            if len(nums)==4 and nums[3]-nums[1]>=20 and nums[1]>=70 and nums[3]<=height-150:
                x,y=str((nums[0]+nums[2])//2),str((nums[1]+nums[3])//2)
                print('Tap developer:',text,node.get('bounds'),flush=True)
                adb('shell','input','tap',x,y);time.sleep(2);return
        adb('shell','input','swipe','250','340','250','160','350')
    raise AssertionError('Developer control missing: '+text)
map_control('Performance overlay: Выкл')
root=hierarchy('developer-overlay-enabled')
assert any(n.get('text')=='Performance overlay: Вкл' or n.get('content-desc')=='Performance overlay: Вкл' for n in root.iter('node')), 'Performance overlay toggle did not apply'
map_control('Performance Benchmark')
time.sleep(50)
root=hierarchy('developer-benchmark-finished');screenshot('developer-benchmark')
assert not any(n.get('text','').startswith('Benchmark: ') for n in root.iter('node')), 'Benchmark did not finish'
assert any('GPU FPS unavailable' in n.get('text','') for n in root.iter('node')), 'Performance overlay missing'
assert any('Benchmark ticks: 12 · OK' in n.get('text','') for n in root.iter('node')), 'Benchmark failed to execute twelve simulation ticks'
# Software render/simulation/autosave soak; not a physical thermal measurement.
duration=int(os.environ.get('DOMINION_STRESS_SECONDS','0'))
if duration:
    set_speed(4);start=time.monotonic();sample=0
    while time.monotonic()-start<duration:
        adb('shell','input','swipe','550','280','720','320','800')
        adb('shell','input','swipe','720','320','550','280','800')
        if time.monotonic()-start>=sample*60:
            (OUT/f'stress-memory-{sample:02}.txt').write_text(adb('shell','dumpsys','meminfo',PACKAGE))
            (OUT/f'stress-frames-{sample:02}.txt').write_text(adb('shell','dumpsys','gfxinfo',PACKAGE,'framestats'))
            print('Stress seconds:',round(time.monotonic()-start),flush=True);sample+=1
        time.sleep(5)
    set_speed(0);screenshot('stress-complete');hierarchy('stress-complete')
    (OUT/'stress-duration.txt').write_text(str(time.monotonic()-start))
    logs=adb('logcat','-d');(OUT/'stress-logcat.txt').write_text(logs)
    assert 'FATAL EXCEPTION' not in logs and 'Fatal signal' not in logs and 'Unable to load script' not in logs
    print('PASS: continuous release render/simulation/autosave software stress',duration,'seconds',flush=True)
