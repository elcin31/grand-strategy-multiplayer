"""Isolated, authoritative protocol v2 QA. No user campaign data is modified.
The exact room ID is retained for guarded cleanup; credentials are never printed.
"""
import json,time,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from backend_http import CLIENT_STATE_VERSION, request
# Read-only compatibility/auth probes BEFORE creating any isolated campaign.
probe={'action':'state','gameId':str(uuid.uuid4()),'playerId':str(uuid.uuid4()),'token':'a'*43}
request('game-room',probe,401)
request('game-room',probe,426,include_client_version=False)
for version in [12,CLIENT_STATE_VERSION+1]:request('game-room',{**probe,'clientStateVersion':version},426)
request('game-room',{**probe,'clientStateVersion':'18'},400)
probe_command={**{key:probe[key] for key in ['gameId','playerId','token']},'commandId':'schema-probe','expectedVersion':0,
               'command':{'type':'SET_READY','playerId':probe['playerId'],'ready':True}}
request('game-command',probe_command,401)
request('game-command',probe_command,426,include_client_version=False)
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
def advance_live(months):
    start=snapshot()['state']['tick'];command(host,'SET_SPEED',speed=4)
    deadline=time.monotonic()+180
    while time.monotonic()<deadline:
        time.sleep(1);heartbeat();observed=snapshot()
        if observed['state']['tick']>=start+months:
            request('game-command',envelope(host,{'type':'SET_SPEED','playerId':host['playerId'],'speed':0},observed['version']))
            result=snapshot()['state'];assert result['speed']==0 and result['tick']>=start+months
            return result
    raise AssertionError('Actual server clock did not progress')
for i in range(7):players.append(request('game-room',{'action':'join','roomCode':host['state']['roomCode'],'displayName':'QA guest '+str(i)})[0])
request('game-room',{'action':'join','roomCode':host['state']['roomCode'],'displayName':'Ninth QA'},400)
heartbeat();s=snapshot();assert len(s['state']['players'])==8
assert len(s['state']['countries'])==195 and len(s['state']['provinces'])==2924 and len(s['state']['cities'])==5411
assert s['state']['stateVersion']==CLIENT_STATE_VERSION
request('game-room',{'action':'reconnect',**auth(host),'token':'a'*43},401)
command(players[1],'SET_READY',400,ready=True)
spoof=envelope(players[1],{'type':'SELECT_COUNTRY','playerId':host['playerId'],'countryId':'germany'});request('game-command',spoof,400)
for p,c in zip(players,['germany','france','usa','chn','ind','bra','russia','can']):
    command(p,'SELECT_COUNTRY',countryId=c);command(p,'SET_READY',ready=True)
command(host,'START_GAME');command(host,'SET_SPEED',speed=0)
s=snapshot();old=s['state'];capital=next(c for c in old['cities'] if c['id']==old['countries']['germany']['capitalCityId']);province=capital['provinceId']
heartbeat();before=snapshot();intent={'type':'RECRUIT','playerId':host['playerId'],'provinceId':province,'troops':1000};body=envelope(host,intent,before['version'])
first=request('game-command',body)[0];duplicate=request('game-command',body)[0];assert duplicate['duplicate']
after=snapshot()['state'];assert after['countries']['germany']['treasury']==before['state']['countries']['germany']['treasury']-20
request('game-command',{**body,'command':{**intent,'troops':2000}},409)
request('game-command',{**body,'commandId':str(uuid.uuid4())},409)
command(players[1],'RECRUIT',400,provinceId=province,troops=1000)
heartbeat();v=snapshot()['version'];france_province=next(p['id'] for p in snapshot()['state']['provinces'] if p['ownerId']=='france')
bodies=[envelope(host,intent,v),envelope(players[1],{'type':'RECRUIT','playerId':players[1]['playerId'],'provinceId':france_province,'troops':1000},v)]
with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda b:request('game-command',b,(200,409)),bodies))
assert sorted(code for _,code in results)==[200,409]
print('PASS: 8 players, ninth rejected, auth/spoof guards, exactly-once recruitment, payload replay guard, stale and concurrent versions',flush=True)
# Persist and cancel a multi-step order through the real authenticated HTTP API.
s=snapshot()['state'];army=next(a for a in s['armies'] if a['ownerId']=='germany')
provinces={p['id']:p for p in s['provinces']};queue=[army['provinceId']];distance={queue[0]:0}
for origin in queue:
    for neighbor in provinces[origin]['neighbors']:
        p=provinces[neighbor]
        if neighbor not in distance and p.get('controllerId',p['ownerId'])=='germany':
            distance[neighbor]=distance[origin]+1;queue.append(neighbor)
