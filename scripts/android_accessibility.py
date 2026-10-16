"""Bound transient UIAutomator failures without concealing game death.

The game PID and fatal logs must remain valid; callers still find and tap real
controls in the returned hierarchy. Frame/paint/interaction gates are unchanged.
"""
import re
import subprocess
import time
import xml.etree.ElementTree as ET


class HierarchyNotWritten(RuntimeError):
    """UIAutomator returned without publishing a new hierarchy."""


def find_enabled_control(root, label):
    """An enabled TextView child does not make its disabled Pressable tappable."""
    if root.get('enabled') == 'false' or root.get('visible-to-user') == 'false':
        return None
    if root.get('text') == label or root.get('content-desc') == label:
        return root
    for child in root:
        found = find_enabled_control(child, label)
        if found is not None:
            return found
    return None


def assert_no_game_fatal(logs, game_pid):
    """Exclude only the observed external UiAutomation bad-fd crash.

    Unknown fatals, game crashes and JS errors still fail. The untouched raw
    log is kept; unchanged game PID is separately required at every retry.
    """
    lines=logs.splitlines()
    for i,line in enumerate(lines):
        if not re.search(r'FATAL EXCEPTION|Fatal signal|JavascriptException',line):continue
        block='\n'.join(lines[i:i+16])
        pid=re.search(r'AndroidRuntime: PID: (\d+)',block)
        external=('FATAL EXCEPTION: UiAutomation' in line and pid and
                  pid[1] not in game_pid.split() and
                  'java.lang.RuntimeException: Bad file descriptor' in block and
                  'android.accessibilityservice.IAccessibilityServiceConnection' in block)
        assert external, 'Fatal error in game/unknown process: '+line


def dump_hierarchy(adb, package, output, name, device_path, pause=time.sleep):
    expected_pid = adb('shell', 'pidof', package).strip()
    assert expected_pid, 'Game is not running before accessibility lookup: ' + name
    for attempt in range(3):
        try:
            # A successful process exit can still report "could not get idle
            # state". Never read the preceding lookup's XML in that case.
            adb('shell', 'rm', '-f', device_path, timeout=10)
            result = adb('shell', 'uiautomator', 'dump', device_path, timeout=20)
            (output / (name + '-dump-' + str(attempt) + '.txt')).write_text(result)
            if 'dumped to: ' + device_path not in result:
                raise HierarchyNotWritten(result)
            xml = adb('shell', 'cat', device_path, timeout=10)
            (output / (name + '.xml')).write_text(xml)
            root = ET.fromstring(xml)
            # The disposable SDK launcher can ANR during app restoration. This
            # lookup runs outside timed gestures. Only its exact external
            # dialog may be closed; a Dominion/unknown ANR remains a failure.
            anr = [n for n in root.iter('node') if n.get('resource-id') == 'android:id/aerr_close']
            if anr:
                titles = [n for n in root.iter('node') if n.get('resource-id') == 'android:id/alertTitle']
                assert len(titles) == 1 and titles[0].get('package') == 'android' and titles[0].get('text') == "Quickstep isn't responding", 'Game/unknown ANR during accessibility lookup: ' + name
                button = anr[0]
                assert len(anr) == 1 and button.get('package') == 'android' and button.get('text') == 'Close app' and button.get('clickable') == 'true' and button.get('enabled') == 'true', 'Unexpected external ANR close control'
                bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', button.get('bounds', ''))
                assert bounds, 'Invalid external ANR close bounds'
                x1,y1,x2,y2 = map(int,bounds.groups())
                assert x2 > x1 and y2 > y1, 'Empty external ANR close bounds'
                (output / (name + '-external-quickstep-anr-' + str(attempt) + '.xml')).write_text(xml)
                assert adb('shell', 'pidof', package).strip() == expected_pid, 'Game died/restarted during accessibility lookup: ' + name
                logs = adb('logcat', '-d')
                (output / (name + '-external-quickstep-anr-' + str(attempt) + '.txt')).write_text(logs)
                assert_no_game_fatal(logs, expected_pid)
                assert attempt < 2, 'Persistent external Quickstep ANR: ' + name
                adb('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2, timeout=10)
                print('Closed verified external Quickstep ANR outside timed gestures:', name, flush=True)
                pause(2)
                assert adb('shell', 'pidof', package).strip() == expected_pid, 'Game died/restarted during accessibility lookup: ' + name
                continue
            return root
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, HierarchyNotWritten) as error:
            if isinstance(error, subprocess.CalledProcessError) and error.returncode != 137:
                raise
            assert adb('shell', 'pidof', package).strip() == expected_pid, 'Game died/restarted during accessibility lookup: ' + name
            logs = adb('logcat', '-d')
            (output / (name + '-accessibility-retry-' + str(attempt) + '.txt')).write_text(logs)
            assert_no_game_fatal(logs, expected_pid)
            if attempt == 2:
                raise
            print('Retry transient accessibility lookup:', name, attempt + 1, type(error).__name__, flush=True)
            pause(2)
