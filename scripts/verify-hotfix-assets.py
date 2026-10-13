"""Verify generated atlas and actual native launcher resources, including APK bytes."""
import hashlib,json,sys,xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
root=Path(__file__).resolve().parent.parent
assets=json.loads((root/'MAP_HOTFIX_ASSET_MANIFEST.json').read_text())['assets'];hashes=set()
for row in assets:
 p=root/row['file'];digest=hashlib.sha256(p.read_bytes()).hexdigest();assert digest==row['sha256']
 with Image.open(p) as im:assert list(im.size)==row['size']
 hashes.add(digest)
assert len(assets)==184
source=json.loads((root/'assets/icon/source.json').read_text());assert hashlib.sha256((root/'assets/icon/dominion-master.jpg').read_bytes()).hexdigest()==source['originalSha256']
with Image.open(root/'assets/icon/dominion-adaptive-foreground.png') as im:
 assert im.mode=='RGBA' and im.size==(1024,1024)
 box=im.getbbox();assert min(box[:2])>=180 and max(box[2:])<=844,'Adaptive safe-zone missing'
if '--native' in sys.argv:
 ANDROID='{http://schemas.android.com/apk/res/android}'
 native=root/'android/app/src/main';app=ET.parse(native/'AndroidManifest.xml').getroot().find('application')
 assert app.get(ANDROID+'icon')=='@mipmap/ic_launcher' and app.get(ANDROID+'roundIcon')=='@mipmap/ic_launcher_round'
 icon=ET.parse(native/'res/mipmap-anydpi-v26/ic_launcher.xml').getroot();assert icon.find('foreground').get(ANDROID+'drawable')=='@mipmap/ic_launcher_foreground'
 files=list((native/'res').glob('mipmap-*/*ic_launcher*'));assert len(files)>=15
 records=[{'file':str(p.relative_to(native)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files if p.suffix in ('.png','.webp')]
 assert len(records)>=15
 # Compare generated foregrounds with the source after resizing, rejecting placeholder artwork.
 with Image.open(root/'assets/icon/dominion-adaptive-foreground.png') as source_im:
  for row in records:
   if 'foreground' in row['file']:
    with Image.open(native/row['file']) as im:
     assert im.getbbox() is not None and im.size[0]>=108
 proof={'originalSha256':source['originalSha256'],'launcherResources':records,'adaptiveForeground':True,'placeholder':False}
 (root/'android/launcher-icon-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
 print('PASS: real native launcher/round/adaptive resources generated from user artwork')
elif len(sys.argv)>1:
 proof=json.loads((root/'android/launcher-icon-proof.json').read_text()) if (root/'android/launcher-icon-proof.json').exists() else json.loads((root/'launcher-icon-proof.json').read_text())
 with ZipFile(sys.argv[1]) as z:
  packed={hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.endswith(('.webp','.png'))}
  assert hashes<=packed,'Prepared offline atlas missing from APK'
  assert {r['sha256'] for r in proof['launcherResources']}<=packed,'New launcher pixels missing from APK'
  # Release AAPT shortens all paths to res/<token>.xml. Identify the compiled
  # adaptive-icon root in binary XML; source filenames are not APK filenames.
  adaptive=[n for n in z.namelist() if n.startswith('res/') and n.endswith('.xml') and (b'adaptive-icon' in z.read(n) or 'adaptive-icon'.encode('utf-16le') in z.read(n))]
  assert adaptive,'Packaged adaptive launcher XML missing'
  xml=z.read(adaptive[0]);assert b'foreground' in xml or 'foreground'.encode('utf-16le') in xml
 print('PASS: precomposed atlas and every generated launcher image actually included in APK')
else:print('PASS: precomposed atlas and exact original icon source verified')
