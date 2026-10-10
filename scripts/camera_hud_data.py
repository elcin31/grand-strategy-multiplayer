"""Read real timing and touch HUD nodes without dropping target identities."""
import json
import math


def camera_hud_data(root):
    labels = [n.get('content-desc', '') for n in root.iter('node')]
    timings = [label.removeprefix('DOMINION_CAMERA ') for label in labels if label.startswith('DOMINION_CAMERA ')]
    targets = [label.removeprefix('DOMINION_TARGETS ') for label in labels if label.startswith('DOMINION_TARGETS ')]
    assert len(timings) == 1 and len(targets) <= 1, 'Missing/ambiguous camera HUD'
    metrics = json.loads(timings[0])
    assert isinstance(metrics, dict), 'Invalid camera timing payload'
    if targets:
        geometry = json.loads(targets[0])
        assert isinstance(geometry, dict) and set(geometry) == {'armyTargets', 'countryTargets'}, 'Invalid touch target payload'
        assert not set(geometry).intersection(metrics), 'Duplicate target fields in separate timing HUD'
        metrics = {**metrics, **geometry}
    for field in ['armyTargets', 'countryTargets']:
        assert isinstance(metrics.get(field), str), 'Missing real touch targets: ' + field
        rows = json.loads(metrics[field])
        assert isinstance(rows, list), 'Invalid real touch target list: ' + field
        for row in rows:
            keys = {'countryId', 'x', 'y'} if field == 'countryTargets' else {'ids', 'ownerIds', 'selected', 'x', 'y'}
            assert isinstance(row, dict) and set(row) == keys, 'Invalid real touch target shape'
            assert all(isinstance(row[k], (int, float)) and not isinstance(row[k], bool) and math.isfinite(row[k]) for k in ['x', 'y']), 'Invalid real touch coordinates'
            if field == 'countryTargets':
                assert isinstance(row['countryId'], str) and row['countryId'], 'Missing real target country'
            else:
                assert isinstance(row['selected'], bool), 'Invalid real army selection'
                for key in ['ids', 'ownerIds']:
                    assert isinstance(row[key], list) and row[key] and all(isinstance(v, str) and v for v in row[key]), 'Missing real target army identities'
    return metrics
