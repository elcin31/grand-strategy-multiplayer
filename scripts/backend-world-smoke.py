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
ROOM_FILE = Path('/tmp/dominion-world-population-room-id')

def request(path, body, expected=200):
    req = urllib.request.Request(BASE+'/'+path, data=json.dumps(body, allow_nan=False).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            status, payload = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, payload = error.code, json.loads(error.read())
    assert status == expected, (path, status, expected)
    return payload

host = request('game-room', {'action': 'create', 'displayName': 'WORLD POPULATION QA'})
game_id = host['state']['id']
assert re.fullmatch(r'[0-9a-f-]{36}', game_id)
ROOM_FILE.write_text(game_id)
print('QA room:', game_id, flush=True)
assert len(host['state']['countries']) == 195
assert len(host['state']['provinces']) == 4386
assert len(host['state']['cities']) == 7214
assert len(host['state']['leaders']) == 195
assert all(c.get('governmentType') and c.get('politicalPower') == 100 for c in host['state']['countries'].values())
guest = request('game-room', {'action': 'join', 'roomCode': host['state']['roomCode'], 'displayName': 'WORLD POPULATION QA GUEST'})

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

# Faith is authoritative; caller-supplied Unity or country fields must be rejected.
religion_command = {'type': 'CHANGE_RELIGION', 'playerId': host['playerId'], 'religionId': 'christian-catholic'}
command(host, {**religion_command, 'religiousUnity': 100}, 400)
command(guest, {**religion_command, 'playerId': host['playerId']}, 400)
command(host, religion_command, 400)  # government payment left insufficient PP
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
for province in religion_before['provinces']:
    assert type(province['population']) is int and 0 <= province['population'] <= 2**53-1
    assert 0 <= province['populationGrowthCarry'] < 1
    assert city_totals.get(province['id'], 0) <= province['population']
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
