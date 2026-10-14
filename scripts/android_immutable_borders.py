"""Require evidence of the actual native draw API, outside timed captures."""
import json
import zipfile
from pathlib import Path

MARKER='DOMINION_BORDER_PATH immutable-native-v1'
UI_DISPATCH_MARKER='DOMINION_UI_DISPATCH posted-main-loop'
PACKAGE='com.elcin31.grandstrategymultiplayer'

def verify_border_api(apk,adb,destination):
    with zipfile.ZipFile(apk) as archive:
        required=MARKER.encode() in archive.read('assets/index.android.bundle')
        dex=[n for n in archive.namelist() if n.startswith('classes') and n.endswith('.dex') and '/' not in n]
        ui_dispatch_required=any(UI_DISPATCH_MARKER.encode() in archive.read(n) for n in dex)
    pid=adb('shell','pidof',PACKAGE).strip()
    assert pid.isascii() and pid.isdigit() and int(pid)>0, 'Missing/ambiguous live native game PID'
    raw_logs=adb('logcat','-d')
    logs=adb('logcat','-d','--pid='+pid)
    observed=MARKER in logs
    ui_dispatch_observed=UI_DISPATCH_MARKER in logs
    destination=Path(destination)
    destination.with_suffix('.log').write_text(raw_logs)
    destination.with_suffix('.process.log').write_text(logs)
    destination.with_suffix('.json').write_text(json.dumps({
        'immutableNativeApiRequired':required,'successfulNativeBorderDrawObserved':observed,
        'postedUiDispatchRequired':ui_dispatch_required,'postedUiDispatchObserved':ui_dispatch_observed,
        'nativeGamePid':int(pid),'nativeAssertionsScopedToCurrentPid':True,
        'frameTimeBenefitProven':False,'physicalRedmiTest':False},indent=2)+'\n')
    assert not required or observed, 'Candidate did not execute the immutable native border draw API'
    assert not ui_dispatch_required or ui_dispatch_observed, 'Candidate did not execute compiled posted UI dispatch'
