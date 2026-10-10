"""Detect missing/truncated/incorrect project artwork before Metro/Android packaging."""
from pathlib import Path
from io import BytesIO
from collections import Counter
import json,hashlib
from PIL import Image
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'assets/art/manifest.json').read_text())
assert len(manifest)==42, '15 inherited assets plus27 new original paintings required'
assert len({e['path'] for e in manifest})==len(manifest)
subjects=set()
for entry in manifest:
 data=(root/entry['path']).read_bytes()
 assert len(data)==entry['bytes'] and len(data)>10000, entry['path']+' missing/truncated'
 assert data[:4]==b'RIFF' and data[8:12]==b'WEBP',entry['path']+' invalid format'
 assert int.from_bytes(data[4:8],'little')+8==len(data),entry['path']+' RIFF size mismatch'
 assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']+' unexpected asset bytes'
 assert entry['width']<=1600 and entry['height']<=960
 with Image.open(BytesIO(data)) as decoded:
  assert decoded.format=='WEBP' and not getattr(decoded,'is_animated',False)
  assert decoded.size==(entry['width'],entry['height']),entry['path']+' incorrect decoded dimensions'
  decoded.verify()
 subjects.add(Path(entry['path']).stem.rsplit('-',1)[0])
assert {'main-menu','campaign','military','diplomacy','economy','loading','rulers','buildings','government','religion','loading-port'} <= subjects
assert sum(e['bytes'] for e in manifest)<3_500_000
assert sum(e['width']*e['height']*4 for e in manifest if 'atlas' in e['path'])<12_000_000
new=[e for e in manifest if e['path'].startswith('assets/art/expansion/')]
assert len(new)==27 and len({e['subjectId'] for e in new})==27
assert len({e['sourceSha256'] for e in new})==27,'Each required scene must have its own original'
assert Counter(e['category'] for e in new)==Counter(Diplomacy=5,Military=4,Construction=4,Government=3,Religion=3,Theme=8)
prompts=json.loads((root/'assets/art/expansion-prompts.json').read_text())
assert {p['id']:p['sourceSha256'] for p in prompts}=={e['subjectId']:e['sourceSha256'] for e in new}
assert all(e['width']<=960 and e['height']<=540 and e['width']*e['height']*4<=2_100_000 for e in new)
print('PASS:15 inherited WebPs retained +19 new category paintings +8 new themes /42 optimized WebPs / '+str(sum(e['bytes'] for e in manifest))+' bytes')
