"""Reject publication unless the exact standalone binary has complete actual QA."""
import math
import re
import json
from pathlib import Path
from native_upgrade_validation import PACKAGE, BACKUP_SUFFIXES

REPOSITORY = 'elcin31/grand-strategy-multiplayer'
REQUIRED_JOBS = {'build-apk', 'long-simulation', 'android-smoke', 'camera-comparison',
                 'android-upgrade / release-upgrade-save', 'android-online / native-online',
                 'backend-live / live-world'}


def read_evidence(directory, filename):
    matches = [p for p in Path(directory).rglob(filename) if p.is_file()]
    assert len(matches) == 1, 'Missing/ambiguous accepted evidence: '+filename
    return json.loads(matches[0].read_text())


def assert_accepted_run(acceptance, run, jobs):
    assert acceptance['status'] == 'ACCEPTED', 'Candidate still pending acceptance'
    assert re.fullmatch(r'[0-9a-f]{40}', acceptance['runtime'])
    assert run['repository']['full_name'] == REPOSITORY
    assert run['id'] == acceptance['runId'] and run['head_sha'] == acceptance['runtime']
    assert run['status'] == 'completed' and run['conclusion'] == 'success'
    for name in REQUIRED_JOBS:
        matching = [j for j in jobs['jobs'] if j['name'] == name]
        assert len(matching) == 1 and matching[0]['status'] == 'completed' \
            and matching[0]['conclusion'] == 'success', 'Missing/unaccepted actual gate: '+name


def assert_binary_evidence(acceptance, apk_sha, apk_bytes, upgrade, online, backend, stress):
    assert re.fullmatch(r'[0-9a-f]{64}', acceptance['apkSha256'])
    assert apk_sha == acceptance['apkSha256'] and apk_bytes == acceptance['apkBytes'] > 0
    base, candidate = upgrade['baseline'], upgrade['candidate']
    assert base['package'] == candidate['package'] == PACKAGE
    assert base['versionCode'] == 9 and candidate['versionCode'] == acceptance['versionCode'] == 10
    assert candidate['versionName'] == acceptance['version'] == '2.0.0'
    assert re.fullmatch(r'[0-9a-f]{64}', candidate['certificateSha256'])
    assert candidate['certificateSha256'] == base['certificateSha256']
    for key in ['appUidRetained', 'privateCampaignFilesRetained',
                'encryptedPreferenceBytesRetainedBeforeLaunch', 'repeatBackupBytesUnchanged',
                'actualCandidateRestart', 'finalVersionUpgrade']:
        assert upgrade[key] is True, 'Unverified install/migration: '+key
    assert upgrade['oldSchema'] == 12 and upgrade['newSchema'] == 18
    assert set(upgrade['migrationBackupSha256']) == set(BACKUP_SUFFIXES)
    assert upgrade['originalWorld'] == {'countries':195, 'provinces':2924, 'cities':5411}
    assert online['apkSha256'] == apk_sha and online['stateVersion'] == 18 and online['members'] == 2
    for key in ['nativeCreate', 'serverPaused', 'menuReconnect', 'processReconnect',
                'realHostMigration', 'nativeOwnerReturn', 'rebootReconnect',
                'sameNativeUidAndSessionKeys', 'onceOnlyFocusPaymentRetained']:
        assert online[key] is True, 'Unverified signed native online flow: '+key
    assert online['nativePaidFocus'] == 'eco-audit'
    assert backend['featuresVerified'] is True and backend['hostMigrationVerified'] is True
    assert backend['stateVersion'] == backend['finalSchema'] == 18
    assert math.isfinite(stress) and stress >= 1800, 'No completed real 30-minute native soak'
    cleanup = acceptance['qaCleanup']
    assert {backend['roomId'], online['roomId']} <= set(cleanup['roomIds'])
    assert all(cleanup[k] == 0 for k in ['roomsRemaining', 'playersRemaining', 'receiptsRemaining'])
    assert cleanup['preservedCityBackups'] >= 29
