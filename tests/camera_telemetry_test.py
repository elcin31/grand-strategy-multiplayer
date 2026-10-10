import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from camera_telemetry import camera_telemetry


def log(**value):
    return '10-10 06:30:00.000 I ReactNativeJS: DOMINION_CAMERA ' + json.dumps(value)


class CameraTelemetryTest(unittest.TestCase):
    def test_active_timing_does_not_use_final_idle_hud(self):
        result = camera_telemetry('\n'.join([
            log(uiFps=35, cameraUpdates=18, frameP95Ms=100, rasterBuilds=10),
            log(uiFps=50, cameraUpdates=25, frameP95Ms=33, rasterBuilds=12),
            log(uiFps=60, cameraUpdates=0, frameP95Ms=17, rasterBuilds=12)]))
        self.assertEqual(result['activeSamples'], 2)
        self.assertEqual(result['activeUiCallbackFpsRange'], {'min': 35, 'max': 50})
        self.assertEqual(result['activeUiCallbackP95MsRange'], {'min': 33, 'max': 100})
        self.assertEqual(result['counterDeltasBetweenSamples']['rasterBuilds'], 2)
        self.assertEqual(result['samples'][-1]['cameraUpdates'], 0)

    def test_real_logcat_truncation_is_reported_as_missing(self):
        truncated = 'I ReactNativeJS: DOMINION_CAMERA {"countryTargets":"' + 'x'*4100
        result = camera_telemetry(truncated+'\n'+log(uiFps=40, cameraUpdates=12))
        self.assertEqual(result['malformedSamples'], 1)
        self.assertEqual(result['completeSamples'], 1)
        self.assertEqual(result['activeSamples'], 1)

    def test_legacy_valid_samples_do_not_invent_frame_histogram(self):
        result = camera_telemetry(log(uiFps=45, cameraUpdates=10))
        self.assertEqual(result['activeUiCallbackFpsRange']['min'], 45)
        self.assertIsNone(result['activeUiCallbackP95MsRange'])
        self.assertIsNone(result['activeUiCallbackP99MsRange'])

    def test_invalid_nonfinite_or_nonobject_values_cannot_contaminate_timing(self):
        result = camera_telemetry('\n'.join([
            'DOMINION_CAMERA []', log(uiFps=-1), log(uiFps=float('nan')),
            log(uiFps=60, cameraUpdates=2, frameP95Ms=float('inf'), countryTargets='x')]))
        self.assertEqual(result['malformedSamples'], 3)
        self.assertEqual(result['completeSamples'], 1)
        self.assertNotIn('frameP95Ms', result['samples'][0])
        self.assertNotIn('countryTargets', result['samples'][0])
        self.assertNotIn('p95Ms', result['samples'][0])

    def test_sample_retention_is_bounded(self):
        result = camera_telemetry('\n'.join(log(uiFps=60, cameraUpdates=1, rasterBuilds=i) for i in range(130)))
        self.assertEqual(result['completeSamples'], 130)
        self.assertEqual(result['retainedSamples'], 120)
        self.assertEqual(result['samples'][0]['rasterBuilds'], 10)

    def test_counter_resets_and_absent_logs_return_unknown_deltas(self):
        self.assertEqual(camera_telemetry('No camera logs')['completeSamples'], 0)
        for values in ([12, 2], [12, 2, 20]):
            result = camera_telemetry('\n'.join(log(uiFps=60, rasterBuilds=i) for i in values))
            self.assertIsNone(result['counterDeltasBetweenSamples']['rasterBuilds'])
