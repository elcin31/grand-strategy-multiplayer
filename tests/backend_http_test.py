import io
import json
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
import backend_http


class Response(io.BytesIO):
    def __init__(self,status=200,data=None):
        super().__init__(json.dumps(data or {'ok':True}).encode());self.status=status


class BackendHttpTest(unittest.TestCase):
    def test_schema_metadata_and_only_dedicated_backend(self):
        captured=[]
        def send(req,**kwargs):captured.append(req);return Response()
        with patch.object(backend_http.urllib.request,'urlopen',send):
            body={'action':'state','token':'private'};backend_http.request('game-room',body)
        self.assertNotIn('clientStateVersion',body)
        # The accepted 2.2.1 state migration contract is already schema 25.
        self.assertEqual(json.loads(captured[0].data)['clientStateVersion'],25)
        self.assertEqual(captured[0].full_url,'https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1/game-room')
        with patch.object(backend_http.urllib.request,'urlopen') as send,self.assertRaises(AssertionError):
            backend_http.request('another-project',{})
        send.assert_not_called()

    def test_explicit_invalid_old_future_and_missing_probes_are_not_replaced(self):
        captured=[]
        def send(req,**kwargs):captured.append(json.loads(req.data));return Response()
        with patch.object(backend_http.urllib.request,'urlopen',send):
            for version in [12,19,'18',None]:backend_http.request('game-command',{'clientStateVersion':version})
            backend_http.request('game-room',{},include_client_version=False)
        self.assertEqual([x['clientStateVersion'] for x in captured[:-1]],[12,19,'18',None])
        self.assertNotIn('clientStateVersion',captured[-1])

    def test_status_failure_does_not_expose_private_payload_and_nan_never_reaches_network(self):
        private={'token':'secret-session','state':{'private':'whole-campaign'}}
        with patch.object(backend_http.urllib.request,'urlopen',return_value=Response(200,private)):
            with self.assertRaises(AssertionError) as error:backend_http.request('game-room',{},401)
        self.assertNotIn('secret-session',str(error.exception));self.assertNotIn('whole-campaign',str(error.exception))
        denied=urllib.error.HTTPError('https://example.invalid',426,'Upgrade required',{},io.BytesIO(b'{"error":"upgrade"}'))
        with patch.object(backend_http.urllib.request,'urlopen',side_effect=denied):
            self.assertEqual(backend_http.request('game-room',{},426)[1],426)
        with patch.object(backend_http.urllib.request,'urlopen') as send,self.assertRaises(ValueError):
            backend_http.request('game-command',{'amount':float('nan')})
        send.assert_not_called()
