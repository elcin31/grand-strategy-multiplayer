"""Build a deterministic ZIP from an explicitly prepared APK/report directory."""
import argparse
import datetime
import hashlib
import json
import re
import zipfile
from pathlib import Path


def digest(path):
    value=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):
            value.update(block)
    return value.hexdigest()


def package(directory, output):
    manifest=json.loads((directory/'MANIFEST.json').read_text())
    assert re.fullmatch('[0-9a-f]{40}',manifest['compiledSourceSha'])
    assert manifest['repository']=='elcin31/grand-strategy-multiplayer'
    assert manifest['status'] in ('playtest-checkpoint','complete-release')
    if manifest['status']=='complete-release':
        required={'cameraNativeGate','graphicsAndInteraction','memoryBounded','engineAndGameplay',
                  'eventsAndFocus','scenarioValidation','saveCompatibility','multiplayerTwoClients',
                  'longSimulation10000','finalAndroidRegression','apkIntegrity','apkInstallColdSmoke'}
        checks=manifest['mandatoryChecks']
        assert manifest['dominion23Complete'] is True and required<=checks.keys()
        assert all(checks[key] is True for key in required),'Incomplete release cannot be packaged as complete'
    else:
        assert manifest['dominion23Complete'] is False
    apk_name=manifest['apk']['filename']
    assert apk_name==Path(apk_name).name and apk_name.endswith('.apk')
    apk=directory/apk_name
    assert digest(apk)==manifest['apk']['sha256'],'APK differs from verified binary'
    with zipfile.ZipFile(apk) as native:
        assert native.testzip() is None,'Corrupted APK'
        assert len(native.read('assets/index.android.bundle'))>100000,'No standalone bundle'
        for abi in ('arm64-v8a','armeabi-v7a','x86','x86_64'):
            assert f'lib/{abi}/librnskia.so' in native.namelist()
    assert output.resolve()!=apk.resolve() and directory.resolve() not in output.resolve().parents
    files=sorted(p for p in directory.rglob('*') if p.is_file() and p.name!='SHA256SUMS')
    assert all(not p.is_symlink() for p in directory.rglob('*')),'No implicit symlink inputs'
    sums=''.join(digest(p)+'  '+p.relative_to(directory).as_posix()+'\n' for p in files)
    (directory/'SHA256SUMS').write_text(sums)
    files=sorted([*files,directory/'SHA256SUMS'])
    timestamp=datetime.datetime.fromtimestamp(manifest['sourceCommitEpoch'],datetime.timezone.utc)
    assert timestamp.year>=1980
    output.parent.mkdir(parents=True,exist_ok=True)
    temporary=output.with_suffix(output.suffix+'.pending')
    try:
        with zipfile.ZipFile(temporary,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
            for file in files:
                info=zipfile.ZipInfo(file.relative_to(directory).as_posix(),timestamp.timetuple()[:6])
                info.compress_type=zipfile.ZIP_DEFLATED;info.create_system=3;info.external_attr=0o100644<<16
                with file.open('rb') as source,archive.open(info,'w',force_zip64=True) as destination:
                    for block in iter(lambda:source.read(1024*1024),b''):destination.write(block)
        with zipfile.ZipFile(temporary) as archive:
            assert archive.testzip() is None and archive.getinfo(apk_name).file_size==apk.stat().st_size
            with archive.open(apk_name) as stream:
                value=hashlib.sha256()
                for block in iter(lambda:stream.read(1024*1024),b''):value.update(block)
                assert value.hexdigest()==manifest['apk']['sha256']
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    result={'filename':output.name,'bytes':output.stat().st_size,'sha256':digest(output),'status':manifest['status']}
    output.with_suffix(output.suffix+'.sha256').write_text(result['sha256']+'  '+output.name+'\n')
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();print(json.dumps(package(args.directory,args.output),indent=2))
