"""Synthetic parser regression only, never native performance evidence."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from camera_trace_analysis import analyze_trace
try:
    from perfetto.trace_processor import TraceProcessor
except ImportError:
    TraceProcessor = None


@unittest.skipIf(TraceProcessor is None, 'Pinned host-only trace analyzer is installed in diagnostic CI')
class TraceSqlIntegrationTest(unittest.TestCase):
    def test_async_android_marker_from_separate_shell_writers_matches_only_game_pid(self):
        # The real capture writes from two short-lived shell processes, while
        # the async marker's explicit PID identifies the live game process.
        raw = ('# tracer: nop\n'
               ' writer-101 ( 101) [000] .... 1.000000: tracing_mark_write: S|42|DOMINION_PINCH_TRACE|101\n'
               ' writer-102 ( 102) [000] .... 1.002000: tracing_mark_write: S|99|DOMINION_PINCH_TRACE|101\n'
               ' writer-103 ( 103) [000] .... 1.010000: tracing_mark_write: F|42|DOMINION_PINCH_TRACE|101\n'
               ' writer-104 ( 104) [000] .... 1.015000: tracing_mark_write: F|99|DOMINION_PINCH_TRACE|101\n')
        with tempfile.NamedTemporaryFile(mode='w', suffix='.systrace') as f:
            f.write(raw);f.flush()
            with TraceProcessor(trace=f.name) as trace:
                report = analyze_trace(trace, 42, 'synthetic')
        self.assertTrue(report['markerValid']);self.assertEqual(report['markerDurationMs'], 10)
        self.assertEqual(len(report['markerCandidates']), 1)
        self.assertFalse(report['attributionComplete']);self.assertFalse(report['schedulerCoveragePresent'])
