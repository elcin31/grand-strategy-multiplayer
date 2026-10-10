"""Recent compositor presentation intervals, separate from HWUI frame work.

SurfaceView bypasses TextureView's window composition. Therefore gfxinfo alone
cannot establish a map-presentation improvement across these two backends.
Keep the actual latency output, unavailable/ambiguous captures and ring limits.
"""
import math
import json
import re
import shlex
import threading
import time


def map_surface_layer(layers, package):
    candidates = []
    for line in layers.splitlines():
        s=line.strip()
        wrapper=re.fullmatch(r'RequestedLayerState\{(.+) parentId=-?\d+\}',s)
        if wrapper:s=wrapper[1]
        if package in s:candidates.append(s)
    surface = [s for s in candidates if 'SurfaceView' in s and '(BLAST)' in s]
    if not surface:
        surface = [s for s in candidates if 'SurfaceView' in s]
    if surface:
        return surface[0] if len(surface) == 1 else None
    window = [s for s in candidates if 'SurfaceView' not in s and '(BLAST)' in s]
    if not window:
        window=[s for s in candidates if 'SurfaceView' not in s and re.search(r'/[^/]*\.MainActivity#\d+$',s)]
    return window[0] if len(window) == 1 else None


def surface_latency_args(layer):
    # adb joins shell arguments into one remote shell command. Parentheses,
    # brackets and spaces in actual Android layer names must be quoted.
    return ('shell','dumpsys','SurfaceFlinger','--latency',shlex.quote(layer))


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


def surface_sequence_stats(polls, duration):
    """Combine overlapping compositor rings, retaining every observed stall.

    A polling gap large enough to overflow the ring invalidates full capture.
    Sorting here only deduplicates overlapping polls: each raw ring is checked
    for its own chronological order first.
    """
    presents = set(); refresh = set(); invalid = False
    times = [0.0]; snapshot_full = False
    for poll in polls:
        times.append(poll['atSeconds'])
        raw = poll.get('raw', '')
        parsed = surface_frame_stats(raw)
        invalid |= bool(poll.get('error') or parsed['invalidRows'] or parsed['nonIncreasingRows'] or not parsed.get('refreshPeriodNs'))
        snapshot_full |= parsed['recentRingMayBeTruncated']
        if parsed.get('refreshPeriodNs'):
            refresh.add(parsed['refreshPeriodNs'])
        for line in raw.strip().splitlines()[1:]:
            try:
                desired, actual, ready = map(int, line.split())
                if min(desired, actual, ready) >= 0 and actual not in (0, 2**63-1):
                    presents.add(actual)
            except ValueError:
                pass  # invalidRows above makes capture incomplete
    times.append(duration)
    max_gap = max((b-a for a,b in zip(times,times[1:])),default=duration)
    complete = bool(polls) and len(refresh)==1 and not invalid and max_gap < min(refresh,default=0)*120/1e9
    combined = str(next(iter(refresh),0))+'\n'+'\n'.join(f'0 {n} 0' for n in sorted(presents))
    report = surface_frame_stats(combined)
    report.update(complete=complete, polls=len(polls), maxPollGapSeconds=max_gap,
                  captureSeconds=duration, snapshotRingWasFull=snapshot_full,
                  recentRingMayBeTruncated=not complete,
                  note='Actual presentation intervals throughout polled capture; '
                       'overlapping rings deduplicated. Not physical handset FPS.')
    if not complete:
        report['error'] = 'Compositor polling incomplete, invalid or ring may have overflowed'
    return report


class SurfaceSampler:
    def __init__(self, adb, layer, path):
        self.adb, self.layer, self.path = adb, layer, path
        self.polls = []; self.stopped = threading.Event(); self.started = time.monotonic()
        self.thread = threading.Thread(target=self._run, daemon=True)
    def _capture(self):
        row = {}
        try:
            row['raw'] = self.adb(*surface_latency_args(self.layer),timeout=5) if self.layer else ''
        except Exception as error:
            row['error'] = str(error)
        row['atSeconds'] = time.monotonic()-self.started
        self.polls.append(row)
    def _run(self):
        while not self.stopped.is_set() and len(self.polls)<255:
            self._capture(); self.stopped.wait(.25)
    def start(self):
        self.thread.start()
    def finish(self):
        self.stopped.set(); self.thread.join(timeout=6)
        if self.thread.is_alive():
            raise AssertionError('Compositor sampler did not stop')
        self._capture()
        self.path.write_text(json.dumps(self.polls,indent=2)+'\n')
        return {**surface_sequence_stats(self.polls,time.monotonic()-self.started),'layer':self.layer}
