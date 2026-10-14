import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from android_immutable_borders import verify_border_api
spec=importlib.util.spec_from_file_location('presentation',ROOT/'scripts/verify-presentation-apk.py')
binary=importlib.util.module_from_spec(spec);spec.loader.exec_module(binary)


class PresentationBinaryTest(unittest.TestCase):
    def apk(self,directory,enabled=True,legacy_abi=None):
        apk=Path(directory)/'fixture.apk'
        with zipfile.ZipFile(apk,'w') as z:
            z.writestr('assets/index.android.bundle','original map geometry')
            for abi in binary.ABIS:
                payload=(binary.MARKER+b'\0eglSwapInterval\0DOMINION_PRESENTATION swap-zero-unavailable') if enabled and abi!=legacy_abi else b'original native window'
                z.writestr(f'lib/{abi}/librnskia.so',payload)
        return apk

    def test_native_mode_must_match_in_all_four_abis(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(binary.verify(self.apk(d),True),binary.ABIS)
            for abi in binary.ABIS:
                with self.assertRaises(AssertionError):binary.verify(self.apk(d,legacy_abi=abi),True)
            with self.assertRaises(AssertionError):binary.verify(self.apk(d),False)
            self.assertEqual(binary.verify(self.apk(d,enabled=False),False),binary.ABIS)

    def test_compiled_option_requires_successful_native_startup_request(self):
        with tempfile.TemporaryDirectory() as d:
            apk=self.apk(d);destination=Path(d)/'startup'
            for logs in ['map loaded','DOMINION_PRESENTATION swap-zero-unavailable']:
                with self.assertRaises(AssertionError):verify_border_api(apk,lambda *_:logs,destination)
            verify_border_api(apk,lambda *_:binary.MARKER.decode(),destination)
            self.assertIn('"nativeSwapRequestObserved": true',destination.with_suffix('.json').read_text())


if __name__=='__main__':unittest.main()
