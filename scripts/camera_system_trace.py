"""Additional rooted-CI diagnostic; never replaces or changes camera gates.

Based on Perfetto's public system-tracing configuration/API documentation:
https://perfetto.dev/docs/getting-started/system-tracing
No app manifest/debug mode, game instrumentation or backend changes needed.
"""
import hashlib
import json
import re
import subprocess
import time

PACKAGE = 'com.elcin31.grandstrategymultiplayer'
DEVICE_TRACE = '/data/misc/perfetto-traces/dominion-camera.pftrace'
MARKER = '/sys/kernel/tracing/trace_marker'
CONFIG = '''buffers { size_kb: 16384 fill_policy: RING_BUFFER }
duration_ms: 20000
data_sources { config { name: "linux.ftrace" ftrace_config {
  ftrace_events: "sched/sched_switch"
  ftrace_events: "sched/sched_waking"
  atrace_categories: "gfx"
  atrace_categories: "view"
  atrace_categories: "input"
  atrace_categories: "am"
  atrace_categories: "dalvik"
  atrace_apps: "com.elcin31.grandstrategymultiplayer"
} } }
data_sources { config { name: "linux.process_stats" process_stats_config {
  scan_all_processes_on_start: true
  proc_stats_poll_ms: 1000
} } }
data_sources { config { name: "android.surfaceflinger.frametimeline" } }
'''


def capture_camera_trace(adb, out, gesture, popen=subprocess.Popen, pause=time.sleep):
    assert adb('shell', 'id', '-u').strip() == '0', 'Trace-only mode requires its own rooted CI emulator'
    pid = adb('shell', 'pidof', PACKAGE).strip()
    assert pid.isascii() and pid.isdigit(), 'Missing/ambiguous game PID before trace'
    adb('shell', 'test', '-w', MARKER)
    config = out / 'pinch-trace.cfg'
    config.write_text(CONFIG)
    # Async begin/end delimit the real gesture on the device clock, allowing
    # later SQL to exclude startup/tail idle time without fabricating timestamps.
    def marker(phase):
        adb('shell', 'sh', '-c', "'echo \""+phase+'|'+pid+'|DOMINION_PINCH_TRACE|101\" > '+MARKER+"'")
    with config.open('r') as source, (out / 'perfetto-record.txt').open('w') as log:
        process = popen(['adb', 'shell', 'perfetto', '--txt', '-c', '-', '-o', DEVICE_TRACE],
                        stdin=source, stdout=log, stderr=subprocess.STDOUT)
        try:
            pause(1)
            marker('S')
            try:
                gesture()
            finally:
                marker('F')
            code = process.wait(timeout=30)
            assert code == 0, 'Perfetto capture failed: '+str(code)
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
    assert adb('shell', 'pidof', PACKAGE).strip() == pid, 'Game died/restarted during trace'
    logs = adb('logcat', '-d')
    (out / 'trace-logcat.txt').write_text(logs)
    assert not re.search(r'FATAL EXCEPTION|Fatal signal|JavascriptException', logs), 'Fatal error during trace'
    trace = out / 'pinch.pftrace'
    adb('pull', DEVICE_TRACE, trace)
    raw = trace.read_bytes()
    assert len(raw) > 1024, 'Missing/empty system trace'
    report = {'diagnosticOnly': True, 'pid': int(pid), 'traceBytes': len(raw),
              'traceSha256': hashlib.sha256(raw).hexdigest(),
              'configSha256': hashlib.sha256(CONFIG.encode()).hexdigest(),
              'gestureMarker': 'DOMINION_PINCH_TRACE',
              'note': 'Separate trace-only launch AFTER gated comparisons, not their workload. '
                      'No FPS, CPU attribution or performance acceptance inferred from file presence. '
                      'Analyze actual async marker interval and trace loss/coverage before attribution. '
                      'Software emulator only; physical Redmi unmeasured.'}
    (out / 'trace-capture.json').write_text(json.dumps(report, indent=2)+'\n')
    return report
