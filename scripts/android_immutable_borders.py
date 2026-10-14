"""Require evidence of the actual native draw API, outside timed captures."""
import json
import zipfile
from pathlib import Path

MARKER='DOMINION_BORDER_PATH immutable-native-v1'
PACKAGE='com.elcin31.grandstrategymultiplayer'

def verify_border_api(apk,adb,destination):
    with zipfile.ZipFile(apk) as archive:
        required=MARKER.encode() in archive.read('assets/index.android.bundle')
        swap_required=b'DOMINION_PRESENTATION swap-zero-requested' in archive.read('lib/x86_64/librnskia.so')
        consumer_required=b'DOMINION_PRESENTATION hwui-owned-consumer' in archive.read('lib/x86_64/librnskia.so')
    pid=adb('shell','pidof',PACKAGE).strip()
    assert pid.isascii() and pid.isdigit() and int(pid)>0, 'Missing/ambiguous live native game PID'
    raw_logs=adb('logcat','-d')
    # Upgrade smoke retains the previous APK's process messages in logcat.
    # Preserve them, but native execution/failure assertions belong to the
    # currently installed running binary, not the dead baseline PID.
    logs=adb('logcat','-d','--pid='+pid)
    observed=MARKER in logs
    swap_observed='DOMINION_PRESENTATION swap-zero-requested' in logs
    consumer_observed='DOMINION_PRESENTATION hwui-owned-consumer' in logs
    destination=Path(destination)
    destination.with_suffix('.log').write_text(raw_logs)
    destination.with_suffix('.process.log').write_text(logs)
    destination.with_suffix('.json').write_text(json.dumps({
        'immutableNativeApiRequired':required,'successfulNativeBorderDrawObserved':observed,
        'nativeSwapRequestRequired':swap_required,'nativeSwapRequestObserved':swap_observed,
        'hwuiConsumerRequired':consumer_required,'hwuiConsumerObserved':consumer_observed,
        'nativeGamePid':int(pid),'nativeAssertionsScopedToCurrentPid':True,
        'frameTimeBenefitProven':False,'physicalRedmiTest':False},indent=2)+'\n')
    assert not required or observed, 'Candidate did not execute the immutable native border draw API'
    assert not swap_required or swap_observed, 'Candidate did not successfully request the compiled EGL swap mode'
    assert not consumer_required or consumer_observed, 'Candidate did not execute the guarded TextureView consumer path'
    assert not consumer_required or 'updateAndRelease() failed' not in logs, 'Producer is still making the rejected per-frame consumer call'
