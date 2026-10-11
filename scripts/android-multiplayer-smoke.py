"""Actual signed Android → existing Dominion HTTP → encrypted-session reconnect.

Creates one native QA room through visible controls. No credential injection,
fake clock, app hook, new backend, or user campaign access. Preserve its UUID
for guarded cleanup; never upload tokens or whole server snapshots.
"""
import atexit
import hashlib
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from android_accessibility import dump_hierarchy, assert_no_game_fatal
from android_fixture import root_test_device
from backend_http import request
from map_paint_check import assert_map_painted
from native_online_validation import (assert_online_campaign, paid_course_fingerprint,
                                      assert_same_native_session)

PACKAGE = 'com.elcin31.grandstrategymultiplayer'
OUT = Path('android-online'); OUT.mkdir(exist_ok=True)
QA_NAME = 'NATIVE ONLINE QA'
game_pids = set()
counter = 0


def adb(*args, timeout=30):
    return subprocess.check_output(['adb', *map(str, args)], text=True,
                                   stderr=subprocess.STDOUT, timeout=timeout)


def logs():
    try:
        raw = adb('logcat', '-d')
        (OUT/'final-logcat.txt').write_text(raw)
        return raw
    except (OSError, subprocess.SubprocessError):
        return ''


atexit.register(logs)


def hierarchy(name):
    global counter
    counter += 1
    game_pids.update(adb('shell', 'pidof', PACKAGE).strip().split())
    return dump_hierarchy(adb, PACKAGE, OUT, str(counter)+'-'+name,
                          '/sdcard/dominion-online.xml')


def screenshot(name):
    path = OUT/(name+'.png')
    path.write_bytes(subprocess.check_output(['adb', 'exec-out', 'screencap', '-p']))
    return path


def node_bounds(node):
    bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
    assert len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]
    return bounds


def tap_node(node):
    assert node.get('enabled') != 'false', 'Native control is disabled'
    x1, y1, x2, y2 = node_bounds(node)
    assert 0 <= x1 < x2 <= 1280 and 0 <= y1 < y2 <= 720, 'Native control is clipped'
    adb('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2)


def find_control(label, scroll=False):
    for attempt in range(14):
        tree = hierarchy('find-'+str(attempt))
        node = next((n for n in tree.iter('node') if n.get('text') == label
                     or n.get('content-desc') == label), None)
        if node is not None:
            x1, y1, x2, y2 = node_bounds(node)
            if 0 <= x1 < x2 <= 1280 and 0 <= y1 < y2 <= (640 if scroll else 720):
                return tree, node
        if scroll:
            if attempt == 0:
                for _ in range(4):
                    adb('shell', 'input', 'swipe', '1080', '240', '1080', '550', '280')
            else:
                adb('shell', 'input', 'swipe', '1080', '530', '1080', '300', '280')
        time.sleep(1)
    raise AssertionError('Missing actual native control: '+label)


def click(label, scroll=False):
    _, node = find_control(label, scroll)
    tap_node(node)  # Exactly one tap; never retry a submitted game command.
    time.sleep(2)


def pause_native_campaign():
    # Server time/presence can advance a snapshot before a host command arrives.
    # A visible CAS rejection is an explicit rejected intent, not a paid retry.
    # Wait for the actual native response and fresh sync before another user tap.
    for attempt in range(3):
        click('Пауза', scroll=True)
        deadline = time.monotonic()+35
        while time.monotonic() < deadline:
            tree = hierarchy('pause-response-'+str(attempt))
            if any(n.get('content-desc') == 'Пауза' and n.get('selected') == 'true'
                   for n in tree.iter('node')):
                return
            texts = {n.get('text', '') for n in tree.iter('node')}
            if 'Действие отклонено' in texts:
                assert 'Состояние обновилось. Повторите действие после синхронизации' in texts, \
                    'Native pause was rejected for a reason other than a stale snapshot'
                ok = next(n for n in tree.iter('node') if n.get('text') == 'OK')
                tap_node(ok)
                print('Native pause: explicit CAS rejection; sync before new host tap', flush=True)
                time.sleep(4)
                break
            time.sleep(2)
        else:
            raise AssertionError('Native pause did not finish or display a rejection')
    raise AssertionError('Native host pause failed after explicit synchronized CAS retries')


def launch():
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE+'/.MainActivity')
    time.sleep(8)


