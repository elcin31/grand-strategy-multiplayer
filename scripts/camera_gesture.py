"""Actual continuous-pointer cadence; frame samples and limits stay unchanged."""
import json

INPUT_PROTOCOL = 'continuous-pointer-v1'
PREFIX = 'DOMINION_GESTURE_TIMING '


def integer(value, minimum, maximum=None):
    return type(value) is int and value >= minimum and (maximum is None or value <= maximum)


def gesture_command(kind, cycles=5, gap_ms=0):
    assert kind in ('pan', 'pinch'), 'Unknown real pointer gesture'
    assert integer(cycles, 1, 50), 'Invalid pointer cycle count'
    assert integer(gap_ms, 0, 1000), 'Invalid injected idle gap'
    return ('CLASSPATH=/data/local/tmp/dominion-camera.jar app_process '
            '/system/bin CameraGesture '+kind+' '+str(cycles)+' '+str(gap_ms))


def validate_gesture_timing(timing, kind, cycles=5, gap_ms=0):
    assert isinstance(timing, dict) and set(timing) == {'kind', 'gapMs', 'cycles'}, 'Missing/invalid native input timing'
    assert timing['kind'] == kind and timing['gapMs'] == gap_ms and integer(timing['gapMs'], 0, 1000), 'Different injected input cadence'
    rows = timing['cycles']
    assert isinstance(rows, list) and len(rows) == cycles, 'Incomplete actual pointer cycles'
    previous = 0
    for row in rows:
        assert isinstance(row, dict) and set(row) == {'downNs', 'upNs'}, 'Invalid actual pointer interval'
        assert integer(row['downNs'], 1) and integer(row['upNs'], 1), 'Invalid native monotonic input clock'
        assert row['upNs'] > row['downNs'] >= previous, 'Nonchronological actual pointer cycles'
        previous = row['upNs']
    return timing


def gesture_timing(raw, kind, cycles=5, gap_ms=0):
    lines = [line[len(PREFIX):] for line in raw.splitlines() if line.startswith(PREFIX)]
    assert len(lines) == 1, 'Missing/ambiguous actual input timing marker'
    return validate_gesture_timing(json.loads(lines[0]), kind, cycles, gap_ms)


def validate_input_cadence(capture):
    protocol = capture.get('inputProtocol')
    if protocol is None:
        return None  # Historical captures remain historical evidence.
    assert protocol == INPUT_PROTOCOL, 'Unknown camera input protocol'
    assert len(capture.get('results', [])) == 9, 'Incomplete continuous camera workload'
    for row in capture['results'][1:]:
        validate_gesture_timing(row.get('gestureTiming'), 'pinch' if row['scenario'] == '03-pinch' else 'pan')
    return protocol
