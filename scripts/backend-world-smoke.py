"""Isolated, authoritative protocol v2 QA. No user campaign data is modified.
The exact room ID is retained for guarded cleanup; credentials are never printed.
"""
import json,time,uuid,urllib.request,urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
BASE='https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1'
def request(path,body,expected=(200,)):
    req=urllib.request.Request(BASE+'/'+path,data=json.dumps(body,allow_nan=False).encode(),headers={'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=90) as r: status,payload=r.status,json.load(r)
    except urllib.error.HTTPError as e: status,payload=e.code,json.loads(e.read())
    if isinstance(expected,int): expected=(expected,)
    assert status in expected,(path,status,expected,payload)
    return payload,status
host=request('game-room',{'action':'create','displayName':'WORLD ECONOMY QA'})[0]
game=host['state']['id'];Path('/tmp/dominion-world-qa-room-id').write_text(game)
print('QA room:',game,flush=True)
players=[host]
def auth(p):return {'gameId':game,'playerId':p['playerId'],'token':p['token']}
last_heartbeat=0
def heartbeat():
    global last_heartbeat
    if time.monotonic()-last_heartbeat<10:return
    last_heartbeat=time.monotonic()
    with ThreadPoolExecutor(8) as pool: list(pool.map(lambda p: request('game-room',{'action':'heartbeat',**auth(p)}),players))
def snapshot(p=host):return request('game-room',{'action':'state',**auth(p)})[0]
def envelope(p,command,version=None):return {**auth(p),'command':command,'commandId':str(uuid.uuid4()),'expectedVersion':snapshot(p)['version'] if version is None else version}
def command(p,kind,expected=200,**fields):
    heartbeat()
    print('Check:',kind,flush=True)
    return request('game-command',envelope(p,{'type':kind,'playerId':p['playerId'],**fields}),expected)[0]
for i in range(7):players.append(request('game-room',{'action':'join','roomCode':host['state']['roomCode'],'displayName':'QA guest '+str(i)})[0])
request('game-room',{'action':'join','roomCode':host['state']['roomCode'],'displayName':'Ninth QA'},400)
heartbeat();s=snapshot();assert len(s['state']['players'])==8
assert len(s['state']['countries'])==195 and len(s['state']['provinces'])==4386 and len(s['state']['cities'])==7214
request('game-room',{'action':'reconnect',**auth(host),'token':'bad'},401)
command(players[1],'SET_READY',400,ready=True)
spoof=envelope(players[1],{'type':'SELECT_COUNTRY','playerId':host['playerId'],'countryId':'germany'});request('game-command',spoof,400)
for p,c in zip(players,['germany','france','usa','china','india','brazil','russia','canada']):
    command(p,'SELECT_COUNTRY',countryId=c);command(p,'SET_READY',ready=True)
command(host,'START_GAME');command(host,'SET_SPEED',speed=0)
s=snapshot();old=s['state'];capital=next(c for c in old['cities'] if c['id']==old['countries']['germany']['capitalCityId']);province=capital['provinceId']
heartbeat();before=snapshot();intent={'type':'RECRUIT','playerId':host['playerId'],'provinceId':province,'troops':1000};body=envelope(host,intent,before['version'])
first=request('game-command',body)[0];duplicate=request('game-command',body)[0];assert duplicate['duplicate']
after=snapshot()['state'];assert after['countries']['germany']['treasury']==before['state']['countries']['germany']['treasury']-20
request('game-command',{**body,'command':{**intent,'troops':2000}},409)
request('game-command',{**body,'commandId':str(uuid.uuid4())},409)
command(players[1],'RECRUIT',400,provinceId=province,troops=1000)
heartbeat();v=snapshot()['version'];bodies=[envelope(host,intent,v),envelope(host,intent,v)]
with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda b:request('game-command',b,(200,409)),bodies))
assert sorted(code for _,code in results)==[200,409]
print('PASS: 8 players, ninth rejected, auth/spoof guards, exactly-once recruitment, payload replay guard, stale and concurrent versions',flush=True)
command(host,'SET_TAX_RATE',taxRate=20)
command(host,'START_RESEARCH',branch='Economy')
command(host,'BUILD',provinceId=province,buildingType='Farm')
command(host,'RECRUIT_UNIT',provinceId=province,troops=1000,unitType='Infantry')
s=snapshot()['state'];assert s['countries']['germany']['research']['branch']=='Economy';assert any(q['provinceId']==province for q in s['constructions'])
command(host,'DIPLOMATIC_ACTION',targetId='france',action='Improve')
command(host,'OFFER_TREATY',targetId='france',treaty='NonAggression');s=snapshot()['state'];assert not s['diplomacy']['france|germany']['treaties']
command(players[1],'RESPOND_TREATY',targetId='germany',accept=True);assert 'NonAggression' in snapshot()['state']['diplomacy']['france|germany']['treaties']
command(host,'DECLARE_WAR',400,targetId='france')
command(host,'PACIFY_PROVINCE',provinceId=province)
reconnected=request('game-room',{'action':'reconnect',**auth(host)})[0];assert reconnected['state']['players'][0]['countryId']=='germany'
assert reconnected['checksum'];request('game-room',{'action':'state',**auth(host),'version':reconnected['version'],'checksum':reconnected['checksum']})
print('PASS: persisted research/building, typed army, human treaty consent, pact protection, pacification and authenticated snapshot recovery',flush=True)
# No client ADVANCE_TICK can create time. A live guest drives elapsed server time after host timeout.
request('game-command',envelope(host,{'type':'ADVANCE_TICK'}),400)
command(host,'SET_SPEED',speed=1)
start=snapshot()['state']['tick'];deadline=time.monotonic()+66
while time.monotonic()<deadline:
    time.sleep(3)
    guest=snapshot(players[1])
state=guest['state'];assert state['tick']>start
oldhost=next(p for p in state['players'] if p['id']==host['playerId']);assert oldhost['aiControlled'] and not oldhost['isHost']
newhost=next(p for p in state['players'] if p['isHost']);assert newhost['id']==players[1]['playerId']
# Direct request avoids helper heartbeats reconnecting timed-out players before assertion.
request('game-command',envelope(players[1],{'type':'SET_SPEED','playerId':players[1]['playerId'],'speed':0}))
restored=request('game-room',{'action':'reconnect',**auth(host)})[0]['state'];me=next(p for p in restored['players'] if p['id']==host['playerId']);assert not me['aiControlled'] and me['countryId']=='germany'
print('PASS: server clock without host, timeout/AI takeover, host migration, same-country human return; schema',restored['stateVersion'],flush=True)
