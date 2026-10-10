import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from android_fixture import root_test_device


class CameraFixtureTest(unittest.TestCase):
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
