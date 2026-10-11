import sys
import unittest
import xml.etree.ElementTree as ET
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from native_diplomacy_feedback import capture_relation_snapshot, relation_snapshot, assert_relation_mission, assert_paid_gift


class NativeDiplomacyFeedbackTest(unittest.TestCase):
    def setUp(self):
        # Real Stage8 native artifact11681745200, read-1.xml: the mission paid
        # +21 and detected intelligence legitimately cost15 relations.
        root = ET.parse(Path(__file__).parent / 'fixtures/native_diplomacy_detected.xml').getroot()
        self.texts = [n.get('text') for n in root.iter('node') if n.get('text')]
        self.after = relation_snapshot(self.texts, 'Бразилия')
        self.before = {'tick': 52, 'relation': 3,
                       'reasons': {'Культурные связи': 5, 'Репутация экспансии': -2}}
        self.progress = 'Улучшение отношений: 7/12 мес. · 3 млн / мес.'

    def test_real_detected_spy_capture_retains_monthly_reward_and_negative_consequence(self):
        self.assertEqual(self.after['reasons']['Дипломатическое сотрудничество'], 21)
        self.assertEqual(self.after['reasons']['Обнаруженная разведка'], -15)
        result = assert_relation_mission(self.before, self.after, self.progress, 6)
        self.assertEqual(result['months'], 7)
        self.assertEqual(result['missionReward'], 21)
        self.assertEqual(result['relationAfter'], 9)

    def test_missing_reward_wrong_clock_instant_credit_and_forged_net_value_fail(self):
        for change in [dict(tick=58), dict(relation=24),
                       dict(reasons={**self.after['reasons'], 'Дипломатическое сотрудничество': 18}),
                       dict(reasons={'Культурные связи': 5, 'Репутация экспансии': -2})]:
            with self.subTest(change=change), self.assertRaises(AssertionError):
                assert_relation_mission(self.before, {**self.after, **change}, self.progress, 6)
        for progress in ['Улучшение отношений: 0/12 мес. · 3 млн / мес.',
                         'Улучшение отношений: 12/12 мес. · 3 млн / мес.',
                         'Улучшение отношений: NaN/12 мес. · 3 млн / мес.']:
            with self.subTest(progress=progress), self.assertRaises(AssertionError):
                assert_relation_mission(self.before, self.after, progress, 6)
        instant = deepcopy(self.before)
        instant['reasons']['Дипломатическое сотрудничество'] = 21
        with self.assertRaises(AssertionError):
            assert_relation_mission(instant, self.after, self.progress, 6)

    def test_no_detection_context_change_and_duplicate_country_reason_labels(self):
        after = deepcopy(self.after)
        del after['reasons']['Обнаруженная разведка']
        after['reasons']['Репутация экспансии'] = -4
        after['relation'] = 22
        self.assertEqual(assert_relation_mission(self.before, after, self.progress, 6)['missionReward'], 21)
        texts = [t for t in self.texts if t != 'Обнаруженная разведка: -15']
        texts.insert(texts.index('Дипломатические миссии'), 'Дипломатическое сотрудничество: +3')
        texts[texts.index('Бразилия · отношения 9 · доверие 44 · МИР')] = 'Бразилия · отношения 27 · доверие 44 · МИР'
        duplicated = relation_snapshot(texts, 'Бразилия')
        self.assertEqual(assert_relation_mission(self.before, duplicated, self.progress, 6)['missionReward'], 24)

    def test_incomplete_invalid_or_saturated_captures_are_not_accepted(self):
        for texts in [[t for t in self.texts if t != 'Дипломатические миссии'],
                      [t.replace('Обнаруженная разведка: -15', 'Обнаруженная разведка: NaN') for t in self.texts],
                      [t for t in self.texts if not t.startswith('Ход ')],
                      [t.replace(' · МИР', ' · ВОЙНА') for t in self.texts]]:
            with self.assertRaises(AssertionError):
                relation_snapshot(texts, 'Бразилия')
        with self.assertRaises(AssertionError):
            assert_relation_mission({**self.before, 'relation': 100}, self.after, self.progress, 6)

    def test_scroll_to_real_ledger_end_before_single_snapshot(self):
        clipped=ET.parse(Path(__file__).parent/'fixtures/native_diplomacy_clipped.xml')
        clipped_texts=[n.get('text') for n in clipped.iter('node') if n.get('text')]
        with self.assertRaisesRegex(AssertionError,'Incomplete relation ledger'):
            relation_snapshot(clipped_texts,'Бразилия')
        calls=[]
        def read(prefix):calls.append(prefix)
        def capture(name):
            self.assertEqual(calls,['Бразилия · отношения ','Дипломатические миссии'])
            calls.append(name)
            return self.texts
        self.assertEqual(capture_relation_snapshot('Бразилия','after',read,capture),self.after)
        self.assertEqual(calls[-1],'after')

    def test_scrolling_cannot_accept_a_still_incomplete_ledger(self):
        clipped=[t for t in self.texts if t!='Дипломатические миссии']
        with self.assertRaisesRegex(AssertionError,'Incomplete relation ledger'):
            capture_relation_snapshot('Бразилия','after',lambda _:None,lambda _:clipped)

    def test_paid_gift_retains_the_actual_refused_pact_spy_ledger(self):
        root=ET.parse(Path(__file__).parent/'fixtures/native_diplomacy_refused.xml')
        before=relation_snapshot([n.get('text') for n in root.iter('node') if n.get('text')],'Бразилия')
        self.assertEqual((before['relation'],before['trust']),(2,41))
        after={**before,'relation':22,'trust':44,'reasons':{**before['reasons'],'Дары':20}}
        evidence=assert_paid_gift(before,after)
        self.assertEqual(evidence['reasonsAfter']['Обнаруженная разведка'],-20)
        self.assertEqual(evidence['reasonsAfter']['Дипломатическое сотрудничество'],18)
        for change in [dict(tick=before['tick']+1),dict(trust=41),dict(relation=100),dict(reasons={'Дары':20}),dict(reasons={**after['reasons'],'Дары':19})]:
            with self.assertRaises(AssertionError):assert_paid_gift(before,{**after,**change})

    def test_invalid_trust_cannot_be_read_as_valid_diplomacy_evidence(self):
        texts=[t.replace('доверие 44','доверие 101') for t in self.texts]
        with self.assertRaisesRegex(AssertionError,'Invalid trust'):relation_snapshot(texts,'Бразилия')
