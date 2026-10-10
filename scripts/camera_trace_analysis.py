"""Evidence from a real device marker only; incomplete capture stays incomplete."""


def analyze_trace(trace, pid, digest):
    assert isinstance(pid, int) and not isinstance(pid, bool) and pid > 0
    diagnostics = [dict(name=r.name, index=r.idx, value=r.value, severity=r.severity)
                   for r in trace.query("SELECT name,idx,value,severity FROM stats WHERE value>0 AND "
                                        "(severity IN ('error','data_loss') OR name LIKE '%overrun%' "
                                        "OR name LIKE '%dropped%' OR name LIKE '%overwritten%' "
                                        "OR name='ftrace_setup_errors')")]
    # Android async markers use process tracks; synchronous markers use thread
    # tracks. Resolve both to the captured game PID, never another application's
    # similarly named slice. Keep unfinished markers visible in the report.
    markers = [dict(ts=r.ts, dur=r.dur) for r in trace.query(f'''SELECT s.ts,s.dur
      FROM slice s LEFT JOIN process_track pt ON s.track_id=pt.id
      LEFT JOIN thread_track tt ON s.track_id=tt.id LEFT JOIN thread t ON tt.utid=t.utid
      JOIN process p ON p.upid=COALESCE(pt.upid,t.upid)
      WHERE s.name='DOMINION_PINCH_TRACE' AND p.pid={pid}''')]
    report = dict(diagnosticOnly=True, traceSha256=digest, markerCandidates=markers,
                  traceLossOrErrors=diagnostics, markerValid=False,
                  schedulerCoveragePresent=False, attributionComplete=False,
                  threadStates=[], completedNestedSlices=[])
    if len(markers) != 1 or markers[0]['dur'] <= 0:
        report['error'] = 'Missing/ambiguous completed real-gesture marker; no time interval invented'
        return report
    begin, end = markers[0]['ts'], markers[0]['ts'] + markers[0]['dur']
    threads = trace.query(f'''SELECT t.tid, t.name, s.state,
      SUM(MIN(s.ts+s.dur,{end})-MAX(s.ts,{begin}))/1e6 AS measured_ms, COUNT(*) AS samples
      FROM thread_state s JOIN thread t USING(utid) JOIN process p USING(upid)
      WHERE p.pid={pid} AND s.dur>0 AND s.ts<{end} AND s.ts+s.dur>{begin}
      GROUP BY t.tid,t.name,s.state ORDER BY measured_ms DESC''')
    report['threadStates'] = [dict(tid=r.tid, thread=r.name, state=r.state,
                                  observedMs=r.measured_ms, samples=r.samples) for r in threads]
    slices = trace.query(f'''SELECT t.tid,t.name AS thread,s.name,
      COUNT(*) AS samples,SUM(s.dur)/1e6 AS nested_ms,MAX(s.dur)/1e6 AS max_ms
      FROM slice s JOIN thread_track tt ON s.track_id=tt.id
      JOIN thread t ON tt.utid=t.utid JOIN process p USING(upid)
      WHERE p.pid={pid} AND s.dur>0 AND s.ts>={begin} AND s.ts+s.dur<={end}
      GROUP BY t.tid,t.name,s.name ORDER BY nested_ms DESC LIMIT 40''')
    report['completedNestedSlices'] = [dict(tid=r.tid, thread=r.thread, name=r.name, samples=r.samples,
                                           nestedInclusiveMs=r.nested_ms, maxCompletedMs=r.max_ms)
                                      for r in slices]
    report.update(markerValid=True, markerStartNs=begin, markerEndNs=end,
                  markerDurationMs=(end-begin)/1e6,
                  schedulerCoveragePresent=bool(report['threadStates']),
                  attributionComplete=bool(report['threadStates']) and not diagnostics)
    return report
