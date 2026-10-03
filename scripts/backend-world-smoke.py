"""Opt-in HTTP integration against the dedicated Grand Strategy backend only.

Creates one isolated QA room, records its ID for scoped SQL cleanup, never logs tokens.
Run locally or through the dedicated World backend QA workflow, separately from
offline build tests. Clean up the recorded room after success or failure.
"""
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

BASE = 'https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1'
ROOM_FILE = Path('/tmp/dominion-world-qa-room-id')

def request(path, body, expected=200):
    req = urllib.request.Request(BASE+'/'+path, data=json.dumps(body, allow_nan=False).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            status, payload = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, payload = error.code, json.loads(error.read())
    assert status == expected, (path, status, expected, payload)
    return payload

host = request('game-room', {'action': 'create', 'displayName': 'WORLD ECONOMY QA'})
game_id = host['state']['id']
assert re.fullmatch(r'[0-9a-f-]{36}', game_id)
ROOM_FILE.write_text(game_id)
print('QA room:', game_id, flush=True)
assert len(host['state']['countries']) == 195
assert len(host['state']['provinces']) == 4386
assert len(host['state']['cities']) == 7214
assert len(host['state']['leaders']) == 195
assert all(c.get('governmentType') and c.get('politicalPower') == 100 for c in host['state']['countries'].values())
guest = request('game-room', {'action': 'join', 'roomCode': host['state']['roomCode'], 'displayName': 'WORLD ECONOMY QA GUEST'})

def snapshot(session=host, version=None):
    body = {'action': 'state', 'gameId': game_id, 'playerId': session['playerId'], 'token': session['token']}
    if version is not None:
        body['version'] = version
    return request('game-room', body)

def command(session, value, expected=200, token=None):
    return request('game-command', {'gameId': game_id, 'playerId': session['playerId'], 'token': token or session['token'], 'command': value}, expected)

before = snapshot()['state']
assert len(before['players']) == 2
assert snapshot(guest)['state'] == before
for value in [
    {'type': 'SELECT_COUNTRY', 'playerId': host['playerId'], 'countryId': '__proto__'},
    {'type': 'SELECT_COUNTRY', 'playerId': host['playerId'], 'countryId': 'germany', 'treasury': 1e9},
    {'type': 'SET_SPEED', 'playerId': host['playerId'], 'speed': 1},
    {'type': 'CHANGE_GOVERNMENT', 'playerId': host['playerId'], 'governmentType': 'Federation'},
]:
    command(host, value, 400)
command(guest, {'type': 'SELECT_COUNTRY', 'playerId': host['playerId'], 'countryId': 'germany'}, 400)
command(host, {'type': 'SET_READY', 'playerId': host['playerId'], 'ready': True}, 401, token='wrong-player-token')
request('game-room', {'action': 'state', 'gameId': game_id, 'playerId': host['playerId'], 'token': host['state']['roomCode']}, 400)
assert snapshot()['state'] == before
for session, country in [(host, 'germany'), (guest, 'france')]:
    command(session, {'type': 'SELECT_COUNTRY', 'playerId': session['playerId'], 'countryId': country})
    command(session, {'type': 'SET_READY', 'playerId': session['playerId'], 'ready': True})
command(host, {'type': 'START_GAME', 'playerId': host['playerId']})
command(host, {'type': 'SET_SPEED', 'playerId': host['playerId'], 'speed': 0})
print('PASS: world creation, join/sync, authentication and lobby guards', flush=True)
response = snapshot(); before = response['state']
assert snapshot(version=response['version'])['unchanged'] is True
command(host, {'type': 'ADVANCE_TICK'})
assert snapshot()['state'] == before
capital = next(c for c in before['cities'] if c['id'] == before['countries']['germany']['capitalCityId'])
province = next(p for p in before['provinces'] if p['id'] == capital['provinceId'])
army = next(a for a in before['armies'] if a['ownerId'] == 'germany' and a['provinceId'] == province['id'])
neighbor = next(p for p in before['provinces'] if p['id'] in province['neighbors'] and p['ownerId'] == 'germany')
command(guest, {'type': 'RECRUIT', 'playerId': guest['playerId'], 'provinceId': province['id'], 'troops': 10000}, 400)
command(host, {'type': 'RECRUIT', 'playerId': host['playerId'], 'provinceId': province['id'], 'troops': 10000})
command(host, {'type': 'MOVE_ARMY', 'playerId': host['playerId'], 'armyId': army['id'], 'provinceId': neighbor['id']})
new_type = 'Parliamentary Republic' if before['countries']['germany']['governmentType'] != 'Parliamentary Republic' else 'Federation'
policy = {'type': 'CHANGE_GOVERNMENT', 'playerId': host['playerId'], 'governmentType': new_type}
command(host, {**policy, 'politicalPower': 500}, 400)
command(host, policy)
command(host, {**policy, 'governmentType': 'Military Junta'}, 400)
after = snapshot()['state']; nation = after['countries']['germany']; old = before['countries']['germany']
assert nation['treasury'] == old['treasury'] - 200
assert nation['manpower'] == old['manpower'] - 10000
assert nation['politicalPower'] == old['politicalPower'] - 80
assert nation['stability'] == old['stability'] - 8
assert nation['governmentType'] == new_type
assert nation['governmentCooldownUntilTick'] == after['tick'] + 24
assert next(a for a in after['armies'] if a['id'] == army['id'])['provinceId'] == neighbor['id']
assert after['tick'] == before['tick'] and after['month'] == before['month']
assert snapshot(guest)['state'] == after
print('PASS: paid recruitment, legal movement, frozen clock, government payment/stability/cooldown, guest sync, unchanged-version polling', flush=True)

# Budget is computed by the server; loans never mint net assets.
cash = nation['treasury']
command(host, {'type':'SET_TAX_RATE','playerId':host['playerId'],'taxRate':35})
command(host, {'type':'BORROW','playerId':host['playerId'],'amount':100,'debt':0}, 400)
command(host, {'type':'BORROW','playerId':host['playerId'],'amount':100})
loan = snapshot()['state']['countries']['germany']
assert loan['debt'] == 100 and loan['treasury'] == cash + 100
assert loan['taxRate'] == 35 and loan['economy']['interest'] == .5
command(host, {'type':'REPAY_DEBT','playerId':host['playerId'],'amount':100})
command(host, {'type':'SET_TAX_RATE','playerId':host['playerId'],'taxRate':30})
paid = snapshot()['state']['countries']['germany']
assert paid['debt'] == 0 and paid['treasury'] == cash
assert paid['economy']['armyMaintenance'] == paid['army'] / 1000 * 1.25
assert paid['economy']['tradeIncome'] > 0
assert snapshot(guest)['state'] == snapshot()['state']
print('PASS: authoritative tax/loan/repayment, exact cash/debt, upkeep/interest/commerce and guest sync', flush=True)

# Phase 11: client sends only intent. Price, duration, ownership and completion are authoritative.
build_before = snapshot()['state']
build_cash = build_before['countries']['germany']['treasury']
command(host, {'type':'BUILD','playerId':host['playerId'],'provinceId':province['id'],'buildingType':'Farm','cost':1}, 400)
command(guest, {'type':'BUILD','playerId':guest['playerId'],'provinceId':province['id'],'buildingType':'Farm'}, 400)
command(host, {'type':'BUILD','playerId':host['playerId'],'provinceId':province['id'],'buildingType':'Farm'})
build_queued = snapshot()['state']
assert build_queued['stateVersion'] == 2
assert build_queued['countries']['germany']['treasury'] == build_cash - 120
assert len(build_queued['constructions']) == 1
construction = build_queued['constructions'][0]
assert construction['provinceId'] == province['id']
assert construction['ownerId'] == 'germany'
assert construction['buildingType'] == 'Farm'
assert construction['targetLevel'] == 1
assert construction['cost'] == 120
assert construction['completeTick'] == build_queued['tick'] + 6
assert not next(p for p in build_queued['provinces'] if p['id'] == province['id']).get('buildings')
command(host, {'type':'BUILD','playerId':host['playerId'],'provinceId':province['id'],'buildingType':'Mine'}, 400)
command(host, {'type':'SET_SPEED','playerId':host['playerId'],'speed':1})
for _ in range(6):
    command(host, {'type':'ADVANCE_TICK'})
command(host, {'type':'SET_SPEED','playerId':host['playerId'],'speed':0})
build_done = snapshot()['state']
built_province = next(p for p in build_done['provinces'] if p['id'] == province['id'])
assert built_province['buildings']['Farm'] == 1
assert not any(c['provinceId'] == province['id'] for c in build_done['constructions'])
assert build_done['countries']['germany']['economy']['buildingMaintenance'] >= 2
assert snapshot(guest)['state'] == build_done
print('PASS: authoritative building price/ownership/queue/state migration, timed completion, maintenance and guest sync', flush=True)

# Faith is authoritative; caller-supplied Unity or country fields must be rejected.
religion_command = {'type': 'CHANGE_RELIGION', 'playerId': host['playerId'], 'religionId': 'christian-catholic'}
command(host, {**religion_command, 'religiousUnity': 100}, 400)
command(guest, {**religion_command, 'playerId': host['playerId']}, 400)
command(host, religion_command, 400)  # government payment plus construction window still leaves insufficient PP
command(host, {'type': 'SET_SPEED', 'playerId': host['playerId'], 'speed': 1})
for _ in range(20):
    command(host, {'type': 'ADVANCE_TICK'})
command(host, {'type': 'SET_SPEED', 'playerId': host['playerId'], 'speed': 0})
religion_before = snapshot()['state']
assert religion_before['countries']['germany']['population'] > after['countries']['germany']['population']
assert sum(p['population'] for p in religion_before['provinces']) > sum(p['population'] for p in after['provinces'])
city_totals = {}
old_cities = {city['id']: city for city in after['cities']}
assert len(old_cities) == len(after['cities'])
assert len({city['id'] for city in religion_before['cities']}) == len(religion_before['cities'])
assert sum(city['population'] for city in religion_before['cities']) > sum(city['population'] for city in after['cities'])
for city in religion_before['cities']:
    assert type(city['population']) is int and 0 <= city['population'] <= 2**53-1
    assert city['population'] >= old_cities[city['id']]['population']
    assert 0 <= city['populationGrowthCarry'] < 1
    city_totals[city['provinceId']] = city_totals.get(city['provinceId'], 0) + city['population']
province_ids = {p['id'] for p in religion_before['provinces']}
assert len(province_ids) == len(religion_before['provinces'])
for p in religion_before['provinces']:
    assert type(p['population']) is int and 0 <= p['population'] <= 2**53-1
    assert 0 <= p['populationGrowthCarry'] < 1
    assert city_totals.get(p['id'], 0) <= p['population']
assert all(province_id in province_ids for province_id in city_totals)
for country in religion_before['countries'].values():
    owned = [p for p in religion_before['provinces'] if p['ownerId'] == country['id']]
    assert country['population'] == sum(p['population'] for p in owned)
    assert country['monthlyPopulationGrowth'] == sum(p['monthlyPopulationGrowth'] for p in owned)
print('PASS: actual monthly provincial/city growth, integer counts, urban conservation and exact country totals', flush=True)
command(host, religion_command)
command(host, {**religion_command, 'religionId': 'secular'}, 400)
religion_after = snapshot()['state']; nation = religion_after['countries']['germany']; old = religion_before['countries']['germany']
assert nation['politicalPower'] == old['politicalPower'] - 120
assert nation['stability'] == max(0, old['stability'] - 12)
assert nation['unrest'] == min(100, old['unrest'] + 8)
assert nation['religion'] == 'christian-catholic'
assert nation['religionCooldownUntilTick'] == religion_after['tick'] + 36
assert religion_after['tick'] == religion_before['tick']
for before_province, after_province in zip(religion_before['provinces'], religion_after['provinces']):
    assert after_province['religion'] == before_province['religion']
    expected = min(100, before_province['unrest'] + 10) if after_province['ownerId'] == 'germany' and after_province['religion'] != nation['religion'] else before_province['unrest']
    assert after_province['unrest'] == expected
owned = [p for p in religion_after['provinces'] if p['ownerId'] == 'germany']
total = sum(p['population'] for p in owned)
unity = sum(p['population'] for p in owned if p['religion'] == nation['religion']) / total * 100 if total else 100
assert abs(nation['religiousUnity'] - unity) < 1e-8
assert snapshot(guest)['state'] == religion_after
print('PASS: religion authentication/payload/payment/cooldown, unchanged provincial faiths, population-weighted Unity, unrest and guest sync', flush=True)

# Resource amounts come from the same authenticated server snapshot as the budget.
resource_types = {'food','iron','coal','oil','gas','gold','copper','uranium','timber','rare_materials'}
assert {p['resourceDeposit']['type'] for p in religion_after['provinces']} == resource_types
for p in religion_after['provinces']:
    assert 1 <= p['resourceDeposit']['richness'] <= 100
assert religion_after['countries']['germany']['economy']['resourceIncome'] > 0
assert all(p['resourceDeposit'] == q['resourceDeposit'] for p,q in zip(religion_before['provinces'],religion_after['provinces']))
print('PASS: all resource types, bounded deposits, real resource income and immutable deposits across policy change', flush=True)
