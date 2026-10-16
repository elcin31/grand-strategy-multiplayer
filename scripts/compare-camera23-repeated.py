"""Pool all measured intervals from three prespecified immutable APK pairs.

Every original single-pair result is retained. The motion window, compositor
completeness checks, tail ratio and per-pair memory limit remain unchanged.
"""
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys
from camera23_motion_scope import motion_presentation, POLICY

spec=importlib.util.spec_from_file_location('single_camera23',Path(__file__).with_name('compare-camera23.py'))
single=importlib.util.module_from_spec(spec);spec.loader.exec_module(single)
RUNTIME=['App.tsx','CampaignScreen.tsx','app.json','package.json','package-lock.json','metro.config.js','babel.config.js','src','supabase/functions','plugins','assets']


def quantiles(groups):
    assert groups and all(group for group in groups),'Every prespecified pair needs actual intervals'
    values=sorted(value for group in groups for value in group)
    assert all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and v>0 for v in values)
    return {**{key:values[math.ceil(len(values)*q)-1] for key,q in [('p50Ms',.5),('p95Ms',.95),('p99Ms',.99)]},'intervals':len(values),'maxMs':values[-1]}


def intervals(root,row):
    report=motion_presentation(root,row)
    assert report['complete'] and report['available'] and report['frames']>=3
    start,end=report['deviceWindowStartNs'],report['deviceWindowEndNs']
    actual=set()
    for poll in json.loads((root/(row['scenario']+'-surface.json')).read_text()):
        for line in poll['raw'].strip().splitlines()[1:]:
            desired,present,ready=map(int,line.split())
            if present not in (0,2**63-1) and start<=present<=end:actual.add(present)
    ordered=sorted(actual);values=[(b-a)/1e6 for a,b in zip(ordered,ordered[1:])]
    # Independently extracted intervals must reproduce the existing formal
    # compositor report exactly, including its slowest in-window frames.
    checked=quantiles([values]);assert len(ordered)==report['frames']
    assert all(checked[key]==report[key] for key in ['p50Ms','p95Ms','p99Ms','maxMs'])
    return values,report


def aggregate(plan,evidence):
    assert plan['repository']=='elcin31/grand-strategy-multiplayer'
    pairs=plan['pairs'];assert len(pairs)==3 and len({p['runId'] for p in pairs})==3
    assert plan['tailRatioLimit']==1.1 and plan['memoryLimitKiB']==32768
    all_before={name:[] for name in single.SCENARIOS};all_after={name:[] for name in single.SCENARIOS}
    reports=[];reference=None
    for pair in pairs:
        root=evidence/pair['directory'];run=json.loads((root/'run.json').read_text())
        assert run['id']==pair['runId'] and run['repository']['full_name']==plan['repository']
        subprocess.run(['git','diff','--exit-code',plan['compiledSourceSha'],run['head_sha'],'--',*RUNTIME],check=True)
        before_root,after_root=root/'profile-baseline',root/'profile-candidate'
        before,after=[json.loads((p/'profiles.json').read_text()) for p in [before_root,after_root]]
        assert before['apkSha256']==plan['baselineApkSha256'] and after['apkSha256']==plan['candidateApkSha256']
        assert plan['baselineApkSha256']==single.ACCEPTED_CAMERA
        identity={key:before[key] for key in ['fixtures','preset','adaptive','overlay','inputProtocol']}
        if reference is None:reference=identity
        assert identity==reference,'Prespecified pairs used different fixtures/settings'
        for path in [before_root,after_root]:
            result=json.loads((path/'result.json').read_text());assert result['noFatalLogs'] is True
        report=single.compare(before,after,before_root,after_root)
        reports.append({'runId':pair['runId'],'comparison':report})
        for x,y in zip(before['results'],after['results']):
            assert x['scenario']==y['scenario']
            a,_=intervals(before_root,x);b,_=intervals(after_root,y)
            all_before[x['scenario']].append(a);all_after[y['scenario']].append(b)
    rows=[];regressions=[]
    for name in single.SCENARIOS:
        a,b=quantiles(all_before[name]),quantiles(all_after[name]);ratios={k:b[k]/a[k] for k in ['p50Ms','p95Ms','p99Ms']}
        rows.append({'scenario':name,'before':a,'after':b,'ratios':ratios})
        for metric in ['p95Ms','p99Ms']:
            if ratios[metric]>1.1:regressions.append({'scenario':name,'metric':metric,'ratio':ratios[metric]})
    memory=any(r['comparison']['memoryRegressionOver32MiB'] for r in reports)
    return {'comparisonKind':'candidate-vs-optimized-baseline','aggregation':'three-prespecified-complete-pairs; all input-scoped presentation intervals pooled',
            'presentationScope':POLICY,'candidateApkSha256':plan['candidateApkSha256'],'baselineApkSha256':plan['baselineApkSha256'],
            'specifiedAtUtc':plan['specifiedAtUtc'],'runIds':[p['runId'] for p in pairs],'allRunsAndInWindowStallsRetained':True,
            'metricGate':'fail' if regressions or memory else 'pass','regressionsOver10Percent':regressions,
            'memoryRegressionOver32MiB':memory,'peakPssKiB':[max(r['comparison']['peakPssKiB'][i] for r in reports) for i in range(2)],
            'results':rows,'originalPairComparisons':reports,'physicalRedmiTest':False,
            'limitations':['Software emulator and host scheduling variability; no physical Redmi FPS or isolated hardware GPU utilization claim.',
                           'All three original per-pair results remain visible, including adverse tails. No run or frame is discarded.',
                           'Short repeated memory soaks do not prove indefinite memory stability. Separate functional checks remain mandatory.']}


if __name__=='__main__':
    plan=json.loads(Path(sys.argv[1]).read_text());report=aggregate(plan,Path(sys.argv[2]))
    Path(sys.argv[3]).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['metricGate','runIds','regressionsOver10Percent','peakPssKiB']},indent=2))
    if '--check' in sys.argv and report['metricGate']!='pass':sys.exit(1)
