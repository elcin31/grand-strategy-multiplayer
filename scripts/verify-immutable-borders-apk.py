"""Check the private native border API in every retained Android ABI.

Symbol presence proves packaging, not actual execution or frame-time benefit;
the real-map startup log and matched A-I profile are separate gates.
"""
import sys
import zipfile

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

if __name__=='__main__':
    print('PASS: immutable native border API packaged in '+', '.join(verify(sys.argv[1])))
