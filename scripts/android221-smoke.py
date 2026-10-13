"""One short 2.2 -> 2.2.1 native A/B, followed by required gameplay/icon smoke.
Same emulator, paused saved scene, real pointers. No soak or camera matrix.
"""
import json,os,re,shutil,subprocess,sys,time
from pathlib import Path
import android_map_controls as h
from camera_frame_stats import frame_stats,thread_stats
from camera_telemetry import camera_telemetry
from camera_surface_stats import map_surface_layer,SurfaceSampler
from android_accessibility import assert_no_game_fatal,find_enabled_control
from map_paint_check import assert_map_painted

OUT=Path('android-hotfix');OUT.mkdir(exist_ok=True);h.OUT=OUT
PACKAGE=h.PACKAGE;results=[]
reuse=os.environ.get('DOMINION221_PROFILE_REUSE')
if reuse:
    previous=next(Path(reuse).rglob('profiles.json'));results=json.loads(previous.read_text())
    assert len(results)==12 and [r['apk'] for r in results]==['baseline']*6+['candidate']*6
    assert all(r['native']['frames']>0 and r['presentation']['available'] for r in results)
    shutil.copytree(previous.parent,OUT,dirs_exist_ok=True)
def mode(label):h.control('Режимы и настройки карты','settings-'+label);h.control('Режим '+label,'mode-'+label)
def settings():h.control('Режимы и настройки карты','settings')
def reset():settings();h.control('Европа','europe',True);time.sleep(.6)
def sample(label,tier,kind):
    name=label+'-'+tier+'-'+kind
    h.adb('shell','dumpsys','gfxinfo',PACKAGE,'reset');h.adb('logcat','-c')
    h.adb('shell','dumpsys','SurfaceFlinger','--latency-clear')
    pid=h.adb('shell','pidof',PACKAGE).strip();assert pid
    layer=map_surface_layer(h.adb('shell','dumpsys','SurfaceFlinger','--list'),PACKAGE)
    sampler=SurfaceSampler(h.adb,layer,OUT/(name+'-surface.json'));sampler.start()
    with (OUT/(name+'-threads.txt')).open('w') as threads:
        process=subprocess.Popen(['adb','shell','top','-H','-b','-d','1','-n','5','-p',pid],stdout=threads,stderr=subprocess.STDOUT)
        gesture='zoom' if kind=='zoom' else 'pan';cycles=1 if kind in ('terrain','zoom') else 2
        timing=h.adb('shell','CLASSPATH=/data/local/tmp/dominion-camera.jar app_process /system/bin CameraGesture '+gesture+' '+str(cycles)+' 0')
        time.sleep(1) # Include the same bounded post-gesture refinement tail.
        surface=sampler.finish();process.wait(timeout=15)
    frames=h.adb('shell','dumpsys','gfxinfo',PACKAGE,'framestats');(OUT/(name+'-frames.txt')).write_text(frames)
    memory=h.adb('shell','dumpsys','meminfo',PACKAGE);(OUT/(name+'-memory.txt')).write_text(memory)
    logs=h.adb('logcat','-d');(OUT/(name+'-logcat.txt')).write_text(logs);assert_no_game_fatal(logs,pid)
    assert h.adb('shell','pidof',PACKAGE).strip()==pid
    h.capture(name);assert_map_painted(OUT/(name+'.png'))
    native=frame_stats(frames);assert native['reportedFrames'] and native['p95Ms'] is not None,'Missing native frame capture'
    pss=re.search(r'TOTAL PSS:\s*(\d+)',memory)
    row={'apk':label,'preset':tier,'operation':kind,'native':native,'presentation':surface,'threads':thread_stats((OUT/(name+'-threads.txt')).read_text(),pid),'telemetry':camera_telemetry(logs),'pssKiB':int(pss[1]) if pss else None,'gesture':timing}
    results.append(row);(OUT/'profiles.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps({k:v for k,v in row.items() if k not in ('telemetry','gesture','threads')}),flush=True)
def profile(label):
    for tier in ['Balanced','Performance']:
        settings();h.control(tier,'preset-'+tier,True);h.control('Закрыть ×','preset-close',True)
        mode('Политическая');reset();sample(label,tier,'pan');reset();sample(label,tier,'zoom')
        mode('Рельеф');reset();sample(label,tier,'terrain')
    settings();h.control('Balanced','restore-balanced',True);h.control('Закрыть ×','close-balanced',True);mode('Политическая');reset()

try:
    h.adb('install','-r',sys.argv[1]);h.adb('shell','pm','clear',PACKAGE)
    h.adb('shell','wm','size','720x1280');h.adb('shell','wm','density','160')
    h.adb('shell','settings','put','system','accelerometer_rotation','0');h.adb('shell','settings','put','system','user_rotation','1')
    h.launch();h.capture('baseline-menu')
    h.control('Одиночная игра','single');time.sleep(12);h.control('СТРАНЫ · 195','countries');node=find_enabled_control(h.root('search'),'Поиск государства');assert node is not None;h.tap(node)
    h.adb('shell','input','text','Germany');time.sleep(1);h.adb('shell','input','keyevent','4');time.sleep(1)
    h.control('Государство: Германия','germany');h.control('Играть за эту страну','choose');h.control('Я ГОТОВ','ready');h.control('Начать игру','start');time.sleep(3);h.control('Пауза','pause')
    settings();h.control('Адаптивное качество: Вкл','adaptive-off',True);h.control('Performance overlay: Выкл','overlay-on',True);h.control('Закрыть ×','settings-close',True)
    if not reuse:profile('baseline')
    h.control('Сохранить кампанию','baseline-save');time.sleep(2)
    # Real installation upgrade retains signing identity, settings and schema25 save.
    h.adb('shell','am','force-stop',PACKAGE);h.adb('install','-r',sys.argv[2]);h.launch();h.capture('candidate-cold-menu')
    h.control('Продолжить','upgrade-continue');time.sleep(12);h.capture('candidate-restored');assert_map_painted(OUT/'candidate-restored.png')
    tree=h.root('same-paused-game');assert find_enabled_control(tree,'Продолжить') is not None,'Paused game not preserved'
    if not reuse:profile('candidate')
    mode('Армии');time.sleep(1);h.capture('candidate-military');assert_map_painted(OUT/'candidate-military.png');mode('Политическая')
    h.control('К выбранному','refocus');time.sleep(.7);node=find_enabled_control(h.root('province-hit'),'Карта Dominion');assert node is not None
    # Read the target and clipping ancestors from the same tree.
    tree=h.root('province-tree');node=find_enabled_control(tree,'Карта Dominion');b=h.visible_bounds(tree,node);assert b
    x,y=(b[0]+b[2])//2,(b[1]+b[3])//2;h.adb('shell','input','swipe',x,y,x,y,750);time.sleep(.5)
    assert any('⠿ Провинция' in n.get('text','') for n in h.root('province-selected').iter('node'))
    h.capture('candidate-province');h.control('Закрыть окно','close-province')
    h.navigation('Раздел Армия','army');h.control('Выбрать армию 1','first-army',True);h.control('Открыть окно армии','inspect');h.control('Приказы','orders',True)
    h.control('Саксония','waypoint',True);h.control('Марш','march',True);h.control('Закрыть окно','close-army')
    assert any('Прибытие' in n.get('text','') for n in h.root('ordered').iter('node'))
    h.capture('candidate-army-route');h.control('Продолжить','resume');time.sleep(6);h.control('Пауза','pause-after-march')
    h.navigation('Раздел Армия','army-moved');h.control('Выбрать армию 1','moved-army',True,tap_control=False)
    assert any('Саксония' in n.get('text','') for n in h.root('moved').iter('node'));h.control('Закрыть окно','close-army-moved')
    h.control('Сохранить кампанию','save');time.sleep(2);h.launch();h.control('Продолжить','continue');time.sleep(12);h.capture('candidate-save-restart');assert_map_painted(OUT/'candidate-save-restart.png')
    logs=h.adb('logcat','-d');(OUT/'final-logcat.txt').write_text(logs);assert_no_game_fatal(logs,h.adb('shell','pidof',PACKAGE).strip())
    assert not re.search(r'TypeError:|ReferenceError:|JavascriptException|undefined is not|Dominion map preparation failed',logs)
    h.adb('shell','input','keyevent','3');time.sleep(2);h.adb('shell','input','swipe',650,570,650,150,350);time.sleep(2);h.capture('candidate-launcher-icon')
    (OUT/'launcher-hierarchy.txt').write_text(h.adb('shell','uiautomator','dump','/sdcard/launcher.xml')+'\n'+h.adb('shell','cat','/sdcard/launcher.xml'))
    summary=[]
    for before,after in zip(results[:6],results[6:]):
        assert (before['preset'],before['operation'])==(after['preset'],after['operation'])
        summary.append({'preset':before['preset'],'operation':before['operation'],'p95Before':before['native']['p95Ms'],'p95After':after['native']['p95Ms'],'p99Before':before['native']['p99Ms'],'p99After':after['native']['p99Ms'],'maxBefore':before['native']['rawMaxMs'],'maxAfter':after['native']['rawMaxMs'],'over50Before':before['native']['rawOver50Ms'],'over50After':after['native']['rawOver50Ms'],'pssBeforeKiB':before['pssKiB'],'pssAfterKiB':after['pssKiB']})
    (OUT/'comparison.json').write_text(json.dumps({'sameEmulator':True,'samePausedSave':True,'physicalRedmiTest':False,'renderer':'existing Skia TextureView','pairedProfileSourceRun':os.environ.get('DOMINION221_PROFILE_RUN') or None,'note':'SwiftShader emulator frame work and actual presentation are reported separately. Preserved A/B was measured together on one emulator with the identical compiled runtime; remaining gameplay checks may run on a fresh emulator. No physical handset FPS claim.','results':summary},indent=2)+'\n')
    (OUT/'result.json').write_text(json.dumps({'coldLaunch':True,'inPlaceUpgrade22':True,'savedPausedCampaignPreserved':True,'balancedAndPerformance':True,'shortRealPanZoom':True,'politicalTerrainMilitary':True,'provinceSelection':True,'armySelection':True,'confirmedRoute':True,'shortMarch':True,'saveRestart':True,'launcherScreenshot':True,'noFatalLogs':True,'soak':False,'physicalRedmiTest':False},indent=2)+'\n')
    print('PASS: short paired pan/zoom, map modes, province/army/order/march, save upgrade/restart and launcher capture',flush=True)
finally:
    if not (OUT/'result.json').exists():
        try:h.capture('failure');(OUT/'failure-logcat.txt').write_text(h.adb('logcat','-d'))
        except Exception:pass
