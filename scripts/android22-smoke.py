"""Short Dominion 2.2 atlas release smoke: launch, campaign, HUD, army and save/restart.
No soak, no camera matrix and no production room writes.
"""
import json,re,subprocess,sys,time
from pathlib import Path
from PIL import Image
from android_accessibility import dump_hierarchy,find_enabled_control,assert_no_game_fatal
from map_paint_check import assert_map_painted
PACKAGE='com.elcin31.grandstrategymultiplayer';OUT=Path('android-lean-smoke');OUT.mkdir(exist_ok=True)
def adb(*args,timeout=None):return subprocess.check_output(['adb',*map(str,args)],text=True,stderr=subprocess.STDOUT,timeout=timeout)
def root(name):return dump_hierarchy(adb,PACKAGE,OUT,name,'/sdcard/dominion21.xml')
def visible_bounds(tree,target):
    def walk(node,ancestors):
        if node is target:
            box=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(box)!=4:return None
            for parent in ancestors:
                clip=list(map(int,re.findall(r'\d+',parent.get('bounds',''))))
                if len(clip)==4:box=[max(box[0],clip[0]),max(box[1],clip[1]),min(box[2],clip[2]),min(box[3],clip[3])]
            return box if box[2]>box[0] and box[3]-box[1]>=12 else None
        for child in node:
            result=walk(child,ancestors+[node])
            if result is not None:return result
        return None
    return walk(tree,[])
def tap(node,box=None):
    coords=box if box is not None else list(map(int,re.findall(r'\d+',node.get('bounds',''))));assert len(coords)==4
    x,y=(coords[0]+coords[2])//2,(coords[1]+coords[3])//2;adb('shell','input','swipe',x,y,x,y,100)
def control(label,name,scroll=False,tap_control=True):
    for attempt in range(7 if scroll else 3):
        tree=root(name+'-'+str(attempt));node=find_enabled_control(tree,label)
        if node is not None:
            box=visible_bounds(tree,node)
            if box is not None and (tap_control or box[3]-box[1]>=200):
                if tap_control:tap(node,box)
                return node
        if scroll:
            containers=[]
            for n in tree.iter('node'):
                box=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
                if n.get('scrollable')=='true' and len(box)==4 and box[3]-box[1]>120:containers.append(box)
            assert containers,'Missing scrollable context panel'
            box=max(containers,key=lambda b:(b[2]-b[0])*(b[3]-b[1]));x=(box[0]+box[2])//2;h=box[3]-box[1]
            adb('shell','input','swipe',x,int(box[1]+h*.82),x,int(box[1]+h*.22),350)
        time.sleep(1)
    raise AssertionError('Missing enabled control: '+label)
def horizontal_control(label,name):
    for attempt in range(6):
        tree=root(name+'-'+str(attempt));node=find_enabled_control(tree,label)
        if node is not None:
            box=visible_bounds(tree,node)
            if box is not None and box[2]-box[0]>=25:
                tap(node,box);return
        bars=[]
        for n in tree.iter('node'):
            b=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
            if n.get('scrollable')=='true' and len(b)==4 and b[2]-b[0]>3*(b[3]-b[1]):bars.append(b)
        assert bars,'Missing horizontal filter/tab strip'
        b=max(bars,key=lambda q:q[2]-q[0]);y=(b[1]+b[3])//2
        direction=-1 if attempt<3 else 1
        left=int(b[0]+(b[2]-b[0])*.2);right=int(b[0]+(b[2]-b[0])*.8)
        adb('shell','input','swipe',right if direction<0 else left,y,left if direction<0 else right,y,300);time.sleep(.3)
    raise AssertionError('Missing horizontal control: '+label)
