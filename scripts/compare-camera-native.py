import json,sys,os
from pathlib import Path
before=json.loads(Path(sys.argv[1]).read_text());after=json.loads(Path(sys.argv[2]).read_text())
assert len(before['results'])==len(after['results'])==9
if before.get('protocol')=='fixed-save-reset-v2' or after.get('protocol')=='fixed-save-reset-v2':
    assert before.get('protocol')==after.get('protocol')=='fixed-save-reset-v2'
    assert before.get('fixtureSha256') and before['fixtureSha256']==after.get('fixtureSha256'), 'Different benchmark save fixtures'
    assert before.get('fixtureStateChecksum')==after.get('fixtureStateChecksum'), 'Different paused worlds'
rows=[]
for b,a in zip(before['results'],after['results']):
    assert b['scenario']==a['scenario']
    rows.append({'scenario':b['scenario'],'before':b,'after':a})
report={'baselineRuntime':os.environ.get('CAMERA_BASELINE_RUNTIME','47b0db4f8b220e9ea89998afaac035239b64f5e0'),'baselineRun':os.environ.get('CAMERA_BASELINE_RUN','37971350100'),'candidateRuntime':os.environ.get('CAMERA_CANDIDATE_RUNTIME',os.environ.get('GITHUB_SHA')),'candidateRun':os.environ.get('CAMERA_CANDIDATE_RUN',os.environ.get('GITHUB_RUN_ID')),'comparisonRuntime':os.environ.get('GITHUB_SHA'),'comparisonRun':os.environ.get('GITHUB_RUN_ID'),'note':'Paired baseline/candidate on one SwiftShader API35 emulator with identical real-pointer gesture driver, offline paused campaign, Balanced and adaptive off. Native frame completion and host software rendering only; physical Redmi acceptance remains pending. gfxinfo histogram percentiles are used when raw timestamps are unavailable.','rows':rows}
report.update({'protocol':before.get('protocol','independent-campaign-v1'),'fixtureSha256':before.get('fixtureSha256'),'fixtureStateChecksum':before.get('fixtureStateChecksum')})
Path('CAMERA_NATIVE_PAIRED.json').write_text(json.dumps(report,indent=2)+'\n')
for row in rows:print(row['scenario'],{k:row['before'][k] for k in ('p50Ms','p95Ms','jankPercent','pssKiB')},'->',{k:row['after'][k] for k in ('p50Ms','p95Ms','jankPercent','pssKiB')})
assert all(r[side]['pssKiB'] is not None and r[side]['pssKiB']>0 for r in rows for side in ('before','after')), 'Native memory capture missing'
assert all(r['after']['pssKiB']<=r['before']['pssKiB']*1.2 for r in rows), 'Native memory regression'
if os.environ.get('CAMERA_REQUIRE_SURFACE_PRESENTATION')=='1':
    # HWUI changes meaning for an opaque SurfaceView. Independently require
    # complete compositor intervals for both map presentation backends.
    for row in rows[1:]:
        b=row['before'].get('surfacePresentation',{});a=row['after'].get('surfacePresentation',{})
        assert all(s.get('available') and s.get('complete') and s.get('frames',0)>=20 for s in [b,a]), row['scenario']+' complete compositor capture missing'
        allowance=1.1 if row['scenario']=='03-pinch' else 1.2
        assert a['p95Ms']<=b['p95Ms']*allowance, row['scenario']+' compositor p95 regression'
        assert a['p99Ms']<=b['p99Ms']*allowance, row['scenario']+' compositor p99 regression'
assert all(r['after']['p95Ms'] is not None for r in rows[1:]), 'No native moving-camera frame timings captured'
pinch=next(r for r in rows if r['scenario']=='03-pinch')
assert pinch['after']['histogramP95Ms'] <= pinch['before']['histogramP95Ms']*1.1, 'Pinch p95 regression; candidate must not publish'
for row in rows[1:]:
    if row['scenario']=='03-pinch':continue
    assert row['after']['histogramP95Ms'] <= row['before']['histogramP95Ms']*1.2, row['scenario']+' p95 regression; candidate must not publish'
print('PASS: paired native camera evidence generated')
