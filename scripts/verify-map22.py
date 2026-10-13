"""Verify atlas hashes, tiling and APK inclusion. No simulation or benchmark."""
import hashlib,json,re,sys
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'MAP_ASSET_MANIFEST.json').read_text())
hashes=set()
for asset in manifest['assets']:
    path=root/asset['file'];digest=hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest==asset['sha256'] and path.stat().st_size==asset['bytes'],asset['file']
    with Image.open(path) as image:assert list(image.size)==asset['size']
    hashes.add(digest)
assets=(root/'src/map/atlas22Assets.ts').read_text()
assert len(re.findall(r'require\(',assets))==len(manifest['assets'])-1
for level,count in [('world',1),('region',18),('province',72)]:
    assert len(re.findall('"level":"'+level+'"',assets))==count
assert manifest['projection']['worldSize']==[1440,720]
assert all(s['license']=='Public domain' for s in manifest['sources'])
if len(sys.argv)>1:
    with ZipFile(sys.argv[1]) as z:
        included={hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.endswith('.webp')}
        assert hashes<=included,'Missing offline atlas assets in standalone APK'
print('PASS: worldwide atlas, projection, 3 LODs, licences, hashes'+(' and APK inclusion' if len(sys.argv)>1 else ''))
