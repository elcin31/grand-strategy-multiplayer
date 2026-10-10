"""Bound transient UIAutomator failures without concealing game death.

The game PID and fatal logs must remain valid; callers still find and tap real
controls in the returned hierarchy. Frame/paint/interaction gates are unchanged.
"""
import re
import subprocess
import time
import xml.etree.ElementTree as ET


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
            adb('shell', 'uiautomator', 'dump', device_path, timeout=20)
            xml = adb('shell', 'cat', device_path, timeout=10)
            (output / (name + '.xml')).write_text(xml)
            return ET.fromstring(xml)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
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
