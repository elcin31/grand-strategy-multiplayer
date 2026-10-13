"""Compare completed actual presentations from two APKs on one emulator.

This is a metric gate, not a claim of physical Redmi FPS or release readiness.
The native CSV ring's truncation and software-driver limits remain explicit.
"""
import json,math,sys
from pathlib import Path

BASELINE='a44c54b3fcbe31dd7c23d5fea13782244436a6e47a7fa3ddf50be1204e846cbb'
SCENARIOS=['A-horizontal-pan','B-rapid-zoom-in','C-rapid-zoom-out','D-pinch-pan','E-lod-transitions','F-terrain','G-war-armies','H-active-simulation','I-extended-0','I-extended-11']

def compare(before,after,root_before,root_after):
    assert before['apkSha256']==BASELINE,'Wrong optimized baseline APK'
    assert before['fixtures']==after['fixtures'],'Different initial gameplay fixtures'
    for key in ['preset','adaptive','overlay','inputProtocol']:
        assert before[key]==after[key],key+' differs'
    assert [r['scenario'] for r in before['results']]==SCENARIOS
    assert [r['scenario'] for r in after['results']]==SCENARIOS
    rows=[];regressions=[];gains=[]
    for a,b in zip(before['results'],after['results']):
        for r in [a,b]:
            assert r['presentation']['available'] and r['presentation']['complete'],'Incomplete presentation capture'
            assert r['presentation']['frames']>=3 and r['native']['frames']>0
            assert r['pssKiB'] is not None
        row={'scenario':a['scenario'],'before':{k:a['presentation'][k] for k in ['p50Ms','p95Ms','p99Ms','frames']},'after':{k:b['presentation'][k] for k in ['p50Ms','p95Ms','p99Ms','frames']},'beforePssKiB':a['pssKiB'],'afterPssKiB':b['pssKiB'],'hwuiBefore':a['native']['rawStageMs'],'hwuiAfter':b['native']['rawStageMs'],'hwuiRecentRingTruncated':[a['native']['rawWindowTruncated'],b['native']['rawWindowTruncated']]}
        ratios={}
        for k in ['p50Ms','p95Ms','p99Ms']:
            x,y=a['presentation'][k],b['presentation'][k]
            assert all(isinstance(v,(int,float)) and math.isfinite(v) and v>0 for v in [x,y])
            ratios[k]=y/x
            if k in ['p95Ms','p99Ms'] and y/x>1.10:regressions.append({'scenario':a['scenario'],'metric':k,'ratio':y/x})
        row['ratios']=ratios;rows.append(row)
        if a['scenario'][0] in 'ABCE':gains.append(1-ratios['p95Ms'])
    trends=[json.loads((p/'memory-trend.json').read_text()) for p in [root_before,root_after]]
    assert all(len(t)==12 and all(r['pssKiB'] is not None for r in t) for t in trends)
    peak_before=max(r['pssKiB'] for r in trends[0]);peak_after=max(r['pssKiB'] for r in trends[1])
    # New visible border snapshots have a hard 12MiB cap. Allow 32MiB total
    # PSS variation for native/GC overhead; report every actual point as well.
    memory_regression=peak_after>peak_before+32*1024
    return {'sameEmulatorRequired':True,'baselineApkSha256':before['apkSha256'],'candidateApkSha256':after['apkSha256'],'fixtureChecksums':{k:v['checksum'] for k,v in before['fixtures'].items()},'physicalRedmiTest':False,'metricGate':'pass' if not regressions and not memory_regression else 'fail','regressionsOver10Percent':regressions,'engineering20PercentP95GoalObserved':any(g>=.2 for g in gains),'peakPssKiB':[peak_before,peak_after],'memoryRegressionOver32MiB':memory_regression,'memoryTrends':trends,'results':rows,'limitations':['One paired software-emulator run; repeat adverse/noisy cases before acceptance.','HWUI quantiles cover its recent CSV ring; actual presentation polling covers the complete motion.','PSS trend is a short bounded soak, not proof of indefinite memory stability.','Separate interaction/upgrade/save smoke and visual review are required before the phase gate.','No fixed physical-device FPS or isolated hardware GPU utilization claimed.']}

if __name__=='__main__':
    a,b=map(Path,sys.argv[1:3]);report=compare(json.loads((a/'profiles.json').read_text()),json.loads((b/'profiles.json').read_text()),a,b)
    Path('camera23-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    if '--check' in sys.argv and report['metricGate']!='pass':sys.exit(1)
