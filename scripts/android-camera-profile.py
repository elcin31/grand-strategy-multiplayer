"""Paired camera-only native profiling. Offline, paused, same input and emulator.

gfxinfo measures Android frame completion on SwiftShader; never handset FPS.
No production rooms are created. Raw framestats/cpu/memory/screenshots retained.
"""
import atexit,hashlib,json,os,re,subprocess,sys,time,xml.etree.ElementTree as ET
from pathlib import Path
from camera_frame_stats import frame_stats,thread_stats
from map_paint_check import assert_map_painted
PACKAGE='com.elcin31.grandstrategymultiplayer'
OUT=Path(os.environ.get('CAMERA_PROFILE_OUT','camera-profile'));OUT.mkdir(exist_ok=True)
def adb(*args,timeout=None):return subprocess.check_output(['adb',*map(str,args)],text=True,stderr=subprocess.STDOUT,timeout=timeout)
def save_logs():
    try:(OUT/'final-logcat.txt').write_text(adb('logcat','-d'))
    except (OSError,subprocess.CalledProcessError):pass
atexit.register(save_logs)
def hierarchy(name):
    adb('shell','uiautomator','dump','/sdcard/camera.xml',timeout=20)
    text=adb('shell','cat','/sdcard/camera.xml',timeout=10);(OUT/(name+'.xml')).write_text(text)
    return ET.fromstring(text)
