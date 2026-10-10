"""Bound transient UIAutomator failures without concealing game death.

The game PID and fatal logs must remain valid; callers still find and tap real
controls in the returned hierarchy. Frame/paint/interaction gates are unchanged.
"""
import re
import subprocess
import time
import xml.etree.ElementTree as ET


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
            assert not re.search(r'FATAL EXCEPTION|Fatal signal|JavascriptException', logs), 'Fatal error during accessibility lookup: ' + name
            if attempt == 2:
                raise
            print('Retry transient accessibility lookup:', name, attempt + 1, type(error).__name__, flush=True)
            pause(2)
