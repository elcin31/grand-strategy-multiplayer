"""Accept actual native reconnect only against the same paused server campaign."""
import json
import re
from backend_http import CLIENT_STATE_VERSION


def native_control_bounds(tree, target):
    """Intersect a real native control with its ancestors and landscape screen."""
    def visit(node, clip):
        if node.get('enabled') == 'false' or node.get('visible-to-user') == 'false':
            return None
        match = re.fullmatch(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', node.get('bounds', ''))
        if match:
            x1,y1,x2,y2 = map(int,match.groups())
            clip = (max(clip[0],x1),max(clip[1],y1),min(clip[2],x2),min(clip[3],y2))
        if clip[2]-clip[0] < 12 or clip[3]-clip[1] < 12:
            return None
        if node is target:
            return clip if match else None
        for child in node:
            result = visit(child,clip)
            if result is not None:
                return result
        return None
    return visit(tree,(0,0,1280,720))


def scroll_context_bounds(tree):
    """Scroll the visible window, never hardcoded coordinates on the map."""
    boxes = [native_control_bounds(tree,n) for n in tree.iter('node')
             if n.get('scrollable') == 'true']
    boxes = [b for b in boxes if b is not None and b[3]-b[1] > 120
             and b[2]-b[0] > 100 and b[2]-b[0] < 4*(b[3]-b[1])]
    assert boxes, 'Missing actual visible vertical scroll container'
    return max(boxes,key=lambda b:(b[2]-b[0])*(b[3]-b[1]))


def visible_control_bounds(node, bottom=720):
    """UiAutomator can retain an offscreen label with inverted clipped bounds."""
    match = re.fullmatch(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', node.get('bounds', ''))
    if not match or node.get('enabled') == 'false':
        return None
    x1, y1, x2, y2 = map(int, match.groups())
    if not (0 <= x1 < x2 <= 1280 and 0 <= y1 < y2 <= bottom):
        return None
    return x1, y1, x2, y2


def exit_confirmation_button(tree):
    nodes = list(tree.iter('node'))
    assert any(n.get('text') == 'Выйти из кампании?' for n in nodes), 'Missing native exit confirmation'
    matches = [n for n in nodes if n.get('class') == 'android.widget.Button'
               and n.get('text', '').casefold() == 'выйти'
               and n.get('enabled') == 'true' and n.get('clickable') == 'true']
    assert len(matches) == 1, 'Missing/ambiguous actual Android exit button'
    return matches[0]


def assert_online_campaign(response, room_id, player_id, country_id):
    state = response['state']
    assert state['id'] == room_id, 'Native flow switched rooms'
    assert state['stateVersion'] == CLIENT_STATE_VERSION, 'Online campaign schema differs from the compiled client'
    assert len(state['countries']) == 195 and len(state['provinces']) == 2924
    assert len(state['cities']) == 5411 and len(state['players']) == 2
    matches = [p for p in state['players'] if p['id'] == player_id]
    assert len(matches) == 1 and matches[0]['countryId'] == country_id
    assert matches[0]['connected'] and not matches[0]['aiControlled'], 'Native owner did not return'
    assert state['speed'] == 0 and state['phase'] == 'paused', 'Server did not actually pause'
    assert response['version'] >= 0 and response.get('checksum'), 'No authoritative snapshot'
    return state


def paid_course_fingerprint(state, country_id):
    country = state['countries'][country_id]
    project = country.get('nationalFocus')
    assert project and project['focusId'] == 'eco-audit' and project['progress'] == 0
    assert not any(f['focusId'] == 'eco-audit' for f in country['completedFocuses'])
    starts = [e for e in state['focusEvents'] if e['countryId'] == country_id
              and e['focusId'] == 'eco-audit' and e['kind'] == 'Started']
    assert len(starts) == 1, 'Missing/duplicated actual paid course event'
    return json.dumps({'tick': state['tick'], 'treasury': country['treasury'],
                       'politicalPower': country['politicalPower'], 'project': project,
                       'completed': country['completedFocuses'], 'event': starts[0]}, sort_keys=True)


def assert_same_native_session(before_uid, after_uid, before_keys, after_keys):
    assert before_uid == after_uid, 'Native reconnect changed installation UID'
    assert before_keys and before_keys == after_keys, 'Encrypted session keys disappeared or duplicated'
    # Expo57 prefixes native preference keys with the actual keychain service.
    assert any(re.search(r'(?:^|-)dominion\.session\.[0-9a-f-]{36}$', k) for k in before_keys)
    assert any(k.endswith('dominion.sessions.v1') for k in before_keys), 'No real saved multiplayer session index'
