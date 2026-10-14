"""Report real Ganesh/OpenGL pbuffer diagnostics; never accept an APK here."""
import hashlib
import json
import math
import sys
from pathlib import Path


def quantile(values, fraction):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * fraction) - 1)]


def analyze(directory):
    reports = []
    for mode, repeat in [('mutable', 1), ('retained', 1), ('retained', 2), ('mutable', 2)]:
        path = directory / f'gpu-probe-{mode}-{repeat}.json'
        raw = path.read_bytes()
        data = json.loads(raw)
        assert data['mode'] == mode and data['diagnosticOnly'] is True
        assert data['pbufferHasCompositor'] is False and data['physicalRedmiTest'] is False
        frames = data['frames']
        assert len(frames) == 240 and [f['frame'] for f in frames] == list(range(240))
        assert data['cacheLimitBytes'] > 0
        for frame in frames:
            assert frame['scenario'] == ('pan' if frame['frame'] < 120 else 'zoom')
            for key in ['recordMs', 'drawMs', 'flushMs', 'completionMs', 'cacheBytes', 'cacheResources', 'purgeableBytes']:
                value = frame[key]
                assert type(value) in (int, float) and math.isfinite(value) and value >= 0
            assert frame['purgeableBytes'] <= frame['cacheBytes']
        summary = {'mode': mode, 'repeat': repeat, 'rawSha256': hashlib.sha256(raw).hexdigest(),
                   'glRenderer': data['glRenderer'], 'cacheLimitBytes': data['cacheLimitBytes'],
                   'peakRssKiB': data['peakRssKiB'],
                   'peakCacheBytes': max(f['cacheBytes'] for f in frames), 'scenarios': {}}
        for scenario in ['pan', 'zoom']:
            selected = [f for f in frames if f['scenario'] == scenario]
            # Keep cold frames and every observed stall; no outlier removal.
            metrics = {}
            for key in ['recordMs', 'drawMs', 'flushMs', 'completionMs', 'totalMs']:
                values = [sum(f[k] for k in ['recordMs', 'drawMs', 'flushMs', 'completionMs'])
                          if key == 'totalMs' else f[key] for f in selected]
                metrics[key] = {f'p{int(q*100)}': quantile(values, q) for q in [.5, .95, .99]}
                metrics[key]['max'] = max(values)
            summary['scenarios'][scenario] = metrics
        reports.append(summary)
    assert len({r['glRenderer'] for r in reports}) == 1, 'Different driver; comparison invalid'
    assert len({r['cacheLimitBytes'] for r in reports}) == 1, 'Different cache budgets'
    return {'diagnosticOnly': True, 'displayedFrameGateEvaluated': False,
            'physicalRedmiTest': False, 'processOrder': ['mutable', 'retained', 'retained', 'mutable'],
            'runs': reports, 'note': 'Four separate native processes on one software emulator. '
            'Pbuffer draw/submit/glFinish costs and Ganesh resource cache only. '
            'Not the app atlas, input latency, compositor completion, FPS or an APK acceptance gate.'}


if __name__ == '__main__':
    directory = Path(sys.argv[1])
    report = analyze(directory)
    (directory / 'gpu-probe-analysis.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
