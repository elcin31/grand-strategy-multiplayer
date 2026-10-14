"""Require the actual native submission change in all ABI, or its absence."""
import json
import sys
import zipfile
from pathlib import Path

ABIS = ('arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64')
MARKER = b'DOMINION_PRESENTATION swap-zero-requested'


def verify(apk, enabled):
    with zipfile.ZipFile(apk) as archive:
        for abi in ABIS:
            native = archive.read(f'lib/{abi}/librnskia.so')
            assert (MARKER in native) == enabled, f'Presentation mode mismatch in {abi}'
            if enabled:
                assert b'eglSwapInterval' in native and b'DOMINION_PRESENTATION swap-zero-unavailable' in native
    return ABIS


if __name__ == '__main__':
    config = json.loads((Path(__file__).resolve().parents[1] / 'app.json').read_text())['expo']
    enabled = './plugins/withSkiaSwapPacing.cjs' in config.get('plugins', [])
    print('PASS: configured native swap mode in ' + ', '.join(verify(sys.argv[1], enabled)))
