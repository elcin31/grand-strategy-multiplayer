"""Check an unchanged paused legacy workload across a schema migration."""
import math


def assert_paused_fixture(actual, expected, allowed_version=16):
    def finite(value):
        if isinstance(value, float):
            assert math.isfinite(value), 'Non-finite benchmark snapshot'
        elif isinstance(value, dict):
            for item in value.values():finite(item)
        elif isinstance(value, list):
            for item in value:finite(item)
    finite(actual)
    assert actual['format']==expected['format']==1
    state, baseline = actual['state'], expected['state']
    assert state['stateVersion'] in (baseline['stateVersion'], allowed_version), 'Unexpected campaign migration'
    assert state['phase']=='paused' and state['tick']==0, 'Camera benchmark is not paused'
    assert set(state['countries'])==set(baseline['countries']), 'Changed benchmark countries'
    for key in ['diplomacy','wars','constructions','movements']:
        assert state.get(key)==baseline.get(key), 'Changed paused workload: '+key
    for key in ['relationMissions','diplomaticOffers','diplomaticHistory','politicalUnions','spyMissions','spyReports','spyEffects','constructionQueue']:
        assert not state.get(key), 'Active expansion gameplay in camera fixture: '+key
    for army in state['armies']:
        assert not army.get('reinforcementEnabled',False), 'Active reinforcement in camera fixture'
        assert army.get('experience',0)==0 and army.get('retreatUntilTick',0)==0, 'Active military advancement in camera fixture'
        if 'composition' in army:
            assert army['composition']=={army.get('unitType','Infantry'):army['troops']} and army.get('template')==army['composition'], 'Changed army recipe in camera fixture'
        assert not army.get('order'), 'Active army route in paused camera fixture'
    for country in state['countries'].values():
        assert not country.get('spyCooldowns'), 'Active espionage cooldown in camera fixture'
        assert country.get('economicPolicy','Balanced')=='Balanced', 'Active economic policy in camera fixture'
        assert country.get('researchFunding','Standard')==country.get('militaryFunding','Standard')=='Standard', 'Changed funding in camera fixture'
        assert country.get('economy',{}).get('researchMaintenance',0)==0, 'Research expense changed camera fixture'
        assert country.get('economy',{}).get('diplomaticMaintenance',0)==0, 'Diplomatic expense changed camera fixture'
    def compare(value, reference, path):
        if path=='state.stateVersion':return
        if isinstance(reference, dict):
            assert isinstance(value,dict), 'Changed fixture structure: '+path
            for key,item in reference.items():
                assert key in value, 'Missing fixture field: '+path+'.'+key
                compare(value[key],item,path+'.'+key)
        elif isinstance(reference,list):
            assert isinstance(value,list) and len(value)==len(reference), 'Changed fixture array: '+path
            for index,(item,base) in enumerate(zip(value,reference)):compare(item,base,path+'.'+str(index))
        else:
            assert value==reference, 'Changed fixture value: '+path
    compare(state,baseline,'state')
