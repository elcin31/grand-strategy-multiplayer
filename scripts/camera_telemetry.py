"""Bounded, explicitly auxiliary UI callback telemetry from real logcat samples.

Never substitutes for native gfxinfo gates or treats a post-gesture HUD as FPS.
"""
import json
import math

FIELDS = ('uiFps', 'frameMs', 'frameP50Ms', 'frameP95Ms', 'frameP99Ms',
          'frameSamples', 'slowFrames', 'over50Ms', 'over100Ms', 'cameraUpdates',
          'cullCommits', 'mapRenders', 'geographyRenders', 'pathBuilds', 'pathBuildMs',
          'rasterBuilds', 'rasterMs', 'rasterBytes', 'rasterTiles',
          'rasterPrewarmBuilds', 'rasterPrewarmMs', 'visibleProvinces',
          'visibleArmies', 'visibleLabels', 'simulationMs', 'networkMs')
COUNTERS = ('cullCommits', 'mapRenders', 'geographyRenders', 'pathBuilds',
            'pathBuildMs', 'rasterBuilds', 'rasterMs', 'rasterPrewarmBuilds',
            'rasterPrewarmMs')


def camera_telemetry(raw):
    samples = []
    complete = invalid = 0
    for line in raw.splitlines():
        if 'DOMINION_CAMERA ' not in line:
            continue
        try:
            value = json.loads(line.split('DOMINION_CAMERA ', 1)[1])
        except (ValueError, TypeError):
            invalid += 1
            continue
        if not isinstance(value, dict):
            invalid += 1
            continue
        row = {key: number for key, number in value.items() if key in FIELDS and
               (number is None or (isinstance(number, (int, float)) and
                                   not isinstance(number, bool) and math.isfinite(number)))}
        if not isinstance(row.get('uiFps'), (int, float)) or row['uiFps'] < 0:
            invalid += 1
            continue
        complete += 1
        samples.append(row)
        if len(samples) > 120:
            samples.pop(0)
    active = [row for row in samples if (row.get('cameraUpdates') or 0) > 0]

    def extent(key):
        values = [row[key] for row in active if row.get(key) is not None]
        return {'min': min(values), 'max': max(values)} if values else None

    deltas = {}
    for key in COUNTERS:
        values = [row[key] for row in samples if row.get(key) is not None]
        deltas[key] = (values[-1] - values[0] if len(values) > 1 and
                       all(b >= a for a, b in zip(values, values[1:])) else None)
    return {'completeSamples': complete, 'retainedSamples': len(samples),
            'malformedSamples': invalid, 'activeSamples': len(active),
            'activeUiCallbackFpsRange': extent('uiFps'),
            'activeUiCallbackP95MsRange': extent('frameP95Ms'),
            'activeUiCallbackP99MsRange': extent('frameP99Ms'),
            'counterDeltasBetweenSamples': deltas, 'samples': samples,
            'note': 'UI callback samples are not GPU presentation or handset FPS. '
                    'Active means cameraUpdates>0; at most the last120 samples are retained. '
                    'Final HUD can be idle. Deltas omit work before/after first/last log; '
                    'counter resets return null. Truncated logs are counted, never invented. '
                    'Native gfxinfo/paint/memory acceptance thresholds remain unchanged.'}
