import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialGame } from '../src/data/world';
import { applyCommand } from '../src/engine/gameEngine';
import { applyServerCommand, createInitialState } from '../supabase/functions/_shared/game';

// Reproducible hostile JSON, sent through both real reducers. No external random API.
function random(seed: number) {
  return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
}
test('5,000 hostile payloads cannot mutate either authoritative campaign', () => {
  const rng = random(0xD041710);
  const values: unknown[] = [null, true, false, 0, -1, 1e300, '1000', {}, [], ['host'], '__proto__'];
  const local = createInitialGame(), server = createInitialState('game', 'SECURE', 'local-player', 'Test');
  const originals = [JSON.stringify(local), JSON.stringify(server)];
  const bases: Record<string, unknown>[] = [
    { type: 'SELECT_COUNTRY', playerId: 'local-player', countryId: 'germany' },
    { type: 'SET_READY', playerId: 'local-player', ready: false },
    { type: 'SET_SPEED', playerId: 'local-player', speed: 1 },
    { type: 'RECRUIT', playerId: 'local-player', provinceId: 'de-1', troops: 10000 },
    { type: 'MOVE_ARMY', playerId: 'local-player', armyId: 'army-de-1', provinceId: 'de-2' },
    { type: 'ADVANCE_TICK' },
  ];
  for (let i = 0; i < 5000; i++) {
    const pick = () => values[Math.floor(rng() * values.length)];
    const command = { ...bases[Math.floor(rng() * bases.length)] };
    const fields = Object.keys(command);
    const field = fields[Math.floor(rng() * fields.length)]!;
    const variant = i % 4;
    if (variant === 0) delete command[field];
    else if (variant === 1) command[field] = pick();
    else if (variant === 2) command.treasury = 1e300;
    else command.type = '__proto__';
    // A correctly typed ready/speed replacement can be legal JSON; ensure these
    // generated cases still exercise an invalid actor rather than a valid order.
    if (variant === 1 && (field === 'ready' || field === 'speed')) command.playerId = 'missing-player';
    assert.throws(() => applyCommand(local, command as never));
    assert.throws(() => applyServerCommand(server, command as never, 'local-player'));
    assert.equal(JSON.stringify(local), originals[0]);
    assert.equal(JSON.stringify(server), originals[1]);
  }
});
for (const mode of ['local', 'server'] as const) {
  test(`${mode} preserves balances and army invariants across 1,000 paused orders`, () => {
    const rng = random(178);
    let state = mode === 'local' ? createInitialGame() : createInitialState('game', 'SECURE', 'local-player', 'Test');
    const apply = (command: unknown) => mode === 'local' ? applyCommand(state, command as never) : applyServerCommand(state, command as never, 'local-player');
    for (const command of [
      { type: 'SELECT_COUNTRY', playerId: 'local-player', countryId: 'germany' },
      { type: 'SET_READY', playerId: 'local-player', ready: true },
      { type: 'START_GAME', playerId: 'local-player' },
      { type: 'SET_SPEED', playerId: 'local-player', speed: 0 },
    ]) state = apply(command);
    const start = structuredClone(state);
    let paid = 0, recruited = 0;
    for (let i = 0; i < 1000; i++) {
      const troops = 1000 * (1 + Math.floor(rng() * 100));
      const provinceId = rng() < .8 ? 'de-1' : 'fr-1';
      const canRecruit = provinceId === 'de-1' && state.countries.germany!.treasury >= troops / 1000 * 20 && state.countries.germany!.manpower >= troops;
      const command = { type: 'RECRUIT', playerId: 'local-player', provinceId, troops };
      if (canRecruit) { state = apply(command); paid += troops / 1000 * 20; recruited += troops; }
      else { const before = structuredClone(state); assert.throws(() => apply(command)); assert.deepEqual(state, before); }
      state = apply({ type: 'ADVANCE_TICK' });
      assert.equal(state.phase, 'paused');
      assert.equal(state.tick, start.tick);
      assert.equal(state.month, start.month);
      assert.equal(state.countries.germany!.treasury, start.countries.germany!.treasury - paid);
      assert.equal(state.countries.germany!.manpower, start.countries.germany!.manpower - recruited);
      assert.equal(state.countries.germany!.army, start.countries.germany!.army + recruited);
      assert.equal(new Set(state.armies.map(a => a.id)).size, state.armies.length);
      for (const army of state.armies) assert.ok(Number.isSafeInteger(army.troops) && army.troops > 0 && state.provinces.some(p => p.id === army.provinceId));
    }
  });
}
