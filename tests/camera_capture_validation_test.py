import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from camera_capture_validation import CAPTURES, SCENARIOS, validate_captures


def fixture():
    return {name: dict(protocol='fixed-save-reset-v2', fixtureSha256='fixture', fixtureStateChecksum='world',
                       results=[dict(scenario=s, pssKiB=100, histogramP95Ms=100,
                                     surfacePresentation=dict(available=True, complete=True, frames=40, p95Ms=100, p99Ms=150)) for s in SCENARIOS]) for name in CAPTURES}


class CaptureValidationTests(unittest.TestCase):
    def test_complete_failures_allow_diagnosis_and_remain_failures(self):
        data = fixture()
        data['camera-after']['results'][6]['pssKiB'] = 121
        data['camera-after-reverse']['results'][2]['surfacePresentation']['p99Ms'] = 166
        before = copy.deepcopy(data)
        report = validate_captures(data, 'fixture', 'world')
        self.assertTrue(report['allFourCapturesComplete'])
        self.assertFalse(report['comparisonGatesPassed'])
        self.assertEqual(len(report['comparisonGateViolations']), 2)
        self.assertEqual(data, before)

    def test_missing_launch_scenario_world_or_presented_frames_cannot_pass(self):
        mutations = [lambda d: d.pop('camera-before-reverse'),
                     lambda d: d['camera-after']['results'].pop(),
                     lambda d: d['camera-after'].update(fixtureSha256='different'),
                     lambda d: d['camera-after'].update(fixtureStateChecksum='different'),
                     lambda d: d['camera-after']['results'][1]['surfacePresentation'].update(complete=False),
                     lambda d: d['camera-after']['results'][1]['surfacePresentation'].update(frames=19),
                     lambda d: d['camera-after']['results'][1]['surfacePresentation'].update(p99Ms=float('nan')),
                     lambda d: d['camera-after']['results'][1].update(pssKiB=None)]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                data = fixture()
                mutation(data)
                with self.assertRaises(AssertionError):
                    validate_captures(data, 'fixture', 'world')

    def test_idle_requires_memory_but_not_moving_frames(self):
        data = fixture()
        for name in CAPTURES:
            data[name]['results'][0]['surfacePresentation'] = {}
        self.assertTrue(validate_captures(data, 'fixture', 'world')['comparisonGatesPassed'])
