import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('android_accessibility', Path(__file__).parents[1] / 'scripts/android_accessibility.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AccessibilityTest(unittest.TestCase):
    def exercise(self, failures, pid='42', logs=''):
        calls = []
        def adb(*args, **kwargs):
            calls.append(args)
            if args[:2] == ('shell', 'pidof'):
                return '42' if len(calls) == 1 else pid
            if args[:2] == ('shell', 'uiautomator') and failures:
                raise failures.pop(0)
            if args[:2] == ('shell', 'cat'):
                return '<hierarchy><node content-desc="Обзор мира" /></hierarchy>'
            if args[0] == 'logcat':
                return logs
            return ''
        with tempfile.TemporaryDirectory() as directory:
            root = module.dump_hierarchy(adb, 'app', Path(directory), 'camera', '/sdcard/camera.xml', pause=lambda _: None)
            self.assertEqual(root[0].get('content-desc'), 'Обзор мира')
        return calls

    def test_transient_kill_retries_and_returns_real_hierarchy(self):
        calls = self.exercise([subprocess.CalledProcessError(137, 'uiautomator')])
        self.assertEqual(sum(c[:2] == ('shell', 'uiautomator') for c in calls), 2)

    def test_timeout_is_bounded_and_can_recover(self):
        self.exercise([subprocess.TimeoutExpired('uiautomator', 20)])

    def test_process_restart_or_fatal_log_cannot_pass(self):
        with self.assertRaisesRegex(AssertionError, 'died/restarted'):
            self.exercise([subprocess.CalledProcessError(137, 'uiautomator')], pid='43')
        with self.assertRaisesRegex(AssertionError, 'Fatal error'):
            self.exercise([subprocess.CalledProcessError(137, 'uiautomator')], logs='FATAL EXCEPTION')

    def test_persistent_kill_is_not_silently_accepted(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.exercise([subprocess.CalledProcessError(137, 'uiautomator') for _ in range(3)])

    def test_other_failure_is_not_treated_as_optional_diagnostics(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.exercise([subprocess.CalledProcessError(1, 'uiautomator')])

    def test_exact_external_automation_crash_can_retry_but_game_and_unknown_crashes_fail(self):
        log='E AndroidRuntime: FATAL EXCEPTION: UiAutomation\nE AndroidRuntime: PID: 3975\nE AndroidRuntime: java.lang.RuntimeException: Bad file descriptor\nE AndroidRuntime: at android.accessibilityservice.IAccessibilityServiceConnection$Stub$Proxy.findAccessibilityNodeInfoByAccessibilityId'
        self.exercise([subprocess.CalledProcessError(137,'uiautomator')],logs=log)
        for broken in [log.replace('3975','42'),log.replace('Bad file descriptor','NullPointerException'),log.replace('UiAutomation','main'),log+'\nFatal signal 11',log+'\nJavascriptException: missing module']:
            with self.assertRaisesRegex(AssertionError,'Fatal error'):
                self.exercise([subprocess.CalledProcessError(137,'uiautomator')],logs=broken)
