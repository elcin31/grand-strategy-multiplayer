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
