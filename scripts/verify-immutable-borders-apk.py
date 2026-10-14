"""Check the private native border API in every retained Android ABI.

Symbol presence proves packaging, not actual execution or frame-time benefit;
the real-map startup log and matched A-I profile are separate gates.
"""
import sys
import zipfile
import json
from pathlib import Path

ABIS=('arm64-v8a','armeabi-v7a','x86','x86_64')
SYMBOLS=(b'MakeDominionImmutable',b'drawDominionImmutablePath',b'JsiDominionImmutablePath')

def verify(apk):
    with zipfile.ZipFile(apk) as archive:
        assert b'DOMINION_BORDER_PATH immutable-native-v1' in archive.read('assets/index.android.bundle'), 'Immutable border runtime missing'
        for abi in ABIS:
            name=f'lib/{abi}/librnskia.so'
            native=archive.read(name)
            for symbol in SYMBOLS:
                assert symbol in native, f'{symbol.decode()} missing from {name}'
    return ABIS

def verify_original(apk):
    """A rollback must not silently ship the rejected native/JS experiment."""
    with zipfile.ZipFile(apk) as archive:
        assert b'DOMINION_BORDER_PATH immutable-native-v1' not in archive.read('assets/index.android.bundle'), 'Rejected border runtime still bundled'
        for abi in ABIS:
            native=archive.read(f'lib/{abi}/librnskia.so')
            assert all(symbol not in native for symbol in SYMBOLS), f'Rejected private API still compiled in {abi}'
    return ABIS

if __name__=='__main__':
    config=json.loads((Path(__file__).resolve().parents[1]/'app.json').read_text())['expo']
    if './plugins/withSkiaImmutableBorders.cjs' in config.get('plugins',[]):
        print('PASS: immutable native border API packaged in '+', '.join(verify(sys.argv[1])))
    else:
        print('PASS: restored original border renderer; rejected private API absent in '+', '.join(verify_original(sys.argv[1])))
