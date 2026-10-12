import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from camera_trace_scenarios import prepare_trace_scenario, trace_filename


class TraceScenariosTest(unittest.TestCase):
    def prepare(self, scenario):
        calls = []
        prepare_trace_scenario(scenario,
            lambda **kw: calls.append(('reset', kw)),
            lambda: calls.append(('settings',)),
            lambda label: calls.append(('click', label)),
            lambda section: calls.append(('nav', section)),
            lambda *args: calls.append(('adb', *args)))
        return calls

    def test_terrain_capture_selects_actual_terrain_before_final_local_reset(self):
        calls = self.prepare('terrain-pan')
        self.assertEqual(calls[-3:], [('settings',), ('click', 'Режим Рельеф'), ('reset', {'local': True})])
        self.assertNotIn(('click', 'Режим Армии'), calls)

    def test_closed_panel_capture_really_opens_and_closes_economy(self):
        calls = self.prepare('panel-closed-pan')
        self.assertEqual(calls[-3:], [('nav', 'Экономика'), ('adb', 'shell', 'input', 'keyevent', '4'), ('reset', {'local': True})])
        self.assertIn(('click', 'Режим Политическая'), calls)

    def test_unknown_or_path_input_is_rejected_before_any_device_operation(self):
        for scenario in ['../terrain-pan', 'terrain;echo bad', '', 'unknown']:
            with self.subTest(scenario=scenario), self.assertRaisesRegex(AssertionError, 'Unsupported'):
                self.prepare(scenario)
            with self.assertRaises(AssertionError):
                trace_filename(scenario)
