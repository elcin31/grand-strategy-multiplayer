"""Inspect the built binary, not just Gradle's selected task."""
import os
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path
apk = Path(sys.argv[1]).resolve()
sdk = Path(os.environ.get('ANDROID_HOME', os.environ.get('ANDROID_SDK_ROOT', '/opt/android-sdk')))
build_tools = sorted((sdk/'build-tools').glob('*'), key=lambda p: [int(n) for n in re.findall(r'\d+', p.name)])[-1]
def run(*args): return subprocess.check_output(list(map(str,args)),text=True,stderr=subprocess.STDOUT)
badging = run(build_tools/'aapt','dump','badging',apk)
manifest = run(build_tools/'aapt','dump','xmltree',apk,'AndroidManifest.xml')
assert "package: name='com.elcin31.grandstrategymultiplayer'" in badging
config=json.loads((Path(__file__).resolve().parent.parent/'app.json').read_text())['expo']
assert f"versionCode='{config['android']['versionCode']}'" in badging and f"versionName='{config['version']}'" in badging
assert 'application-debuggable' not in badging, 'APK is debuggable'
assert not re.search(r'android:debuggable[^\n]*0xffffffff',manifest), 'Debuggable manifest'
assert re.search(r'android:screenOrientation[^\n]*\)0x(?:0|6)\b',manifest), 'Landscape missing in packaged manifest'
signature = run(build_tools/'apksigner','verify','--verbose','--print-certs',apk)
assert 'Verified' in signature or 'Verifies' in signature
with zipfile.ZipFile(apk) as archive:
    bundle=archive.read('assets/index.android.bundle')
    assert b'dfjsnjxnyjspwugjguhq.supabase.co' in bundle, 'Dedicated production backend missing'
    if config['version']=='2.1.1':
        assert b'-v211' in bundle, 'Dominion 2.1.1 endpoint suffix missing'
        assert 'android.permission.RECORD_AUDIO' not in manifest, 'Unexpected microphone permission'
baseline=json.loads((Path(__file__).resolve().parent.parent/'PLAYTEST_RELEASE_MANIFEST.json').read_text())['apk']
if config['android']['versionCode']>baseline['versionCode']:
    digest=re.search(r'certificate SHA-256 digest: ([0-9a-fA-F]+)',signature)
    assert digest and digest.group(1).lower()==baseline['certificateSha256'].lower(), 'Signing certificate changed from 2.0'
    print('PASS: installation-compatible Dominion 2.0 certificate retained')
with zipfile.ZipFile(apk) as archive:
    import hashlib
    packaged={hashlib.sha256(archive.read(n)).hexdigest() for n in archive.namelist() if n.endswith(('.webp','.png'))}
    for art in (Path(__file__).resolve().parent.parent/'assets/art/overhaul').glob('*.webp'):
        assert hashlib.sha256(art.read_bytes()).hexdigest() in packaged, 'New artwork missing: '+art.name
print(badging)
print(signature)
print(f"PASS: release manifest, version {config['version']} ({config['android']['versionCode']}), landscape, embedded production backend, verified signature")
