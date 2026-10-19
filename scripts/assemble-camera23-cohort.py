"""Bind a fixed20-sample extension to the original three adverse pairs."""
import json
import os
from pathlib import Path
import subprocess

definition=json.loads(Path('DOMINION_23_PLAYTEST4_CAMERA_COHORT_PLAN.json').read_text())
plan=json.loads(Path('DOMINION_23_PLAYTEST4_CAMERA_PLAN.json').read_text())
assert definition['additionalSamples']==20 and definition['originalPairCount']==3
assert definition['candidateApkSha256']==plan['candidateApkSha256']
root=Path('evidence');cohort=int(os.environ['GITHUB_RUN_ID'])
def metadata(run_id):
    return subprocess.check_output(['gh','api','repos/elcin31/grand-strategy-multiplayer/actions/runs/'+str(run_id)])
for pair in plan['pairs']:(root/pair['directory']/'run.json').write_bytes(metadata(pair['runId']))
run=metadata(cohort)
plan.update(expectedPairCount=23,additionalCohortSamples=20,additionalCohortRunId=cohort,
            specifiedAtUtc=definition['specifiedAtUtc'],originalThreeGate='fail; retained unchanged',extensionDefinition=definition)
for number in range(1,21):
    directory='camera-cohort-sample-'+str(number)
    assert (root/directory/'sample.json').is_file(),'Missing fixed cohort sample'
    (root/directory/'run.json').write_bytes(run)
    plan['pairs'].append({'runId':cohort,'sampleNumber':number,'directory':directory})
Path('camera23-cohort-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
