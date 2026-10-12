"""Validated auxiliary workloads; the original camera acceptance is unchanged."""

GESTURE_MARKERS = {
    'pinch': 'DOMINION_PINCH_TRACE',
    'world-pan': 'DOMINION_WORLD_PAN_TRACE',
    'local-pan': 'DOMINION_LOCAL_PAN_TRACE',
    'military-pan': 'DOMINION_MILITARY_PAN_TRACE',
    'terrain-pan': 'DOMINION_TERRAIN_PAN_TRACE',
    'panel-closed-pan': 'DOMINION_PANEL_CLOSED_PAN_TRACE',
}


def trace_filename(scenario):
    assert scenario in GESTURE_MARKERS, 'Unsupported trace-only camera scenario'
    return scenario + '.pftrace'


def prepare_trace_scenario(scenario, reset_camera, settings, find_click, nav, adb):
    # Reject unknown input before touching the emulator or shell.
    trace_filename(scenario)
    reset_camera(world=scenario == 'world-pan',
                 local=scenario in ['local-pan', 'military-pan', 'terrain-pan', 'panel-closed-pan'])
    if scenario in ['military-pan', 'terrain-pan']:
        settings()
        find_click('Режим Армии' if scenario == 'military-pan' else 'Режим Рельеф')
        reset_camera(local=True)
    elif scenario == 'panel-closed-pan':
        settings()
        find_click('Режим Политическая')
        reset_camera(local=True)
        nav('Экономика')
        adb('shell', 'input', 'keyevent', '4')
        reset_camera(local=True)
