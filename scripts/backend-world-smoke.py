"""Opt-in HTTP integration against the dedicated Grand Strategy backend only.

Creates one isolated QA room, records its ID for scoped SQL cleanup, never logs tokens.
Run separately from general CI. Clean up the recorded room after success or failure.
"""
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

BASE = 'https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1'
ROOM_FILE = Path('/tmp/dominion-world-government-room-id')

def request(path, body, expected=200):
    req = urllib.request.Request(BASE+'/'+path, data=json.dumps(body, allow_nan=False).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            status, payload = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, payload = error.code, json.loads(error.read())
    assert status == expected, (path, status, expected)
    return payload

host = request('game-room', {'action': 'create', 'displayName': 'WORLD GOVERNMENT QA'})
game_id = host['state']['id']
assert re.fullmatch(r'[0-9a-f-]{36}', game_id)
ROOM_FILE.write_text(game_id)
print('QA room:', game_id, flush=True)
assert len(host['state']['countries']) == 195
assert len(host['state']['provinces']) == 4386
assert len(host['state']['cities']) == 7214
assert len(host['state']['leaders']) == 195
assert all(c.get('governmentType') and c.get('politicalPower') == 100 for c in host['state']['countries'].values())
guest = request('game-room', {'action': 'join', 'roomCode': host['state']['roomCode'], 'displayName': 'WORLD GOVERNMENT QA GUEST'})

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
