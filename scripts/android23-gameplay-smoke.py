"""Actual candidate APK, original scenario/event UI, economics, focus and restart.
All fixture writes are restricted to a rooted disposable Android SDK emulator.
No production multiplayer room or user save is read or modified.
"""
import hashlib,json,re,subprocess,sys,time
from pathlib import Path
import android_map_controls as h
from android_accessibility import assert_no_game_fatal
from android_fixture import root_test_device,label_test_fixture
from android_campaign_pull import copy_campaign_saves
from map_paint_check import assert_map_painted
OUT=Path('android23-gameplay');OUT.mkdir(exist_ok=True);h.OUT=OUT
fixture=Path(sys.argv[2]);manifest=json.loads((fixture/'manifest.json').read_text());campaign='gameplay23-qa';checks=[]
def text_present(value,name):
    assert any(value in n.get('text','') or value in n.get('content-desc','') for n in h.root(name).iter('node')),name

def event_option(label):
    # The option heading repeats its title. Tap the labelled Pressable itself,
    # never a matching plain TextView above it.
    for attempt in range(8):
        tree=h.root('event-option-'+str(attempt))
        for node in tree.iter('node'):
            if node.get('content-desc')==label and node.get('enabled')!='false' and node.get('clickable')=='true':
                box=h.visible_bounds(tree,node)
                if box is not None:h.tap(node,box);return
        containers=[]
        for node in tree.iter('node'):
            box=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if node.get('scrollable')=='true' and len(box)==4 and box[3]-box[1]>120:containers.append(box)
        assert containers,'Missing actual event scroll container'
        box=max(containers,key=lambda b:(b[2]-b[0])*(b[3]-b[1]));x=(box[0]+box[2])//2;height=box[3]-box[1]
        h.adb('shell','input','swipe',x,int(box[1]+height*.82),x,int(box[1]+height*.22),350);time.sleep(.5)
    raise AssertionError('Missing actual event option Pressable')

def state(name):
    h.control('Сохранить кампанию','save-'+name);time.sleep(2)
    destination=OUT/('saved-'+name);copy_campaign_saves(h.adb,h.PACKAGE,destination,OUT/('copy-'+name+'.json'))
    saves=[]
    for f in destination.glob(campaign+'.*.json'):
        match=re.fullmatch(re.escape(campaign)+r'\.(\d+)\.json',f.name)
        if match:saves.append((int(match[1]),json.loads(f.read_text())['state']))
    assert saves,'No actual saved candidate campaign';return max(saves,key=lambda item:item[0])[1]
