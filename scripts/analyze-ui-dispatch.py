"""Locate completed map swaps relative to the real application's doFrame.

Diagnostic scheduling evidence only: a swap is not a displayed frame and
inclusive durations are not CPU time. The original frame gate is unchanged.
"""
import hashlib
import json
import sys
from pathlib import Path
from perfetto.trace_processor import TraceProcessor
from camera_trace_analysis import analyze_trace

def analyze(trace,pid,digest,marker):
    base=analyze_trace(trace,pid,digest,marker)
    assert base['markerValid'],base.get('error')
    begin,end=base['markerStartNs'],base['markerEndNs']
    query=f'''WITH RECURSIVE ancestors(swap_id,id,parent_id,name,depth) AS (
      SELECT s.id,s.id,s.parent_id,s.name,0 FROM slice s
      JOIN thread_track tt ON tt.id=s.track_id JOIN thread t ON t.utid=tt.utid
      JOIN process p ON p.upid=t.upid
      WHERE p.pid={pid} AND t.tid=p.pid AND s.name='eglSwapBuffers'
        AND s.dur>0 AND s.ts>={begin} AND s.ts+s.dur<={end}
      UNION ALL SELECT a.swap_id,s.id,s.parent_id,s.name,a.depth+1
        FROM ancestors a JOIN slice s ON s.id=a.parent_id
    ), nearest AS (
      SELECT *,ROW_NUMBER() OVER(PARTITION BY swap_id ORDER BY depth) rank
      FROM ancestors WHERE name LIKE 'Choreographer#doFrame %'
    ) SELECT id AS frame_id,name,COUNT(*) swaps
      FROM nearest WHERE rank=1 GROUP BY id,name ORDER BY id'''
    rows=[dict(frameId=r.frame_id,name=r.name,completedUiSwaps=r.swaps) for r in trace.query(query)]
    slices=trace.query(f'''SELECT s.name,COUNT(*) n,SUM(s.dur)/1e6 ms,MAX(s.dur)/1e6 max_ms
      FROM slice s JOIN thread_track tt ON tt.id=s.track_id
      JOIN thread t ON t.utid=tt.utid JOIN process p ON p.upid=t.upid
      WHERE p.pid={pid} AND t.tid=p.pid AND s.dur>0
        AND s.ts>={begin} AND s.ts+s.dur<={end}
        AND s.name IN ('eglSwapBuffers','DOMINION_UI_TASKS','input','animation')
      GROUP BY s.name ORDER BY s.name''')
    counts=[dict(name=r.name,completedCalls=r.n,nestedInclusiveMs=r.ms,maxCompletedMs=r.max_ms) for r in slices]
    total=next((r['completedCalls'] for r in counts if r['name']=='eglSwapBuffers'),0)
    return dict(diagnosticOnly=True,traceSha256=digest,gamePid=pid,gestureMarker=marker,
                markerStartNs=begin,markerEndNs=end,markerDurationMs=base['markerDurationMs'],
                traceLossOrErrors=base['traceLossOrErrors'],attributionComplete=base['attributionComplete'],
                completedUiSwaps=total,completedUiSwapsInsideDoFrame=sum(r['completedUiSwaps'] for r in rows),
                doFramesWithMultipleUiSwaps=sum(r['completedUiSwaps']>1 for r in rows),
                swapsByDoFrame=rows,completedNestedSlices=counts,
                note='Actual scoped game PID and complete marker only. Swaps are not displayed frames. '
                     'Posted draws may be outside doFrame; this does not establish better FPS or acceptance. '
                     'Nested durations overlap; CPU time is not their sum. Software emulator only.')

if __name__=='__main__':
    root=Path(sys.argv[1]);capture=json.loads((root/'trace-capture.json').read_text())
    path=root/capture['traceFile']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==capture['traceSha256']
    with TraceProcessor(trace=str(path)) as trace:
        report=analyze(trace,capture['pid'],capture['traceSha256'],capture['gestureMarker'])
    (root/'ui-dispatch-analysis.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['diagnosticOnly','gamePid','markerDurationMs',
        'completedUiSwaps','completedUiSwapsInsideDoFrame','doFramesWithMultipleUiSwaps','attributionComplete']},indent=2))
