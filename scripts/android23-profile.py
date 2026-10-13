"""Matched APK camera A-I workload on an ephemeral rooted API35 QA emulator.

Actual compositor presentations and HWUI completion stay separate. Worklet
callbacks are diagnostics only. Detached checksum-validated schema25 saves.
"""
import hashlib,json,os,re,subprocess,sys,time
from pathlib import Path
import android_map_controls as h
from android_accessibility import assert_no_game_fatal,find_enabled_control
from android_fixture import root_test_device,label_test_fixture
from camera_frame_stats import frame_stats,thread_stats
from camera_surface_stats import SurfaceSampler,map_surface_layer
from camera_telemetry import camera_telemetry
from map_paint_check import assert_map_painted

OUT=Path(os.environ.get('CAMERA23_OUT','android23-profile'));OUT.mkdir(exist_ok=True);h.OUT=OUT
PACKAGE=h.PACKAGE;FIXTURES=Path(sys.argv[2]);manifest=json.loads((FIXTURES/'manifest.json').read_text());rows=[]
def settings():h.control('Режимы и настройки карты','settings')
def mode(label):settings();h.control('Режим '+label,'mode-'+label)
def reset(world=False,local=False):
    if world:h.control('Обзор мира','world')
    else:settings();h.control('Европа','europe',True)
    if local:
        for n in range(3):h.control('Приблизить','local-'+str(n))
    time.sleep(2)
def gesture(kind,cycles=6):
    output=h.adb('shell','CLASSPATH=/data/local/tmp/dominion-camera23.jar app_process /system/bin CameraGesture23 '+kind+' '+str(cycles))
    match=re.search(r'DOMINION_GESTURE_TIMING (\{.*\})',output);assert match,'Missing real input timestamps'
    return json.loads(match[1])
def install_fixture(name):
    h.adb('shell','am','force-stop',PACKAGE)
    app='/data/user/0/'+PACKAGE;directory=app+'/files/dominion-campaigns'
    uid=re.search(r'(?:userId|appId)=(\d+)',h.adb('shell','dumpsys','package',PACKAGE));assert uid
    # Only detached fixtures on this explicitly verified test emulator.
    h.adb('shell','rm','-rf',directory);h.adb('shell','mkdir','-p',directory)
    item=manifest[name];file=FIXTURES/item['filename'];assert hashlib.sha256(file.read_bytes()).hexdigest()==item['sha256']
    h.adb('push',file,directory+'/'+file.name);h.adb('shell','chown',uid[1]+':'+uid[1],app+'/files');h.adb('shell','chown','-R',uid[1]+':'+uid[1],directory)
    label_test_fixture(h.adb,app,directory,directory+'/'+file.name)
    h.launch();h.control('Продолжить','restore-'+name);time.sleep(12)
    mode('Политическая');reset()
def configure():
    settings();h.control('Balanced','balanced',True)
    tree=h.root('quality');node=find_enabled_control(tree,'Адаптивное качество: Вкл')
    if node is not None:h.tap(node)
    tree=h.root('overlay');node=find_enabled_control(tree,'Performance overlay: Выкл')
    if node is not None:h.tap(node)
    h.control('Закрыть ×','settings-close',True)
def sample(name,kind,cycles=6):
    h.adb('shell','dumpsys','gfxinfo',PACKAGE,'reset');h.adb('logcat','-c');h.adb('shell','dumpsys','SurfaceFlinger','--latency-clear')
    pid=h.adb('shell','pidof',PACKAGE).strip();assert pid
    layers=h.adb('shell','dumpsys','SurfaceFlinger','--list');(OUT/(name+'-layers.txt')).write_text(layers)
    layer=map_surface_layer(layers,PACKAGE);assert layer and 'SurfaceView' not in layer
    sampler=SurfaceSampler(h.adb,layer,OUT/(name+'-surface.json'));sampler.start()
    with (OUT/(name+'-threads.txt')).open('w') as threads:
        process=subprocess.Popen(['adb','shell','top','-H','-b','-d','1','-n',str(cycles*2+3),'-p',pid],stdout=threads,stderr=subprocess.STDOUT)
        start=time.monotonic();timing=gesture(kind,cycles);time.sleep(.1);presentation=sampler.finish();elapsed=time.monotonic()-start
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.terminate();process.wait(timeout=5)
    raw=h.adb('shell','dumpsys','gfxinfo',PACKAGE,'framestats');(OUT/(name+'-frames.txt')).write_text(raw)
    memory=h.adb('shell','dumpsys','meminfo',PACKAGE);(OUT/(name+'-memory.txt')).write_text(memory)
    logs=h.adb('logcat','-d');(OUT/(name+'-logcat.txt')).write_text(logs);assert_no_game_fatal(logs,pid)
    assert h.adb('shell','pidof',PACKAGE).strip()==pid
    assert not re.search(r'TypeError:|ReferenceError:|JavascriptException|Dominion map preparation failed',logs)
    native=frame_stats(raw);assert native['frames']>0,'Missing completed frames'
    assert presentation['available'] and presentation['complete'],'Incomplete compositor capture'
    h.capture(name);paint=assert_map_painted(OUT/(name+'.png'))
    pss=re.search(r'TOTAL PSS:\s*(\d+)',memory)
    row={'scenario':name,'native':native,'presentation':presentation,'pssKiB':int(pss[1]) if pss else None,'seconds':elapsed,'gesture':timing,'threads':thread_stats((OUT/(name+'-threads.txt')).read_text(),pid),'telemetry':camera_telemetry(logs),'mapPaint':paint}
    rows.append(row);persist();print('CAMERA23_SAMPLE '+json.dumps({k:v for k,v in row.items() if k not in ('threads','telemetry','gesture')}),flush=True)
