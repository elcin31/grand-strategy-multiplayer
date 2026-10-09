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
print(badging)
print(signature)
print(f"PASS: release manifest, version {config['version']} ({config['android']['versionCode']}), landscape, embedded production backend, verified signature")
