"""Fail Android prebuild if landscape or application identity was lost."""
from pathlib import Path
import hashlib
import json
import xml.etree.ElementTree as ET
ANDROID = '{http://schemas.android.com/apk/res/android}'
manifest = ET.parse('android/app/src/main/AndroidManifest.xml').getroot()
activity = next(a for a in manifest.iter('activity') if a.get(ANDROID+'name') == '.MainActivity')
assert activity.get(ANDROID+'screenOrientation') in ('landscape','sensorLandscape'), 'Landscape orientation missing'
strings = ET.parse('android/app/src/main/res/values/strings.xml').getroot()
assert next(s.text for s in strings if s.get('name') == 'app_name') == 'Dominion'
print('PASS: landscape manifest and app identity')
config=json.loads(Path('app.json').read_text())['expo']
if './plugins/withMapTextureOpacity.cjs' in config.get('plugins',[]):
    proof=json.loads(Path('android/map-texture-opacity.json').read_text())
    native=Path(proof['nativePath']).read_text()
    base=Path('node_modules/@shopify/react-native-skia/android/src/main/java/com/shopify/reactnative/skia/SkiaBaseView.java').read_text()
    assert proof['skiaVersion']=='2.6.2' and proof['backend']=='TextureView' and proof['textureOpaque'] is True
    assert proof['soleCanvas']=='src/components/WorldMap.tsx' and proof['fullOpaqueFill']=='#203B48'
    assert proof['baseViewUnchanged'] is True and hashlib.sha256(base.encode()).hexdigest()==proof['baseViewSha256']
    assert hashlib.sha256(native.encode()).hexdigest()==proof['nativeSourceSha256']
    assert 'class SkiaTextureView extends TextureView' in native and native.count('setOpaque(true);')==1
    assert 'setOpaque(false);' not in native and 'DOMINION_OPAQUE_MAP_TEXTURE' in native
    assert 'mView = new SkiaTextureView(context, this, debug);' in base
    assert 'surfaceAvailable(surface, width, height, false);' in base
    print('PASS: pinned opaque map TextureView source and unchanged presentation backend verified')
if './plugins/withSkiaRecorderLifecycle.cjs' in config.get('plugins',[]):
    proof=json.loads(Path('android/skia-recorder-lifecycle.json').read_text())
    native=Path(proof['nativePath']).read_text()
    header=Path(proof['recorderPath']).read_text()
    metadata=json.loads(Path('node_modules/@shopify/react-native-skia/package.json').read_text())
    assert metadata['version']==proof['skiaVersion']=='2.6.2'
    assert metadata['react-native']==proof['nativeMetroEntry']=='src/index.ts'
    assert proof['originalSourceSha256']=='921d99c81ea02318d217dd52386d8b71ac268e1b56138c7f781c1ae2e9935e0b'
    assert hashlib.sha256(native.encode()).hexdigest()==proof['nativeSourceSha256']
    assert hashlib.sha256(header.encode()).hexdigest()==proof['recorderHeaderSha256']=='a6b8561f75d993b16003011feb7619d906c88851be802359e184bb92706c86e1'
    assert proof['retiredCommandsResetOnUi'] is True and proof['stopMapperBeforeReset'] is True
    assert proof['livePicturesDisposed'] is False and 'DOMINION_RECORDER_LIFECYCLE' in native
    # Re-run the full source guard; a self-consistent hash alone does not prove
    # this is the reviewed pinned implementation.
    import subprocess
    subprocess.run(['node','-e',"require('./plugins/withSkiaRecorderLifecycle.cjs').applySkiaRecorderLifecycle(process.cwd())"],check=True)
    print('PASS: pinned native recorder lifetime and UI reset contract verified')
if './plugins/withSkiaImmutableBorders.cjs' in config.get('plugins',[]):
    proof=json.loads(Path('android/skia-immutable-borders.json').read_text())
    assert proof['skiaVersion']=='2.6.2' and proof['immutableBorderApi']==1
    assert proof['mutablePathApiUnchanged'] is True and proof['livePathsDisposed'] is False
    assert proof['imagesOrSurfacesAdded'] is False and proof['nativeMemoryPressure'] is True
    assert proof['boundsPreparedBeforeSharing'] is True
    for entry in [*proof['files'],proof['header']]:
        assert hashlib.sha256(Path(entry['file']).read_bytes()).hexdigest()==entry['sha256']
    # Validate the exact original source and reversible pinned edits as well.
    import subprocess
    guarded=json.loads(subprocess.check_output(['node','-e',
        "console.log(JSON.stringify(require('./plugins/withSkiaImmutableBorders.cjs').applyImmutableBorders(process.cwd())))"],text=True))
    assert guarded==proof, 'Native border proof does not match the reviewed pinned patch'
    print('PASS: pinned immutable border API; original mutable API and cache ownership preserved')
else:
    import subprocess
    subprocess.run(['node','-e',"const fs=require('node:fs'),crypto=require('node:crypto');for(const b of require('./plugins/withSkiaImmutableBorders.cjs').bindings){const s=fs.readFileSync('node_modules/@shopify/react-native-skia/'+b.file);if(crypto.createHash('sha256').update(s).digest('hex')!==b.sha)throw Error('Restored renderer has changed native path API')}"],check=True)
    print('PASS: restored accepted renderer has the exact original pinned native path API')
