import importlib.util
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

spec = importlib.util.spec_from_file_location('android_accessibility', Path(__file__).parents[1] / 'scripts/android_accessibility.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AccessibilityTest(unittest.TestCase):
    def quickstep_lookup(self, title="Quickstep isn't responding", pid='42', logs='', persistent=False):
        calls=[]
        attempts=0
        dialog='<hierarchy><node package="android" resource-id="android:id/alertTitle" text="'+title+'" /><node package="android" resource-id="android:id/aerr_close" text="Close app" enabled="true" clickable="true" bounds="[266,282][1014,408]" /></hierarchy>'
        def adb(*args, **kwargs):
            nonlocal attempts
            calls.append(args)
            if args[:2] == ('shell','pidof'):return '42' if len(calls)==1 else pid
            if args[:2] == ('shell','uiautomator'):
                attempts+=1
                return 'UI hierchary dumped to: /sdcard/camera.xml'
            if args[:2] == ('shell','cat'):
                return dialog if attempts==1 or persistent else '<hierarchy><node content-desc="Обзор мира" /></hierarchy>'
            if args[0]=='logcat':return logs
            return ''
        with tempfile.TemporaryDirectory() as directory:
            root=module.dump_hierarchy(adb,'app',Path(directory),'camera','/sdcard/camera.xml',pause=lambda _:None)
            self.assertEqual(root[0].get('content-desc'),'Обзор мира')
            self.assertEqual((Path(directory)/'camera-external-quickstep-anr-0.xml').read_text(),dialog)
            self.assertEqual((Path(directory)/'camera-external-quickstep-anr-0.txt').read_text(),logs)
        return calls

    def test_exact_external_quickstep_anr_recovers_with_unchanged_game_and_raw_evidence(self):
        calls=self.quickstep_lookup()
        self.assertEqual(sum(c[:2]==('shell','uiautomator') for c in calls),2)
        self.assertEqual([c for c in calls if c[:3]==('shell','input','tap')],[('shell','input','tap',640,345)])

    def test_quickstep_recovery_cannot_hide_game_anr_restart_fatal_or_persistent_dialog(self):
        for title in ["Dominion isn't responding", "Other app isn't responding"]:
            with self.assertRaisesRegex(AssertionError,'Game/unknown ANR'):self.quickstep_lookup(title=title)
        with self.assertRaisesRegex(AssertionError,'died/restarted'):self.quickstep_lookup(pid='43')
        with self.assertRaisesRegex(AssertionError,'Fatal error'):self.quickstep_lookup(logs='FATAL EXCEPTION: main')
        with self.assertRaisesRegex(AssertionError,'Persistent external Quickstep ANR'):self.quickstep_lookup(persistent=True)

    def test_disabled_pressable_cannot_be_tapped_through_its_enabled_text_child(self):
        root=ET.fromstring('<hierarchy><node content-desc="Продолжить" enabled="false"><node text="Продолжить" enabled="true" /></node></hierarchy>')
        self.assertIsNone(module.find_enabled_control(root,'Продолжить'))
        root[0].set('enabled','true')
        self.assertIs(module.find_enabled_control(root,'Продолжить'),root[0])
        root[0].set('visible-to-user','false')
        self.assertIsNone(module.find_enabled_control(root,'Продолжить'))

    def exercise(self, failures, pid='42', logs=''):
        calls = []
        def adb(*args, **kwargs):
            calls.append(args)
            if args[:2] == ('shell', 'pidof'):
                return '42' if len(calls) == 1 else pid
            if args[:2] == ('shell', 'uiautomator') and failures:
                raise failures.pop(0)
            if args[:2] == ('shell', 'uiautomator'):
                return 'UI hierchary dumped to: /sdcard/camera.xml'
            if args[:2] == ('shell', 'cat'):
                return '<hierarchy><node content-desc="Обзор мира" /></hierarchy>'
            if args[0] == 'logcat':
                return logs
            return ''
        with tempfile.TemporaryDirectory() as directory:
            root = module.dump_hierarchy(adb, 'app', Path(directory), 'camera', '/sdcard/camera.xml', pause=lambda _: None)
            self.assertEqual(root[0].get('content-desc'), 'Обзор мира')
        return calls

    def test_zero_exit_without_new_dump_never_reads_previous_benchmark_xml(self):
        calls=[]
        attempts=0
        def adb(*args,**kwargs):
            nonlocal attempts
            calls.append(args)
            if args[:2]==('shell','pidof'):return '42'
            if args[:2]==('shell','uiautomator'):
                attempts+=1
                return 'ERROR: could not get idle state.' if attempts==1 else 'UI hierchary dumped to: /sdcard/camera.xml'
            if args[:2]==('shell','cat'):
                return '<hierarchy><node text="Benchmark ticks: 12 · OK" /></hierarchy>'
            return ''
        with tempfile.TemporaryDirectory() as directory:
            root=module.dump_hierarchy(adb,'app',Path(directory),'benchmark','/sdcard/camera.xml',pause=lambda _:None)
            self.assertEqual(root[0].get('text'),'Benchmark ticks: 12 · OK')
            self.assertIn('could not get idle state', (Path(directory)/'benchmark-dump-0.txt').read_text())
        self.assertEqual(sum(c[:2]==('shell','cat') for c in calls),1)
        self.assertEqual(sum(c[:3]==('shell','rm','-f') for c in calls),2)

    def test_missing_dump_is_bounded_and_still_checks_game_fatals(self):
        def adb(*args,**kwargs):
            if args[:2]==('shell','pidof'):return '42'
            if args[:2]==('shell','uiautomator'):return 'ERROR: could not get idle state.'
            if args[:2]==('shell','cat'):self.fail('Must not read a stale hierarchy')
            return ''
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(module.HierarchyNotWritten):
                module.dump_hierarchy(adb,'app',Path(directory),'benchmark','/sdcard/camera.xml',pause=lambda _:None)
        def fatal_adb(*args,**kwargs):
            return 'JavascriptException: broken campaign' if args[0]=='logcat' else adb(*args,**kwargs)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(AssertionError,'Fatal error'):
                module.dump_hierarchy(fatal_adb,'app',Path(directory),'benchmark','/sdcard/camera.xml',pause=lambda _:None)

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

    def test_actual_native_process4053_bad_fd_does_not_hide_game2201_failure(self):
        logs=(Path(__file__).parent/'fixtures/native_uiautomator_bad_fd.txt').read_text()
        module.assert_no_game_fatal(logs,'2201')
        self.exercise([subprocess.CalledProcessError(137,'uiautomator')],logs=logs)
        with self.assertRaisesRegex(AssertionError,'Fatal error'):
            module.assert_no_game_fatal(logs,'4053')
        for fatal in ['FATAL EXCEPTION: main','Fatal signal 11','JavascriptException: broken campaign']:
            with self.assertRaisesRegex(AssertionError,'Fatal error'):
                module.assert_no_game_fatal(logs+'\n'+fatal,'2201')
