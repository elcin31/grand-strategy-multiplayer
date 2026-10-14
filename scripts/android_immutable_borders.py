"""Require evidence of the actual native draw API, outside timed captures."""
import json
import zipfile
from pathlib import Path

MARKER='DOMINION_BORDER_PATH immutable-native-v1'

def verify_border_api(apk,adb,destination):
    with zipfile.ZipFile(apk) as archive:
        required=MARKER.encode() in archive.read('assets/index.android.bundle')
        swap_required=b'DOMINION_PRESENTATION swap-zero-requested' in archive.read('lib/x86_64/librnskia.so')
    logs=adb('logcat','-d')
    observed=MARKER in logs
    swap_observed='DOMINION_PRESENTATION swap-zero-requested' in logs
    destination=Path(destination)
    destination.with_suffix('.log').write_text(logs)
    destination.with_suffix('.json').write_text(json.dumps({
        'immutableNativeApiRequired':required,'successfulNativeBorderDrawObserved':observed,
        'nativeSwapRequestRequired':swap_required,'nativeSwapRequestObserved':swap_observed,
        'frameTimeBenefitProven':False,'physicalRedmiTest':False},indent=2)+'\n')
    assert not required or observed, 'Candidate did not execute the immutable native border draw API'
    assert not swap_required or swap_observed, 'Candidate did not successfully request the compiled EGL swap mode'
