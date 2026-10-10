"""Root only the ephemeral QA emulator, with proof after adbd restarts."""
import subprocess
import time


def root_test_device(adb, diagnostic):
    lines = []
    def record(value):
        lines.append(str(value))
        diagnostic.write_text('\n'.join(lines) + '\n')
    for name in ['ro.build.type', 'ro.debuggable', 'ro.build.fingerprint']:
        record(name + '=' + adb('shell', 'getprop', name, timeout=10).strip())
    for attempt in range(3):
        try:
            record('root attempt ' + str(attempt + 1) + ': ' + adb('root', timeout=15).strip())
        except subprocess.CalledProcessError as error:
            # A transport can disconnect while adbd changes UID. The observed
            # UID below is mandatory; a failed command never grants access.
            record('root command failed: ' + str(error.output))
        try:
            adb('wait-for-device', timeout=30)
            uid = adb('shell', 'id', '-u', timeout=10).strip()
            record('verified uid=' + uid)
            if uid == '0':
                return
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
            record('root verification failed: ' + str(error))
        if attempt < 2:
            time.sleep(1)
    raise AssertionError('Fixed-save QA requires verified emulator UID 0; see ' + str(diagnostic))
