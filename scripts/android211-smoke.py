"""Short Dominion 2.1.1 release smoke: launch, campaign, HUD, army and save/restart.
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
def navigation(label,name,direction='up'):
    # The eleven 44dp targets intentionally scroll on short landscape screens.
    # Scroll the actual left rail, then tap the visible enabled target once.
    for attempt in range(5):
        tree=root(name+'-'+str(attempt));node=find_enabled_control(tree,label)
        if node is not None:
            box=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(box)==4 and box[2]>box[0] and box[3]-box[1]>=12:tap(node);return
        rails=[]
        for n in tree.iter('node'):
            box=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
            if n.get('scrollable')=='true' and len(box)==4 and box[3]-box[1]>120:rails.append(box)
        assert rails,'Missing scrollable navigation rail'
        box=min(rails,key=lambda b:b[0]);x=(box[0]+box[2])//2;h=box[3]-box[1]
        low,high=int(box[1]+h*.82),int(box[1]+h*.22)
        adb('shell','input','swipe',x,low if direction=='down' else high,x,high if direction=='down' else low,350)
        time.sleep(.5)
    raise AssertionError('Missing enabled navigation: '+label)
def launch():
    adb('shell','am','force-stop',PACKAGE);adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity');time.sleep(10)
try:
    adb('install','-r',sys.argv[1]);adb('logcat','-c');adb('shell','settings','put','system','accelerometer_rotation','0');adb('shell','settings','put','system','user_rotation','1');launch();capture('01-menu')
    control('Одиночная игра','single');time.sleep(12);control('СТРАНЫ · 195','countries');tree=root('search');node=find_enabled_control(tree,'Поиск государства');assert node is not None;tap(node);adb('shell','input','text','Germany');time.sleep(1);adb('shell','input','keyevent','4');time.sleep(1);control('Государство: Германия','germany');time.sleep(1);control('Играть за эту страну','choose');control('Я ГОТОВ','ready');control('Начать игру','start');time.sleep(3)
    control('Пауза','pause');tree=root('hud');assert find_enabled_control(tree,'Выбрать скорость кампании') is not None;capture('02-campaign');assert_map_painted(OUT/'02-campaign.png')
    navigation('Раздел Правительство','government','down');tree=root('window-before');title=next(n for n in tree.iter('node') if '⠿ Правительство' in n.get('text',''));before=title.get('bounds');box=list(map(int,re.findall(r'\d+',before)));x,y=(box[0]+box[2])//2,(box[1]+box[3])//2
    adb('shell','input','swipe',x,y,x+25,y+40,450);time.sleep(.5);tree=root('window-after');title=next(n for n in tree.iter('node') if '⠿ Правительство' in n.get('text',''));assert title.get('bounds')!=before,'Window did not move'
    control('Советники','advisers');tree=root('scroll');containers=[list(map(int,re.findall(r'\d+',n.get('bounds','')))) for n in tree.iter('node') if n.get('scrollable')=='true'];box=max((b for b in containers if len(b)==4 and b[3]-b[1]>80),key=lambda b:b[0]);x=(box[0]+box[2])//2;adb('shell','input','swipe',x,box[3]-20,x,box[1]+30,350);control('Закрыть окно','close-window')
    navigation('Раздел Армия','army');control('Выбрать армию 1','army-first',True);control('Открыть окно армии','inspect');control('Приказы','orders');control('Разделить 50%','split',True);time.sleep(.5)
    control('Бранденбург','waypoint',True);control('Марш','march',True);time.sleep(.5);tree=root('ordered');assert any('Прибытие:' in n.get('text','') for n in tree.iter('node')),'Route confirmation missing'
    control('Закрыть окно','close-army');control('Снять выделение армии','deselect');control('Продолжить','resume');time.sleep(6);control('Пауза','pause-after-march')
    navigation('Раздел Армия','army-moved');tree=root('moved');assert any('Бранденбург' in n.get('text','') for n in tree.iter('node')),'Army did not complete the short route';control('Закрыть окно','close-moved')
    control('Настройки звука','audio');control('Отключить звук','mute');tree=root('muted');assert any(n.get('checked')=='true' and 'Отключить звук' in n.get('content-desc','') for n in tree.iter('node')),'Mute not confirmed';control('Закрыть окно','close-audio')
    control('Сохранить кампанию','save');time.sleep(2)
    launch();control('Продолжить','continue');time.sleep(12);control('Настройки звука','restored-audio');tree=root('restored-muted');assert any(n.get('checked')=='true' and 'Отключить звук' in n.get('content-desc','') for n in tree.iter('node')),'Audio preference not restored';control('Закрыть окно','close-restored-audio');tree=root('restored');assert find_enabled_control(tree,'Выбрать скорость кампании') is not None;capture('03-restored');assert_map_painted(OUT/'03-restored.png')
    logs=adb('logcat','-d');(OUT/'logcat.txt').write_text(logs);assert_no_game_fatal(logs,adb('shell','pidof',PACKAGE).strip());assert not re.search(r'TypeError:|ReferenceError:|JavascriptException|Cannot read property|undefined is not',logs),'Runtime JS error'
    (OUT/'result.json').write_text(json.dumps({'releaseColdLaunch':True,'campaignStarted':True,'newHUD':True,'armySplit':True,'armyOrder':True,'armyMovement':True,'deselectPreservesOrder':True,'centralWindowOpenDragScrollClose':True,'mute':True,'saveRestart':True,'mapPainted':True,'noFatalLogs':True,'soak':False},indent=2));print('PASS: standalone launch/HUD/map, draggable window, army split/order/move/deselect, mute and save/restart')
finally:
    if not (OUT/'result.json').exists():
        try:capture('failure')
        except Exception:pass
    try:(OUT/'final-logcat.txt').write_text(adb('logcat','-d'))
    except Exception:pass
