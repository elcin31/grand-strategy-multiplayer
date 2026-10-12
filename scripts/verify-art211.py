from pathlib import Path
from collections import Counter
import hashlib,json,re,sys,zipfile
from PIL import Image
root=Path(__file__).resolve().parents[1];directory=root/'assets/art/dominion-2.1.1';rows=json.loads((directory/'art-manifest.json').read_text());assert len(rows)==100
assert Counter(r['category'] for r in rows)==Counter(military=20,economy=18,technology=15,focuses=15,diplomacy=12,events=10,government=10)
assert len({r['id'] for r in rows})==len({r['sha256'] for r in rows})==100
for r in rows:
 path=directory/r['filename'];data=path.read_bytes();assert len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'];assert all(r[k] for k in ['titleRu','description','era','purpose','screens','origin','rights'])
 with Image.open(path) as image:assert image.format=='WEBP' and image.size==(r['width'],r['height']) and image.width<=640 and image.height<=384;image.verify()
registry=(root/'src/art/library.ts').read_text();assert len(re.findall(r"require\(",registry))==100
assert all(r['filename'] in registry for r in rows)
if len(sys.argv)>1:
 with zipfile.ZipFile(sys.argv[1]) as apk:
  hashes={hashlib.sha256(apk.read(n)).hexdigest() for n in apk.namelist() if n.endswith(('.webp','.wav','.ogg'))};assert all(r['sha256'] in hashes for r in rows)
  audio=json.loads((root/'assets/audio/dominion-2.1.1/audio-manifest.json').read_text());assert len(audio)==24 and all(r['sha256'] in hashes for r in audio)
print('PASS: 100 distinct optimized paintings, 7 categories, provenance and static Metro references'+(' + all 100 paintings/24 audio files packaged' if len(sys.argv)>1 else ''))
