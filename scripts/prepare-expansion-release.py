"""Bind publication to completed GitHub checks and byte-identical game sources."""
import json
import os
import subprocess
from pathlib import Path
from release_v2_validation import REPOSITORY, RERUN_GATES, assert_accepted_run

acceptance = json.loads(Path('RELEASE_ACCEPTANCE_V2.json').read_text())
assert acceptance['status'] == 'ACCEPTED'


def fetch(run_id, suffix, destination):
    assert isinstance(run_id, int) and not isinstance(run_id, bool) and run_id > 0
    data = json.loads(subprocess.check_output(['gh', 'api',
        f'repos/{REPOSITORY}/actions/runs/{run_id}{suffix}'], text=True))
    path = Path(destination); path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2)+'\n')
    return data


run_id = acceptance['runId']
run = fetch(run_id, '', 'accepted-run.json')
jobs = fetch(run_id, '/jobs?per_page=100', 'accepted-jobs.json')
reruns = {}
for gate, proof in acceptance.get('gateReruns', {}).items():
    assert gate in RERUN_GATES
    folder = Path('recovered-gates')/RERUN_GATES[gate]
    reruns[gate] = {'run': fetch(proof['runId'], '', folder/'run.json'),
                    'jobs': fetch(proof['runId'], '/jobs?per_page=100', folder/'jobs.json')}
assert_accepted_run(acceptance, run, jobs, reruns)
runtime_paths = ['App.tsx', 'CampaignScreen.tsx', 'app.json', 'package.json', 'package-lock.json',
                 'babel.config.js', 'metro.config.js', 'src', 'supabase/functions', 'plugins', 'assets']
for source in [acceptance['runtime'], *[r['qaRuntime'] for r in acceptance.get('gateReruns', {}).values()]]:
    subprocess.run(['git', 'diff', '--exit-code', source, 'HEAD', '--', *runtime_paths], check=True)
outputs = {'run_id': run_id, 'camera_run_id': acceptance.get('gateReruns', {}).get('camera-comparison', {}).get('runId', run_id),
           'online_run_id': acceptance.get('gateReruns', {}).get('android-online / native-online', {}).get('runId', run_id),
           'camera_artifact': 'expansion-camera-paired-evidence' if 'camera-comparison' in acceptance.get('gateReruns', {})
               else 'camera-native-paired-evidence',
           'main_sha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()}
with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
    for key, value in outputs.items(): output.write(f'{key}={value}\n')
print('PASS: all seven completed actual gates, preserved failures, exact source and corrected QA provenance')
