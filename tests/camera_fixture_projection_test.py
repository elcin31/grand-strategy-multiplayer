import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
from camera_fixture_projection import assert_paused_fixture


class FixtureProjectionTest(unittest.TestCase):
    def fixture(self):
        return {'format':1,'state':{'stateVersion':12,'phase':'paused','tick':0,'id':'fixture',
            'countries':{'de':{'treasury':100,'economy':{'monthlyBalance':3}}},
            'provinces':[{'id':'p','ownerId':'de','neighbors':['q']}],
            'cities':[{'id':'c','provinceId':'p','population':30}],
            'armies':[{'id':'a','ownerId':'de','provinceId':'p','troops':1000}],
            'diplomacy':{},'wars':[],'constructions':[],'movements':[]}}
    def test_only_inactive_additive_schema14_defaults_can_change_the_legacy_workload(self):
        base=self.fixture();actual=copy.deepcopy(base);actual['state']['stateVersion']=14
        for key in ['relationMissions','diplomaticOffers','diplomaticHistory','politicalUnions','spyMissions','spyReports','spyEffects']:actual['state'][key]=[]
        actual['state']['countries']['de']['spyCooldowns']={}
        actual['state']['countries']['de']['economy']['diplomaticMaintenance']=0
        assert_paused_fixture(actual,base)
    def test_geometry_troops_cash_countries_simulation_and_active_diplomacy_are_not_ignored(self):
        def reduced(s):s['provinces'].clear()
        def troops(s):s['armies'][0]['troops']=500
        def cash(s):s['countries']['de']['treasury']=101
        def country(s):s['countries']['other']={}
        def tick(s):s['tick']=1
        def diplomacy(s):s['diplomacy']['de|other']={}
        def mission(s):s['relationMissions']=[{'id':'mission'}]
        def spy(s):s['spyMissions']=[{'id':'spy'}]
        def spy_effect(s):s['spyEffects']=[{'id':'spy-effect'}]
        def spy_cooldown(s):s['countries']['de']['spyCooldowns']={'de:Counterintelligence':12}
        def nan(s):s['extra']=float('nan')
        for change in [reduced,troops,cash,country,tick,diplomacy,mission,spy,spy_effect,spy_cooldown,nan]:
            base=self.fixture();actual=copy.deepcopy(base);change(actual['state'])
            with self.assertRaises(AssertionError):assert_paused_fixture(actual,base)
    def test_future_schema_is_rejected(self):
        base=self.fixture();actual=copy.deepcopy(base);actual['state']['stateVersion']=15
        with self.assertRaises(AssertionError):assert_paused_fixture(actual,base)
