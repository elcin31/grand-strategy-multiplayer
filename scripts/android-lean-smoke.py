"""Short Dominion 2.1 release smoke: launch, campaign, HUD, army and save/restart.
No soak, no camera matrix and no production room writes.
"""
import json,re,subprocess,sys,time
from pathlib import Path
from android_accessibility import dump_hierarchy,find_enabled_control,assert_no_game_fatal
from map_paint_check import assert_map_painted
PACKAGE='com.elcin31.grandstrategymultiplayer';OUT=Path('android-lean-smoke');OUT.mkdir(exist_ok=True)
def adb(*args,timeout=None):return subprocess.check_output(['adb',*map(str,args)],text=True,stderr=subprocess.STDOUT,timeout=timeout)
def root(name):return dump_hierarchy(adb,PACKAGE,OUT,name,'/sdcard/dominion21.xml')
def tap(node):
    coords=list(map(int,re.findall(r'\d+',node.get('bounds',''))));assert len(coords)==4
    x,y=(coords[0]+coords[2])//2,(coords[1]+coords[3])//2;adb('shell','input','swipe',x,y,x,y,100)
def control(label,name,scroll=False):
    for attempt in range(7 if scroll else 3):
        tree=root(name+'-'+str(attempt));node=find_enabled_control(tree,label)
        if node is not None:
            coords=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(coords)==4 and coords[2]>coords[0] and coords[3]-coords[1]>=12:tap(node);return
        if scroll:
            containers=[]
            for n in tree.iter('node'):
                box=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
                if n.get('scrollable')=='true' and len(box)==4 and box[3]-box[1]>120:containers.append(box)
            assert containers,'Missing scrollable context panel'
            box=max(containers,key=lambda b:b[0]);x=(box[0]+box[2])//2;h=box[3]-box[1]
            adb('shell','input','swipe',x,int(box[1]+h*.82),x,int(box[1]+h*.22),350)
        time.sleep(1)
    raise AssertionError('Missing enabled control: '+label)
def capture(name):
    with (OUT/(name+'.png')).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def launch():
    adb('shell','am','force-stop',PACKAGE);adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity');time.sleep(10)
try:
    adb('install','-r',sys.argv[1]);adb('logcat','-c');adb('shell','settings','put','system','accelerometer_rotation','0');adb('shell','settings','put','system','user_rotation','1');launch();capture('01-menu')
    control('Одиночная игра','single');time.sleep(12);control('СТРАНЫ · 195','countries');tree=root('search');node=find_enabled_control(tree,'Поиск государства');assert node is not None;tap(node);adb('shell','input','text','Germany');time.sleep(1);control('Государство: Германия','germany');time.sleep(1);control('ИГРАТЬ ЗА ЭТУ СТРАНУ','choose',True);control('Я ГОТОВ','ready');control('Начать игру','start');time.sleep(3)
    control('Пауза','pause');tree=root('hud');assert find_enabled_control(tree,'Скорость кампании') is not None;capture('02-campaign');assert_map_painted(OUT/'02-campaign.png')
    control('Раздел Армия','army');tree=root('army-list');row=next((n for n in tree.iter('node') if n.get('text','').startswith('Берлин · ')),None);assert row is not None,'Own army is missing';tap(row);time.sleep(1);control('Разделить 50%','split',True);time.sleep(1);control('Снять выделение армии','deselect');control('Сохранить кампанию','save');time.sleep(3)
    launch();control('Продолжить','continue');time.sleep(12);tree=root('restored');assert find_enabled_control(tree,'Скорость кампании') is not None;capture('03-restored');assert_map_painted(OUT/'03-restored.png')
    logs=adb('logcat','-d');(OUT/'logcat.txt').write_text(logs);assert_no_game_fatal(logs,adb('shell','pidof',PACKAGE).strip());assert not re.search(r'TypeError:|ReferenceError:|JavascriptException|Cannot read property|undefined is not',logs),'Runtime JS error'
    (OUT/'result.json').write_text(json.dumps({'releaseColdLaunch':True,'campaignStarted':True,'newHUD':True,'armySplit':True,'saveRestart':True,'mapPainted':True,'noFatalLogs':True,'soak':False},indent=2));print('PASS: standalone launch, new HUD/map, army split and save/restart')
finally:
    try:(OUT/'final-logcat.txt').write_text(adb('logcat','-d'))
    except Exception:pass
