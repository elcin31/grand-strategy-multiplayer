"""Verify compiled Java dispatch mode, separately from execution/performance."""
import json
import sys
import zipfile
from pathlib import Path

MARKER=b'DOMINION_UI_DISPATCH posted-main-loop'

def verify(apk,enabled):
    with zipfile.ZipFile(apk) as archive:
        dex=[n for n in archive.namelist() if n.startswith('classes') and n.endswith('.dex') and '/' not in n]
        assert dex,'No compiled Android Java code'
        found=any(MARKER in archive.read(n) for n in dex)
        assert found is enabled,'Compiled UI dispatch differs from registered Expo plugin'
    return found

if __name__=='__main__':
    config=json.loads((Path(__file__).resolve().parents[1]/'app.json').read_text())['expo']
    enabled='./plugins/withSkiaUiDispatch.cjs' in config.get('plugins',[])
    print('PASS: compiled Java UI dispatch mode matches configuration: '+str(verify(sys.argv[1],enabled)))