def persist():
    (OUT/'profiles.json').write_text(json.dumps({'apkSha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'fixtures':manifest,'preset':'Balanced','adaptive':False,'overlay':True,'physicalRedmiTest':False,'inputProtocol':'CameraGesture23-constant-pan-v1','note':'API35 x86_64 SwiftShader. Actual presentation intervals and HWUI work reported separately; no callback FPS or physical handset claim. Active simulation starts from the same fixture; timer advances are recorded, not assumed identical.','results':rows},indent=2)+'\n')

try:
    root_test_device(h.adb,OUT/'device.txt')
    assert 'sdk' in h.adb('shell','getprop','ro.product.name'),'Ephemeral SDK emulator required'
    h.adb('install','-r',sys.argv[1]);h.adb('shell','pm','clear',PACKAGE)
    h.adb('shell','wm','size','720x1280');h.adb('shell','wm','density','160');h.adb('shell','settings','put','system','accelerometer_rotation','0');h.adb('shell','settings','put','system','user_rotation','1')
    h.adb('shell','svc','wifi','disable');h.adb('shell','svc','data','disable')
    install_fixture('peace');configure()
    sample('A-horizontal-pan','pan');reset(world=True);sample('B-rapid-zoom-in','in',2)
    reset(local=True);sample('C-rapid-zoom-out','out',2)
    reset();sample('D-pinch-pan','combined');reset();sample('E-lod-transitions','lod')
    mode('Рельеф');reset();sample('F-terrain','combined')
    install_fixture('war');sample('G-war-armies','combined')
    h.control('Продолжить','simulation-resume');sample('H-active-simulation','pan');h.control('Пауза','simulation-pause')
    h.control('Сохранить кампанию','simulation-save');time.sleep(2)
    directory='/data/user/0/'+PACKAGE+'/files/dominion-campaigns'
    h.adb('pull',directory,OUT/'native-saves')
    install_fixture('peace')
    # 12 matched 12s blocks, repeated map modes. Retain first/last native
    # frames and all intermediate PSS; the SurfaceFlinger ring cannot cover
    # an uninterrupted multi-minute test without polling throughout.
    trend=[]
    for n in range(12):
        mode(['Политическая','Рельеф','Армии'][n%3]);reset()
        if n in (0,11):sample('I-extended-'+str(n),'combined')
        else:gesture('combined')
        memory=h.adb('shell','dumpsys','meminfo',PACKAGE);(OUT/('I-memory-'+str(n)+'.txt')).write_text(memory)
        pss=re.search(r'TOTAL PSS:\s*(\d+)',memory);trend.append({'block':n,'pssKiB':int(pss[1]) if pss else None})
        (OUT/'memory-trend.json').write_text(json.dumps(trend,indent=2)+'\n')
    mode('Политическая');reset()
    from camera_system_trace import capture_camera_trace
    for kind,scenario in [('pan','panel-closed-pan'),('combined','pinch')]:
        reset();out=OUT/('diagnostic-'+kind);out.mkdir(exist_ok=True)
        print('CAMERA23_TRACE '+json.dumps(capture_camera_trace(h.adb,out,lambda:gesture(kind,6),scenario=scenario)),flush=True)
    h.adb('shell','svc','wifi','enable');h.adb('shell','svc','data','enable')
    (OUT/'result.json').write_text(json.dumps({'AtoI':True,'noFatalLogs':True,'standalone':True,'physicalRedmiTest':False},indent=2)+'\n')
finally:
    persist()
    if not (OUT/'result.json').exists():
        try:h.capture('failure');(OUT/'failure-logcat.txt').write_text(h.adb('logcat','-d'))
        except Exception:pass
