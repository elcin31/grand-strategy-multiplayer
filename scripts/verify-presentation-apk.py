"""Require the actual native submission change in all ABI, or its absence."""
import json
import sys
import zipfile
from pathlib import Path

ABIS = ('arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64')
MARKER = b'DOMINION_PRESENTATION swap-zero-requested'
CONSUMER_MARKER = b'DOMINION_PRESENTATION hwui-owned-consumer'


def verify(apk, enabled, consumer_enabled=False):
    with zipfile.ZipFile(apk) as archive:
        for abi in ABIS:
            native = archive.read(f'lib/{abi}/librnskia.so')
            assert (MARKER in native) == enabled, f'Presentation mode mismatch in {abi}'
            assert (CONSUMER_MARKER in native) == consumer_enabled, f'Consumer mode mismatch in {abi}'
            if consumer_enabled:
                assert b'updateAndRelease() failed. The exception above' not in native
            if enabled:
                assert b'eglSwapInterval' in native and b'DOMINION_PRESENTATION swap-zero-unavailable' in native
    return ABIS


if __name__ == '__main__':
    config = json.loads((Path(__file__).resolve().parents[1] / 'app.json').read_text())['expo']
    enabled = './plugins/withSkiaSwapPacing.cjs' in config.get('plugins', [])
    consumer_enabled = './plugins/withSkiaTextureConsumer.cjs' in config.get('plugins', [])
    print('PASS: configured native submission/consumer mode in ' + ', '.join(verify(sys.argv[1], enabled,consumer_enabled)))
