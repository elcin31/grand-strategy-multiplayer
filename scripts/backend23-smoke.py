"""Real independent HTTP clients on the existing Dominion project only.
No state injection, privileged gameplay command, fake clock or user-room access.
Only generated room UUIDs are retained for narrowly scoped cleanup.
"""
import json,threading,time,uuid,urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import backend_http as http
http.ENDPOINT_SUFFIX='-v23'
OUT=Path('BACKEND_23_QA.json');CLEANUP=Path('/tmp/dominion23-qa-rooms.json')
checks=[];rooms=[];clients=[];stop=threading.Event();heartbeat_errors=[]
def check(name):checks.append(name);print('PASS:',name,flush=True)
def retain(result,cohort):
    rooms.append({'id':result['state']['id'],'code':result['state']['roomCode'],'cohort':cohort})
    CLEANUP.write_text(json.dumps(rooms))
class Client:
    def __init__(self,result):
        self.id=result['state']['id'];self.player=result['playerId'];self.token=result['token'];self.connected=True
    def auth(self):return {'gameId':self.id,'playerId':self.player,'token':self.token}
    def state(self,action='state'):return http.request('game-room',{'action':action,**self.auth()})[0]
    def envelope(self,kind,**fields):
        return {**self.auth(),'commandId':str(uuid.uuid4()),'expectedVersion':self.state()['version'],'command':{'type':kind,'playerId':self.player,**fields}}
    def send(self,kind,expected=200,**fields):
        time.sleep(.3);print('Check:',kind,flush=True)
        return http.request('game-command',self.envelope(kind,**fields),expected)[0]
def heartbeat():
    with ThreadPoolExecutor(max_workers=3) as pool:
        while not stop.wait(5):
            pending=[pool.submit(http.request,'game-room',{'action':'heartbeat',**client.auth()}) for client in clients if client.connected]
            for task in pending:
                try:task.result()
                except Exception as error:heartbeat_errors.append(type(error).__name__)
def advance(months):
    start=host.state()['state']['tick'];host.send('SET_SPEED',speed=5);deadline=time.monotonic()+240
    while time.monotonic()<deadline:
        time.sleep(1);snapshot=host.state()
        if snapshot['state']['tick']>=start+months:
            host.send('SET_SPEED',speed=0)
            state=host.state()['state'];assert state['speed']==0 and state['tick']>=start+months
            return state
    raise AssertionError('Actual server calendar did not reach the requested observation')
