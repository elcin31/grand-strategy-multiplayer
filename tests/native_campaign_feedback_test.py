import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from native_campaign_feedback import campaign_feedback
PACKAGE='com.elcin31.grandstrategymultiplayer'


class CampaignFeedbackTest(unittest.TestCase):
    def test_real_release_capture_with_deferred_map_loader_is_visible_feedback(self):
        # Exact9c native artifact11665813433: early assertion failed even though
        # the real loading caption and campaign shell were already displayed.
        root=ET.parse(Path(__file__).parent/'fixtures/native_campaign_loading.xml').getroot()
        self.assertFalse(any('Загрузка кампании' in n.get('text','') or
                             'Политическая' in n.get('text','') for n in root.iter('node')))
        self.assertEqual(campaign_feedback(root,PACKAGE),'map-loading')

    def test_missing_feedback_hidden_zero_bounds_or_another_app_still_fail(self):
        for attrs in [dict(package='com.android.launcher3'),dict(bounds='[0,0][0,0]'),
                      {'visible-to-user':'false'},dict(text='Главное меню'),dict(text='Ошибка загрузки')]:
            root=ET.Element('hierarchy');node=ET.SubElement(root,'node',
                {'package':PACKAGE,'text':'Подготовка карты мира…','bounds':'[10,10][200,40]',**attrs})
            self.assertIsNone(campaign_feedback(root,PACKAGE))
        for text,expected in [('Загрузка кампании…','campaign-loading'),('Политическая · Balanced','campaign')]:
            root=ET.Element('hierarchy');ET.SubElement(root,'node',package=PACKAGE,text=text,bounds='[10,10][200,40]')
            self.assertEqual(campaign_feedback(root,PACKAGE),expected)
