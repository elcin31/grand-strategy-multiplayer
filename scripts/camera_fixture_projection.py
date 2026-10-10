"""Check an unchanged paused legacy workload across a schema migration."""
import math


def assert_paused_fixture(actual, expected, allowed_version=13):
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
    for key in ['relationMissions','diplomaticOffers','diplomaticHistory','politicalUnions']:
        assert not state.get(key), 'Active expansion gameplay in camera fixture: '+key
    for army in state['armies']:
        assert not army.get('order'), 'Active army route in paused camera fixture'
    for country in state['countries'].values():
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
