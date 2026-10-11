"""Update the accepted APK in place on an ephemeral offline QA emulator.

Real controls, encrypted preferences, schema12 save and byte-exact backups.
No uninstall/data clear, debug APK, app hook or production campaign requests.
"""
import atexit
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from android_accessibility import dump_hierarchy, assert_no_game_fatal
from android_fixture import root_test_device
from camera_fixture_projection import assert_paused_fixture
from map_paint_check import assert_map_painted
from native_upgrade_validation import (PACKAGE, BACKUP_SUFFIXES, package_metadata,
    assert_install_compatibility, assert_app_data_preserved, assert_migration, assert_backups_immutable)

BASELINE, CANDIDATE, FIXTURE = map(Path, sys.argv[1:4])
OUT = Path(os.environ.get('DOMINION_UPGRADE_OUT', 'android-upgrade'))
OUT.mkdir(exist_ok=True)
ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = '/data/user/0/' + PACKAGE + '/files/dominion-campaigns'
SECURE = '/data/user/0/' + PACKAGE + '/shared_prefs/SecureStore.xml'
expected = json.loads((ROOT/'app.json').read_text())['expo']
fixture_raw = FIXTURE.read_bytes()
assert hashlib.sha256(fixture_raw).hexdigest() == '3882257a66e558a529dd2cd8005e782243a7b07adf1a54576564465402288dc5', 'Wrong immutable accepted fixture'
fixture = json.loads(fixture_raw)
assert fixture['state']['stateVersion'] == 12 and fixture['checksum'] == 'e8befae1'
assert len(fixture['state']['countries']) == 195 and len(fixture['state']['provinces']) == 2924 and len(fixture['state']['cities']) == 5411
campaign_id = fixture['state']['id']
assert campaign_id == 'camera-fixture-101'


def adb(*args, timeout=30):
    return subprocess.check_output(['adb', *map(str,args)], text=True, stderr=subprocess.STDOUT, timeout=timeout)


def raw_file(path):
    return subprocess.check_output(['adb','exec-out','cat',path], timeout=30)


def save_logs():
    try: (OUT/'final-logcat.txt').write_text(adb('logcat','-d'))
    except (OSError,subprocess.SubprocessError): pass


atexit.register(save_logs)


def apk_metadata(path):
    sdk = Path(os.environ.get('ANDROID_HOME', '/opt/android-sdk'))
    tools = sorted((sdk/'build-tools').glob('*'), key=lambda p:[int(n) for n in re.findall(r'\d+',p.name)])[-1]
    def run(*args):return subprocess.check_output(list(map(str,args)),text=True,stderr=subprocess.STDOUT)
    badging = run(tools/'aapt','dump','badging',path)
    signature = run(tools/'apksigner','verify','--verbose','--print-certs',path)
    (OUT/(path.parent.name+'-'+path.name+'-integrity.txt')).write_text(badging+'\n'+signature)
    return package_metadata(badging,signature)


def uid():
    match = re.search(r'(?:userId|appId)=(\d+)',adb('shell','dumpsys','package',PACKAGE))
    assert match, 'Missing installed package UID'
    return match[1]


def hierarchy(name):return dump_hierarchy(adb,PACKAGE,OUT,name,'/sdcard/dominion-upgrade.xml')


def find_readable(label, scroll_x=640):
    labels=(label,) if isinstance(label,str) else label
    for attempt in range(12):
        tree = hierarchy('tap-'+str(click.calls)+'-'+str(attempt))
        click.calls += 1
        node = next((n for n in tree.iter('node') if n.get('text') in labels or n.get('content-desc') in labels),None)
        if node is not None:
            bounds = list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(bounds)==4:
                x1,y1,x2,y2 = bounds
                if x2>x1 and 24<=y1 and y2<=680 and y2-y1>=12:
                    return tree,node
        if attempt==0:
            for _ in range(3):adb('shell','input','swipe',scroll_x,'240',scroll_x,'500','280')
        else:adb('shell','input','swipe',scroll_x,'500',scroll_x,'280','280')
    raise AssertionError('Missing actual readable control: '+str(label))


