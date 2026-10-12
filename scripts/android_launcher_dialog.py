"""Recognize only the actual API35 Quickstep ANR observed in upgrade QA.

No game/unknown dialog may be dismissed. The caller preserves the raw XML/logs,
checks the unchanged game PID and bounds the number of launcher dismissals.
"""
import re


def quickstep_anr_close_bounds(root):
    nodes = list(root.iter('node'))
    if not nodes or any(n.get('package') != 'android' for n in nodes):
        return None
    titles = [n for n in nodes if n.get('resource-id') == 'android:id/alertTitle']
    if len(titles) != 1 or titles[0].get('text') != "Quickstep isn't responding":
        return None
    buttons = [n for n in nodes if n.get('resource-id') == 'android:id/aerr_close']
    if len(buttons) != 1:
        return None
    button = buttons[0]
    if (button.get('text') != 'Close app' or button.get('enabled') != 'true' or
            button.get('clickable') != 'true' or button.get('visible-to-user') == 'false'):
        return None
    bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', button.get('bounds', ''))
    window = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', nodes[0].get('bounds', ''))
    if not bounds or not window:
        return None
    x1, y1, x2, y2 = map(int, bounds.groups())
    wx1, wy1, wx2, wy2 = map(int, window.groups())
    if not (wx1 <= x1 < x2 <= wx2 and wy1 <= y1 < y2 <= wy2):
        return None
    return x1, y1, x2, y2
