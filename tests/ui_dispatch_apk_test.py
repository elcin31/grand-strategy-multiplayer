import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from android_immutable_borders import UI_DISPATCH_MARKER,verify_border_api
spec=importlib.util.spec_from_file_location('ui_dispatch_binary',Path(__file__).resolve().parents[1]/'scripts/verify-ui-dispatch-apk.py')
binary=importlib.util.module_from_spec(spec);spec.loader.exec_module(binary)

class UiDispatchApkTest(unittest.TestCase):
    def apk(self,root,enabled):
        file=Path(root)/'fixture.apk'
        with zipfile.ZipFile(file,'w') as archive:
            archive.writestr('assets/index.android.bundle','unchanged original map bundle')
            archive.writestr('classes.dex',UI_DISPATCH_MARKER if enabled else 'original Java')
        return file

    def test_exact_java_mode_must_match_packaged_dex(self):
        with tempfile.TemporaryDirectory() as root:
            for enabled in [False,True]:
                apk=self.apk(root,enabled)
                self.assertEqual(binary.verify(apk,enabled),enabled)
                with self.assertRaises(AssertionError):binary.verify(apk,not enabled)

    def test_dead_process_log_cannot_satisfy_candidate_execution(self):
        with tempfile.TemporaryDirectory() as root:
            def adb(*args):
                if args[:2]==('shell','pidof'):return '4836'
                return '4836 new app with no posted callback' if '--pid=4836' in args else '2224 '+UI_DISPATCH_MARKER
            destination=Path(root)/'startup'
            with self.assertRaises(AssertionError):verify_border_api(self.apk(root,True),adb,destination)
            self.assertIn('2224',destination.with_suffix('.log').read_text())
            self.assertNotIn(UI_DISPATCH_MARKER,destination.with_suffix('.process.log').read_text())

    def test_current_process_execution_is_required_and_reported(self):
        with tempfile.TemporaryDirectory() as root:
            def adb(*args):return '4836' if args[:2]==('shell','pidof') else '4836 '+UI_DISPATCH_MARKER
            destination=Path(root)/'startup'
            verify_border_api(self.apk(root,True),adb,destination)
            proof=json.loads(destination.with_suffix('.json').read_text())
            self.assertTrue(proof['postedUiDispatchRequired'])
            self.assertTrue(proof['postedUiDispatchObserved'])
            self.assertEqual(proof['nativeGamePid'],4836)
            self.assertFalse(proof['frameTimeBenefitProven'])

if __name__=='__main__':unittest.main()
