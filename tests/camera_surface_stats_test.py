import sys
import shlex
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from camera_surface_stats import map_surface_layer, surface_frame_stats, surface_sequence_stats, surface_latency_args, assert_map_backend


class SurfaceStatsTest(unittest.TestCase):
    def test_native_backend_gate_checks_the_restored_texture_and_rejects_wrong_missing_or_ambiguous_surfaces(self):
        texture='app/Main (BLAST)#2'
        surface='SurfaceView[app/Main](BLAST)#4'
        self.assertEqual(assert_map_backend(texture,'app','texture'),texture)
        self.assertEqual(assert_map_backend(surface,'app','surface'),surface)
        for layers,expected in [(texture,'surface'),(surface,'texture'),('other/Main (BLAST)#1','texture'),(texture+'\napp/Main (BLAST)#3','texture'),(texture,'unknown')]:
            with self.assertRaises(AssertionError):assert_map_backend(layers,'app',expected)
    def test_map_layer_is_unambiguous_and_ignores_other_app(self):
        layers = 'other/Main (BLAST)#1\napp/Main (BLAST)#2\nSurfaceView[app/Main]#3\nSurfaceView[app/Main](BLAST)#4'
        self.assertEqual(map_surface_layer(layers, 'app'), 'SurfaceView[app/Main](BLAST)#4')
        self.assertEqual(map_surface_layer('app/Main (BLAST)#2', 'app'), 'app/Main (BLAST)#2')
        self.assertIsNone(map_surface_layer(layers + '\nSurfaceView[app/Other](BLAST)#5', 'app'))
        self.assertIsNone(map_surface_layer('other/Main (BLAST)#1', 'app'))

    def test_actual_android_requested_state_wrapper_and_shell_metacharacters(self):
        raw='RequestedLayerState{SurfaceView[app/app.MainActivity](BLAST)#202 parentId=201}'
        layer=map_surface_layer(raw,'app')
        self.assertEqual(layer,'SurfaceView[app/app.MainActivity](BLAST)#202')
        self.assertEqual(shlex.split(surface_latency_args(layer)[-1]),[layer])
        window='RequestedLayerState{app/app.MainActivity#52 parentId=40}'
        self.assertEqual(map_surface_layer(window,'app'),'app/app.MainActivity#52')
        actual='\n'.join(['RequestedLayerState{ActivityRecord{123 u0 app/.MainActivity#124 parentId=123}', 'RequestedLayerState{abc app/app.MainActivity#133 parentId=124 z=1}', 'RequestedLayerState{app/app.MainActivity#134 parentId=133 z=1}'])
        self.assertEqual(map_surface_layer(actual,'app'),'app/app.MainActivity#134')

    def test_only_actual_present_times_and_long_stalls_are_retained(self):
        raw = '16666667\n1 1000000000 5\n2 1016666667 6\n3 7016666667 7\n0 0 0\n4 9223372036854775807 8'
        result = surface_frame_stats(raw)
        self.assertTrue(result['available'])
        self.assertEqual(result['frames'], 3)
        self.assertEqual(result['unpresentedRows'], 2)
        self.assertEqual(result['p99Ms'], 6000)
        self.assertEqual(result['maxMs'], 6000)

    def test_missing_malformed_and_out_of_order_captures_never_report_valid_timings(self):
        for raw in ['', 'Permission denied', '16666667\n0 0 0', '16666667\n1 100 1\n2 99 2',
                    '16666667\n1 100 1\ninvalid\n2 200 2']:
            self.assertFalse(surface_frame_stats(raw)['available'], raw)

    def test_ring_limit_is_reported_without_discarding_completed_stalls(self):
        raw = '16666667\n' + '\n'.join(f'1 {1000000000 + i * 20000000} 1' for i in range(128))
        result = surface_frame_stats(raw)
        self.assertTrue(result['recentRingMayBeTruncated'])
        self.assertEqual(result['frames'], 128)
        self.assertEqual(result['p95Ms'], 20)

    def test_overlapping_rings_are_deduplicated_and_long_stalls_survive(self):
        rows=[]
        for i in range(40):
            actual=1_000_000_000+i*20_000_000+(6_000_000_000 if i>=20 else 0)
            rows.append(f'1 {actual} 1')
        polls=[{'atSeconds':.1+i*.25,'raw':'16666667\n'+'\n'.join(rows[max(0,i-5):i+1])} for i in range(40)]
        result=surface_sequence_stats(polls,10)
        self.assertTrue(result['complete']);self.assertEqual(result['frames'],40)
        self.assertEqual(result['p99Ms'],6020)

    def test_slow_polling_or_invalid_ring_cannot_prove_complete_capture(self):
        raw='16666667\n1 1000000000 1\n2 1016666667 2'
        self.assertFalse(surface_sequence_stats([{'atSeconds':3,'raw':raw}],3)['complete'])
        bad=raw+'\n3 999999999 2'
        self.assertFalse(surface_sequence_stats([{'atSeconds':.1,'raw':bad}],.2)['complete'])

    def test_real_device_input_window_excludes_idle_boundaries_and_preserves_camera_stalls(self):
        rows=[100_000_000,500_000_000,510_000_000,550_000_000,950_000_000,960_000_000,2_000_000_000]
        polls=[{'atSeconds':.1,'raw':'16666667\n'+'\n'.join(f'1 {n} 1' for n in rows)}]
        result=surface_sequence_stats(polls,.2,(500_000_000,1_000_000_000))
        self.assertTrue(result['complete']);self.assertTrue(result['available'])
        self.assertEqual(result['frames'],5);self.assertEqual(result['maxMs'],400)
        self.assertEqual(result['excludedBeforeInputFrames'],1)
        self.assertEqual(result['excludedAfterGraceFrames'],1)
        self.assertEqual(result['unboundedCaptureFrames'],7)
        self.assertEqual(result['firstWindowPresentationDelayMs'],0)

    def test_invalid_or_empty_device_windows_cannot_report_a_valid_camera_sample(self):
        polls=[{'atSeconds':.1,'raw':'16666667\n1 1000000000 1\n2 1016666667 2'}]
        for window in [(0,20),(True,20),(30,20),(1.5,20)]:
            with self.assertRaises(AssertionError):surface_sequence_stats(polls,.2,window)
        self.assertFalse(surface_sequence_stats(polls,.2,(10,20))['available'])
