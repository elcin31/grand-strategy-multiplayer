import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from camera_capture_validation import CAPTURES,SCENARIOS
spec=importlib.util.spec_from_file_location('camera_orders',Path(__file__).parents[1]/'scripts/compare-camera-orders.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class CameraOrdersTests(unittest.TestCase):
    def captures(self):
        return {name:dict(protocol='fixed-save-reset-v2',fixtureSha256='fixture',fixtureStateChecksum='world',
            inputProtocol='continuous-pointer-v1',results=[dict(scenario=s,pssKiB=100,p50Ms=50,p95Ms=100,jankPercent=0,
                histogramP95Ms=100,surfacePresentation=dict(available=True,complete=True,frames=40,p95Ms=100,p99Ms=150),
                gestureTiming=None if s=='01-idle' else dict(kind='pinch' if s=='03-pinch' else 'pan',gapMs=0,
                    cycles=[dict(downNs=i*2000+1,upNs=i*2000+1900) for i in range(5)])) for s in SCENARIOS]) for name in CAPTURES}

    def run_orders(self,data,failed=False):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name,capture in data.items():
                (root/name).mkdir();(root/name/'results.json').write_text(json.dumps(capture))
            with contextlib.redirect_stdout(io.StringIO()):
                if failed:
                    with self.assertRaisesRegex(AssertionError,'original camera order failed'):module.compare_orders(root)
                else:module.compare_orders(root)
            for order in ['FORWARD','REVERSE']:
                self.assertEqual(len(json.loads((root/('CAMERA_NATIVE_PAIRED_'+order+'.json')).read_text())['rows']),9)
            return json.loads((root/'CAMERA_ABBA_QA.json').read_text())

    def test_complete_forward_reverse_success_survives_separate_processes(self):
        self.assertTrue(self.run_orders(self.captures())['comparisonGatesPassed'])

    def test_failed_forward_and_reverse_each_preserve_both_orders_and_fail(self):
        for name in ['camera-after','camera-after-reverse']:
            with self.subTest(name=name):
                data=self.captures();data[name]['results'][2]['surfacePresentation']['p99Ms']=166
                self.assertFalse(self.run_orders(data,failed=True)['comparisonGatesPassed'])

    def test_failed_memory_gate_cannot_be_replaced_by_successful_frame_gates(self):
        data=self.captures();data['camera-after-reverse']['results'][0]['pssKiB']=121
        self.assertFalse(self.run_orders(data,failed=True)['comparisonGatesPassed'])
