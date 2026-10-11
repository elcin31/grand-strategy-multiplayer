import ast
import runpy
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
import backend_http
SCRIPT=Path(__file__).parents[1]/'scripts/backend-world-smoke.py'


def clock_function(environment):
    tree=ast.parse(SCRIPT.read_text())
    function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='advance_live')
    module=ast.Module(body=[function],type_ignores=[])
    exec(compile(module,str(SCRIPT),'exec'),environment)
    return environment['advance_live']


class BackendWorldGuardTest(unittest.TestCase):
    def test_old_backend_blocks_before_any_room_or_saved_identifier(self):
        calls=[]
        def request(path,body,expected,**kwargs):
            calls.append((path,body,expected))
            raise AssertionError((path,400,expected))
        with patch.object(backend_http,'request',request),patch.object(Path,'write_text') as save:
            with self.assertRaises(AssertionError):runpy.run_path(str(SCRIPT),run_name='qa_preflight_test')
        self.assertEqual(len(calls),1);self.assertEqual(calls[0][1]['action'],'state')
        self.assertEqual(calls[0][2],401);save.assert_not_called()
        self.assertNotIn('create',[body.get('action') for _,body,_ in calls])

    def test_real_clock_pause_uses_observed_cas_version_without_extra_poll_or_client_tick(self):
        calls=[];states=iter([{'state':{'tick':10},'version':40},{'state':{'tick':11},'version':41},
                             {'state':{'tick':18},'version':49},{'state':{'tick':18,'speed':0},'version':50}])
        def snapshot():calls.append('snapshot');return next(states)
        def request(path,body):
            calls.append(('pause',path,body));return {'ok':True},200
        env={'snapshot':snapshot,'host':{'playerId':'host'},'command':lambda p,k,**kw:calls.append(('command',k,kw)),
             'heartbeat':lambda:calls.append('heartbeat'),'time':SimpleNamespace(monotonic=lambda:0,sleep=lambda _:None),
             'envelope':lambda p,c,v:{'command':c,'expectedVersion':v},'request':request}
        result=clock_function(env)(8)
        self.assertEqual(result,{'tick':18,'speed':0})
        pause=next(c for c in calls if isinstance(c,tuple) and c[0]=='pause')
        self.assertEqual(pause[2],{'command':{'type':'SET_SPEED','playerId':'host','speed':0},'expectedVersion':49})
        position=calls.index(pause);self.assertEqual(calls[position-1],'snapshot')
        self.assertEqual(calls.count('snapshot'),4)
        self.assertFalse(any('ADVANCE_TICK' in str(c) for c in calls))

    def test_stopped_server_clock_cannot_pass_or_write_fabricated_state(self):
        now=iter([0,1,181]);requests=[]
        env={'snapshot':lambda:{'state':{'tick':10},'version':40},'host':{'playerId':'host'},
             'command':lambda *a,**kw:None,'heartbeat':lambda:None,
             'time':SimpleNamespace(monotonic=lambda:next(now),sleep=lambda _:None),
             'request':lambda *a:requests.append(a),'envelope':lambda *a:None}
        with self.assertRaisesRegex(AssertionError,'Actual server clock did not progress'):clock_function(env)(8)
        self.assertEqual(requests,[])
