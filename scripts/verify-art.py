"""Detect missing/truncated/incorrect project artwork before Metro/Android packaging."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'assets/art/manifest.json').read_text())
assert len(manifest)==15
subjects=set()
for entry in manifest:
 data=(root/entry['path']).read_bytes()
 assert len(data)==entry['bytes'] and len(data)>10000, entry['path']+' missing/truncated'
 assert data[:4]==b'RIFF' and data[8:12]==b'WEBP',entry['path']+' invalid format'
 assert int.from_bytes(data[4:8],'little')+8==len(data),entry['path']+' RIFF size mismatch'
 assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']+' unexpected asset bytes'
 assert entry['width']<=1600 and entry['height']<=960
 subjects.add(Path(entry['path']).stem.rsplit('-',1)[0])
assert {'main-menu','campaign','military','diplomacy','economy','loading','rulers','buildings','government','religion','loading-port'} <= subjects
assert sum(e['bytes'] for e in manifest)<3_500_000
assert sum(e['width']*e['height']*4 for e in manifest if 'atlas' in e['path'])<12_000_000
print('PASS: original historical scenes, rulers/buildings/government/religion atlases / 15 optimized WebPs / '+str(sum(e['bytes'] for e in manifest))+' bytes')
