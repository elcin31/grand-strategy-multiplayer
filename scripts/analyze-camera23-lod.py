"""Complete App FrameTimeline durations during real staged LOD changes.

Camera23 LOD intentionally has fixed quiet periods so detail can be prepared.
Absence of a frame during those pauses is not a missed frame. No presentation
interval quantiles are substituted for actual complete frame durations here.
"""
import hashlib,json,math,sys
from pathlib import Path
from perfetto.trace_processor import TraceProcessor
from camera_trace_analysis import analyze_trace

out=Path(sys.argv[1]);capture=json.loads((out/'trace-capture.json').read_text());file=out/capture['traceFile']
assert hashlib.sha256(file.read_bytes()).hexdigest()==capture['traceSha256']
with TraceProcessor(trace=str(file)) as trace:
    scope=analyze_trace(trace,capture['pid'],capture['traceSha256'],capture['gestureMarker']);assert scope['markerValid']
    b,e,pid=scope['markerStartNs'],scope['markerEndNs'],capture['pid']
    rows=[dict(token=r.surface_frame_token,ms=r.dur/1e6,jank=r.jank_type,present=r.present_type,onTime=r.on_time_finish) for r in trace.query(f'''SELECT f.surface_frame_token,f.dur,f.jank_type,f.present_type,f.on_time_finish
        FROM actual_frame_timeline_slice f JOIN process p USING(upid)
        WHERE p.pid={pid} AND f.dur>0 AND f.ts>={b} AND f.ts+f.dur<={e}''')]
    assert len(rows)>=12,'Missing complete App FrameTimeline records'
    assert len({r['token'] for r in rows})==len(rows),'Duplicate frame tokens'
    values=sorted(r['ms'] for r in rows)
    report={'traceSha256':capture['traceSha256'],'scopedCompleteFrames':len(rows),'p50Ms':values[math.ceil(len(values)*.5)-1],'p95Ms':values[math.ceil(len(values)*.95)-1],'p99Ms':values[math.ceil(len(values)*.99)-1],'latePresentedFrames':sum(r['present']=='Late Present' for r in rows),'jankTypes':sorted(set(r['jank'] for r in rows)),'traceLossOrErrors':scope['traceLossOrErrors'],'rows':rows,'physicalRedmiTest':False,'note':'Complete actual Android App FrameTimeline durations inside only the real staged input marker. Fixed .8s preparation pauses produce no synthetic stutters. These are not physical FPS, isolated hardware GPU times or the primary continuous-gesture benchmark.'}
(out/'lod-frames.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='rows'}))
