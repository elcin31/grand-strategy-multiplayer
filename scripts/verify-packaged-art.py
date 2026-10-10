"""Candidate-only gate: all42 exact manifest images must be in the release APK."""
from pathlib import Path
import json,sys,zipfile
from art_package import assert_packaged_art
root=Path(__file__).resolve().parents[1]
entries=json.loads((root/'assets/art/manifest.json').read_text())
with zipfile.ZipFile(sys.argv[1]) as apk:
 count=assert_packaged_art(apk,entries)
 print(f'PASS: {count} byte-exact optimized paintings embedded in this standalone APK')