def click(root,label):
    node=next(n for n in root.iter('node') if n.get('text')==label or n.get('content-desc')==label)
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
    assert x2>x1 and y2>y1, label+' has no hit area'
    print('Tap:',label,node.get('bounds'),flush=True)
    adb('shell','input','swipe',(x1+x2)//2,(y1+y2)//2,(x1+x2)//2,(y1+y2)//2,'100')
def find_click(label,scroll_x=1080,lower=664):
    for i in range(18):
        root=hierarchy('find-'+str(i))
        node=next((n for n in root.iter('node') if n.get('text')==label or n.get('content-desc')==label),None)
        if node is not None:
            x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
            if x2>x1 and 24<=y1 and y2<=lower and y2-y1>=12:
                click(root,label);time.sleep(1);return
            if y2>lower:
                adb('shell','input','swipe',scroll_x,'500',scroll_x,'300','280');continue
        if i==0:
            for _ in range(5):adb('shell','input','swipe',scroll_x,'220',scroll_x,'500','300')
        else:adb('shell','input','swipe',scroll_x,'500',scroll_x,'300','280')
    raise AssertionError('Missing '+label)
def shot(name):
    data=subprocess.check_output(['adb','exec-out','screencap','-p']);(OUT/(name+'.png')).write_bytes(data)
def settings():click(hierarchy('settings'),'Настройки карты');time.sleep(.5)
def nav(section):find_click('Раздел '+section)
def gesture(kind,cycles=5):
    adb('shell','CLASSPATH=/data/local/tmp/dominion-camera.jar app_process /system/bin CameraGesture '+kind+' '+str(cycles))
fixture_path=os.environ.get('CAMERA_FIXTURE_PATH')
fixture=json.loads(Path(fixture_path).read_text()) if fixture_path else None
fixture_sha=hashlib.sha256(Path(fixture_path).read_bytes()).hexdigest() if fixture_path else None
def load_fixed_fixture():
    # Ephemeral AOSP QA emulator only. No debuggable APK, app backdoor, or
    # production data. Install the same normal, checksum-validated old save.
    adb('root');adb('wait-for-device')
    assert adb('shell','id','-u').strip()=='0', 'Fixed-save native QA requires the rootable test emulator'
    uid=re.search(r'(?:userId|appId)=(\d+)',adb('shell','dumpsys','package',PACKAGE))
    assert uid, 'Test app UID unavailable'
    directory='/data/user/0/'+PACKAGE+'/files/dominion-campaigns'
    adb('shell','mkdir','-p',directory)
    adb('push',fixture_path,directory+'/'+fixture['state']['id']+'.1.json')
    adb('shell','chown',uid[1]+':'+uid[1],'/data/user/0/'+PACKAGE+'/files')
    adb('shell','chown','-R',uid[1]+':'+uid[1],directory)
    assert_fixture_campaign()
def assert_fixture_campaign():
    directory='/data/user/0/'+PACKAGE+'/files/dominion-campaigns'
    names=adb('shell','ls',directory).splitlines()
    saves=[n for n in names if re.fullmatch(re.escape(fixture['state']['id'])+r'\.\d+\.json',n)]
    assert saves, 'Fixed campaign snapshot missing'
    newest=max(saves,key=lambda n:int(n.rsplit('.',2)[1]))
    actual=json.loads(adb('shell','cat',directory+'/'+newest))
    assert actual['checksum']==fixture['checksum'] and actual['state']==fixture['state'], 'Camera workload changed its paused campaign state'
def reset_camera(local=False,world=False):
    find_click('Обзор мира' if world else 'Европа')
    if local:find_click('Приблизить');find_click('Приблизить')
    time.sleep(2)
def sample(name,kind=None):
    adb('shell','dumpsys','gfxinfo',PACKAGE,'reset');adb('logcat','-c')
    pid=adb('shell','pidof',PACKAGE).strip()
    thread_file=(OUT/(name+'-threads-active.txt')).open('w')
    sampler=subprocess.Popen(['adb','shell','top','-H','-b','-d','1','-n','12','-p',pid],stdout=thread_file,stderr=subprocess.STDOUT)
    t=time.monotonic()
    if kind:gesture(kind)
    else:time.sleep(10)
    elapsed=time.monotonic()-t
    try:sampler.wait(timeout=20)
    except subprocess.TimeoutExpired:sampler.terminate();sampler.wait(timeout=5)
    thread_file.close()
    raw=adb('shell','dumpsys','gfxinfo',PACKAGE,'framestats');(OUT/(name+'-frames.txt')).write_text(raw)
    cpu=adb('shell','dumpsys','cpuinfo');(OUT/(name+'-cpu.txt')).write_text(cpu)
    mem=adb('shell','dumpsys','meminfo',PACKAGE);(OUT/(name+'-memory.txt')).write_text(mem)
    logs=adb('logcat','-d');(OUT/(name+'-logcat.txt')).write_text(logs)
    shot(name)
    painted=assert_map_painted(OUT/(name+'.png')) if name in ('01-idle','04-world-pan','05-local-labels-armies') else None
    # Completed-frame timestamps, PSS and PNG are already captured. Persist
    # them before the optional accessibility diagnostic process can be killed.
    assert not re.search(r'FATAL EXCEPTION|Fatal signal|JavascriptException',logs), 'Fatal runtime error in '+name
    current_pid=adb('shell','pidof',PACKAGE).strip()
    assert current_pid==pid and pid, 'Game process disappeared/restarted in '+name
    (OUT/(name+'-threads.txt')).write_text(adb('shell','top','-H','-b','-n','1','-p',pid))
    pss=re.search(r'TOTAL PSS:\s*(\d+)',mem)
    fallback=re.findall(r'DOMINION_CAMERA[^\n]*',logs)[-1:]
    result={'pssKiB':int(pss[1]) if pss else None,'scenario':name,'elapsedSeconds':elapsed,**frame_stats(raw),'cpuThreads':thread_stats((OUT/(name+'-threads-active.txt')).read_text(),pid),'mapPaint':painted,'cameraTrace':fallback,'diagnosticError':None}
    results.append(result)
    def persist(): (OUT/'results.json').write_text(json.dumps({'protocol':'fixed-save-reset-v2' if fixture else 'independent-campaign-v1','fixtureSha256':fixture_sha,'fixtureStateChecksum':fixture['checksum'] if fixture else None,'note':'Software SwiftShader API35 native frames, offline paused campaign. Same gestures for both builds; not physical Redmi FPS. Accessibility diagnostics are auxiliary to the completed-frame capture.','results':results},indent=2))
    persist()
    try:
        tree=hierarchy(name+'-metrics')
        trace=[n.get('content-desc') for n in tree.iter('node') if n.get('content-desc','').startswith('DOMINION_CAMERA ')]
        if trace:result['cameraTrace']=trace
    except (subprocess.CalledProcessError,subprocess.TimeoutExpired) as error:
        # Do not conceal gameplay death or alter frame/camera thresholds.
        assert adb('shell','pidof',PACKAGE).strip()==pid, 'Game process died during diagnostics'
        result['diagnosticError']=str(error)
        print('Camera accessibility diagnostic unavailable:',name,str(error),flush=True)
    persist();print(json.dumps(result),flush=True)

adb('install','-r',sys.argv[1]);adb('shell','pm','clear',PACKAGE)
adb('shell','wm','size','720x1280');adb('shell','wm','density','160')
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
if fixture:load_fixed_fixture()
adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity');time.sleep(5)
if fixture:
    find_click('Продолжить');time.sleep(15)
else:
    find_click('Одиночная игра');time.sleep(15)
    find_click('СТРАНЫ · 195');root=hierarchy('picker');click(root,'Поиск государства')
    adb('shell','input','text','Germany');time.sleep(1);find_click('Германия')
    find_click('ИГРАТЬ ЗА ЭТУ СТРАНУ');find_click('Я ГОТОВ');time.sleep(1);find_click('Начать игру');time.sleep(8)
    nav('Страна');find_click('Пауза');time.sleep(2)
settings();find_click('Balanced',200,540);find_click('Адаптивное качество: Вкл',200,540)
assert any(n.get('text')=='Адаптивное качество: Выкл' for n in hierarchy('adaptive-off').iter('node')), 'Adaptive quality was not disabled'
find_click('Performance overlay: Выкл',200,540)
assert any(n.get('text')=='Performance overlay: Вкл' for n in hierarchy('overlay-on').iter('node')), 'Camera overlay was not enabled'
# settings stay open after quality changes; close with the toolbar button.
settings();
if not fixture:adb('shell','input','keyevent','4')
time.sleep(2)
results=[]
sample('01-idle')
reset_camera();sample('02-medium-pan','pan')
if fixture:reset_camera()
sample('03-pinch','pinch')
reset_camera(world=True);sample('04-world-pan','pan')
reset_camera(local=True)
sample('05-local-labels-armies','pan')
settings();find_click('Режим Рельеф')
if fixture:reset_camera(local=True)
sample('06-terrain-pan','pan')
settings();find_click('Режим Армии')
if fixture:reset_camera(local=True)
sample('07-military-overlay','pan')
settings();find_click('Режим Политическая')
if fixture:reset_camera(local=True)
nav('Экономика');sample('08-panel-open','pan')
adb('shell','input','keyevent','4')
if fixture:reset_camera(local=True)
sample('09-panel-closed','pan')
if fixture:assert_fixture_campaign()
logs=adb('logcat','-d');assert not re.search(r'FATAL EXCEPTION|JavascriptException|com.facebook.react.common.JavascriptException',logs), 'Fatal runtime error'
print('PASS: camera profile scenarios complete',flush=True)
