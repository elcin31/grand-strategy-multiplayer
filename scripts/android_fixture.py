"""Root only the ephemeral QA emulator, with proof after adbd restarts."""
import subprocess
import time
import re


def fresh_camera_install(adb, package, apk):
    """Camera QA already resets saves; fresh installs also support version10→9."""
    installed = adb('shell', 'pm', 'list', 'packages', package).splitlines()
    if 'package:'+package in installed:
        assert adb('uninstall', package, timeout=60).strip() == 'Success', 'Camera test uninstall failed'
    assert adb('install', apk, timeout=180).strip().endswith('Success'), 'Camera test install failed'
    assert adb('shell', 'pm', 'clear', package).strip() == 'Success', 'Camera fixture reset failed'


def label_test_fixture(adb, app_directory, fixture_directory, fixture_file):
    """Keep enforcing SELinux; copy the newly installed app's actual MLS label."""
    assert fixture_directory == app_directory+'/files/dominion-campaigns'
    assert fixture_file.startswith(fixture_directory+'/') and '/' not in fixture_file[len(fixture_directory)+1:]
    context = adb('shell', 'ls', '-Zd', app_directory).split()[0]
    assert re.fullmatch(r'u:object_r:app_data_file:s0(?::c\d+(?:,c\d+)*)?', context), 'No actual installed app data label'
    # restorecon can use stale package-info categories after a version switch.
    # The PackageManager-created app root has the current UID's actual label.
    adb('shell', 'chcon', '-R', context, fixture_directory)
    observed = adb('shell', 'ls', '-Zd', fixture_file).split()[0]
    assert observed == context, 'Copied camera fixture retains another installation label'
    return context


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
