import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from android_fixture import root_test_device, fresh_camera_install


class CameraFixtureTest(unittest.TestCase):
    def test_comparison_replaces_newer_version_only_after_successful_isolated_uninstall(self):
        calls=[]
        def adb(*args,**kwargs):
            calls.append(args)
            if args[:4]==('shell','pm','list','packages'):return 'package:qa.camera\n'
            return 'Success\n'
        fresh_camera_install(adb,'qa.camera','baseline-v9.apk')
        self.assertEqual(calls,[('shell','pm','list','packages','qa.camera'),
            ('uninstall','qa.camera'),('install','baseline-v9.apk'),('shell','pm','clear','qa.camera')])
        calls.clear()
        def failed(*args,**kwargs):
            calls.append(args)
            return 'package:qa.camera\n' if args[:4]==('shell','pm','list','packages') else 'Failure\n'
        with self.assertRaisesRegex(AssertionError,'uninstall failed'):
            fresh_camera_install(failed,'qa.camera','baseline-v9.apk')
        self.assertFalse(any(c[0]=='install' for c in calls))

    def run_root(self, uid, root_failure=False):
        def adb(*args, **kwargs):
            if args == ('root',) and root_failure:
                raise subprocess.CalledProcessError(1, ['adb', 'root'], output='connection closed')
            if args[:2] == ('shell', 'getprop'):
                return 'userdebug\n'
            if args == ('shell', 'id', '-u'):
                return uid + '\n'
            return 'restarting adbd as root\n'
        with tempfile.TemporaryDirectory() as directory, patch('android_fixture.time.sleep'):
            path = Path(directory) / 'root.txt'
            if uid != '0':
                with self.assertRaisesRegex(AssertionError, 'verified emulator UID 0'):
                    root_test_device(adb, path)
            else:
                root_test_device(adb, path)
            return path.read_text()

    def test_restarted_root_transport_is_accepted_only_with_actual_uid_zero(self):
        evidence = self.run_root('0', root_failure=True)
        self.assertIn('root command failed', evidence)
        self.assertIn('verified uid=0', evidence)

    def test_non_root_image_is_rejected_even_when_root_command_succeeds(self):
        evidence = self.run_root('2000')
        self.assertEqual(evidence.count('verified uid=2000'), 3)

    def test_normal_root_records_image_and_observed_uid(self):
        evidence = self.run_root('0')
        self.assertIn('ro.build.type=userdebug', evidence)
        self.assertIn('verified uid=0', evidence)
