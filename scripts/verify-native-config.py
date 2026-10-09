"""Fail Android prebuild if landscape or application identity was lost."""
from pathlib import Path
import xml.etree.ElementTree as ET
ANDROID = '{http://schemas.android.com/apk/res/android}'
manifest = ET.parse('android/app/src/main/AndroidManifest.xml').getroot()
activity = next(a for a in manifest.iter('activity') if a.get(ANDROID+'name') == '.MainActivity')
assert activity.get(ANDROID+'screenOrientation') in ('landscape','sensorLandscape'), 'Landscape orientation missing'
strings = ET.parse('android/app/src/main/res/values/strings.xml').getroot()
assert next(s.text for s in strings if s.get('name') == 'app_name') == 'Dominion'
print('PASS: landscape manifest and app identity')
