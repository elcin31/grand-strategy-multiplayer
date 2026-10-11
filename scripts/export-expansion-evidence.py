"""Read exact existing Dominion artifacts; never rebuild, reroll or accept a release."""
import argparse
import hashlib
import json
import math
import subprocess
import zipfile
from pathlib import Path
from camera_capture_validation import CAPTURES, validate_captures
from release_v2_validation import REPOSITORY, REQUIRED_JOBS, read_evidence

parser=argparse.ArgumentParser()
parser.add_argument('source')
parser.add_argument('--out',default='native-readback')
args=parser.parse_args()
source=json.loads(Path(args.source).read_text())
assert source['repository']==REPOSITORY
runtime,run_id=source['runtime'],source['runId']
assert isinstance(run_id,int) and not isinstance(run_id,bool) and run_id>0
assert len(runtime)==40 and all(c in '0123456789abcdef' for c in runtime)
runtime_paths=['App.tsx','CampaignScreen.tsx','app.json','package.json','package-lock.json','babel.config.js','metro.config.js','src','supabase/functions','plugins','assets']
subprocess.run(['git','diff','--exit-code',runtime,'HEAD','--',*runtime_paths],check=True)
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
def api(path):
    return json.loads(subprocess.check_output(['gh','api','repos/'+REPOSITORY+'/'+path],text=True))
run=api('actions/runs/'+str(run_id))
assert run['id']==run_id and run['head_sha']==runtime and run['repository']['full_name']==REPOSITORY
jobs=api('actions/runs/'+str(run_id)+'/jobs?per_page=100')['jobs']
actual={}
for name in REQUIRED_JOBS:
    matches=[j for j in jobs if j['name']==name]
    assert len(matches)<=1,name
    actual[name]=({'id':matches[0]['id'],'status':matches[0]['status'],'conclusion':matches[0]['conclusion']} if matches else {'status':'not_started','conclusion':None})
complete=all(j['status']=='completed' for j in actual.values())
passed=complete and all(j['conclusion']=='success' for j in actual.values())
report={'status':'COLLECTED_NOT_RELEASE_ACCEPTANCE','repository':REPOSITORY,'runtime':runtime,'runId':run_id,'originalRunStatus':run['status'],'originalRunConclusion':run['conclusion'],'jobs':actual,'allSevenCompleted':complete,'allSevenPassed':passed,'releaseAccepted':False,'qaCleanup':'PENDING actual guarded database review/readback','artifacts':{},'missingArtifacts':[]}
names={'release':'dominion-camera-illustrated-release','camera':'camera-native-paired-evidence','upgrade':'dominion-upgrade-save-evidence','online':'dominion-native-online-evidence','backend':'world-backend-expansion-evidence','native':'android-smoke-evidence','long':'final-long-simulation-evidence'}
artifacts=api('actions/runs/'+str(run_id)+'/artifacts?per_page=100')['artifacts']
folders={}
for label,name in names.items():
    matches=[a for a in artifacts if a['name']==name and not a['expired']]
    assert len(matches)<=1,name
    if not matches:
        report['missingArtifacts'].append(name);continue
    artifact=matches[0]
    assert artifact['workflow_run']['id']==run_id and artifact['workflow_run']['head_sha']==runtime
    archive=out/(label+'.zip')
    with archive.open('wb') as stream:
        subprocess.run(['gh','api','repos/'+REPOSITORY+'/actions/artifacts/'+str(artifact['id'])+'/zip'],stdout=stream,check=True)
    observed=hashlib.sha256(archive.read_bytes()).hexdigest()
    assert archive.stat().st_size==artifact['size_in_bytes'],name+' ZIP length'
    assert artifact['digest']=='sha256:'+observed,name+' ZIP digest'
    folder=out/label;folder.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None,name+' ZIP CRC'
        for member in z.namelist():
            p=Path(member)
            assert not p.is_absolute() and '..' not in p.parts,member
        z.extractall(folder)
    folders[label]=folder
    report['artifacts'][label]={'id':artifact['id'],'name':name,'bytes':archive.stat().st_size,'sha256':observed,'zipCrcVerified':True,'sourceRuntime':runtime,'sourceRunId':run_id}
