import hashlib
import json
import sys
from pathlib import Path
from camera_capture_validation import CAPTURES, validate_captures

directory, fixture = Path(sys.argv[1]), Path(sys.argv[2])
raw = fixture.read_bytes()
saved = json.loads(raw)
assert saved['state']['stateVersion'] == 12 and saved['state']['tick'] == 0 and saved['state']['phase'] == 'paused'
report = validate_captures({name: json.loads((directory/name/'results.json').read_text()) for name in CAPTURES},
                           hashlib.sha256(raw).hexdigest(), saved['checksum'])
print(json.dumps(report, indent=2))