def capture(name):
    with (OUT/(name+'.png')).open('wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
def navigation(label,name,direction='up'):
    # The eleven 44dp targets intentionally scroll on short landscape screens.
    # Scroll the actual left rail, then tap the visible enabled target once.
    for attempt in range(5):
        tree=root(name+'-'+str(attempt));node=find_enabled_control(tree,label)
        if node is not None:
            box=visible_bounds(tree,node)
            if box is not None:
                tap(node,box)
                return node
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
    control('Режимы и настройки карты','balanced-settings');control('Balanced','balanced',True);control('Закрыть ×','balanced-close',True)
    # Brief screenshots of all five approved map views and economic filters.
    for mode,name in [('Рельеф','terrain'),('Армии','military'),('Провинции','province'),('Экономика','economic'),('Политическая','political')]:
        control('Режимы и настройки карты','settings-'+name);control('Режим '+mode,'mode-'+name);time.sleep(1.5);capture('map22-'+name);assert_map_painted(OUT/('map22-'+name+'.png'))
        if mode=='Экономика':
            for filter in ['Промышленность','Торговля','Инфраструктура','Развитие','Производство','Ресурсы']:
                horizontal_control('Фильтр '+filter,'filter-'+filter);time.sleep(.3)
    control('Приблизить','zoom-in');time.sleep(.5);capture('map22-close');(OUT/'map22-memory.txt').write_text(adb('shell','dumpsys','meminfo',PACKAGE));control('Отдалить','zoom-out');time.sleep(.5)
    dimensions=Image.open(OUT/'02-campaign.png').size
    adb('shell','input','swipe',int(dimensions[0]*.58),int(dimensions[1]*.58),int(dimensions[0]*.52),int(dimensions[1]*.56),350);time.sleep(.5)
    control('К выбранному','refocus');time.sleep(.5)
    tree=root('province-hit');node=find_enabled_control(tree,'Карта Dominion');assert node is not None
    b=visible_bounds(tree,node);assert b is not None;x,y=(b[0]+b[2])//2,(b[1]+b[3])//2
    adb('shell','input','swipe',x,y,x,y,750);time.sleep(.7)
    tree=root('province-window');assert any('⠿ Провинция' in n.get('text','') for n in tree.iter('node')),'Province window did not open'
    capture('map22-province-window')
    for tab in ['Города','Инфраструктура','Ресурсы','Строительство','Военное положение','Обзор']:
        horizontal_control(tab,'province-tab-'+tab);time.sleep(.3)
    control('Закрыть окно','close-province')
    navigation('Раздел Правительство','government','down');tree=root('window-before');title=next(n for n in tree.iter('node') if '⠿ Правительство' in n.get('text',''));before=title.get('bounds');box=list(map(int,re.findall(r'\d+',before)));x,y=(box[0]+box[2])//2,(box[1]+box[3])//2
    adb('shell','input','swipe',x,y,x+25,y+40,450);time.sleep(.5);tree=root('window-after');title=next(n for n in tree.iter('node') if '⠿ Правительство' in n.get('text',''));assert title.get('bounds')!=before,'Window did not move'
    control('Советники','advisers');tree=root('scroll');containers=[list(map(int,re.findall(r'\d+',n.get('bounds','')))) for n in tree.iter('node') if n.get('scrollable')=='true'];box=max((b for b in containers if len(b)==4 and b[3]-b[1]>80),key=lambda b:b[0]);x=(box[0]+box[2])//2;adb('shell','input','swipe',x,box[3]-20,x,box[1]+30,350);control('Закрыть окно','close-window')
    navigation('Раздел Армия','army');control('Выбрать армию 1','army-first',True);control('Открыть окно армии','inspect');control('Приказы','orders',True);control('Разделить 50%','split',True);time.sleep(.5)
    control('Саксония','waypoint',True);control('Марш','march',True);time.sleep(.5);control('Закрыть окно','close-army');tree=root('ordered');assert any('Прибытие' in n.get('text','') for n in tree.iter('node')),'Route confirmation missing from visible army dock'
    control('Снять выделение армии','deselect');control('Продолжить','resume');time.sleep(6);control('Пауза','pause-after-march')
    navigation('Раздел Армия','army-moved');control('Выбрать армию 1','reveal-moved-army',True,tap_control=False);tree=root('moved');assert any('Саксония' in n.get('text','') for n in tree.iter('node')),'Army did not complete the short route';control('Закрыть окно','close-moved')
    control('Настройки звука','audio');control('Отключить звук','mute');tree=root('muted');assert any(n.get('checked')=='true' and 'Отключить звук' in n.get('content-desc','') for n in tree.iter('node')),'Mute not confirmed';control('Закрыть окно','close-audio')
    control('Сохранить кампанию','save');time.sleep(2)
    launch();control('Продолжить','continue');time.sleep(12);control('Настройки звука','restored-audio');tree=root('restored-muted');assert any(n.get('checked')=='true' and 'Отключить звук' in n.get('content-desc','') for n in tree.iter('node')),'Audio preference not restored';control('Закрыть окно','close-restored-audio');tree=root('restored');assert find_enabled_control(tree,'Выбрать скорость кампании') is not None;capture('03-restored');assert_map_painted(OUT/'03-restored.png')
    logs=adb('logcat','-d');(OUT/'logcat.txt').write_text(logs);assert_no_game_fatal(logs,adb('shell','pidof',PACKAGE).strip());assert not re.search(r'TypeError:|ReferenceError:|JavascriptException|Cannot read property|undefined is not',logs),'Runtime JS error'
    (OUT/'result.json').write_text(json.dumps({'releaseColdLaunch':True,'campaignStarted':True,'newHUD':True,'armySplit':True,'armyOrder':True,'armyMovement':True,'deselectPreservesOrder':True,'centralWindowOpenDragScrollClose':True,'mute':True,'saveRestart':True,'mapPainted':True,'noFatalLogs':True,'mapModes':['Political','Terrain','Military','Province','Economy'],'economicFilters':True,'briefPanZoom':True,'provinceSelectionAndSixTabs':True,'balanced':True,'soak':False},indent=2));print('PASS: standalone launch/HUD/map, draggable window, army split/order/move/deselect, mute and save/restart')
finally:
    if not (OUT/'result.json').exists():
        try:capture('failure')
        except Exception:pass
    try:(OUT/'final-logcat.txt').write_text(adb('logcat','-d'))
    except Exception:pass
