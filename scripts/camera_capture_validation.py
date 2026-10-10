"""Validate completed ABBA evidence before separate diagnostic trace launches.

Capture completeness is independent of performance acceptance. Failed memory
and frame gates remain failures and are explicitly retained in this report.
"""
import math

CAPTURES = ('camera-before', 'camera-after', 'camera-after-reverse', 'camera-before-reverse')
SCENARIOS = ('01-idle', '02-medium-pan', '03-pinch', '04-world-pan',
             '05-local-labels-armies', '06-terrain-pan', '07-military-overlay',
             '08-panel-open', '09-panel-closed')


def positive(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def validate_captures(captures, fixture_sha, fixture_checksum):
    assert set(captures) == set(CAPTURES), 'All four ABBA launches are required'
    assert fixture_sha and fixture_checksum, 'Missing accepted fixture identity'
    for name in CAPTURES:
        data = captures[name]
        assert data.get('protocol') == 'fixed-save-reset-v2', name+' protocol'
        assert data.get('fixtureSha256') == fixture_sha, name+' fixture hash'
        assert data.get('fixtureStateChecksum') == fixture_checksum, name+' paused world'
        rows = data.get('results', [])
        assert tuple(r.get('scenario') for r in rows) == SCENARIOS, name+' complete scenario order'
        for row in rows:
            assert positive(row.get('pssKiB')), name+' memory capture missing'
            if row['scenario'] == '01-idle':
                continue
            s = row.get('surfacePresentation', {})
            assert s.get('available') is True and s.get('complete') is True, name+' incomplete compositor capture'
            assert isinstance(s.get('frames'), int) and not isinstance(s['frames'], bool) and s['frames'] >= 20, name+' too few presented frames'
            assert all(positive(s.get(k)) for k in ('p95Ms', 'p99Ms')), name+' invalid presentation times'
            assert s['p95Ms'] <= s['p99Ms'], name+' invalid percentile order'
            assert positive(row.get('histogramP95Ms')), name+' HWUI histogram missing'
    violations = []
    for order, before, after in [('forward', 'camera-before', 'camera-after'),
                                 ('reverse', 'camera-before-reverse', 'camera-after-reverse')]:
        for b, a in zip(captures[before]['results'], captures[after]['results']):
            label = order+':'+b['scenario']
            if a['pssKiB'] > b['pssKiB']*1.2:
                violations.append(dict(scenario=label, gate='pss20percent', before=b['pssKiB'], after=a['pssKiB']))
            if b['scenario'] == '01-idle':
                continue
            allowance = 1.1 if b['scenario'] == '03-pinch' else 1.2
            for metric in ('p95Ms', 'p99Ms'):
                if a['surfacePresentation'][metric] > b['surfacePresentation'][metric]*allowance:
                    violations.append(dict(scenario=label, gate='compositor:'+metric,
                                           before=b['surfacePresentation'][metric], after=a['surfacePresentation'][metric]))
            if a['histogramP95Ms'] > b['histogramP95Ms']*allowance:
                violations.append(dict(scenario=label, gate='histogramP95Ms', before=b['histogramP95Ms'], after=a['histogramP95Ms']))
    return dict(diagnosticOnly=True, allFourCapturesComplete=True, scenariosPerLaunch=9,
                fixtureSha256=fixture_sha, fixtureStateChecksum=fixture_checksum,
                comparisonGateViolations=violations,
                comparisonGatesPassed=not violations,
                note='Original20% PSS/other and10% pinch limits retained. Complete captures allow diagnosis; they do not establish final native or physical-device acceptance.')
