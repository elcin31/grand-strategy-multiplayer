"""Recognize visible campaign feedback, including the existing deferred map loader."""
import re


def campaign_feedback(root, package):
    for node in root.iter('node'):
        if node.get('package') != package or node.get('visible-to-user', 'true') != 'true':
            continue
        rect = [int(x) for x in re.findall(r'-?\d+', node.get('bounds', ''))]
        if len(rect) != 4 or rect[2] <= rect[0] or rect[3] <= rect[1]:
            continue
        text = node.get('text', '')
        for prefix, state in [('Загрузка кампании', 'campaign-loading'),
                              ('Подготовка карты мира', 'map-loading'),
                              ('Политическая', 'campaign')]:
            if text.startswith(prefix):
                return state
    return None
