"""Inspect actual99Hz CPU callsites inside a verified auxiliary gesture marker.

Requested sampling is not observed data. Missing vendor points and incomplete
attribution remain visible; counts/nested timings never become FPS or CPU time.
"""
import hashlib
import json
import sys
from pathlib import Path
from perfetto.trace_processor import TraceProcessor
from camera_trace_analysis import analyze_trace

out = Path(sys.argv[1])
capture = json.loads((out / 'trace-capture.json').read_text())
filename = capture['traceFile']
assert filename in ['pinch.pftrace', 'world-pan.pftrace', 'local-pan.pftrace', 'military-pan.pftrace']
raw = out / filename
assert raw.stat().st_size == capture['traceBytes'], 'Wrong raw trace length'
assert hashlib.sha256(raw.read_bytes()).hexdigest() == capture['traceSha256'], 'Wrong raw trace SHA'
pid = capture['pid']
assert isinstance(pid, int) and not isinstance(pid, bool) and pid > 0
with TraceProcessor(trace=str(raw)) as trace:
    report = analyze_trace(trace, pid, capture['traceSha256'], capture['gestureMarker'])
    assert report['markerValid'], report.get('error')
    begin, end = report['markerStartNs'], report['markerEndNs']
    assert isinstance(begin, int) and isinstance(end, int) and end > begin
    where = f'p.pid={pid} AND ps.ts>={begin} AND ps.ts<{end}'
    report['sampledThreads'] = [dict(tid=r.tid, thread=r.name, samples=r.samples,
        withStack=r.with_stack, unwindErrorSamples=r.errors)
        for r in trace.query(f'''SELECT t.tid,t.name,COUNT(*) samples,
            SUM(CASE WHEN ps.callsite_id IS NOT NULL THEN 1 ELSE 0 END) with_stack,
            SUM(CASE WHEN ps.unwind_error IS NOT NULL THEN 1 ELSE 0 END) errors
            FROM perf_sample ps JOIN thread t USING(utid) JOIN process p USING(upid)
            WHERE {where} GROUP BY t.tid,t.name ORDER BY samples DESC''')]
    report['sampledFrames'] = [dict(thread=r.thread,
        mapping='/kernel' if r.mapping == '/kernel' else Path(r.mapping).name,
        function=r.function, selfSamples=r.self_samples, inclusiveSamples=r.inclusive_samples)
        for r in trace.query(f'''WITH RECURSIVE frames(sample_id,utid,callsite_id,is_leaf,steps) AS (
            SELECT ps.id,ps.utid,ps.callsite_id,1,0 FROM perf_sample ps
            JOIN thread t USING(utid) JOIN process p USING(upid)
            WHERE {where} AND ps.callsite_id IS NOT NULL
            UNION ALL SELECT f.sample_id,f.utid,c.parent_id,0,f.steps+1
            FROM frames f JOIN stack_profile_callsite c ON c.id=f.callsite_id
            WHERE c.parent_id IS NOT NULL AND f.steps<128)
          SELECT t.name thread,m.name mapping,
            COALESCE(NULLIF(sf.name,''),'pc:'||printf('%x',sf.rel_pc)) function,
            SUM(CASE WHEN f.is_leaf=1 THEN 1 ELSE 0 END) self_samples,
            COUNT(DISTINCT f.sample_id) inclusive_samples
          FROM frames f JOIN thread t USING(utid)
          JOIN stack_profile_callsite c ON c.id=f.callsite_id
          JOIN stack_profile_frame sf ON sf.id=c.frame_id
          JOIN stack_profile_mapping m ON m.id=sf.mapping
          GROUP BY thread,mapping,function ORDER BY self_samples DESC,inclusive_samples DESC LIMIT 160''')]
    scope_count = next(iter(trace.query(f'''SELECT COUNT(*) scoped_samples
        FROM perf_sample ps JOIN thread t USING(utid) JOIN process p USING(upid)
        WHERE {where}'''))).scoped_samples
    assert sum(t['samples'] for t in report['sampledThreads']) == scope_count
    report['cpuProfileObserved'] = scope_count > 0
    report['scopedSampleCount'] = scope_count
    report['profileNote'] = ('Actual sampled counts inside only this captured game PID and real gesture marker. '
        'Inclusive frames overlap; counts cannot be summed as CPU time. All original loss/setup '
        'warnings/unwind errors retained. No FPS, handset result or acceptance inferred. '
        'Install paths sanitized to library basenames; raw trace retained.')
(out / 'cpu-stack-analysis.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(dict(capture=out.name, pid=pid, traceSha256=capture['traceSha256'],
    markerDurationMs=report['markerDurationMs'], cpuProfileObserved=report['cpuProfileObserved'],
    attributionComplete=report['attributionComplete'], traceLossOrErrors=report['traceLossOrErrors'],
    sampledThreads=report['sampledThreads'], topSelfFrames=report['sampledFrames'][:15],
    runningThreads=[r for r in report['threadStates'] if r['state'] == 'Running']), ensure_ascii=False))
assert report['cpuProfileObserved'], 'No actual scoped CPU samples; config is not evidence'
