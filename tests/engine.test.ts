import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialGame } from '../src/data/world';
import { applyCommand } from '../src/engine/gameEngine';
function running() {
  let state = createInitialGame();
  state = applyCommand(state, { type: 'SELECT_COUNTRY', playerId: 'local-player', countryId: 'france' });
  state = applyCommand(state, { type: 'SET_READY', playerId: 'local-player', ready: true });
  return applyCommand(state, { type: 'START_GAME', playerId: 'local-player' });
}
test('recruitment pays treasury and manpower without mutating prior state', () => {
  const state = running(), before = structuredClone(state);
  const result = applyCommand(state, { type: 'RECRUIT', playerId: 'local-player', provinceId: 'fr-1', troops: 10000 });
  assert.equal(result.countries.france.treasury, state.countries.france.treasury - 200);
  assert.equal(result.countries.france.manpower, state.countries.france.manpower - 10000);
  assert.deepEqual(state, before);
});
test('invalid movement and recruitment commands are rejected', () => {
  const state = running();
  for (const troops of [-1, 0, NaN, Infinity, 1.2, 100001]) assert.throws(() => applyCommand(state, { type: 'RECRUIT', playerId: 'local-player', provinceId: 'fr-1', troops }));
  assert.throws(() => applyCommand(state, { type: 'RECRUIT', playerId: 'local-player', provinceId: 'de-1', troops: 10000 }));
  assert.throws(() => applyCommand(state, { type: 'MOVE_ARMY', playerId: 'local-player', armyId: 'army-fr-1', provinceId: 'ru-2' }));
  assert.throws(() => applyCommand(state, { type: 'MOVE_ARMY', playerId: 'local-player', armyId: 'army-de-1', provinceId: 'fr-1' }));
});
test('AI simulation has finite values, unique ids, legal army positions and bounded logs', () => {
  let state = running();
  for (let i = 0; i < 1000; i++) {
    state = applyCommand(state, { type: 'ADVANCE_TICK' });
    assert.equal(new Set(state.provinces.map(p => p.id)).size, state.provinces.length);
    assert.equal(new Set(state.armies.map(a => a.id)).size, state.armies.length);
    for (const a of state.armies) { assert.ok(Number.isFinite(a.troops) && a.troops > 0); assert.ok(state.provinces.some(p => p.id === a.provinceId)); }
    for (const c of Object.values(state.countries)) for (const value of [c.treasury, c.population, c.manpower, c.army]) assert.ok(Number.isFinite(value) && value >= 0);
    assert.ok(state.battleLog.length <= 20);
  }
});