target=next(p for p,d in distance.items() if d>=3)
command(players[1],'ORDER_ARMY',400,armyId=army['id'],provinceId=target)
command(host,'ORDER_ARMY',400,armyId=army['id'],provinceId=target,route=[target])
command(host,'ORDER_ARMY',armyId=army['id'],provinceId=target)
ordered=next(a for a in snapshot()['state']['armies'] if a['id']==army['id'])
assert ordered['order']['targetProvinceId']==target and len(ordered['order']['route'])>=3
command(host,'CANCEL_ARMY_ORDER',armyId=army['id'])
assert not next(a for a in snapshot()['state']['armies'] if a['id']==army['id']).get('order')
print('PASS: authoritative multi-step route, ownership guard, client route rejection and cancellation persisted',flush=True)
command(host,'SET_TAX_RATE',taxRate=20)
command(host,'START_RESEARCH',branch='Economy')
command(host,'BUILD',provinceId=province,buildingType='Farm')
command(host,'RECRUIT_UNIT',provinceId=province,troops=1000,unitType='Infantry')
s=snapshot()['state'];assert s['countries']['germany']['research']['branch']=='Economy';assert any(q['provinceId']==province for q in s['constructions'])
before=snapshot()['state'];active=next(c for c in before['constructions'] if c['provinceId']==province)
queued_body=envelope(host,{'type':'QUEUE_BUILD','playerId':host['playerId'],'provinceId':province,'buildingType':'Infrastructure'})
request('game-command',queued_body);assert request('game-command',queued_body)[0]['duplicate']
s=snapshot()['state'];queued=next(c for c in s['constructionQueue'] if c['provinceId']==province)
assert round(before['countries']['germany']['treasury']-s['countries']['germany']['treasury'],3)==queued['cost']
command(players[1],'CANCEL_CONSTRUCTION',400,constructionId=queued['id'])
before=snapshot()['state'];command(host,'CANCEL_CONSTRUCTION',constructionId=queued['id']);s=snapshot()['state']
assert round(s['countries']['germany']['treasury']-before['countries']['germany']['treasury'],3)==round(queued['cost']*.5,3)
assert all(c['id']!=queued['id'] for c in s['constructionQueue']) and any(c['id']==active['id'] for c in s['constructions'])
command(host,'CANCEL_CONSTRUCTION',400,constructionId=queued['id'])
army_id=army['id'];before_army=next(a for a in s['armies'] if a['id']==army_id)
command(players[1],'ADD_REGIMENT',400,armyId=army_id,unitType='Infantry',troops=1000)
command(host,'ADD_REGIMENT',armyId=army_id,unitType='Infantry',troops=1000)
s=snapshot()['state'];mixed=next(a for a in s['armies'] if a['id']==army_id)
assert mixed['troops']==before_army['troops']+1000 and sum(mixed['composition'].values())==mixed['troops']
commander=next(c for c in s['commanders'].values() if c['countryId']=='germany' and not any(a.get('commanderId')==c['id'] for a in s['armies']))
command(host,'ASSIGN_COMMANDER',armyId=army_id,commanderId=commander['id'])
command(host,'SET_REINFORCEMENT',armyId=army_id,enabled=True)
before=snapshot()['state'];command(host,'SET_ECONOMIC_POLICY',policy='Investment');s=snapshot()['state']
assert s['countries']['germany']['economicPolicy']=='Investment'
assert round(before['countries']['germany']['treasury']-s['countries']['germany']['treasury'],3)==50
assert s['countries']['germany']['politicalPower']==before['countries']['germany']['politicalPower']-15
command(host,'SET_ECONOMIC_POLICY',400,policy='Austerity')
before=snapshot()['state'];command(host,'SET_FUNDING',domain='Research',level='High');s=snapshot()['state']
assert s['countries']['germany']['researchFunding']=='High' and s['countries']['germany']['politicalPower']==before['countries']['germany']['politicalPower']-5
command(host,'SET_FUNDING',400,domain='Military',level='High')
# Real transfers and projects use authenticated commands and immutable receipts.
before=snapshot()['state'];gift_body=envelope(host,{'type':'SEND_GIFT','playerId':host['playerId'],'targetId':'bra','amount':100})
request('game-command',gift_body);assert request('game-command',gift_body)[0]['duplicate'];s=snapshot()['state']
assert round(before['countries']['germany']['treasury']-s['countries']['germany']['treasury'],3)==100
assert round(s['countries']['bra']['treasury']-before['countries']['bra']['treasury'],3)==100
command(host,'SEND_GIFT',400,targetId='bra',amount=100)
before=snapshot()['state'];focus_body=envelope(host,{'type':'START_NATIONAL_FOCUS','playerId':host['playerId'],'focusId':'eco-audit'})
request('game-command',focus_body);assert request('game-command',focus_body)[0]['duplicate'];s=snapshot()['state']
assert s['countries']['germany']['nationalFocus']['progress']==0
assert round(before['countries']['germany']['treasury']-s['countries']['germany']['treasury'],3)==220
assert s['countries']['germany']['politicalPower']==before['countries']['germany']['politicalPower']-16
command(host,'START_NATIONAL_FOCUS',400,focusId='eco-corridors')
spy_ids=[]
for target_id,kind,cost in [('germany','Counterintelligence',70),('bra','IntelligenceGathering',80)]:
    before=snapshot()['state'];spy_body=envelope(host,{'type':'START_ESPIONAGE','playerId':host['playerId'],'targetId':target_id,'kind':kind})
    request('game-command',spy_body);assert request('game-command',spy_body)[0]['duplicate'];s=snapshot()['state']
    mission=next(m for m in s['spyMissions'] if m['ownerId']=='germany' and m['targetId']==target_id and m['kind']==kind);spy_ids.append(mission['id'])
    assert mission['startedTick']==s['tick'] and mission['completeTick']>s['tick']
    assert round(before['countries']['germany']['treasury']-s['countries']['germany']['treasury'],3)==cost
