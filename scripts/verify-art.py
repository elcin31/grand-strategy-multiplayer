"""Detect missing/truncated/incorrect project artwork before Metro/Android packaging."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'assets/art/manifest.json').read_text())
assert len(manifest)==9
subjects=set()
for entry in manifest:
 data=(root/entry['path']).read_bytes()
 assert len(data)==entry['bytes'] and len(data)>10000, entry['path']+' missing/truncated'
 assert data[:4]==b'RIFF' and data[8:12]==b'WEBP',entry['path']+' invalid format'
 assert int.from_bytes(data[4:8],'little')+8==len(data),entry['path']+' RIFF size mismatch'
 assert hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']+' unexpected asset bytes'
 assert entry['width']<=1600 and entry['height']<=960
 subjects.add(Path(entry['path']).stem.rsplit('-',1)[0])
assert subjects=={'main-menu','campaign','military','diplomacy','economy','loading'}
print('PASS: six original subjects / nine optimized WebP variants / '+str(sum(e['bytes'] for e in manifest))+' bytes')
