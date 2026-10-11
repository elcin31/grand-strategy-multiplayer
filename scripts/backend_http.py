"""Dedicated Dominion QA transport. Never log credentials or full snapshots."""
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

BASE='https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1'
source=(Path(__file__).parents[1]/'supabase/functions/_shared/stateMigrations.ts').read_text()
CLIENT_STATE_VERSION=int(re.search(r'export const CURRENT_STATE_VERSION\s*=\s*(\d+)',source)[1])


def request(path,body,expected=(200,),include_client_version=True):
    assert path in ['game-room','game-command'],'Unsupported Dominion QA endpoint'
    payload={**body}
    if include_client_version:payload.setdefault('clientStateVersion',CLIENT_STATE_VERSION)
    req=urllib.request.Request(BASE+'/'+path,data=json.dumps(payload,allow_nan=False).encode(),headers={'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=90) as response:
            status,data=response.status,json.load(response)
    except urllib.error.HTTPError as error:
        status,data=error.code,json.loads(error.read())
    if isinstance(expected,int):expected=(expected,)
    # A failed response can contain private game/session data. The diagnostic
    # needs only HTTP status; never stringify that payload in an assertion.
    assert status in expected,(path,status,expected)
    return data,status
