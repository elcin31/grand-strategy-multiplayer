"""Parse HWUI frame completion across Android CSV header versions.

An idle zero-frame histogram contains 4950ms sentinels, not real slow frames.
Preserve histogram fallback only when the capture reports rendered frames.
"""
import re


def thread_stats(raw, pid):
    """Aggregate active top samples; its first sample is lifetime CPU usage."""
    samples, current = [], None
    for line in raw.splitlines():
        parts = line.split()
        if parts and parts[0] in ('TID', 'PID'):
            current = {}
            samples.append(current)
        elif current is not None and len(parts) >= 12 and parts[0].isdigit():
            try:
                cpu = float(parts[8])
            except ValueError:
                continue
            name = 'main-ui' if parts[0] == str(pid) else parts[11]
            current[name] = current.get(name, 0) + cpu
    active = samples[1:] if len(samples) > 1 else samples
    names = sorted({name for sample in active for name in sample})
    return {
        'samples': len(active),
        'note': 'Percent of one emulator CPU core; sums can exceed 100%. Same sampler on both APKs. First top sample excluded when possible.',
        'threads': {name: {'meanCpuPercent': round(sum(s.get(name, 0) for s in active) / len(active), 2),
                           'maxCpuPercent': max(s.get(name, 0) for s in active)} for name in names},
    }


def frame_stats(raw):
    total = re.search(r'Total frames rendered:\s*(\d+)', raw)
    reported = int(total[1]) if total else None
    frames = []
    lines = [line.strip() for line in raw.splitlines()]
    for i, line in enumerate(lines):
        fields = line.split(',')
        if not (fields[0] == 'Flags' and 'IntendedVsync' in fields and 'FrameCompleted' in fields):
            continue
        start, end = fields.index('IntendedVsync'), fields.index('FrameCompleted')
        for row in lines[i + 1:]:
            if not re.match(r'^\d+,', row):
                break
            values = row.split(',')
            try:
                if int(values[0]) != 0:
                    continue
                ms = (int(values[end]) - int(values[start])) / 1e6
            except (ValueError, IndexError):
                continue
            if 0 < ms < 5000:
                frames.append(ms)
    frames.sort()

    def histogram(p):
        if reported == 0:
            return None
        match = re.search(str(int(p * 100)) + r'th percentile:\s*([\d.]+)ms', raw)
        return float(match[1]) if match else None

    def percentile(p):
        if frames:
            return frames[min(len(frames) - 1, int(len(frames) * p))]
        return histogram(p)

    jank = re.search(r'Janky frames:\s*(\d+)\s*\(([\d.]+)%\)', raw)
    return {
        'reportedFrames': reported,
        'frames': len(frames),
        'timingSource': 'framestats' if frames else 'idle-no-frames' if reported == 0 else 'histogram',
        'rawWindowTruncated': reported is not None and len(frames) < reported,
        'histogramP50Ms': histogram(.5),
        'histogramP95Ms': histogram(.95),
        'histogramP99Ms': histogram(.99),
        'p50Ms': percentile(.5),
        'p95Ms': percentile(.95),
        'p99Ms': percentile(.99),
        'jankPercent': float(jank[2]) if jank else None,
    }
