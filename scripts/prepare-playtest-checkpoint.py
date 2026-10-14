"""Bind a clearly labelled checkpoint ZIP to an actual APK and native QA runs."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPOSITORY='elcin31/grand-strategy-multiplayer'
RUNTIME=['App.tsx','CampaignScreen.tsx','app.json','package.json','package-lock.json',
         'metro.config.js','babel.config.js','src','supabase/functions','plugins','assets']


def load(path):return json.loads(path.read_text())
def copy(source, destination):
    destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,destination)


def prepare(evidence, output):
    assert not output.exists(),'Use a fresh curated payload directory'
    build=load(evidence/'build-run.json');jobs=load(evidence/'build-jobs.json')['jobs']
    smoke=load(evidence/'smoke-run.json');lod=load(evidence/'lod-run.json')
    for run in [build,smoke,lod]:
        assert run['repository']['full_name']==REPOSITORY and run['status']=='completed'
    assert any(j['name']=='build-candidate' and j['conclusion']=='success' for j in jobs)
    assert smoke['conclusion']==lod['conclusion']=='success','Do not distribute a failed interaction/LOD binary'
    sha=build['head_sha']
    for reference in [sha,smoke['head_sha'],lod['head_sha']]:
        subprocess.run(['git','diff','--exit-code',reference,'HEAD','--',*RUNTIME],check=True)
    config=json.loads(subprocess.check_output(['git','show',sha+':app.json'],text=True))['expo']
    apk=evidence/'binary/Dominion-2.3-performance-candidate.apk'
    digest=hashlib.sha256(apk.read_bytes()).hexdigest()
    comparison=load(evidence/'camera/camera23-comparison.json')
    assert comparison['comparisonKind']=='candidate-vs-optimized-baseline'
    assert comparison['candidateApkSha256']==digest
    assert comparison['baselineApkSha256']=='a44c54b3fcbe31dd7c23d5fea13782244436a6e47a7fa3ddf50be1204e846cbb'
    functional=load(evidence/'smoke/android-hotfix/result.json')
    for key in ['coldLaunch','inPlaceUpgrade22','savedPausedCampaignPreserved','balancedAndPerformance',
                'shortRealPanZoom','politicalTerrainMilitary','provinceSelection','armySelection',
                'confirmedRoute','shortMarch','saveRestart','noFatalLogs']:
        assert functional[key] is True,key
    monthly=load(evidence/'smoke/monthly-candidate/result.json')
    assert monthly['monthlyEconomyAndAI'] is True and monthly['noFatalLogs'] is True
    lod_result=load(evidence/'lod/lod-candidate/result.json')
    assert lod_result['stagedWorldRegionProvince'] is True and lod_result['noFatalLogs'] is True
    # Actual capture metadata contains the hash of the installed APK. The
    # apksigner text contains certificate hashes, not an APK content digest.
    for path in [evidence/'smoke/monthly-candidate/profiles.json',
                 evidence/'lod/lod-candidate/profiles.json']:
        assert load(path)['apkSha256']==digest,'Validation used a different APK'
    output.mkdir()
    name='Dominion-'+config['version']+'-playtest.apk';copy(apk,output/name)
    mandatory={'cameraNativeGate':comparison['metricGate']=='pass','graphicsAndInteraction':True,
               'memoryBounded':False,'engineAndGameplay':False,'eventsAndFocus':False,
               'scenarioValidation':False,'saveCompatibility':False,'multiplayerTwoClients':False,
               'longSimulation10000':False,'finalAndroidRegression':False,
               'apkIntegrity':True,'apkInstallColdSmoke':True}
    manifest={'repository':REPOSITORY,'status':'playtest-checkpoint','dominion23Complete':False,
              'compiledSourceSha':sha,'sourceCommitEpoch':int(subprocess.check_output(['git','show','-s','--format=%ct',sha],text=True)),
              'apk':{'filename':name,'sha256':digest,'versionName':config['version'],
                     'versionCode':config['android']['versionCode'],'package':config['android']['package'],
                     'certificateSha256':'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c'},
              'runs':{'buildAndCamera':build['id'],'interactionAndMonthly':smoke['id'],'repeatedLod':lod['id']},
              'mandatoryChecks':mandatory,'physicalRedmiTest':False,
              'cameraRegressionsOver10Percent':comparison['regressionsOver10Percent']}
    (output/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    readme=f'''Dominion 2.3 — тестовый checkpoint\n\nСтатус: разработка не завершена. Это standalone APK {config['version']} для проверки кандидата камеры.\nSHA исходников: {sha}\n\nУстановка, совместимая подпись, встроенный bundle, четыре ABI, карта 2.2, выбор провинции/армии, маршрут, сохранение/перезапуск, месячный шаг и LOD проверены на Android-эмуляторе.\nCamera gate: {comparison['metricGate']}. Проверки эмулятора не доказывают FPS Redmi Note 12.\n\nУглубление игровых систем Dominion 2.3, сценарии, полный перенос сохранений, два реальных multiplayer-клиента и 10 000 шагов остаются незавершёнными. Не публиковалось как готовый релиз.\nИсходники: https://github.com/{REPOSITORY}/tree/{sha}\nКонтрольные суммы каждого файла: SHA256SUMS.\n'''
    (output/'README.txt').write_text(readme)
    for file in ['DOMINION_23_CHECKPOINT.md','DOMINION_23_PRESENTATION_PROBE.md',
                 'DOMINION_23_NATIVE_GPU_PROOF.json','DOMINION_23_UI_SWAP_DIAGNOSTIC.json',
                 'DOMINION_23_TEXTURE_CONSUMER_PROBE.md','DOMINION_23_TEXTURE_CONSUMER_DIAGNOSTIC.json',
                 'DOMINION_23_DEV11_CANDIDATE_MANIFEST.json','DOMINION_23_PERFORMANCE_DEV10_UNACCEPTED.json',
                 'DOMINION_23_SOURCE_REGRESSION_AUDIT.json','DOMINION_23_LEGACY_SAVE_FAILURE.json']:
        path=Path(file)
        if path.exists():copy(path,output/'reports'/file)
    for source,target in [(evidence/'camera/camera23-comparison.json','camera-comparison.json'),
                          (evidence/'rechecked-integrity.txt','apk-integrity.txt'),
                          (evidence/'smoke/android-hotfix/result.json','interaction.json'),
                          (evidence/'smoke/monthly-candidate/result.json','monthly.json'),
                          (evidence/'lod/lod-candidate/result.json','lod.json')]:
        copy(source,output/'reports'/target)
    for path in sorted((evidence/'binary').rglob('*.json')):
        copy(path,output/'reports/native-proof'/path.relative_to(evidence/'binary'))
    return manifest


if __name__=='__main__':
    print(json.dumps(prepare(Path(sys.argv[1]),Path(sys.argv[2])),indent=2))
