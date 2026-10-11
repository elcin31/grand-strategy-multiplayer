import json
import sys
import unittest
import xml.etree.ElementTree as ET
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from camera_hud_data import camera_hud_data


class CameraHudDataTest(unittest.TestCase):
    def setUp(self):
        # Actual Stage9 paired artifact11680994961/world-pan hierarchy. Moving
        # its existing target fields to a separate node must preserve all data.
        self.root = ET.parse(Path(__file__).parent / 'fixtures/native_camera_targets.xml').getroot()
        self.original = camera_hud_data(self.root)
        self.split = deepcopy(self.root)
        node = next(n for n in self.split.iter('node') if n.get('content-desc', '').startswith('DOMINION_CAMERA '))
        timing = dict(self.original)
        geometry = {key: timing.pop(key) for key in ['countryTargets', 'armyTargets']}
        node.set('content-desc', 'DOMINION_CAMERA ' + json.dumps(timing))
        ET.SubElement(self.split, 'node', {'content-desc': 'DOMINION_TARGETS ' + json.dumps(geometry)})

    def test_actual_dense_legacy_and_separate_huds_preserve_every_coordinate_and_identity(self):
        self.assertEqual(camera_hud_data(self.split), self.original)
        self.assertEqual(len(json.loads(self.original['countryTargets'])), 5)
        self.assertGreater(len(json.loads(self.original['armyTargets'])), 0)
        targets = next(n.get('content-desc') for n in self.split.iter('node') if n.get('content-desc', '').startswith('DOMINION_TARGETS '))
        for fps in [30, 31, 32]:
            timing = next(n for n in self.split.iter('node') if n.get('content-desc', '').startswith('DOMINION_CAMERA '))
            payload = json.loads(timing.get('content-desc').removeprefix('DOMINION_CAMERA '))
            payload['uiFps'] = fps
            timing.set('content-desc', 'DOMINION_CAMERA ' + json.dumps(payload))
            actual = camera_hud_data(self.split)
            self.assertEqual(actual['countryTargets'], self.original['countryTargets'])
            self.assertEqual(actual['armyTargets'], self.original['armyTargets'])
            self.assertEqual(next(n.get('content-desc') for n in self.split.iter('node') if n.get('content-desc', '').startswith('DOMINION_TARGETS ')), targets)

    def test_missing_duplicate_wrong_shape_or_nonfinite_targets_fail(self):
        for change in ['missing', 'duplicate', 'overlap', 'invalid-array', 'nonfinite', 'missing-identity']:
            root = deepcopy(self.split)
            node = next(n for n in root.iter('node') if n.get('content-desc', '').startswith('DOMINION_TARGETS '))
            payload = json.loads(node.get('content-desc').removeprefix('DOMINION_TARGETS '))
            if change == 'missing':root.remove(node)
            elif change == 'duplicate':ET.SubElement(root, 'node', dict(node.attrib))
            elif change == 'overlap':payload['uiFps'] = 60
            elif change == 'invalid-array':payload['countryTargets'] = '{}'
            else:
                rows = json.loads(payload['armyTargets'])
                if change == 'nonfinite':rows[0]['x'] = float('inf')
                else:rows[0]['ids'] = []
                payload['armyTargets'] = json.dumps(rows)
            if change not in ['missing', 'duplicate']:node.set('content-desc', 'DOMINION_TARGETS ' + json.dumps(payload))
            with self.subTest(change=change), self.assertRaises(AssertionError):camera_hud_data(root)
