"""Prevent false native acceptance from mismatched worlds or relaxed gates."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / 'scripts/compare-camera-native.py'


class CameraProtocolTest(unittest.TestCase):
    def compare(self, change, require_surface=False):
        data = {'protocol': 'fixed-save-reset-v2', 'fixtureSha256': 'fixture-a',
                'fixtureStateChecksum': 'checksum-a', 'results': []}
        for i, name in enumerate(['idle', 'pan', '03-pinch', 'world', 'local', 'terrain', 'military', 'open', 'closed']):
            data['results'].append({'scenario': name, 'p50Ms': 16, 'p95Ms': 33,
                                    'histogramP95Ms': 33, 'pssKiB': 200000, 'jankPercent': 5,
                                    'surfacePresentation':{'available':True,'complete':True,'frames':40,'p50Ms':16,'p95Ms':33,'p99Ms':50}})
        after = json.loads(json.dumps(data));change(after)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'before.json').write_text(json.dumps(data))
            (root / 'after.json').write_text(json.dumps(after))
            env=dict(os.environ)
            if require_surface:env['CAMERA_REQUIRE_SURFACE_PRESENTATION']='1'
            return subprocess.run([sys.executable, str(SCRIPT), 'before.json', 'after.json'],
                                  cwd=root, text=True, capture_output=True,env=env)

    def test_equal_fixed_world_passes_and_changed_fixture_fails(self):
        self.assertEqual(self.compare(lambda _: None).returncode, 0)
        result = self.compare(lambda d: d.update(fixtureSha256='another-world'))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Different benchmark save fixtures', result.stderr)

    def test_panel_regression_still_fails_original_twenty_percent_gate(self):
        def regress(d): d['results'][-1]['histogramP95Ms'] = 50
        result = self.compare(regress)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('closed p95 regression', result.stderr)

    def test_pinch_and_memory_capture_remain_mandatory(self):
        def regress(d): d['results'][2]['histogramP95Ms'] = 37
        self.assertIn('Pinch p95 regression', self.compare(regress).stderr)
        def missing(d): d['results'][3]['pssKiB'] = None
        self.assertIn('Native memory capture missing', self.compare(missing).stderr)

    def test_surface_backend_cannot_pass_with_incomplete_capture_or_worse_tail(self):
        self.assertEqual(self.compare(lambda _:None,require_surface=True).returncode,0)
        def incomplete(d):d['results'][2]['surfacePresentation']['complete']=False
        self.assertIn('complete compositor capture missing',self.compare(incomplete,require_surface=True).stderr)
        def tail(d):d['results'][2]['surfacePresentation']['p99Ms']=75
        self.assertIn('compositor p99 regression',self.compare(tail,require_surface=True).stderr)
