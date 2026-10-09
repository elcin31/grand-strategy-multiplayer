import json,sys
from pathlib import Path
before=json.loads(Path(sys.argv[1]).read_text());after=json.loads(Path(sys.argv[2]).read_text())
assert len(before['results'])==len(after['results'])==9
rows=[]
for b,a in zip(before['results'],after['results']):
    assert b['scenario']==a['scenario']
    rows.append({'scenario':b['scenario'],'before':b,'after':a})
report={'baselineRuntime':'c758ed78f586268809a2184a064ae7fdadc5156e','note':'Paired baseline/candidate on one SwiftShader API35 emulator with identical real-pointer gesture driver, offline paused campaign, Balanced and adaptive off. Native frame completion and host software rendering only; physical Redmi acceptance remains pending. gfxinfo histogram percentiles are used when raw timestamps are unavailable.','rows':rows}
Path('CAMERA_NATIVE_PAIRED.json').write_text(json.dumps(report,indent=2)+'\n')
for row in rows:print(row['scenario'],{k:row['before'][k] for k in ('p50Ms','p95Ms','jankPercent','pssKiB')},'->',{k:row['after'][k] for k in ('p50Ms','p95Ms','jankPercent','pssKiB')})
assert all(r['after']['p95Ms'] is not None for r in rows[1:]), 'No native moving-camera frame timings captured'
print('PASS: paired native camera evidence generated')
