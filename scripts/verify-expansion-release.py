"""Read sanitized accepted artifacts; do not build or modify a game campaign."""
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from release_v2_validation import (assert_accepted_run, assert_binary_evidence, read_evidence,
                                   read_rerun_runs, assert_artifact_source)
from camera_capture_validation import validate_captures, CAPTURES

read = lambda name: json.loads(Path(name).read_text())
acceptance = read('RELEASE_ACCEPTANCE_V2.json')
assert_accepted_run(acceptance, read('accepted-run.json'), read('accepted-jobs.json'), read_rerun_runs(acceptance))
for gate in acceptance.get('gateReruns', {}):
    directory, source = ('camera-evidence', 'source-run.json') if gate == 'camera-comparison' \
        else ('online-evidence', 'candidate-run.json')
    assert_artifact_source(acceptance, read_evidence(directory, source))
if 'camera-comparison' in acceptance.get('gateReruns', {}):
    observed = read_evidence('camera-evidence', 'EXPANSION_CAMERA_REVIEW.json')['apkVerification']
    assert observed['sourceRuntime'] == acceptance['runtime'] and str(observed['sourceRun']) == str(acceptance['runId'])
    assert observed['sha256'] == acceptance['apkSha256'] and observed['bytes'] == acceptance['apkBytes']
# Re-evaluate every unchanged frame, compositor, memory and input-cadence gate
# from raw complete forward/reverse artifacts, including corrected-harness runs.
env = {**os.environ, 'CAMERA_REQUIRE_SURFACE_PRESENTATION': '1',
       'CAMERA_CANDIDATE_RUNTIME': acceptance['runtime'], 'CAMERA_CANDIDATE_RUN': str(acceptance['runId'])}
captures = {name: read_evidence(Path('camera-evidence')/name, 'results.json') for name in CAPTURES}
assert all(data.get('inputProtocol') == 'continuous-pointer-v1' for data in captures.values())
fixture = captures['camera-before']
complete = validate_captures(captures, fixture['fixtureSha256'], fixture['fixtureStateChecksum'])
assert complete['comparisonGatesPassed'] is True, 'Actual raw camera regression: '+str(complete['comparisonGateViolations'])
for suffix in ['', '-reverse']:
    paths = [next(Path('camera-evidence').rglob('camera-'+side+suffix+'/results.json'))
             for side in ['before', 'after']]
    subprocess.run([sys.executable, 'scripts/compare-camera-native.py', *map(str, paths)], check=True, env=env)
apk = Path('release/Dominion-grand-strategy-v2-release.apk')
assert_binary_evidence(acceptance, hashlib.sha256(apk.read_bytes()).hexdigest(), apk.stat().st_size,
    read_evidence('upgrade-evidence', 'UPGRADE_SAVE_QA.json'),
    read_evidence('online-evidence', 'NATIVE_ONLINE_QA.json'),
    read_evidence('backend-evidence', 'BACKEND_EXPANSION_QA.json'),
    float(Path('native-evidence/stress-duration.txt').read_text()))
print('PASS: exact accepted run/binary, all seven gates, higher version/signature/save, paid native reconnect and scoped cleanup')
