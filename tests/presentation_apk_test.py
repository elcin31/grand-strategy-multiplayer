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
    def adb(self,logs):
        return lambda *args:'1234' if args[:2]==('shell','pidof') else logs
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
                with self.assertRaises(AssertionError):verify_border_api(apk,self.adb(logs),destination)
            verify_border_api(apk,self.adb(binary.MARKER.decode()),destination)
            self.assertIn('"nativeSwapRequestObserved": true',destination.with_suffix('.json').read_text())

    def test_consumer_fix_requires_all_abis_and_no_old_producer_warning(self):
        with tempfile.TemporaryDirectory() as d:
            apk=Path(d)/'consumer.apk'
            with zipfile.ZipFile(apk,'w') as z:
                z.writestr('assets/index.android.bundle','original map geometry')
                for abi in binary.ABIS:z.writestr(f'lib/{abi}/librnskia.so',binary.CONSUMER_MARKER)
            self.assertEqual(binary.verify(apk,False,True),binary.ABIS)
            with self.assertRaises(AssertionError):binary.verify(apk,False,False)
            destination=Path(d)/'consumer-startup'
            with self.assertRaises(AssertionError):verify_border_api(apk,self.adb('map loaded'),destination)
            with self.assertRaises(AssertionError):verify_border_api(apk,self.adb(binary.CONSUMER_MARKER.decode()+' updateAndRelease() failed'),destination)
            verify_border_api(apk,self.adb(binary.CONSUMER_MARKER.decode()),destination)

    def test_upgrade_retains_old_logs_without_attributing_dead_baseline_pid_to_candidate(self):
        with tempfile.TemporaryDirectory() as d:
            apk=Path(d)/'consumer.apk'
            with zipfile.ZipFile(apk,'w') as z:
                z.writestr('assets/index.android.bundle','original map')
                for abi in binary.ABIS:z.writestr(f'lib/{abi}/librnskia.so',binary.CONSUMER_MARKER)
            old='10-14 09:17:40.641  2224  2224 I RNSkia : updateAndRelease() failed'
            live='10-14 09:18:08.443  4836  4836 I RNSkia : '+binary.CONSUMER_MARKER.decode()
            def adb(*args):
                if args[:2]==('shell','pidof'):return '4836'
                if args==('logcat','-d','--pid=4836'):return live
                self.assertEqual(args,('logcat','-d'));return old+'\n'+live
            dest=Path(d)/'startup';verify_border_api(apk,adb,dest)
            self.assertIn(old,dest.with_suffix('.log').read_text())
            self.assertNotIn(old,dest.with_suffix('.process.log').read_text())
            self.assertIn('"nativeGamePid": 4836',dest.with_suffix('.json').read_text())


if __name__=='__main__':unittest.main()