def package_uid():
    match = re.search(r'(?:userId|appId)=(\d+)', adb('shell', 'dumpsys', 'package', PACKAGE))
    assert match, 'No installed native package UID'
    return match[1]


def secure_keys():
    raw = subprocess.check_output(['adb', 'exec-out', 'cat', '/data/user/0/'+PACKAGE+
                                   '/shared_prefs/SecureStore.xml'])
    tree = ET.fromstring(raw)
    keys = set()
    for node in tree:
        if 'dominion.session' not in node.get('name', ''):
            continue
        encrypted = json.loads(node.text)
        assert encrypted.get('ct') and 'token' not in encrypted and 'playerId' not in encrypted, 'Plaintext native credentials'
        keys.add(node.get('name'))
    return keys, hashlib.sha256(raw).hexdigest()


# The exact APK's embedded production endpoint and release configuration are
# independently checked by the invoking workflow before enabling online QA.
root_test_device(adb, OUT/'emulator-root.txt')
adb('shell', 'wm', 'size', '1280x720'); adb('shell', 'wm', 'density', '160')
adb('logcat', '-c')
adb('install', '-r', str(Path(sys.argv[1]).resolve()), timeout=180)
launch(); click('Мультиплеер')
_, name = find_control('Имя игрока'); tap_node(name)
adb('shell', 'input', 'keyevent', '123', *['67']*32)
adb('shell', 'input', 'text', 'NATIVE%sONLINE%sQA')
click('Создать комнату')
room_code = None
for attempt in range(30):
    tree = hierarchy('native-created-'+str(attempt))
    matches = [re.fullmatch(r'Комната ([A-HJ-NP-Z2-9]{6})', n.get('text', ''))
               for n in tree.iter('node')]
    codes = [m[1] for m in matches if m]
    if codes:
        assert len(set(codes)) == 1
        room_code = codes[0]; break
    time.sleep(2)
assert room_code, 'One native create tap produced no server room'
guest, _ = request('game-room', {'action': 'join', 'roomCode': room_code,
                                'displayName': 'NATIVE ONLINE QA GUEST'})
room_id = guest['state']['id']
assert re.fullmatch(r'[0-9a-f-]{36}', room_id)
hosts = [p for p in guest['state']['players'] if p['displayName'] == QA_NAME and p['isHost']]
assert len(hosts) == 1, 'Native room was not created with the scoped QA identity'
native_id = hosts[0]['id']
Path('/tmp/dominion-native-online-room-id').write_text(room_id)
print('QA room:', room_id, flush=True)
guest_auth = {'gameId': room_id, 'playerId': guest['playerId'], 'token': guest['token']}


def snapshot():
    return request('game-room', {'action': 'state', **guest_auth})[0]


def guest_command(kind, **fields):
    observed = snapshot()
    body = {**guest_auth, 'commandId': 'native-qa-'+str(time.time_ns()),
            'expectedVersion': observed['version'],
            'command': {'type': kind, 'playerId': guest['playerId'], **fields}}
    return request('game-command', body)[0]


guest_command('SELECT_COUNTRY', countryId='france')
guest_command('SET_READY', ready=True)
click('СТРАНЫ · 195')
_, search = find_control('Поиск государства'); tap_node(search)
adb('shell', 'input', 'text', 'Germany'); time.sleep(1)
click('Германия'); click('ИГРАТЬ ЗА ЭТУ СТРАНУ', scroll=True)
click('Я ГОТОВ')
for attempt in range(20):
    tree = hierarchy('native-ready-'+str(attempt))
    start = next((n for n in tree.iter('node') if n.get('content-desc') == 'Начать игру'), None)
    if start is not None and start.get('enabled') == 'true': break
    time.sleep(2)
assert start is not None and start.get('enabled') == 'true'
tap_node(start); time.sleep(8)
click('Раздел Страна'); pause_native_campaign()
paused = assert_online_campaign(snapshot(), room_id, native_id, 'germany')
assert_map_painted(screenshot('01-online-paused'))

