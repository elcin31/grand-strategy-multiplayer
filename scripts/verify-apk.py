"""Standalone release integrity gate; a missing JS bundle must fail CI."""
import sys
import zipfile
with zipfile.ZipFile(sys.argv[1]) as apk:
    names = apk.namelist()
    assert 'assets/index.android.bundle' in names, 'Missing embedded JS bundle: APK would depend on Metro'
    assert apk.getinfo('assets/index.android.bundle').file_size > 100000, 'Unexpectedly small JS bundle'
    assert any(n.startswith('lib/') and 'skia' in n.lower() for n in names), 'Missing native Skia renderer'
    assert any(n.startswith('lib/') and n.endswith('libhermes.so') for n in names), 'Missing Hermes runtime'
    assert apk.testzip() is None, 'Corrupted APK archive'
    print(f'Standalone bundle verified: {apk.getinfo("assets/index.android.bundle").file_size} bytes; native Skia and Hermes present')
