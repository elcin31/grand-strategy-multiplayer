"""Require both complete original camera comparisons, without shell state."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from camera_capture_validation import CAPTURES, validate_captures


def compare_orders(directory=Path('.')):
    directory=Path(directory)
    captures={name:json.loads((directory/name/'results.json').read_text()) for name in CAPTURES}
    fixture=captures['camera-before']
    complete=validate_captures(captures,fixture['fixtureSha256'],fixture['fixtureStateChecksum'])
    (directory/'CAMERA_ABBA_QA.json').write_text(json.dumps(complete,indent=2)+'\n')
    env={**os.environ,'CAMERA_REQUIRE_SURFACE_PRESENTATION':'1'}
    outcomes=[]
    for suffix,order in [('', 'FORWARD'),('-reverse','REVERSE')]:
        result=subprocess.run([sys.executable,str(Path(__file__).with_name('compare-camera-native.py').resolve()),
            'camera-before'+suffix+'/results.json','camera-after'+suffix+'/results.json'],cwd=directory,env=env)
        shutil.copyfile(directory/'CAMERA_NATIVE_PAIRED.json',directory/('CAMERA_NATIVE_PAIRED_'+order+'.json'))
        outcomes.append(result.returncode)
    shutil.copyfile(directory/'CAMERA_NATIVE_PAIRED_FORWARD.json',directory/'CAMERA_NATIVE_PAIRED.json')
    assert outcomes==[0,0], 'An original camera order failed: '+str(outcomes)
    assert complete['comparisonGatesPassed'] is True, 'Original ABBA regression: '+str(complete['comparisonGateViolations'])
    print('PASS: all four launches and both original camera orders; no shell variables')


if __name__=='__main__':compare_orders()
