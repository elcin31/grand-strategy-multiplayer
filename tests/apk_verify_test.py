import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

class ApkVerification(unittest.TestCase):
    def check(self, libs, bundle=True):
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory) / 'test.apk'
            with zipfile.ZipFile(apk, 'w') as archive:
                if bundle: archive.writestr('assets/index.android.bundle', b'x' * 100001)
                for lib in libs: archive.writestr('lib/arm64-v8a/' + lib, b'fixture')
            return subprocess.run([sys.executable, 'scripts/verify-apk.py', str(apk)], capture_output=True, text=True).returncode
    def test_both_supported_hermes_packagings(self):
        for hermes in ['libhermes.so', 'libhermesvm.so']:
            self.assertEqual(self.check(['librnskia.so', hermes]), 0)
    def test_missing_bundle_or_runtime_is_rejected(self):
        self.assertNotEqual(self.check(['librnskia.so','libhermesvm.so'], bundle=False), 0)
        self.assertNotEqual(self.check(['librnskia.so','libhermestooling.so']), 0)
        self.assertNotEqual(self.check(['libhermesvm.so']), 0)

if __name__ == '__main__': unittest.main()
