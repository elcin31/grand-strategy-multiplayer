"""APK smoke test on an emulator. No Metro, no production-room writes.

Verifies cold launch, landscape, offline campaign map, restart, and fatal logs.
Evidence is uploaded by CI. This is not a physical-device FPS claim.
"""
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
PACKAGE = 'com.elcin31.grandstrategymultiplayer'
OUT = Path('android-smoke'); OUT.mkdir(exist_ok=True)
def adb(*args): return subprocess.check_output(['adb', *args], text=True)
def hierarchy(name):
    adb('shell','uiautomator','dump','/sdcard/window.xml')
    xml = adb('shell','cat','/sdcard/window.xml')
    (OUT / (name+'.xml')).write_text(xml)
    return ET.fromstring(xml)
def screenshot(name):
    with (OUT / (name+'.png')).open('wb') as f: subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def launch():
    adb('shell','am','force-stop',PACKAGE)
    adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
    time.sleep(12)
def click_text(root, text):
    node = next((n for n in root.iter('node') if n.get('text') == text or n.get('content-desc') == text), None)
    assert node is not None, 'Missing control: '+text
    nums = [int(n) for n in re.findall(r'\d+',node.get('bounds',''))]
    assert len(nums)==4
    adb('shell','input','tap',str((nums[0]+nums[2])//2),str((nums[1]+nums[3])//2))
def click_scrolling(text):
    for attempt in range(8):
        root = hierarchy('flow-'+str(attempt))
        node = next((n for n in root.iter('node') if n.get('text') == text), None)
        if node is not None:
            nums = [int(n) for n in re.findall(r'\d+',node.get('bounds',''))]
            if len(nums) == 4 and nums[2] > nums[0] and 70 <= nums[1] < nums[3] <= 660:
                click_text(root,text); time.sleep(1); return
        adb('shell','input','swipe','1080','570','1080','180','450')
    raise AssertionError('Missing usable control: '+text)
def province_army_text(root):
    texts = [n.get('text','') for n in root.iter('node') if n.get('text')]
    owner = texts.index('GER')
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
click_text(root,'ОДИНОЧНАЯ ИГРА')
time.sleep(8)
root = hierarchy('02-map'); screenshot('02-map')
assert any('Политическая' in n.get('text','') for n in root.iter('node')), 'GPU map screen did not mount'
# Exercise real offline commands in the release bundle, not only a mounted canvas.
# Fixed screen is 1280x720; this is the initial west-Germany counter position.
adb('shell','input','tap','475','357'); time.sleep(1)
click_scrolling('ИГРАТЬ ЗА ЭТУ СТРАНУ')
click_scrolling('Я ГОТОВ')
click_scrolling('НАЧАТЬ ИГРУ')
root = hierarchy('02-running')
click_text(root,'УПРАВЛЕНИЕ')
click_scrolling('Ⅱ')
root = hierarchy('02-paused'); click_text(root,'ЗАКРЫТЬ ПАНЕЛЬ')
adb('shell','input','tap','475','357'); time.sleep(1)
# Scroll the command card into view and capture the actual army size before recruitment.
for _ in range(5):
    root = hierarchy('02-command')
    if any(n.get('text') == 'GER' for n in root.iter('node')): break
    adb('shell','input','swipe','1080','570','1080','220','450')
before = province_army_text(root)
click_scrolling('+25K · $500M')
root = hierarchy('02-recruited'); screenshot('02-recruited')
assert province_army_text(root) == str(int(before[:-1])+25)+'K', 'Recruitment command did not update the army'
click_text(root,'ЗАКРЫТЬ ПАНЕЛЬ')
root = hierarchy('map-controls')
click_text(root, 'Политическая · Medium ▾')
for quality in ['Low','Medium','High','Ultra']:
    root = hierarchy('graphics-'+quality)
    click_text(root, quality)
    time.sleep(1)
    screenshot('graphics-'+quality)
root = hierarchy('graphics-close')
click_text(root, 'Политическая · Ultra ▾')
for label in ['Экономика','Население','Армии','Рельеф','Стабильность','Политическая']:
    root = hierarchy('mode-open')
    current = next(n.get('text') for n in root.iter('node') if ' · Ultra ▾' in n.get('text',''))
    click_text(root,current)
    root = hierarchy('mode-select')
    click_text(root,label)
    time.sleep(1)
    screenshot('mode-'+str(['Экономика','Население','Армии','Рельеф','Стабильность','Политическая'].index(label)))
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
# GPU surface resize/layout across target widths.
for width, height in [(1600,720),(1920,1080),(1280,800)]:
    adb('shell','wm','size',f'{height}x{width}')
    time.sleep(3)
    screenshot(f'layout-{width}x{height}')
launch(); root = hierarchy('04-restart'); screenshot('04-restart')
assert any(n.get('text')=='DOMINION' for n in root.iter('node')), 'Restart failed without Metro'
logs = adb('logcat','-d'); (OUT/'logcat.txt').write_text(logs)
assert 'FATAL EXCEPTION' not in logs and 'Fatal signal' not in logs, 'Native crash detected'
assert 'Unable to load script' not in logs, 'Standalone JS load failed'
print('PASS: network-disabled cold launch, landscape, offline country selection/start/pause/recruitment, 4 presets, 6 modes, camera inputs, 4 layouts, restart, no fatal logs')
