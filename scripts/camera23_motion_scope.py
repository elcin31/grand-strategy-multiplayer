"""Scope completed compositor records to the already captured real input clock.

Android System.nanoTime and SurfaceFlinger actual-present timestamps share the
device monotonic clock here. Host ADB polling/join delays must not extend the
declared100ms tail or add an idle interval before pointer-down to camera P99.
All in-window stalls survive; original unbounded samples remain diagnostic.
"""
import hashlib
import json
from camera_surface_stats import surface_sequence_stats

POLICY='device-first-down-to-final-up-plus100ms-v1'

def motion_presentation(root,row):
    cycles=row['gesture']['cycles']
    assert cycles,'Missing actual device input timestamps'
    previous=0
    for cycle in cycles:
        begin,end=cycle['downNs'],cycle['upNs']
        assert all(isinstance(n,int) and not isinstance(n,bool) and n>0 for n in (begin,end)) and previous<=begin<end,'Invalid/overlapping real input cycles'
        previous=end
    path=root/(row['scenario']+'-surface.json');raw=path.read_bytes()
    report=surface_sequence_stats(json.loads(raw),row['presentation']['captureSeconds'],(cycles[0]['downNs'],cycles[-1]['upNs']+100_000_000))
    report['scopePolicy']=POLICY
    report['rawPollsSha256']=hashlib.sha256(raw).hexdigest()
    report['layer']=row['presentation']['layer']
    return report
