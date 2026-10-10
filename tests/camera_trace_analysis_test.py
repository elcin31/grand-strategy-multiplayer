import sys
import unittest
from pathlib import Path
from types import SimpleNamespace as Row

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from camera_trace_analysis import analyze_trace


class Trace:
    def __init__(self, markers=(), diagnostics=(), threads=(), slices=()):
        self.markers, self.diagnostics, self.threads, self.slices = markers, diagnostics, threads, slices
        self.queries = []

    def query(self, sql):
        self.queries.append(sql)
        if 'FROM stats' in sql: return self.diagnostics
        if "s.name='DOMINION_PINCH_TRACE'" in sql: return self.markers
        if 'FROM thread_state' in sql: return self.threads
        return self.slices


class TraceAnalysisTest(unittest.TestCase):
    def test_missing_partial_ambiguous_marker_keeps_loss_but_invents_no_cpu_interval(self):
        loss = Row(name='traced_buf_bytes_overwritten', idx=0, value=6152192, severity='info')
        for markers in [(), (Row(ts=1, dur=-1),), (Row(ts=1, dur=5), Row(ts=7, dur=5))]:
            trace = Trace(markers=markers, diagnostics=[loss])
            report = analyze_trace(trace, 42, 'digest')
            self.assertFalse(report['markerValid']);self.assertFalse(report['attributionComplete'])
            self.assertNotIn('markerDurationMs', report);self.assertEqual(report['threadStates'], [])
            self.assertEqual(report['traceLossOrErrors'][0]['value'], 6152192)
            self.assertEqual(len(trace.queries), 2)
            self.assertIn("name LIKE '%overwritten%'", trace.queries[0])
            self.assertIn('p.pid=42', trace.queries[1])

    def test_exact_window_missing_scheduler_and_overwrites_never_claim_complete_attribution(self):
        thread = Row(tid=42, name='main', state='Running', measured_ms=7.5, samples=3)
        slice = Row(tid=42, thread='main', name='nested', samples=2, nested_ms=12.0, max_ms=8.0)
        loss = Row(name='traced_buf_chunks_overwritten', idx=0, value=193, severity='info')
        for threads, diagnostics, complete in [([], [], False), ([thread], [loss], False), ([thread], [], True)]:
            trace = Trace([Row(ts=100, dur=10000000)], diagnostics, threads, [slice])
            report = analyze_trace(trace, 42, 'digest')
            self.assertTrue(report['markerValid']);self.assertEqual(report['markerDurationMs'], 10)
            self.assertEqual(report['attributionComplete'], complete)
            self.assertEqual(report['completedNestedSlices'][0]['nestedInclusiveMs'], 12)
            self.assertNotIn('cpuPercent', report)
            self.assertIn('s.ts<10000100 AND s.ts+s.dur>100', trace.queries[2])

    def test_untrusted_pid_cannot_be_interpolated(self):
        for pid in [0, -1, True, '42', '42; bad']:
            trace = Trace()
            with self.assertRaises(AssertionError): analyze_trace(trace, pid, 'digest')
            self.assertEqual(trace.queries, [])