def click(label, scroll_x=640):
    _,node=find_readable(label,scroll_x)
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds','')))
    adb('shell','input','tap',(x1+x2)//2,(y1+y2)//2);time.sleep(1)


click.calls = 0
game_pids = set()


def launch_saved(name):
    adb('shell','am','force-stop',PACKAGE)
    adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity');time.sleep(6)
    pid=adb('shell','pidof',PACKAGE).strip()
    assert pid.isdigit(), 'Updated release process did not start'
    game_pids.add(pid)
    click('Продолжить')
    for attempt in range(12):
        time.sleep(1);tree=hierarchy(name+'-load-'+str(attempt))
        if any(n.get('text','').startswith('Ход 0 ') for n in tree.iter('node')):break
    else:raise AssertionError('Original paused campaign did not actually load')
    assert not any('поврежден' in n.get('text','').lower() or 'Действие отклонено' in n.get('text','') for n in tree.iter('node'))
    bounds=list(map(int,re.findall(r'\d+',tree[0].get('bounds',''))))
    assert bounds[2]>bounds[3], 'Updated app did not render landscape'
    image = OUT/(name+'.png')
    image.write_bytes(subprocess.check_output(['adb','exec-out','screencap','-p']))
    assert_map_painted(image)


def stopped_snapshot(name):
    adb('shell','am','force-stop',PACKAGE)
    files=adb('shell','ls',DIRECTORY).splitlines()
    saves=[f for f in files if re.fullmatch(re.escape(campaign_id)+r'\.\d+\.json',f)]
    assert saves, 'No persisted campaign'
    newest=max(saves,key=lambda f:int(f.rsplit('.',2)[1]))
    raw=raw_file(DIRECTORY+'/'+newest)
    local=OUT/(name+'.json');local.write_bytes(raw)
    subprocess.run(['node','--import','tsx',str(ROOT/'scripts/verify-camera-checksum.ts'),str(local)],check=True)
    return raw


def campaign_manifest():
    files=adb('shell','ls',DIRECTORY).splitlines()
    assert files and all(re.fullmatch(re.escape(campaign_id)+r'\.[\w.-]+',f) for f in files), 'Unexpected private QA file'
    return {f:hashlib.sha256(raw_file(DIRECTORY+'/'+f)).hexdigest() for f in sorted(files)}


def backups():return {suffix:raw_file(DIRECTORY+'/'+campaign_id+'.'+suffix+'.backup') for suffix in BACKUP_SUFFIXES}


def check_preferences(name):
    click('Настройки карты');tree,_=find_readable('Адаптивное качество: Выкл',220)
    texts=[n.get('text','') for n in tree.iter('node')]
    assert 'Адаптивное качество: Выкл' in texts and '✓ 30 FPS' in texts, 'Encrypted preferences failed to survive update'
    adb('shell','input','keyevent','4');time.sleep(1)
    assert any(n.get('text','').startswith('Политическая · High') for n in hierarchy(name+'-preset').iter('node')), 'Saved quality preset lost'
    (OUT/(name+'-preferences-summary.txt')).write_text('Verified actual controls: High; 30 FPS; adaptive off\n')


base_meta, new_meta = apk_metadata(BASELINE), apk_metadata(CANDIDATE)
assert_install_compatibility(base_meta,new_meta,expected)
adb('install','-r',BASELINE)
root_test_device(adb,OUT/'root-diagnostic.txt')
before_uid = uid()
adb('logcat','-c');adb('shell','wm','size','720x1280');adb('shell','wm','density','160')
adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
adb('shell','mkdir','-p',DIRECTORY);adb('push',FIXTURE,DIRECTORY+'/'+campaign_id+'.1.json')
adb('shell','chown',before_uid+':'+before_uid,'/data/user/0/'+PACKAGE+'/files')
adb('shell','chown','-R',before_uid+':'+before_uid,DIRECTORY);adb('shell','restorecon','-RF',DIRECTORY)
launch_saved('baseline')
click('Настройки карты')
_,adaptive_node=find_readable(('Адаптивное качество: Вкл','Адаптивное качество: Выкл'),220)
if adaptive_node.get('text')=='Адаптивное качество: Вкл':click('Адаптивное качество: Вкл',220)
click('High',220)
if not any(n.get('text')=='✓ 30 FPS' for n in hierarchy('baseline-fps').iter('node')):click('30 FPS',220)
adb('shell','input','keyevent','4');time.sleep(1)
click('СОХРАНИТЬ');time.sleep(3)
check_preferences('baseline')
raw_before=stopped_snapshot('before-update')
assert_paused_fixture(json.loads(raw_before),fixture,12)
before_files=campaign_manifest();secure_before=hashlib.sha256(raw_file(SECURE)).hexdigest()
adb('install','-r',CANDIDATE)
assert_app_data_preserved(before_uid,uid(),before_files,campaign_manifest(),secure_before,hashlib.sha256(raw_file(SECURE)).hexdigest())
launch_saved('candidate')
check_preferences('candidate');click('СОХРАНИТЬ');time.sleep(3)
raw_after=stopped_snapshot('after-update');saved_backups=backups()
assert_migration(raw_before,raw_after,saved_backups)
backup_hashes={k:hashlib.sha256(v).hexdigest() for k,v in saved_backups.items()}
launch_saved('candidate-restart');check_preferences('candidate-restart');click('СОХРАНИТЬ');time.sleep(3)
raw_repeat=stopped_snapshot('after-repeated-save')
assert_paused_fixture(json.loads(raw_repeat),json.loads(raw_after),18)
assert_backups_immutable(backup_hashes,{k:hashlib.sha256(v).hexdigest() for k,v in backups().items()})
logs=adb('logcat','-d');assert_no_game_fatal(logs,' '.join(sorted(game_pids)))
assert 'Unable to load script' not in logs, 'Release depended on an external JS server'
report={'baseline':base_meta,'candidate':new_meta,'appUidRetained':True,'privateCampaignFilesRetained':True,
 'encryptedPreferenceBytesRetainedBeforeLaunch':True,'actualSecureStorePreferencesAfterUpdate':{'preset':'High','frameRate':30,'adaptive':False},
 'fixtureSha256':hashlib.sha256(fixture_raw).hexdigest(),'originalWorld':{'countries':195,'provinces':2924,'cities':5411},
 'oldSchema':12,'newSchema':json.loads(raw_after)['state']['stateVersion'],'oldSaveSha256':hashlib.sha256(raw_before).hexdigest(),
 'migrationBackupSha256':backup_hashes,'repeatBackupBytesUnchanged':True,'actualCandidateRestart':True,'finalVersionUpgrade':new_meta['versionCode']>base_meta['versionCode'],
 'note':'Real offline ephemeral-emulator package replacement, native save/load/backups and encrypted graphics preference round-trip. No production-session reconnect or hardware FPS claim.'}
(OUT/'UPGRADE_SAVE_QA.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: actual in-place release installation, SecureStore preferences, schema12→18 campaign, original backups and restart')
