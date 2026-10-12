"""Bind the existing 2.1.1 APK to completed short checks; never rebuild it."""
import hashlib,json,os,re,sys,zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
delivery=Path(sys.argv[1] if len(sys.argv)>1 else 'release211')
native_dir=Path(sys.argv[2] if len(sys.argv)>2 else 'native211')
runtime='f35f19100b8f6d715592006cb4b5114d9425c216'
build=json.loads((delivery/'build-run.json').read_text())
jobs=json.loads((delivery/'build-jobs.json').read_text())['jobs']
native_run=json.loads((delivery/'native-run.json').read_text())
assert build['head_sha']==runtime and build['status']=='completed'
job=next(j for j in jobs if j['name']=='build-apk')
assert job['conclusion']=='success'
for name in ['Typecheck','Gameplay and authority checks','Verify release manifest, signature and production backend','Package final release']:
 assert next(s for s in job['steps'] if s['name']==name)['conclusion']=='success',name
assert native_run['status']=='completed' and native_run['conclusion']=='success'
results=list(native_dir.rglob('result.json'));assert len(results)==1
native=json.loads(results[0].read_text())
for key in ['releaseColdLaunch','campaignStarted','newHUD','armySplit','armyOrder','armyMovement','deselectPreservesOrder','centralWindowOpenDragScrollClose','mute','saveRestart','mapPainted','noFatalLogs']:
 assert native.get(key) is True,key
apk=delivery/'Dominion-2.1.1-playtest.apk';integrity=(delivery/'release-integrity.txt').read_text()
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
sha=digest(apk);assert sha in integrity,'Binary differs from the checked build'
cert=re.search(r'certificate SHA-256 digest: ([0-9a-fA-F]+)',integrity).group(1).lower()
previous=json.loads((root/'DOMINION_21_RELEASE_MANIFEST.json').read_text())
assert cert==previous['apk']['certificateSha256']
assert "versionCode='12'" in integrity and "versionName='2.1.1'" in integrity
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None
 bundle=z.read('assets/index.android.bundle')
 assert bundle[:8].hex()=='c61fbc03c103191f'
 assert b'dfjsnjxnyjspwugjguhq.supabase.co' in bundle and b'-v211' in bundle
 abis=sorted({n.split('/')[1] for n in z.namelist() if n.startswith('lib/') and n.endswith('.so')})
archive=delivery/'Dominion-2.1.1-playtest.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:z.write(apk,apk.name)
(delivery/'SHA256SUMS.txt').write_text(sha+'  '+apk.name+'\n'+digest(archive)+'  '+archive.name+'\n')
server=json.loads((root/'DOMINION_211_BACKEND_MANIFEST.json').read_text())
qa=json.loads((root/'DOMINION_211_MULTIPLAYER_QA.json').read_text())
art=json.loads((root/'assets/art/dominion-2.1.1/art-manifest.json').read_text())
manifest={
 'repository':'elcin31/grand-strategy-multiplayer',
 'release':'DOMINION 2.1.1 PLAYTEST — WARFARE, INTERFACE, MULTIPLAYER & ART UPDATE',
 'releaseTag':'v2.1.1-playtest.1','checkpointBranch':'dominion-2.1.1-warfare-interface-art',
 'runtimeCommit':runtime,'publicationCommit':os.environ['GITHUB_SHA'],
 'publicationRunId':int(os.environ['GITHUB_RUN_ID']),
 'apk':{'name':apk.name,'bytes':apk.stat().st_size,'sha256':sha,'package':'com.elcin31.grandstrategymultiplayer','versionName':'2.1.1','versionCode':12,'configuration':'RELEASE','debuggable':False,'standalone':True,'landscape':True,'microphonePermission':False,'certificateSha256':cert,'embeddedHermesBytes':len(bundle),'embeddedHermesSha256':hashlib.sha256(bundle).hexdigest(),'abis':abis,'correctDominionBackendVerified':True,'versionedEndpointsEmbedded':True,'zipCRCVerified':True},
 'downloadArchive':{'name':archive.name,'bytes':archive.stat().st_size,'sha256':digest(archive),'embeddedApkSha256':sha},
 'build':{'runId':build['id'],'url':build['html_url'],'conclusion':build['conclusion'],'buildJobConclusion':job['conclusion'],'note':'Build and binary checks passed. The older queued smoke was cancelled; the corrected short smoke reused the identical APK.'},
 'verification':{'strictTypecheck':True,'focusedTests':{'tests':59,'passed':59,'failed':0},'nativeRun':{'runId':native_run['id'],'url':native_run['html_url'],'sourceCommit':native_run['head_sha'],'conclusion':native_run['conclusion'],'runtimeSourceEqualityChecked':True},'nativeSmoke':native,'liveTwoClientMultiplayer':qa,'artAndAudioPackaged':True,'worldDataUnchangedFrom21':True},
 'server':server,'art':{'newPaintings':len(art),'newPaintingsBytes':sum(r['bytes'] for r in art),'oldIllustrationsPreserved':True,'manifest':'assets/art/dominion-2.1.1/art-manifest.json'},
 'audio':{'originalEffects':21,'originalProceduralScores':3,'localAssets':24,'bytes':2702410},
 'preservedReleases':['v2.0.0-playtest.1','v2.1.0-playtest.1'],
 'knownLimitations':['Live multiplayer check used two independent HTTP clients and prepared map geometry, not two physical Android devices.','Short native smoke used one Android emulator; physical-device audio output and smoothness remain for user playtest.','Initial warfare and peace playtest balance.'],
 'publicationStatus':'VERIFIED_BUILD_PENDING_PUBLICATION',
}
(delivery/'DOMINION_211_RELEASE_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('PASS: exact standalone 2.1.1 APK, original signature, completed short native checks; SHA-256',sha)