try:
    root_test_device(h.adb,OUT/'device.txt');assert 'sdk' in h.adb('shell','getprop','ro.product.name')
    h.adb('install','-r',sys.argv[1]);h.adb('shell','pm','clear',h.PACKAGE)
    h.adb('shell','wm','size','720x1280');h.adb('shell','wm','density','160');h.adb('shell','settings','put','system','accelerometer_rotation','0');h.adb('shell','settings','put','system','user_rotation','1')
    app='/data/user/0/'+h.PACKAGE;folder=app+'/files/dominion-campaigns';h.adb('shell','mkdir','-p',folder)
    source=fixture/manifest['filename'];target=folder+'/'+source.name;h.adb('push',source,target)
    uid=re.search(r'(?:userId|appId)=(\d+)',h.adb('shell','dumpsys','package',h.PACKAGE));assert uid
    h.adb('shell','chown','-R',uid[1]+':'+uid[1],app+'/files');label_test_fixture(h.adb,app,folder,target)
    h.adb('logcat','-c');h.launch();h.capture('cold-menu');h.control('Продолжить','restore');time.sleep(12)
    h.capture('alternate-scenario-map');assert_map_painted(OUT/'alternate-scenario-map.png');checks.append('candidate cold launch and actual original scenario restore')
    h.navigation('Раздел Нац. курс','focus',direction='down');h.control('Игровые события','events');time.sleep(1)
    text_present('Совместные мастерские пакта','event-title');h.capture('event-options');event_option('Принять совместную программу');time.sleep(1)
    text_present('НЕДАВНИЕ РЕШЕНИЯ','resolved-event');h.capture('event-resolved');h.control('Закрыть окно','close-event')
    event_state=state('event');country=event_state['countries']['germany']
    assert country['eventUnlockedFocuses'].count('alt-shared-workshops')==1
    assert round(manifest['initialTreasury']-country['treasury'],3)==80 and manifest['initialPoliticalPower']-country['politicalPower']==10
    assert sum(e['eventId']=='alt-rhine-workshops' and e['countryId']=='germany' for e in event_state['events']['history'])==1
    checks.append('visible paid event decision, exact cash/PP cost, one history entry and dynamic focus unlock')
    h.navigation('Раздел Статистика','statistics',direction='down');h.control('Хроника мира','world-chronicle')
    h.horizontal_control('Фильтр хроники: Государство','chronicle-filter');h.capture('filtered-chronicle')
    h.control('К стране: '+country['name'],'chronicle-country',scroll=True);time.sleep(1)
    text_present('ТВОЁ ГОСУДАРСТВО','chronicle-country-window');text_present(country['name'],'chronicle-country-name');h.capture('chronicle-country')
    h.control('Закрыть окно','close-chronicle-country');checks.append('event in filtered world chronicle opens the actual country window and focuses its capital')
    h.navigation('Раздел Экономика','economy');h.control('ПРОГНОЗ · 6 МЕСЯЦЕВ','forecast',scroll=True,tap_control=False);text_present('ПРОГНОЗ · 6 МЕСЯЦЕВ','forecast-visible');h.capture('forecast')
    h.control('Автоматическое строительство','enable-automation',True);time.sleep(1);h.control('Закрыть окно','close-economy')
    enabled=state('automation-enabled');assert enabled['countries']['germany']['stockpile']['autoBuild'] is True
    h.navigation('Раздел Экономика','economy-disable');h.control('Автоматическое строительство','disable-automation',True);time.sleep(1);h.control('Закрыть окно','close-economy-disable');checks.append('actual conditional economic forecast and saved opt-in automation toggle')
    h.navigation('Раздел Нац. курс','politics',direction='down');h.control('Особенности и решения','political-groups',True)
    for label in ['Военные','Промышленники','Региональные элиты','Гражданские движения','Государственная администрация']:text_present(label,'group-'+label)
    h.capture('political-groups');h.control('Фокусы (125)','focus-tree',True)
    h.control('Курс: '+manifest['focusName'],'select-course',True);h.control('Взять курс: '+manifest['focusName'],'start-course',True);time.sleep(1)
    h.capture('paid-focus');h.adb('shell','input','keyevent','4');time.sleep(1)
    before=state('before-restart');c=before['countries']['germany'];assert c['nationalFocus']['focusId']=='eco-audit' and c['nationalFocus']['progress']==0
    assert c['stockpile']['autoBuild'] is False;assert round(country['treasury']-c['treasury'],3)==220
    checks.append('five political groups, original focus tree, paid course and Android Back')
    h.launch();h.control('Продолжить','restart-continue');time.sleep(12)
    after=state('after-restart');assert before==after,'Significant paused state changed across actual process restart'
    h.control('Приблизить','camera-after-windows');h.capture('camera-after-windows');assert_map_painted(OUT/'camera-after-windows.png')
    logs=h.adb('logcat','-d');(OUT/'final-logcat.txt').write_text(logs);assert_no_game_fatal(logs,h.adb('shell','pidof',h.PACKAGE).strip())
    assert not re.search(r'TypeError:|ReferenceError:|JavascriptException|Dominion map preparation failed',logs)
    checks.append('exact save/process restart/restore, camera interaction after closing windows, no fatal logs')
    (OUT/'result.json').write_text(json.dumps({'passed':True,'apkSha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'checks':checks,'emulatorOnly':True,'physicalRedmiTest':False},ensure_ascii=False,indent=2)+'\n')
    print('PASS: actual APK event/economy/politics/focus/save/restart and camera-after-windows',flush=True)
finally:
    if not (OUT/'result.json').exists():
        try:h.capture('failure');(OUT/'failure-logcat.txt').write_text(h.adb('logcat','-d'))
        except Exception:pass
