"""Package an already verified Dominion payload with deterministic ZIP metadata.

This does not turn incomplete QA into a release. The curated manifest must bind
the actual APK, source and every required proof before packaging is allowed.
Only the curated payload is included, never raw campaign/session directories.
"""
import hashlib
import json
import re
import shutil
import stat
import sys
import time
import zipfile
from pathlib import Path

REQUIRED = {
    'standaloneApkIntegrity', 'compatibleSignatureAndUpgrade',
    'sourceTypecheckAndTests', 'daily10000', 'monthly10000',
    'cameraNativeRegression', 'cameraInteractionAndModes',
    'monthlySimulationOnAndroid', 'stagedLod', 'newGameplayOnAndroid',
    'saveAndProcessRestart', 'multiplayerRealHttp', 'multiplayerNative',
    'testRoomsCleaned', 'visualReview',
}


def sha256(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def package(payload, destination):
    payload, destination = payload.resolve(), destination.resolve()
    assert not destination.is_relative_to(payload), 'ZIP must be outside payload'
    assert not destination.exists(), 'Do not overwrite an existing deliverable'
    manifest = json.loads((payload / 'MANIFEST.json').read_text())
    assert manifest['repository'] == 'elcin31/grand-strategy-multiplayer'
    assert manifest['status'] == 'verified-playtest'
    assert manifest['dominion23Complete'] is True
    assert REQUIRED <= manifest['mandatoryChecks'].keys()
    assert all(manifest['mandatoryChecks'][key] is True for key in REQUIRED), 'Mandatory QA is incomplete'
    for key in ['compiledSourceSha', 'validationSourceSha']:
        assert re.fullmatch('[0-9a-f]{40}', manifest[key]), key
    apk = manifest['apk']
    assert apk['package'] == 'com.elcin31.grandstrategymultiplayer'
    assert apk['certificateSha256'] == 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c'
    assert re.fullmatch(r'Dominion-[A-Za-z0-9._-]+\.apk', apk['filename'])
    assert sha256(payload / apk['filename']) == apk['sha256'], 'APK digest mismatch'
    proofs = manifest['proofs']
    assert REQUIRED <= proofs.keys(), 'Each acceptance check needs a concrete proof'
    for name in REQUIRED:
        proof = proofs[name]
        path = Path(proof['path'])
        assert not path.is_absolute() and '..' not in path.parts
        assert str(path).startswith('reports/')
        assert sha256(payload / path) == proof['sha256'], 'Proof digest mismatch: ' + name
    def result(name):
        return json.loads((payload / proofs[name]['path']).read_text())
    # A hand-written summary cannot override a rejected native matrix or a
    # partial long simulation. Check those original proof contents as well.
    camera = result('cameraNativeRegression')
    assert camera['metricGate'] == 'pass' and camera['regressionsOver10Percent'] == []
    assert camera['comparisonKind'] == 'candidate-vs-optimized-baseline'
    assert camera['candidateApkSha256'] == apk['sha256']
    assert camera['baselineApkSha256'] == '7df9e78cdf9c5293cdb8a0bf72363c96de5e85586c9096b16393cddf25986764'
    assert camera['memoryRegressionOver32MiB'] is False
    for name, mode in [('daily10000', 'daily'), ('monthly10000', 'monthly')]:
        simulation = result(name)
        assert simulation['mode'] == mode and simulation['steps'] >= 10000 and simulation['restores'] >= 10
        assert simulation['sourceClean'] is True and simulation['sourceSha'] == manifest['compiledSourceSha']
    gameplay = result('newGameplayOnAndroid')
    assert gameplay['passed'] is True and gameplay['apkSha256'] == apk['sha256']
    online = result('multiplayerNative')
    assert online['apkSha256'] == apk['sha256'] and online['members'] >= 2
    assert all(online[name] is True for name in ['nativeCreate', 'menuReconnect', 'processReconnect', 'realHostMigration', 'nativeOwnerReturn', 'rebootReconnect', 'sameNativeUidAndSessionKeys', 'onceOnlyFocusPaymentRetained'])
    backend = result('multiplayerRealHttp')
    assert backend['passed'] is True and backend['projectId'] == 'dfjsnjxnyjspwugjguhq' and backend['realHttpClients'] >= 3
    cleanup = backend['qaCleanup']
    assert cleanup['completed'] is True and all(cleanup[key] == 0 for key in ['remainingRooms', 'remainingPlayers', 'remainingReceipts'])
    assert (payload / 'README.txt').is_file()
    assert (payload / 'sources/Dominion-source.tar').is_file()
    files = sorted(p for p in payload.rglob('*') if p.is_file())
    for path in files:
        relative = path.relative_to(payload)
        assert not path.is_symlink(), 'Symlinks are not release payloads'
        assert (relative.as_posix() in [apk['filename'], 'MANIFEST.json', 'README.txt', 'sources/Dominion-source.tar']
                or relative.parts[0] == 'reports'), 'Uncurated payload file: ' + str(relative)
        assert not any(part.startswith('.') for part in relative.parts)
        assert not re.search(r'(?:token|session|snapshot|failed-state|checkpoint)\.(?:json|txt)$', path.name), 'Private/raw state must stay outside the release'
    # Source commit time, sorted entries and fixed permissions make repeated
    # packaging of the same verified payload byte-identical.
    stamp = time.gmtime(max(315532800, int(manifest['sourceCommitEpoch'])))[:6]
    sums = ''.join(sha256(p) + '  ' + p.relative_to(payload).as_posix() + '\n' for p in files)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, path in [(p.relative_to(payload).as_posix(), p) for p in files] + [('SHA256SUMS', None)]:
            entry = zipfile.ZipInfo(name, stamp)
            entry.create_system = 3
            entry.external_attr = (stat.S_IFREG | 0o644) << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            with archive.open(entry, 'w', force_zip64=True) as target:
                if path is None:
                    target.write(sums.encode())
                else:
                    with path.open('rb') as source:
                        shutil.copyfileobj(source, target)
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None, 'ZIP integrity check failed'
    digest = sha256(destination)
    destination.with_suffix(destination.suffix + '.sha256').write_text(digest + '  ' + destination.name + '\n')
    return {'file': str(destination), 'bytes': destination.stat().st_size, 'sha256': digest}


if __name__ == '__main__':
    print(json.dumps(package(Path(sys.argv[1]), Path(sys.argv[2])), indent=2))
