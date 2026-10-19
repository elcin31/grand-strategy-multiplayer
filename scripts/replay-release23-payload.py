"""Reconstruct the approved payload from immutable same-repository evidence.

No game is rebuilt and no backend is changed. Every input byte is hash-bound;
only the explicitly recorded new draft may be published with --publish.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import zipfile
import zlib

REPO = Path(__file__).resolve().parents[1]
NAME = 'elcin31/grand-strategy-multiplayer'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def relative(value):
    path = Path(value)
    assert value and not path.is_absolute() and '..' not in path.parts
    return path


def gh(*args):
    return subprocess.check_output(['gh', *args], text=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('recipe', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--artifact-cache', type=Path)
    parser.add_argument('--assemble-only', action='store_true')
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    assert not (args.publish and args.assemble_only)
    recipe = json.loads(args.recipe.read_text())
    assert recipe['repository'] == NAME
    assert os.environ.get('GITHUB_REPOSITORY', NAME) == NAME
    assert recipe['draftReleaseId'] == 417150835
    assert recipe['tag'] == 'v2.3.0-playtest.4'
    destination = args.destination.resolve()
    destination.mkdir(exist_ok=False)
    payload = destination / 'payload'
    payload.mkdir()
    downloads = destination / 'downloads'
    downloads.mkdir()

    def artifact(item):
        identity, description = item
        assert identity.isdigit() and re.fullmatch('[a-f0-9]{64}', description['sha256'])
        if args.artifact_cache:
            path = args.artifact_cache / relative(description['directory']) / 'artifact.zip'
        else:
            path = downloads / (identity + '.zip')
            with path.open('wb') as target:
                subprocess.run(['gh', 'api', 'repos/' + NAME + '/actions/artifacts/' + identity + '/zip'], stdout=target, check=True)
        assert path.stat().st_size == description['bytes'] and digest(path) == description['sha256'], identity
        return identity, path

    with ThreadPoolExecutor(max_workers=4) as executor:
        archives = dict(executor.map(artifact, recipe['artifacts'].items()))
    seen = set()
    with_archives = {key: zipfile.ZipFile(path) for key, path in archives.items()}
    try:
        for entry in recipe['entries']:
            name = relative(entry['path'])
            assert name.as_posix() not in seen
            seen.add(name.as_posix())
            target = payload / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if 'artifact' in entry:
                member = relative(entry['member']).as_posix()
                with with_archives[str(entry['artifact'])].open(member) as source, target.open('wb') as output:
                    shutil.copyfileobj(source, output)
            elif 'repoPath' in entry:
                commit = entry['repoCommit']
                assert re.fullmatch('[a-f0-9]{40}', commit)
                with target.open('wb') as output:
                    subprocess.run(['git', 'show', commit + ':' + relative(entry['repoPath']).as_posix()], stdout=output, check=True, cwd=REPO)
            elif 'sourceArchiveCommit' in entry:
                assert name.as_posix() == 'sources/Dominion-source.tar'
                commit = entry['sourceArchiveCommit']
                assert re.fullmatch('[a-f0-9]{40}', commit)
                subprocess.run(['git', 'archive', '--format=tar', commit, '--output=' + str(target)], check=True, cwd=REPO)
            else:
                shutil.copyfile(args.recipe.parent / 'metadata' / relative(entry['metadata']), target)
            assert target.stat().st_size == entry['bytes'] and digest(target) == entry['sha256'], str(name)
    finally:
        for archive in with_archives.values():
            archive.close()
    assert len(seen) == 2679
    subprocess.run([sys.executable, str(REPO / 'scripts/compare-camera23-repeated.py'), str(payload / 'reports/camera/plan.json'), str(payload / 'reports/camera/evidence'), str(destination / 'camera-recomputed.json'), '--check'], cwd=REPO, check=True)
    assert json.loads((destination / 'camera-recomputed.json').read_text()) == json.loads((payload / 'reports/camera/pooled.json').read_text())
    print('All2679 approved payload files and all23 original camera pairs reproduced exactly.', flush=True)
    if args.assemble_only:
        return
    spec = importlib.util.spec_from_file_location('release23', REPO / 'scripts/make-release23-zip.py')
    packager = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(packager)
    filename = 'Dominion-2.3.0-playtest.4.zip'
    packaged = packager.package(payload, destination / filename)
    repeated = packager.package(payload, destination / 'reproducibility-check.zip')
    assert packaged['sha256'] == repeated['sha256'] and packaged['bytes'] == repeated['bytes']
    manifest = json.loads((payload / 'MANIFEST.json').read_text())
    apk = payload / manifest['apk']['filename']
    assert digest(apk) == recipe['apkSha256']
    checksum = destination / 'SHA256SUMS.txt'
    checksum.write_text(recipe['apkSha256'] + '  ' + apk.name + '\n' + packaged['sha256'] + '  ' + filename + '\n')
    notes = destination / 'RELEASE_NOTES.md'
    notes.write_text((args.recipe.parent / 'RELEASE_NOTES.md').read_text().replace(recipe['approvedLocalZipSha256'], packaged['sha256']))
    proof = {'repository': NAME, 'compiledSourceSha': recipe['compiledSourceSha'], 'apkSha256': digest(apk), 'zip': packaged, 'all2679ApprovedFilesEqual': True, 'all23CameraPairsReproduced': True, 'twoPackagesByteIdentical': True, 'matchesLocalZip': packaged['sha256'] == recipe['approvedLocalZipSha256'], 'python': sys.version, 'zlib': zlib.ZLIB_RUNTIME_VERSION, 'workflowRunId': os.environ.get('GITHUB_RUN_ID')}
    (destination / 'delivery.json').write_text(json.dumps(proof, indent=2) + '\n')
    print(json.dumps(proof, indent=2), flush=True)
    if not args.publish:
        return
    release = json.loads(gh('api', 'repos/' + NAME + '/releases/' + str(recipe['draftReleaseId'])))
    assert release['draft'] and release['tag_name'] == recipe['tag'] and release['prerelease']
    assert release['target_commitish'] == recipe['compiledSourceSha']
    assets = [destination / filename, apk, checksum]
    existing = {asset['name']: asset for asset in release['assets']}
    for asset in assets:
        if asset.name in existing:
            actual = existing[asset.name]
            assert actual['size'] == asset.stat().st_size and actual['digest'] == 'sha256:' + digest(asset)
        else:
            subprocess.run(['gh', 'release', 'upload', recipe['tag'], str(asset), '--repo', NAME], check=True)
    release = json.loads(gh('api', 'repos/' + NAME + '/releases/' + str(recipe['draftReleaseId'])))
    uploaded = {asset['name']: asset for asset in release['assets']}
    for asset in assets:
        actual = uploaded[asset.name]
        assert actual['state'] == 'uploaded' and actual['size'] == asset.stat().st_size
        assert actual['digest'] == 'sha256:' + digest(asset)
    subprocess.run(['gh', 'release', 'edit', recipe['tag'], '--repo', NAME, '--notes-file', str(notes), '--draft=false', '--prerelease'], check=True)
    release = json.loads(gh('api', 'repos/' + NAME + '/releases/' + str(recipe['draftReleaseId'])))
    assert not release['draft'] and release['published_at']
    print('Published verified release: ' + release['html_url'], flush=True)


if __name__ == '__main__':
    main()
