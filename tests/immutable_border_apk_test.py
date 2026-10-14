import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from android_immutable_borders import MARKER,verify_border_api
spec=importlib.util.spec_from_file_location('border_binary',Path(__file__).resolve().parents[1]/'scripts/verify-immutable-borders-apk.py')
binary=importlib.util.module_from_spec(spec);spec.loader.exec_module(binary)

class ImmutableBorderBinaryTest(unittest.TestCase):
    def adb(self,logs):
        return lambda *args:'1234' if args[:2]==('shell','pidof') else logs
    def apk(self,directory,missing_abi=None,missing_symbol=None,modern=True):
        apk=Path(directory)/'fixture.apk'
        with zipfile.ZipFile(apk,'w') as z:
            z.writestr('assets/index.android.bundle',MARKER if modern else 'original hotfix bundle')
            for abi in binary.ABIS:
                if abi!=missing_abi:
                    z.writestr(f'lib/{abi}/librnskia.so',b'\0'.join(s for s in binary.SYMBOLS if s!=missing_symbol))
        return apk

    def test_all_four_native_abis_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(binary.verify(self.apk(directory)),binary.ABIS)
            for abi in binary.ABIS:
                with self.assertRaises(KeyError):binary.verify(self.apk(directory,missing_abi=abi))

    def test_js_only_or_incomplete_native_binding_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            for symbol in binary.SYMBOLS:
                with self.assertRaises(AssertionError):binary.verify(self.apk(directory,missing_symbol=symbol))
            with self.assertRaises(AssertionError):binary.verify(self.apk(directory,modern=False))

    def test_candidate_must_execute_native_api_not_merely_package_it(self):
        with tempfile.TemporaryDirectory() as directory:
            apk=self.apk(directory);dest=Path(directory)/'startup'
            with self.assertRaises(AssertionError):verify_border_api(apk,self.adb('map loaded'),dest)
            verify_border_api(apk,self.adb(MARKER),dest)
            self.assertIn('"successfulNativeBorderDrawObserved": true',dest.with_suffix('.json').read_text())

    def test_exact_legacy_baseline_does_not_require_candidate_api(self):
        with tempfile.TemporaryDirectory() as directory:
            verify_border_api(self.apk(directory,modern=False),self.adb('map loaded'),Path(directory)/'startup')

    def test_restored_renderer_rejects_accidental_experiment_bundling(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(AssertionError):binary.verify_original(self.apk(directory))
            with self.assertRaises(AssertionError):binary.verify_original(self.apk(directory,modern=False))
            apk=Path(directory)/'original.apk'
            with zipfile.ZipFile(apk,'w') as z:
                z.writestr('assets/index.android.bundle','original renderer')
                for abi in binary.ABIS:z.writestr(f'lib/{abi}/librnskia.so','original native path API')
            self.assertEqual(binary.verify_original(apk),binary.ABIS)

if __name__=='__main__':unittest.main()
