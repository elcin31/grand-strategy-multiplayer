import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialGame } from '../src/data/world';
import { applyCommand } from '../src/engine/gameEngine';
import { applyServerCommand, createInitialState } from '../supabase/functions/_shared/game';

const rejected: unknown[] = [null, [], {}, { type: 'UNKNOWN' }, { type: '__proto__' },
  { type: 'SELECT_COUNTRY', playerId: 'local-player', countryId: 'missing' },
  { type: 'SELECT_COUNTRY', playerId: 'local-player', countryId: '__proto__' },
  { type: 'SET_READY', playerId: 'local-player', ready: 'true' },
  { type: 'SET_READY', playerId: 'local-player', ready: true, treasury: 1e9 },
  ...[null, '4', -1, 5, NaN, Infinity, 1.5].map(speed => ({ type: 'SET_SPEED', playerId: 'local-player', speed })),
  ...[null, '1000', -1, 0, NaN, Infinity, 100001, 1500.5].map(troops => ({ type: 'RECRUIT', playerId: 'local-player', provinceId: 'de-1', troops })),
  { type: 'MOVE_ARMY', playerId: 'local-player', armyId: {}, provinceId: 'de-1' },
  { type: 'ADVANCE_TICK', playerId: 'local-player' },
];
for (const mode of ['local', 'server'] as const) {
  test(`${mode} rejects malformed commands without changing the campaign`, () => {
    const state = mode === 'local' ? createInitialGame() : createInitialState('game', 'SECURE', 'local-player', 'Test');
    const before = JSON.stringify(state);
    for (const command of rejected) {
      assert.throws(() => mode === 'local' ? applyCommand(state, command as never) : applyServerCommand(state, command as never, 'local-player'));
      assert.equal(JSON.stringify(state), before);
    }
  });
  test(`${mode} enforces lobby, start, pause and resume transitions`, () => {
    let state = mode === 'local' ? createInitialGame() : createInitialState('game', 'SECURE', 'local-player', 'Test');
    const apply = (command: unknown) => mode === 'local' ? applyCommand(state, command as never) : applyServerCommand(state, command as never, 'local-player');
    assert.throws(() => apply({ type: 'SET_SPEED', playerId: 'local-player', speed: 1 }));
    state = apply({ type: 'SELECT_COUNTRY', playerId: 'local-player', countryId: 'germany' });
    state = apply({ type: 'SET_READY', playerId: 'local-player', ready: true });
    state = apply({ type: 'START_GAME', playerId: 'local-player' });
    assert.equal(state.phase, 'running');
    assert.throws(() => apply({ type: 'START_GAME', playerId: 'local-player' }));
    assert.throws(() => apply({ type: 'SET_READY', playerId: 'local-player', ready: false }));
    state = apply({ type: 'SET_SPEED', playerId: 'local-player', speed: 0 });
    assert.equal(state.phase, 'paused');
    state = apply({ type: 'SET_SPEED', playerId: 'local-player', speed: 1 });
    const funds = state.countries.germany.treasury;
    state = apply({ type: 'RECRUIT', playerId: 'local-player', provinceId: 'de-1', troops: 10000 });
    assert.equal(state.countries.germany.treasury, funds - 200);
  });
}
test('server rejects actor spoofing and a non-host advancing the clock', () => {
  const state = createInitialState('game', 'SECURE', 'host', 'Host');
  state.players.push({ id: 'guest', displayName: 'Guest', countryId: null, ready: false, isHost: false });
  const before = JSON.stringify(state);
  assert.throws(() => applyServerCommand(state, { type: 'SELECT_COUNTRY', playerId: 'host', countryId: 'germany' }, 'guest'));
  assert.throws(() => applyServerCommand(state, { type: 'ADVANCE_TICK' }, 'guest'));
  assert.equal(JSON.stringify(state), before);
});
