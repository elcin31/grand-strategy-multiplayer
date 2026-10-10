"""Analyze only the actual async gesture marker in an auxiliary system trace.

No conversion of nested slices to CPU percentages or native frame quantiles.
Uses the pinned Perfetto Python API: https://perfetto.dev/docs/analysis/trace-processor-python
"""
import hashlib
import json
import sys
from pathlib import Path
from perfetto.trace_processor import TraceProcessor

out = Path(sys.argv[1])
capture = json.loads((out / 'trace-capture.json').read_text())
assert hashlib.sha256((out / 'pinch.pftrace').read_bytes()).hexdigest() == capture['traceSha256'], 'Corrupted/wrong trace file'
pid = capture['pid']
assert isinstance(pid, int) and not isinstance(pid, bool) and pid > 0
with TraceProcessor(trace=str(out / 'pinch.pftrace')) as trace:
    windows = list(trace.query("SELECT ts, dur FROM slice WHERE name='DOMINION_PINCH_TRACE' AND dur>0"))
    assert len(windows) == 1, 'Missing/ambiguous completed real-gesture marker; no time interval invented'
    begin, end = windows[0].ts, windows[0].ts + windows[0].dur
    thread_rows = trace.query(f'''SELECT t.tid, t.name, s.state,
      SUM(MIN(s.ts+s.dur,{end})-MAX(s.ts,{begin}))/1e6 AS measured_ms, COUNT(*) AS samples
      FROM thread_state s JOIN thread t USING(utid) JOIN process p USING(upid)
      WHERE p.pid={pid} AND s.dur>0 AND s.ts<{end} AND s.ts+s.dur>{begin}
      GROUP BY t.tid,t.name,s.state ORDER BY measured_ms DESC''')
    threads = [{'tid': r.tid, 'thread': r.name, 'state': r.state,
                'observedMs': r.measured_ms, 'samples': r.samples} for r in thread_rows]
    slices = trace.query(f'''SELECT t.tid,t.name AS thread,s.name,
      COUNT(*) AS samples,SUM(s.dur)/1e6 AS nested_ms,MAX(s.dur)/1e6 AS max_ms
      FROM slice s JOIN thread_track tt ON s.track_id=tt.id
      JOIN thread t ON tt.utid=t.utid JOIN process p USING(upid)
      WHERE p.pid={pid} AND s.dur>0 AND s.ts>={begin} AND s.ts+s.dur<={end}
      GROUP BY t.tid,t.name,s.name ORDER BY nested_ms DESC LIMIT 40''')
    categories = [{'tid': r.tid, 'thread': r.thread, 'name': r.name, 'samples': r.samples,
                   'nestedInclusiveMs': r.nested_ms, 'maxCompletedMs': r.max_ms} for r in slices]
    loss = [{'name': r.name, 'index': r.idx, 'value': r.value, 'severity': r.severity}
            for r in trace.query("SELECT name,idx,value,severity FROM stats WHERE value>0 AND "
                                 "(severity IN ('error','data_loss') OR name LIKE '%overrun%' OR name LIKE '%dropped%')")]
report = {'diagnosticOnly': True, 'traceSha256': capture['traceSha256'],
          'markerStartNs': begin, 'markerEndNs': end, 'markerDurationMs': (end-begin)/1e6,
          'schedulerCoveragePresent': bool(threads), 'traceLossOrErrors': loss,
          'attributionComplete': bool(threads) and not loss,
          'threadStates': threads, 'completedNestedSlices': categories,
          'note': 'Observed thread-state intersections only inside the actual device marker. '
                  'Missing scheduler/loss means incomplete attribution, never zero CPU. '
                  'Nested slice durations overlap; their sum is NOT CPU time. '
                  'Partially completed slices excluded from category totals. No frame/FPS acceptance inferred. '
                  'Raw trace retained for inspection; separate diagnostic launch, software emulator only.'}
(out / 'trace-analysis.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({key: report[key] for key in ['diagnosticOnly', 'markerDurationMs', 'schedulerCoveragePresent', 'attributionComplete']}))
