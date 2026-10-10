"""Analyze only the actual async gesture marker in an auxiliary system trace.

No conversion of nested slices to CPU percentages or native frame quantiles.
Uses the pinned Perfetto Python API: https://perfetto.dev/docs/analysis/trace-processor-python
"""
import hashlib
import json
import sys
from pathlib import Path
from perfetto.trace_processor import TraceProcessor
from camera_trace_analysis import analyze_trace

out = Path(sys.argv[1])
capture = json.loads((out / 'trace-capture.json').read_text())
assert hashlib.sha256((out / 'pinch.pftrace').read_bytes()).hexdigest() == capture['traceSha256'], 'Corrupted/wrong trace file'
with TraceProcessor(trace=str(out / 'pinch.pftrace')) as trace:
    report = analyze_trace(trace, capture['pid'], capture['traceSha256'])
report['note'] = 'Observed thread-state intersections only inside the actual device marker. '
report['note'] += ('Marker encloses input injection; asynchronous presentation after its end is outside this interval. '
                  'Missing scheduler/loss means incomplete attribution, never zero CPU. '
                  'Nested slice durations overlap; their sum is NOT CPU time. '
                  'Partially completed slices excluded from category totals. No frame/FPS acceptance inferred. '
                  'Raw trace retained for inspection; separate diagnostic launch, software emulator only.')
(out / 'trace-analysis.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
assert report['markerValid'], report['error']
print(json.dumps({key: report[key] for key in ['diagnosticOnly', 'markerDurationMs', 'schedulerCoveragePresent', 'attributionComplete']}))