command(host,'START_ESPIONAGE',400,targetId='bra',kind='Sabotage')
command(host,'DIPLOMATIC_ACTION',targetId='france',action='Improve')
command(host,'OFFER_TREATY',targetId='france',treaty='NonAggression');s=snapshot()['state'];assert not s['diplomacy']['france|germany']['treaties']
command(players[1],'RESPOND_TREATY',targetId='germany',accept=True);assert 'NonAggression' in snapshot()['state']['diplomacy']['france|germany']['treaties']
command(host,'DECLARE_WAR',400,targetId='france')
command(host,'PACIFY_PROVINCE',provinceId=province)
reconnected=request('game-room',{'action':'reconnect',**auth(host)})[0];assert reconnected['state']['players'][0]['countryId']=='germany'
assert reconnected['checksum'];request('game-room',{'action':'state',**auth(host),'version':reconnected['version'],'checksum':reconnected['checksum']})
print('PASS: persisted research/building, typed army, human treaty consent, pact protection, pacification and authenticated snapshot recovery',flush=True)
relation_before=next((r['value'] for r in reconnected['state']['diplomacy']['france|germany']['reasons'] if r['key']=='Improve:germany'),0)
mission_start=reconnected['state']['tick'];s=advance_live(8);c=s['countries']['germany']
assert c['technologies']['Economy']==1 and not c.get('research'),'Actual funded research did not complete'
assert len([f for f in c['completedFocuses'] if f['focusId']=='eco-audit'])==1 and not c.get('nationalFocus')
assert len([e for e in s['focusEvents'] if e['countryId']=='germany' and e['focusId']=='eco-audit' and e['kind']=='Completed'])==1
assert next(p for p in s['provinces'] if p['id']==province)['buildings']['Farm']==active['targetLevel']
own_reports=[r for r in s['spyReports'] if r['missionId'] in spy_ids];assert len(own_reports)==2
counter=next(r for r in own_reports if r['kind']=='Counterintelligence');assert counter['outcome']=='Success' and not counter['detected']
assert any(e['missionId']==counter['missionId'] and e['untilTick']>s['tick'] for e in s['spyEffects'])
intel=next(r for r in own_reports if r['kind']=='IntelligenceGathering');assert intel['outcome'] in ['Success','Failure']
if intel['outcome']=='Success':assert set(intel['intelligence'])=={'army','treasury','debt','stability','technology','provinceCount','counterintelligence'}
relation_after=next(r['value'] for r in s['diplomacy']['france|germany']['reasons'] if r['key']=='Improve:germany')
assert relation_after-relation_before==3*(s['tick']-mission_start)
command(host,'START_NATIONAL_FOCUS',400,focusId='eco-audit')
command(host,'START_ESPIONAGE',400,targetId='bra',kind='IntelligenceGathering')
science_body=envelope(host,{'type':'START_TECHNOLOGY','playerId':host['playerId'],'nodeId':'science-method'})
request('game-command',science_body);assert request('game-command',science_body)[0]['duplicate']
assert snapshot()['state']['countries']['germany']['research']['nodeId']=='science-method'
for kind,cost in [('Sabotage',120),('PoliticalIntrigue',100)]:
    before=snapshot()['state'];command(host,'START_ESPIONAGE',targetId='bra',kind=kind);s=snapshot()['state']
    mission=next(m for m in s['spyMissions'] if m['ownerId']=='germany' and m['kind']==kind);spy_ids.append(mission['id'])
    assert round(before['countries']['germany']['treasury']-s['countries']['germany']['treasury'],3)==cost
