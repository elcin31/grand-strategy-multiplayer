"""Strict installation and migration evidence; no emulator or network here."""
import json
import re
from camera_fixture_projection import assert_paused_fixture

PACKAGE = 'com.elcin31.grandstrategymultiplayer'
BACKUP_SUFFIXES = ('before-expansion-v13', 'before-espionage-v14',
                   'before-economy-v15', 'before-military-v16',
                   'before-technology-v17', 'before-focus-v18')


def adaptive_control_enabled(node):
    label=node.get('text') or node.get('content-desc')
    assert label in ('Адаптивное качество: Вкл','Адаптивное качество: Выкл'), 'Unknown actual adaptive control state'
    return label=='Адаптивное качество: Вкл'


def package_metadata(badging, signature):
    package = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging)
    certificates = re.findall(r'certificate SHA-256 digest: ([0-9a-f]{64})', signature)
    assert package and package[1] == PACKAGE, 'Wrong Dominion package'
    assert 'application-debuggable' not in badging, 'Debug APK cannot establish installation compatibility'
    assert len(certificates) == 1 and ('Verifies' in signature or 'Verified' in signature), 'Missing/ambiguous verified signature'
    return {'package': package[1], 'versionCode': int(package[2]),
            'versionName': package[3], 'certificateSha256': certificates[0]}


def assert_install_compatibility(baseline, candidate, expected):
    assert baseline['package'] == candidate['package'] == PACKAGE
    assert candidate['certificateSha256'] == baseline['certificateSha256'], 'Changed install certificate'
    assert candidate['versionName'] == expected['version']
    assert candidate['versionCode'] == expected['android']['versionCode']
    assert candidate['versionCode'] >= baseline['versionCode'], 'Downgrade is not an upgrade test'
    if candidate['versionName'] != baseline['versionName']:
        assert candidate['versionCode'] > baseline['versionCode'], 'New release needs a greater Android versionCode'


def assert_app_data_preserved(before_uid, after_uid, before_files, after_files, before_secure, after_secure):
    assert before_uid == after_uid, 'Package update changed app UID'
    assert before_files and before_files == after_files, 'Install replaced/deleted private campaign data'
    assert re.fullmatch('[0-9a-f]{64}', before_secure) and before_secure == after_secure, 'Install replaced/deleted encrypted SecureStore preferences'


def assert_migration(raw_before, raw_after, backups):
    before, after = json.loads(raw_before), json.loads(raw_after)
    assert before['state']['stateVersion'] == 12, 'Upgrade did not start from schema12'
    assert after['state']['stateVersion'] == 18, 'Actual native save did not migrate to schema18'
    assert after['metadata']['id'] == before['metadata']['id'] == before['state']['id']
    assert after['metadata']['generation'] > before['metadata']['generation'], 'No actual new native save generation'
    assert_paused_fixture(after, before, 18)
    for suffix in BACKUP_SUFFIXES:
        assert backups.get(suffix) == raw_before, 'Missing/changed original migration backup: ' + suffix


def assert_backups_immutable(before_hashes, after_hashes):
    assert set(before_hashes) == set(BACKUP_SUFFIXES), 'Incomplete initial migration backup evidence'
    assert before_hashes == after_hashes, 'Repeated native save overwrote original migration backups'
