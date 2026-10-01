"""Opt-in integration test against only the dedicated Grand Strategy backend.
Creates one isolated QA room. Its UUID is printed for scoped cleanup; tokens are never logged.
Do not run in general CI or against unrelated projects.
"""
import json
import re
import urllib.error
import urllib.request
from pathlib import Path
BASE = 'https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1'
def request(path, body, expected=200, raw=None):
    data = raw if raw is not None else json.dumps(body, allow_nan=False).encode()
    req = urllib.request.Request(BASE+'/'+path,data=data,headers={'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=25) as response: status=response.status; payload=json.load(response)
    except urllib.error.HTTPError as error:
        status=error.code; payload=json.loads(error.read())
    assert status==expected,(path,status,expected)
    return payload
host=request('game-room',{'action':'create','displayName':'SECURITY QA'})
game_id=host['state']['id']
assert re.fullmatch(r'[0-9a-f-]{36}',game_id)
Path('/tmp/dominion-security-room-id').write_text(game_id)
print('QA room:',game_id,flush=True)
guest=request('game-room',{'action':'join','roomCode':host['state']['roomCode'],'displayName':'SECURITY QA GUEST'})
def state(): return request('game-room',{'action':'state','gameId':game_id,'playerId':host['playerId'],'token':host['token']})['state']
def command(session, value, expected=200, token=None):
    return request('game-command',{'gameId':game_id,'playerId':session['playerId'],'token':token or session['token'],'command':value},expected)
before=state()
for value in [
    {'type':'SELECT_COUNTRY','playerId':host['playerId'],'countryId':'__proto__'},
    {'type':'SELECT_COUNTRY','playerId':host['playerId'],'countryId':'missing'},
    {'type':'SET_READY','playerId':host['playerId'],'ready':'true'},
    {'type':'SELECT_COUNTRY','playerId':host['playerId'],'countryId':'germany','treasury':1e9},
    {'type':'SET_SPEED','playerId':host['playerId'],'speed':1},
    {'type':'SET_SPEED','playerId':host['playerId'],'speed':None},
    {'type':'UNKNOWN'},
]: command(host,value,400)
command(guest,{'type':'SELECT_COUNTRY','playerId':host['playerId'],'countryId':'germany'},400)
command(host,{'type':'SELECT_COUNTRY','playerId':host['playerId'],'countryId':'germany'},401,token='wrong-player-token')
request('game-command',{},400,raw=b'{broken JSON')
assert state()==before,'Rejected commands changed authoritative state'
for session,country in [(host,'germany'),(guest,'france')]:
    command(session,{'type':'SELECT_COUNTRY','playerId':session['playerId'],'countryId':country})
    command(session,{'type':'SET_READY','playerId':session['playerId'],'ready':True})
command(host,{'type':'START_GAME','playerId':host['playerId']})
command(host,{'type':'START_GAME','playerId':host['playerId']},400)
command(guest,{'type':'ADVANCE_TICK'},400)
command(host,{'type':'SET_SPEED','playerId':host['playerId'],'speed':0})
before=state()
command(host,{'type':'ADVANCE_TICK'})
assert state()==before,'Paused clock advanced'
command(guest,{'type':'RECRUIT','playerId':guest['playerId'],'provinceId':'de-1','troops':10000},400)
command(host,{'type':'RECRUIT','playerId':host['playerId'],'provinceId':'de-1','troops':-1000},400)
command(host,{'type':'MOVE_ARMY','playerId':host['playerId'],'armyId':'army-de-1','provinceId':'missing'},400)
assert state()==before,'Invalid recruitment or movement changed state'
command(host,{'type':'RECRUIT','playerId':host['playerId'],'provinceId':'de-1','troops':10000})
after=state()
assert after['countries']['germany']['treasury']==before['countries']['germany']['treasury']-200
assert sum(a['troops'] for a in after['armies'] if a['ownerId']=='germany')==sum(a['troops'] for a in before['armies'] if a['ownerId']=='germany')+10000
command(host,{'type':'MOVE_ARMY','playerId':host['playerId'],'armyId':'army-de-1','provinceId':'de-2'})
moved=state()
assert next(a for a in moved['armies'] if a['id']=='army-de-1')['provinceId']=='de-2'
assert moved['phase']=='paused' and moved['tick']==before['tick'] and moved['month']==before['month']
print('PASS: paused paid recruitment/legal movement/frozen clock, malformed JSON/fields/countries, actor spoof, stolen token, lobby bypass, non-host tick, illegal recruitment/movement, paid recruitment',flush=True)