command(host,'OFFER_DIPLOMACY',targetId='france',terms={'kind':'Treaty','treaty':'TradeAgreement'})
s=snapshot()['state'];offer=next(o for o in s['diplomaticOffers'] if o['from']=='germany' and o['to']=='france' and o['terms'].get('treaty')=='TradeAgreement')
assert 'TradeAgreement' not in s['diplomacy']['france|germany']['treaties']
command(players[2],'RESPOND_DIPLOMACY',400,offerId=offer['id'],accept=True)
command(players[1],'RESPOND_DIPLOMACY',offerId=offer['id'],accept=True)
assert 'TradeAgreement' in snapshot()['state']['diplomacy']['france|germany']['treaties']
s=advance_live(8);c=s['countries']['germany'];assert 'science-method' in c['scientificDiscoveries'] and not c.get('research')
assert len([f for f in c['completedFocuses'] if f['focusId']=='eco-audit'])==1
assert len([r for r in s['spyReports'] if r['missionId'] in spy_ids])==4
assert all(r['outcome'] in ['Success','Failure'] for r in s['spyReports'] if r['missionId'] in spy_ids)
for r in [r for r in s['spyReports'] if r['missionId'] in spy_ids and r['detected']]:
    assert any(reason['key']=='espionage:germany' and reason['value']<0 for reason in s['diplomacy']['bra|germany']['reasons'])
restored=request('game-room',{'action':'reconnect',**auth(host)})[0]['state']
assert restored['countries']['germany']['completedFocuses']==c['completedFocuses']
assert restored['countries']['germany']['scientificDiscoveries']==c['scientificDiscoveries']
print('PASS: real expansion payments/receipt retry, construction refund, composition/commander/reinforcement, budget cooldown, gifts, paid relations, four spy results/counterintelligence, once-only course/science, human trade consent and reconnect',flush=True)
Path('BACKEND_EXPANSION_QA.json').write_text(json.dumps({'roomId':game,'stateVersion':CLIENT_STATE_VERSION,'tick':s['tick'],
    'featuresVerified':True,'hostMigrationVerified':False,'completedFocuses':c['completedFocuses'],'scientificDiscoveries':c['scientificDiscoveries'],
    'spyResults':[{k:r[k] for k in ['kind','tick','outcome','detected']} for r in s['spyReports'] if r['missionId'] in spy_ids],
    'paidRelationChange':relation_after-relation_before,'humanTreaties':s['diplomacy']['france|germany']['treaties'],
    'note':'Scoped existing production HTTP QA. No tokens, player IDs or whole snapshots in evidence.'},indent=2)+'\n')
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
assert len([f for f in restored['countries']['germany']['completedFocuses'] if f['focusId']=='eco-audit'])==1
evidence_path=Path('BACKEND_EXPANSION_QA.json');evidence=json.loads(evidence_path.read_text());evidence.update(hostMigrationVerified=True,finalTick=restored['tick'],finalSchema=restored['stateVersion']);evidence_path.write_text(json.dumps(evidence,indent=2)+'\n')
print('PASS: server clock without host, timeout/AI takeover, host migration, same-country human return; schema',restored['stateVersion'],flush=True)
