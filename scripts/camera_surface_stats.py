"""Recent compositor presentation intervals, separate from HWUI frame work.

SurfaceView bypasses TextureView's window composition. Therefore gfxinfo alone
cannot establish a map-presentation improvement across these two backends.
Keep the actual latency output, unavailable/ambiguous captures and ring limits.
"""
import math


def map_surface_layer(layers, package):
    candidates = [s.strip() for s in layers.splitlines() if package in s]
    surface = [s for s in candidates if 'SurfaceView' in s and '(BLAST)' in s]
    if not surface:
        surface = [s for s in candidates if 'SurfaceView' in s]
    if surface:
        return surface[0] if len(surface) == 1 else None
    window = [s for s in candidates if 'SurfaceView' not in s and '(BLAST)' in s]
    return window[0] if len(window) == 1 else None


def surface_frame_stats(raw):
    lines = raw.strip().splitlines()
    report = {'available': False, 'frames': 0, 'invalidRows': 0,
              'unpresentedRows': 0, 'nonIncreasingRows': 0,
              'recentRingMayBeTruncated': False, 'p50Ms': None,
              'p95Ms': None, 'p99Ms': None, 'maxMs': None,
              'note': 'Recent actual-present timestamp differences only. '
                      'Not HWUI work, unique dropped frames or physical handset FPS.'}
    try:
        refresh = int(lines[0])
        if refresh <= 0:
            raise ValueError('Invalid refresh interval')
    except (IndexError, ValueError):
        report['error'] = 'Compositor latency unavailable'
        return report
    report['refreshPeriodNs'] = refresh
    present = []
    for line in lines[1:]:
        try:
            desired, actual, ready = map(int, line.split())
        except ValueError:
            report['invalidRows'] += 1
            continue
        if actual in (0, 2**63 - 1):
            report['unpresentedRows'] += 1
            continue
        if min(desired, actual, ready) < 0:
            report['invalidRows'] += 1
            continue
        if present and actual <= present[-1]:
            report['nonIncreasingRows'] += 1
            continue
        present.append(actual)
    report['frames'] = len(present)
    report['recentRingMayBeTruncated'] = len(lines) - 1 >= 127
    if len(present) < 2 or report['invalidRows'] or report['nonIncreasingRows']:
        report['error'] = 'Missing or invalid compositor presentation sequence'
        return report
    intervals = sorted((b - a) / 1e6 for a, b in zip(present, present[1:]))
    def quantile(q):
        return intervals[max(0, math.ceil(len(intervals) * q) - 1)]
    report.update(available=True, firstPresentNs=present[0], lastPresentNs=present[-1],
                  p50Ms=quantile(.5), p95Ms=quantile(.95), p99Ms=quantile(.99),
                  maxMs=intervals[-1])
    return report
