import copy
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from native_online_validation import (assert_online_campaign, paid_course_fingerprint,
                                      assert_same_native_session, exit_confirmation_button,
                                      visible_control_bounds)


class NativeOnlineValidationTest(unittest.TestCase):
    def test_offscreen_inverted_bounds_are_scrolled_until_a_real_enabled_control_is_visible(self):
        def node(bounds, enabled='true'):
            return ET.Element('node', {'bounds': bounds, 'enabled': enabled})
        # Actual failed signed native hierarchy: clipped TextView below ScrollView.
        for bounds in ['[982,704][1151,610]', '[0,0][0,0]', '[-1,2][30,50]',
                       '[1,2][1281,50]', '[1,2][30,721]', 'missing']:
            self.assertIsNone(visible_control_bounds(node(bounds)))
        visible=node('[982,450][1151,490]')
        self.assertEqual(visible_control_bounds(visible,640),(982,450,1151,490))
        self.assertIsNone(visible_control_bounds(node('[982,620][1151,670]'),640))
        self.assertIsNone(visible_control_bounds(node('[982,450][1151,490]','false')))

    def test_actual_exit_confirmation_accepts_android_uppercase_and_rejects_other_dialogs_or_duplicate_controls(self):
        def dialog(label='ВЫЙТИ',title='Выйти из кампании?'):
            tree=ET.Element('hierarchy')
            ET.SubElement(tree,'node',{'text':title,'class':'android.widget.TextView'})
            button=ET.SubElement(tree,'node',{'text':label,'class':'android.widget.Button',
                                 'enabled':'true','clickable':'true'})
            return tree,button
        for label in ['ВЫЙТИ','Выйти']:
            tree,button=dialog(label);self.assertIs(exit_confirmation_button(tree),button)
        for label,title in [('ОСТАТЬСЯ','Выйти из кампании?'),('ВЫЙТИ','Действие отклонено')]:
            tree,_=dialog(label,title)
            with self.assertRaises(AssertionError):exit_confirmation_button(tree)
        tree,button=dialog();tree.append(copy.deepcopy(button))
        with self.assertRaises(AssertionError):exit_confirmation_button(tree)

    def fixture(self):
        return {'version': 11, 'checksum': 'a1b2c3d4', 'state': {
            'id': 'native-room', 'stateVersion': 18, 'speed': 0, 'phase': 'paused', 'tick': 3,
            'countries': {**{str(i): {} for i in range(194)}, 'germany': {
                'treasury': 1000, 'politicalPower': 44, 'completedFocuses': [],
                'nationalFocus': {'focusId': 'eco-audit', 'progress': 0, 'startedTick': 3}}},
            'provinces': [{}]*2924, 'cities': [{}]*5411,
            'players': [{'id': 'native-owner', 'countryId': 'germany', 'connected': True,
                         'aiControlled': False}, {'id': 'guest', 'countryId': 'france'}],
            'focusEvents': [{'id': 'one', 'countryId': 'germany', 'focusId': 'eco-audit',
                             'kind': 'Started', 'tick': 3}]}}

    def test_reconnect_requires_original_native_country_owner_and_paused_authority(self):
        valid = self.fixture()
        assert_online_campaign(valid, 'native-room', 'native-owner', 'germany')
        corruptions = [lambda x: x['state'].update(id='new-room'),
                       lambda x: x['state'].update(stateVersion=12),
                       lambda x: x['state']['players'][0].update(countryId='france'),
                       lambda x: x['state']['players'][0].update(aiControlled=True),
                       lambda x: x['state']['players'][0].update(connected=False),
                       lambda x: x['state']['players'].append({'id': 'duplicate'}),
                       lambda x: x['state'].update(speed=1),
                       lambda x: x['state'].update(phase='running'),
                       lambda x: x.pop('checksum')]
        for change in corruptions:
            with self.subTest(change=change):
                wrong = copy.deepcopy(valid); change(wrong)
                with self.assertRaises((AssertionError, KeyError)):
                    assert_online_campaign(wrong, 'native-room', 'native-owner', 'germany')

    def test_paused_reconnect_fingerprint_detects_repeat_payment_progress_and_event(self):
        valid = self.fixture()['state']; before = paid_course_fingerprint(valid, 'germany')
        for field, value in [('treasury', 780), ('politicalPower', 28)]:
            wrong = copy.deepcopy(valid); wrong['countries']['germany'][field] = value
            self.assertNotEqual(paid_course_fingerprint(wrong, 'germany'), before)
        for change in [lambda x: x['countries']['germany']['nationalFocus'].update(progress=1),
                       lambda x: x['countries']['germany']['completedFocuses'].append({'focusId': 'eco-audit'}),
                       lambda x: x['focusEvents'].append(copy.deepcopy(x['focusEvents'][0]))]:
            wrong = copy.deepcopy(valid); change(wrong)
            with self.assertRaises(AssertionError): paid_course_fingerprint(wrong, 'germany')
        wrong = copy.deepcopy(valid); wrong['tick'] += 1
        self.assertNotEqual(paid_course_fingerprint(wrong, 'germany'), before)

    def test_actual_prefixed_secure_session_keys_and_uid_survive_without_recreation(self):
        keys = {'key_v1-dominion.sessions.v1',
                'key_v1-dominion.session.9cc50b47-6263-4ec7-8d4f-90ded6a453a7'}
        assert_same_native_session('10123', '10123', keys, keys)
        for uid, after in [('10234', keys), ('10123', set()),
                           ('10123', keys|{'key_v1-dominion.session.00000000-0000-0000-0000-000000000000'})]:
            with self.assertRaises(AssertionError): assert_same_native_session('10123', uid, keys, after)


if __name__ == '__main__': unittest.main()
