import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]/'scripts'))
from camera_gesture import PREFIX, gesture_command, gesture_timing, validate_gesture_timing


def timing(kind='pan'):
    return dict(kind=kind, gapMs=0, cycles=[dict(downNs=i*2000+1, upNs=i*2000+1900) for i in range(5)])


class CameraGestureTests(unittest.TestCase):
    def test_continuous_command_and_actual_marker_preserve_real_scheduling_gaps(self):
        self.assertTrue(gesture_command('pan').endswith('CameraGesture pan 5 0'))
        data=timing();before=copy.deepcopy(data)
        self.assertEqual(gesture_timing(PREFIX+json.dumps(data)+'\nPASS', 'pan'), before)
        self.assertEqual(data,before)  # Actual gaps are never clamped or hidden.
        for kind,count,gap in [('other',5,0),('pan',0,0),('pan',True,0),('pan',51,0),('pan',5,-1),('pan',5,float('nan'))]:
            with self.assertRaises(AssertionError):gesture_command(kind,count,gap)

    def test_missing_ambiguous_wrong_kind_and_injected_idle_timing_fail(self):
        raw=PREFIX+json.dumps(timing())
        for text,kind in [('', 'pan'),(raw+'\n'+raw,'pan'),(raw,'pinch')]:
            with self.assertRaises(AssertionError):gesture_timing(text,kind)
        data=timing();data['gapMs']=150
        with self.assertRaisesRegex(AssertionError,'Different injected'):validate_gesture_timing(data,'pan')

    def test_incomplete_nonchronological_and_invalid_native_clock_fail(self):
        mutations=[lambda d:d['cycles'].pop(),lambda d:d['cycles'][1].update(downNs=10),
                   lambda d:d['cycles'][0].update(upNs=1),lambda d:d['cycles'][0].update(downNs=True),
                   lambda d:d['cycles'][0].update(upNs=float('inf')),lambda d:d.update(extra=1)]
        for mutation in mutations:
            data=timing();mutation(data)
            with self.assertRaises(AssertionError):validate_gesture_timing(data,'pan')
