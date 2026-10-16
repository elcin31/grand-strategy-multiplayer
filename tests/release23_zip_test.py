import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('release23_zip', Path(__file__).parents[1] / 'scripts/make-release23-zip.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseZipTest(unittest.TestCase):
    def fixture(self, root):
        payload = root / 'payload'
        (payload / 'reports').mkdir(parents=True)
        (payload / 'sources').mkdir()
        (payload / 'Dominion-test.apk').write_bytes(b'test binary')
        (payload / 'README.txt').write_text('Test payload, not a real release.')
        (payload / 'sources/Dominion-source.tar').write_bytes(b'test source')
        report = payload / 'reports/qa.json'
        report.write_text('{"fixture":true}\n')
        manifest = {
            'repository': 'elcin31/grand-strategy-multiplayer', 'status': 'verified-playtest',
            'dominion23Complete': True, 'compiledSourceSha': 'a' * 40,
            'validationSourceSha': 'b' * 40, 'sourceCommitEpoch': 1792120000,
            'mandatoryChecks': {key: True for key in release.REQUIRED},
            'proofs': {key: {'path': 'reports/qa.json', 'sha256': release.sha256(report)} for key in release.REQUIRED},
            'apk': {'filename': 'Dominion-test.apk', 'sha256': release.sha256(payload / 'Dominion-test.apk'),
                    'package': 'com.elcin31.grandstrategymultiplayer',
                    'certificateSha256': 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c'},
        }
        values = {
            'cameraNativeRegression': {'metricGate': 'pass', 'regressionsOver10Percent': [], 'comparisonKind': 'candidate-vs-optimized-baseline', 'candidateApkSha256': manifest['apk']['sha256'], 'baselineApkSha256': '7df9e78cdf9c5293cdb8a0bf72363c96de5e85586c9096b16393cddf25986764', 'memoryRegressionOver32MiB': False},
            'daily10000': {'mode': 'daily', 'steps': 10000, 'restores': 10, 'sourceClean': True, 'sourceSha': 'a' * 40},
            'monthly10000': {'mode': 'monthly', 'steps': 10000, 'restores': 10, 'sourceClean': True, 'sourceSha': 'a' * 40},
            'newGameplayOnAndroid': {'passed': True, 'apkSha256': manifest['apk']['sha256']},
            'multiplayerNative': {'apkSha256': manifest['apk']['sha256'], 'members': 2, **{key: True for key in ['nativeCreate', 'menuReconnect', 'processReconnect', 'realHostMigration', 'nativeOwnerReturn', 'rebootReconnect', 'sameNativeUidAndSessionKeys', 'onceOnlyFocusPaymentRetained']}},
            'multiplayerRealHttp': {'passed': True, 'projectId': 'dfjsnjxnyjspwugjguhq', 'realHttpClients': 3, 'qaCleanup': {'completed': True, 'remainingRooms': 0, 'remainingPlayers': 0, 'remainingReceipts': 0}},
        }
        for key, value in values.items():
            path = payload / 'reports' / (key + '.json')
            path.write_text(json.dumps(value))
            manifest['proofs'][key] = {'path': 'reports/' + path.name, 'sha256': release.sha256(path)}
        (payload / 'MANIFEST.json').write_text(json.dumps(manifest))
        return payload, manifest

    def test_same_payload_produces_identical_zip_with_all_file_checksums(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            payload, _ = self.fixture(root)
            first = release.package(payload, root / 'first.zip')
            second = release.package(payload, root / 'second.zip')
            self.assertEqual(first['sha256'], second['sha256'])
            with zipfile.ZipFile(root / 'first.zip') as archive:
                checksums = archive.read('SHA256SUMS').decode().splitlines()
                self.assertEqual(len(checksums), len(archive.namelist()) - 1)
                for row in checksums:
                    digest, name = row.split('  ', 1)
                    self.assertEqual(digest, release.hashlib.sha256(archive.read(name)).hexdigest())

    def test_failed_gate_or_modified_binary_and_proof_cannot_be_packaged(self):
        for broken in ['gate', 'binary', 'proof']:
            with self.subTest(broken=broken), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                payload, manifest = self.fixture(root)
                if broken == 'gate':
                    manifest['mandatoryChecks']['monthly10000'] = False
                    (payload / 'MANIFEST.json').write_text(json.dumps(manifest))
                elif broken == 'binary':
                    (payload / 'Dominion-test.apk').write_bytes(b'wrong APK')
                else:
                    (payload / 'reports/qa.json').write_text('{"changed":true}')
                with self.assertRaises(AssertionError):
                    release.package(payload, root / 'failed.zip')
                self.assertFalse((root / 'failed.zip').exists())

    def test_raw_session_and_uncurated_files_are_rejected(self):
        for extra in ['session.json', 'reports/session.json', 'reports/.secret']:
            with self.subTest(extra=extra), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                payload, _ = self.fixture(root)
                (payload / extra).write_text('not for release')
                with self.assertRaises(AssertionError):
                    release.package(payload, root / 'failed.zip')
                self.assertFalse((root / 'failed.zip').exists())

    def test_real_rejected_camera_cannot_be_overridden_by_a_green_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            payload, manifest = self.fixture(root)
            report = Path(__file__).parents[1] / 'DOMINION_23_PLAYTEST2_CAMERA_REJECTED.json'
            destination = payload / manifest['proofs']['cameraNativeRegression']['path']
            destination.write_bytes(report.read_bytes())
            manifest['proofs']['cameraNativeRegression']['sha256'] = release.sha256(destination)
            (payload / 'MANIFEST.json').write_text(json.dumps(manifest))
            with self.assertRaises(AssertionError):
                release.package(payload, root / 'failed.zip')
            self.assertFalse((root / 'failed.zip').exists())