def legacy_request(body):
    req=urllib.request.Request(http.BASE+'/game-room-v211',data=json.dumps({**body,'clientStateVersion':25}).encode(),headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
try:
    probe={'action':'state','gameId':str(uuid.uuid4()),'playerId':str(uuid.uuid4()),'token':'a'*43}
    http.request('game-room',probe,401);http.request('game-room',probe,426,include_client_version=False)
    check('current protocol and custom session authentication')
    old=legacy_request({'action':'create','displayName':'DOMINION23 LEGACY QA'});retain(old,'v211')
    before=legacy_request({'action':'state','gameId':old['state']['id'],'playerId':old['playerId'],'token':old['token']})
    old_auth={key:old[key] for key in ['playerId','token']};old_auth['gameId']=old['state']['id']
    http.request('game-room',{'action':'reconnect',**old_auth},426)
    after=legacy_request({'action':'state',**old_auth});assert before['checksum']==after['checksum'] and before['version']==after['version']
    check('existing schema25 room remains unchanged after a schema28 connection attempt')
    created=http.request('game-room',{'action':'create','displayName':'DOMINION23 HOST QA'})[0];retain(created,'v23');host=Client(created);clients.append(host)
    ally=Client(http.request('game-room',{'action':'join','roomCode':created['state']['roomCode'],'displayName':'DOMINION23 ALLY QA'})[0]);clients.append(ally)
    enemy=Client(http.request('game-room',{'action':'join','roomCode':created['state']['roomCode'],'displayName':'DOMINION23 ENEMY QA'})[0]);clients.append(enemy)
    threading.Thread(target=heartbeat,daemon=True).start()
    ally.send('SELECT_SCENARIO',400,scenarioId='rhine-reconstruction-compact');host.send('SELECT_SCENARIO',scenarioId='rhine-reconstruction-compact')
    for client,country in zip(clients,['germany','france','russia']):client.send('SELECT_COUNTRY',countryId=country);client.send('SET_READY',ready=True)
    ally.send('START_GAME',400);host.send('START_GAME');host.send('SET_SPEED',speed=0)
    state=host.state()['state'];assert state['stateVersion']==http.CLIENT_STATE_VERSION and state['scenario']['id']=='rhine-reconstruction-compact'
    check('three independent authenticated clients select countries, ready and launch the registered scenario')
    province=next(p['id'] for p in state['provinces'] if p['ownerId']=='germany' and p.get('controllerId')=='germany')
    ally.send('RECRUIT',400,provinceId=province,troops=1000)
    body=host.envelope('RECRUIT',provinceId=province,troops=1000);cash=host.state()['state']['countries']['germany']['treasury']
    http.request('game-command',body);assert http.request('game-command',body)[0]['duplicate']
    assert round(cash-host.state()['state']['countries']['germany']['treasury'],3)==20
    http.request('game-command',{**body,'command':{**body['command'],'troops':2000}},409)
    http.request('game-command',{**body,'commandId':str(uuid.uuid4())},409)
    host.send('SET_CONSTRUCTION_AUTOMATION',enabled=True);assert host.state()['state']['countries']['germany']['stockpile']['autoBuild']
    state=advance(1);assert state['simulationDay']>0
    pending=next(e for e in state['events']['pending'] if e['countryId']=='germany' and e['eventId']=='alt-rhine-workshops')
    ally.send('RESOLVE_GAME_EVENT',400,eventId=pending['id'],choiceId='joint')
    body=host.envelope('RESOLVE_GAME_EVENT',eventId=pending['id'],choiceId='joint');before=host.state()['state']['countries']['germany']
    http.request('game-command',body);assert http.request('game-command',body)[0]['duplicate']
    after=host.state()['state']['countries']['germany'];assert round(before['treasury']-after['treasury'],3)==80 and before['politicalPower']-after['politicalPower']==10
    assert after['eventUnlockedFocuses'].count('alt-shared-workshops')==1
    host.send('RESOLVE_GAME_EVENT',400,eventId=pending['id'],choiceId='joint')
    host.send('SET_CONSTRUCTION_AUTOMATION',enabled=False)
    check('real daily clock, paid automation, owner-bound event choice, exactly-once costs and dynamic focus unlock')
    host.send('OFFER_DIPLOMACY',targetId='france',terms={'kind':'Treaty','treaty':'MilitaryAccess'})
    offer=next(o for o in ally.state()['state']['diplomaticOffers'] if o['from']=='germany' and o['to']=='france')
    enemy.send('RESPOND_DIPLOMACY',400,offerId=offer['id'],accept=True);ally.send('RESPOND_DIPLOMACY',offerId=offer['id'],accept=True)
    assert 'MilitaryAccess' in host.state()['state']['diplomacy']['france|germany']['treaties']
    host.send('START_NATIONAL_FOCUS',focusId='eco-audit');host.send('SET_TAX_RATE',taxRate=40)
    assert host.state()['state']['countries']['germany']['politicalGroupReason']=='Изменение налоговой нагрузки'
    ally.send('SET_TAX_RATE',taxRate=35);enemy.send('SET_TAX_RATE',taxRate=35)
    check('human diplomatic consent, paid national course and actual political response')
    host.send('DECLARE_WAR',targetId='russia');state=host.state()['state'];war=next(w for w in state['wars'] if 'germany' in w['attackers'] and 'russia' in w['defenders']);wid=war['id'];assert 'france' in war['attackers']
    terms={'kind':'WhitePeace','provinceIds':[],'amount':0}
    host.send('PROPOSE_PEACE',warId=wid,terms=terms);enemy.send('RESPOND_PEACE',400,warId=wid,accept=True)
    enemy.send('APPROVE_PEACE_PLAN',400,warId=wid,accept=True);ally.send('APPROVE_PEACE_PLAN',warId=wid,accept=False)
    assert not next(w for w in host.state()['state']['wars'] if w['id']==wid).get('peaceOffer')
    host.send('PROPOSE_PEACE',400,warId=wid,terms={'kind':'Money','provinceIds':[],'amount':-1})
    host.send('PROPOSE_PEACE',warId=wid,terms=terms);ally.send('APPROVE_PEACE_PLAN',warId=wid,accept=True)
    enemy.send('RESPOND_PEACE',warId=wid,accept=True);state=host.state()['state'];assert not any(w['id']==wid for w in state['wars']) and sum(w['id']==wid for w in state['warHistory'])==1
    enemy.send('RESPOND_PEACE',400,warId=wid,accept=True);host.send('DECLARE_WAR',400,targetId='russia')
    check('joint war, mandatory human ally consent/refusal, atomic peace, negative-payment and replay/truce guards')
    state=advance(6);assert sum(f['focusId']=='eco-audit' for f in state['countries']['germany']['completedFocuses'])==1
    host.send('START_NATIONAL_FOCUS',focusId='alt-shared-workshops');state=advance(8)
    assert sum(f['focusId']=='alt-shared-workshops' for f in state['countries']['germany']['completedFocuses'])==1
    check('event-unlocked scenario focus completes through actual server calendar exactly once')
    saved=host.state();reconnected=host.state('reconnect');assert saved['checksum']==reconnected['checksum']
    # A distinct client stops heartbeats long enough for actual presence/AI takeover.
    enemy.connected=False;deadline=time.monotonic()+63
    while time.monotonic()<deadline:time.sleep(1)
    offline=host.state()['state'];assert next(p for p in offline['players'] if p['id']==enemy.player)['aiControlled']
    returned=enemy.state('reconnect')['state'];owner=next(p for p in returned['players'] if p['id']==enemy.player);assert owner['countryId']=='russia' and owner['connected'] and not owner['aiControlled'];enemy.connected=True
    assert not heartbeat_errors
    check('persisted authoritative snapshot, independent disconnect, real timeout and same-country reconnect')
    OUT.write_text(json.dumps({'passed':True,'projectId':'dfjsnjxnyjspwugjguhq','schema':http.CLIENT_STATE_VERSION,'realHttpClients':3,'roomIds':[r['id'] for r in rooms],'checks':checks,'physicalAndroidClients':False,'clock':'actual elapsed server time; no direct advance command or state injection'},ensure_ascii=False,indent=2)+'\n')
finally:
    stop.set()
    if not OUT.exists():OUT.write_text(json.dumps({'passed':False,'checksCompleted':checks,'roomIds':[r['id'] for r in rooms]},ensure_ascii=False,indent=2)+'\n')
