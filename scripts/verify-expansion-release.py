"""Read sanitized accepted artifacts; do not build or modify a game campaign."""
import hashlib
import json
from pathlib import Path
from release_v2_validation import assert_accepted_run, assert_binary_evidence

read = lambda name: json.loads(Path(name).read_text())
acceptance = read('RELEASE_ACCEPTANCE_V2.json')
assert_accepted_run(acceptance, read('accepted-run.json'), read('accepted-jobs.json'))
apk = Path('release/Dominion-grand-strategy-v2-release.apk')
assert_binary_evidence(acceptance, hashlib.sha256(apk.read_bytes()).hexdigest(), apk.stat().st_size,
    read('upgrade-evidence/android-upgrade/UPGRADE_SAVE_QA.json'),
    read('online-evidence/android-online/NATIVE_ONLINE_QA.json'),
    read('backend-evidence/BACKEND_EXPANSION_QA.json'),
    float(Path('native-evidence/stress-duration.txt').read_text()))
print('PASS: exact accepted run/binary, all seven gates, higher version/signature/save, paid native reconnect and scoped cleanup')