def subset(data,keys): return {k:data[k] for k in keys if k in data}
if 'release' in folders:
    apks=list(folders['release'].rglob('Dominion-grand-strategy-v2-release.apk'))
    assert len(apks)==1,apks
    apk=apks[0]
    report['apk']={'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'bytes':apk.stat().st_size}
    for script in ['verify-apk.py','verify-packaged-art.py','verify-release.py']:
        result=subprocess.check_output(['python','scripts/'+script,str(apk)],text=True)
        (out/(script+'.txt')).write_text(result)
    with zipfile.ZipFile(apk) as z:
        assert z.testzip() is None,'APK CRC'
        bundle=z.read('assets/index.android.bundle')
        assert bundle[:8].hex()=='c61fbc03c103191f'
        report['apk']['hermes']={'bytes':len(bundle),'sha256':hashlib.sha256(bundle).hexdigest(),'magic':bundle[:8].hex()}
    report['apk']['apkCrcVerified']=True
    report['apk']['standaloneArtReleaseVerifiersPassed']=True
if 'camera' in folders:
    captures={name:read_evidence(folders['camera']/name,'results.json') for name in CAPTURES}
    fixture=captures['camera-before']
    camera=validate_captures(captures,fixture['fixtureSha256'],fixture['fixtureStateChecksum'])
    report['camera']=camera
    if actual['camera-comparison']['conclusion']=='success':assert camera['comparisonGatesPassed'] is True
if 'upgrade' in folders:
    upgrade=read_evidence(folders['upgrade'],'UPGRADE_SAVE_QA.json')
    report['upgrade']=subset(upgrade,['baseline','candidate','appUidRetained','privateCampaignFilesRetained','encryptedPreferenceBytesRetainedBeforeLaunch','repeatBackupBytesUnchanged','actualCandidateRestart','finalVersionUpgrade','oldSchema','newSchema','migrationBackupSha256','originalWorld','fixtureSha256'])
if 'online' in folders:
    online=read_evidence(folders['online'],'NATIVE_ONLINE_QA.json')
    report['online']=subset(online,['apkSha256','stateVersion','members','roomId','nativeCreate','serverPaused','menuReconnect','processReconnect','realHostMigration','nativeOwnerReturn','rebootReconnect','sameNativeUidAndSessionKeys','onceOnlyFocusPaymentRetained','nativePaidFocus'])
    if 'apk' in report:assert online['apkSha256']==report['apk']['sha256']
if 'backend' in folders:
    backend=read_evidence(folders['backend'],'BACKEND_EXPANSION_QA.json')
    report['backend']=subset(backend,['roomId','featuresVerified','hostMigrationVerified','stateVersion','finalSchema','firstTick','finalTick','tick','finalTickNumber','spyMissionResults','missions','spyResults'])
if 'native' in folders:
    durations=list(folders['native'].rglob('stress-duration.txt'))
    if durations:
        assert len(durations)==1
        duration=float(durations[0].read_text());assert math.isfinite(duration)
        import re
        pss=[]
        for path in sorted(folders['native'].rglob('stress-memory-*.txt')):
            raw=path.read_text();match=re.search(r'TOTAL PSS:\s*(\d+)',raw) or re.search(r'^\s*TOTAL\s+(\d+)',raw,re.M)
            assert match,path
            pss.append(int(match[1]))
        report['nativeStress']={'durationSeconds':duration,'durationFileSha256':hashlib.sha256(durations[0].read_bytes()).hexdigest(),'memorySamples':len(pss),'pssMinKiB':min(pss) if pss else None,'pssMaxKiB':max(pss) if pss else None}
        if actual['android-smoke']['conclusion']=='success':assert duration>=1800 and len(pss)>=29
    elif actual['android-smoke']['conclusion']=='success':raise AssertionError('Successful native job lacks raw stress duration')
if 'long' in folders:
    report['longSimulation']=read_evidence(folders['long'],'LONG_SIMULATION_RESULTS.json')
if passed:
    assert not report['missingArtifacts']
    assert report['camera']['comparisonGatesPassed'] is True
    assert report['nativeStress']['durationSeconds']>=1800
path=out/'NATIVE_SOURCE_QA_SUMMARY.json'
path.write_text(json.dumps(report,indent=2)+'\n')
print('DOMINION_NATIVE_READBACK '+json.dumps(report,separators=(',',':')))