# A real native focus payment must survive every reconnect without a new
# room, replayed payment, progress while paused, or duplicate start/reward.
before = paused['countries']['germany']
click('Раздел Нац. курс'); click('Взять национальный курс', scroll=True)
for attempt in range(6):
    paid = assert_online_campaign(snapshot(), room_id, native_id, 'germany')
    if (paid['countries']['germany'].get('nationalFocus') or {}).get('focusId') == 'eco-audit':
        break
    tree = hierarchy('course-response-'+str(attempt))
    assert not any(n.get('text') == 'Действие отклонено' for n in tree.iter('node')), \
        'Native paid course was rejected; never replay its payment'
    time.sleep(2)
else:
    raise AssertionError('Single native course payment was not acknowledged by the server')
assert round(before['treasury']-paid['countries']['germany']['treasury'], 3) == 220
assert before['politicalPower']-paid['countries']['germany']['politicalPower'] == 16
fingerprint = paid_course_fingerprint(paid, 'germany')
uid_before = package_uid(); keys_before, cipher_before = secure_keys()
screenshot('02-online-paid-course')


def reconnect(name):
    launch(); click('Мультиплеер'); click('Вернуться · '+room_code, scroll=True)
    for attempt in range(20):
        tree = hierarchy(name+'-'+str(attempt))
        if any(n.get('text', '').startswith('Ход ') for n in tree.iter('node')): break
        time.sleep(2)
    else: raise AssertionError('Original native multiplayer session did not reconnect')
    current = assert_online_campaign(snapshot(), room_id, native_id, 'germany')
    assert paid_course_fingerprint(current, 'germany') == fingerprint, 'Reconnect repeated or lost paid course'
    keys, _ = secure_keys()
    assert_same_native_session(uid_before, package_uid(), keys_before, keys)
    assert_map_painted(screenshot(name))
    return current


click('ВЫЙТИ'); click('Выйти'); time.sleep(2)
reconnect('03-menu-reconnect')
adb('shell', 'am', 'force-stop', PACKAGE)
stopped_keys, stopped_cipher = secure_keys()
assert stopped_keys == keys_before
reconnect('04-process-reconnect')

# Drive only actual elapsed server time from the guest after closing Android.
# This deliberately proves the stored native owner returns after AI/host takeover.
adb('shell', 'am', 'force-stop', PACKAGE)
deadline = time.monotonic()+68
while time.monotonic() < deadline:
    time.sleep(3); timed_out = snapshot()['state']
old_owner = next(p for p in timed_out['players'] if p['id'] == native_id)
assert old_owner['aiControlled'] and not old_owner['isHost']
assert next(p for p in timed_out['players'] if p['isHost'])['id'] == guest['playerId']
assert paid_course_fingerprint(timed_out, 'germany') == fingerprint
reconnect('05-native-owner-return')

adb('reboot', timeout=15); adb('wait-for-device', timeout=90)
for attempt in range(45):
    if adb('shell', 'getprop', 'sys.boot_completed').strip() == '1': break
    time.sleep(2)
else: raise AssertionError('QA emulator did not reboot')
root_test_device(adb, OUT/'emulator-root-after-reboot.txt')
final = reconnect('06-reboot-reconnect')
assert_no_game_fatal(logs(), ' '.join(game_pids))
report = {'roomId': room_id, 'qaName': QA_NAME, 'stateVersion': final['stateVersion'],
          'apkSha256': hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),
          'nativeCreate': True, 'nativeCountrySelection': 'germany', 'serverPaused': True,
          'nativePaidFocus': 'eco-audit', 'menuReconnect': True, 'processReconnect': True,
          'realHostMigration': True, 'nativeOwnerReturn': True, 'rebootReconnect': True,
          'sameNativeUidAndSessionKeys': True, 'onceOnlyFocusPaymentRetained': True,
          'members': 2, 'cleanup': 'PENDING',
          'note': 'Actual existing production HTTP and signed native controls; no tokens or snapshots in evidence.'}
(OUT/'NATIVE_ONLINE_QA.json').write_text(json.dumps(report, indent=2)+'\n')
print('PASS: signed native create, server pause/payment, encrypted menu/process/host-migration/reboot reconnect', flush=True)
