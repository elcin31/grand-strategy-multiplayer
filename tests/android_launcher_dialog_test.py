import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from android_launcher_dialog import quickstep_anr_close_bounds


def dialog():
    return ET.fromstring('''<hierarchy><node package="android" bounds="[224,91][1056,597]">
      <node package="android" resource-id="android:id/alertTitle" text="Quickstep isn't responding" />
      <node package="android" resource-id="android:id/aerr_close" text="Close app" enabled="true" clickable="true" bounds="[266,282][1014,408]" />
      <node package="android" resource-id="android:id/aerr_wait" text="Wait" enabled="true" clickable="true" bounds="[266,408][1014,534]" />
    </node></hierarchy>''')


class LauncherDialogTest(unittest.TestCase):
    def test_actual_observed_quickstep_system_dialog(self):
        self.assertEqual(quickstep_anr_close_bounds(dialog()), (266, 282, 1014, 408))

    def test_game_unknown_and_spoofed_dialogs_are_never_dismissed(self):
        for title, package in [("Dominion isn't responding", 'android'),
                ("Other isn't responding", 'android'), ("Quickstep keeps stopping", 'android'),
                ("Quickstep isn't responding", 'com.elcin31.grandstrategymultiplayer')]:
            root = dialog(); root[0][0].set('text', title); root[0][0].set('package', package)
            self.assertIsNone(quickstep_anr_close_bounds(root))

    def test_ambiguous_disabled_or_invalid_close_controls_are_rejected(self):
        for attribute, value in [('enabled', 'false'), ('clickable', 'false'),
                ('visible-to-user', 'false'), ('text', 'Wait'), ('resource-id', 'android:id/button1'),
                ('bounds', '[0,0][1,1]'), ('bounds', '[266,282][266,408]'), ('bounds', 'malformed')]:
            root = dialog(); root[0][1].set(attribute, value)
            self.assertIsNone(quickstep_anr_close_bounds(root))
        root = dialog(); root[0].append(ET.fromstring(ET.tostring(root[0][0])))
        self.assertIsNone(quickstep_anr_close_bounds(root))
        root = dialog(); root[0].append(ET.fromstring(ET.tostring(root[0][1])))
        self.assertIsNone(quickstep_anr_close_bounds(root))


if __name__ == '__main__':
    unittest.main()
