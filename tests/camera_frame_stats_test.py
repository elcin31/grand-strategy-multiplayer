import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('camera_frame_stats', Path(__file__).parents[1] / 'scripts/camera_frame_stats.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CameraFrameStatsTest(unittest.TestCase):
    def test_active_thread_samples_exclude_initial_lifetime_average(self):
        header = 'TID USER PR NI VIRT RES SHR S[%CPU] %MEM TIME+ THREAD PROCESS\n'
        raw = (header + '10 u0 10 -10 1G 1M 1M S 90.0 2.0 0:01 main app\n' + header
               + '10 u0 10 -10 1G 1M 1M S 4.0 2.0 0:01 main app\n'
               + '11 u0 16 -4 1G 1M 1M S 20.0 2.0 0:01 mqt_v_js app\n'
               + '12 u0 16 -4 1G 1M 1M S 10.0 2.0 0:01 mqt_v_js app\n')
        result = module.thread_stats(raw, '10')
        self.assertEqual(result['samples'], 1)
        self.assertEqual(result['threads']['main-ui']['maxCpuPercent'], 4)
        self.assertEqual(result['threads']['mqt_v_js']['meanCpuPercent'], 30)

    def test_android35_extended_header(self):
        result = module.frame_stats('Total frames rendered: 2\nJanky frames: 1 (50.00%)\n'
                                    ' Flags,FrameTimelineVsyncId,IntendedVsync,FrameCompleted,\n'
                                    ' 0,100,100000000,120000000,\n0,101,200000000,260000000,\n---PROFILEDATA---')
        self.assertEqual(result['frames'], 2)
        self.assertEqual(result['p50Ms'], 60)
        self.assertEqual(result['timingSource'], 'framestats')

    def test_original_header_filters_flagged_or_invalid_samples(self):
        result = module.frame_stats('Flags,IntendedVsync,FrameCompleted,\n'
                                    '0,1000000,17000000,\n1,1000000,20000000,\n'
                                    '0,1000000,0,\n0,1000000,6001000000,\n')
        self.assertEqual(result['frames'], 1)
        self.assertEqual(result['p95Ms'], 16)

    def test_empty_idle_is_not_4950ms(self):
        result = module.frame_stats('Total frames rendered: 0\n50th percentile: 4950ms\n95th percentile: 4950ms')
        self.assertIsNone(result['p50Ms'])
        self.assertIsNone(result['p95Ms'])
        self.assertEqual(result['timingSource'], 'idle-no-frames')

    def test_histogram_fallback_without_csv(self):
        result = module.frame_stats('Total frames rendered: 10\n50th percentile: 32ms\n95th percentile: 48ms')
        self.assertEqual(result['p95Ms'], 48)
        self.assertEqual(result['reportedFrames'], 10)
        self.assertEqual(result['timingSource'], 'histogram')
