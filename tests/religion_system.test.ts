import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { createInitialState, applyServerCommand } from '../supabase/functions/_shared/game';
import { applyCommand } from '../src/engine/gameEngine';
import { RELIGIONS, RELIGION_IDS, initializeReligions, recalcReligiousUnity, monthlyReligionEffects } from '../supabase/functions/_shared/religionSystem';
import { buildProvinceColors } from '../src/map/scene';
import type { GameState } from '../src/types/game';

const world = (seed = 101) => createWorldState('religion-qa', 'RELQA', 'host', 'Test', seed);
function campaign(state = world(), countryId = 'germany'): GameState {
  for (const command of [
    { type: 'SELECT_COUNTRY', playerId: 'host', countryId }, { type: 'SET_READY', playerId: 'host', ready: true },
    { type: 'START_GAME', playerId: 'host' }, { type: 'SET_SPEED', playerId: 'host', speed: 0 },
  ]) state = applyServerCommand(state, command as never, 'host');
  return state;
}
const choice = (state: GameState) => RELIGION_IDS.find(id => id !== state.countries.germany!.religion)!;

test('religion catalogue and all-world scenario identities are valid, deterministic and seed-sensitive', () => {
  assert.equal(RELIGION_IDS.length, 13);
  assert.equal(new Set(Object.values(RELIGIONS).map(r => r.group)).size, 10);
  const state = world(); assert.deepEqual(state, world());
  const another = world(202);
  assert.ok(state.provinces.some((p, i) => p.religion !== another.provinces[i]!.religion));
  assert.equal(new Set(state.provinces.map(p => p.religion)).size, 13);
  for (const c of Object.values(state.countries)) {
    assert.ok(Object.hasOwn(RELIGIONS, c.religion!));
    assert.ok(c.religiousUnity! >= 0 && c.religiousUnity! <= 100);
    const capital = state.cities!.find(city => city.id === c.capitalCityId)!;
    assert.equal(state.provinces.find(p => p.id === capital.provinceId)!.religion, c.religion);
  }
});

test('state faith switch pays once, preserves province faiths and affects only the authenticated country', () => {
  const before = campaign(); before.countries.germany!.politicalPower = 150;
  const original = structuredClone(before), command = { type: 'CHANGE_RELIGION', playerId: 'host', religionId: choice(before) } as const;
  const next = applyServerCommand(before, command, 'host'), nation = next.countries.germany!;
  assert.deepEqual(next, applyCommand(before, command));
  assert.equal(nation.politicalPower, 30); assert.equal(nation.stability, before.countries.germany!.stability - 12);
  assert.equal(nation.unrest, before.countries.germany!.unrest! + 8);
  assert.equal(nation.religionCooldownUntilTick, before.tick + 36);
  assert.equal(nation.religion, command.religionId);
  for (let i = 0; i < next.provinces.length; i++) {
    const p = next.provinces[i]!, old = before.provinces[i]!;
    assert.equal(p.religion, old.religion);
    assert.equal(p.unrest, old.unrest! + (p.ownerId === 'germany' && p.religion !== nation.religion ? 10 : 0));
  }
  assert.deepEqual(next.countries.france, before.countries.france);
  assert.deepEqual(before, original);
  assert.throws(() => applyServerCommand(before, { ...command, playerId: 'other' }, 'host'), /Подмена/);
  assert.throws(() => applyServerCommand(before, command, 'intruder'), /Игрок/);
});

test('religion payload, cost, phase, same-policy and complete cooldown guards reject immutably', () => {
  const state = campaign(); state.countries.germany!.politicalPower = 150;
  const original = structuredClone(state), command = { type: 'CHANGE_RELIGION', playerId: 'host', religionId: choice(state) } as const;
  for (const bad of [{ ...command, religionId: '__proto__' }, { ...command, religionId: {} }, { ...command, countryId: 'france' }, { ...command, politicalPower: 500 }]) assert.throws(() => applyServerCommand(state, bad as never, 'host'));
  assert.throws(() => applyServerCommand(world(), command, 'host'));
  assert.throws(() => applyServerCommand(state, { ...command, religionId: state.countries.germany!.religion! }, 'host'));
  const poor = structuredClone(state); poor.countries.germany!.politicalPower = 119;
  assert.throws(() => applyServerCommand(poor, command, 'host'), /Недостаточно/);
  let next = applyServerCommand(state, command, 'host'); next.countries.germany!.politicalPower = 120;
  const second = { ...command, religionId: choice(next) };
  next.tick = 35; assert.throws(() => applyServerCommand(next, second, 'host'), /cooldown/);
  next.tick = 36; next = applyServerCommand(next, second, 'host');
  assert.equal(next.countries.germany!.politicalPower, 0);
  assert.deepEqual(state, original);
});

test('religious unity is population-weighted and updates when province ownership changes', () => {
  const state = world(), owned = state.provinces.filter(p => p.ownerId === 'germany');
  for (const p of owned) { p.population = 0; p.religion = 'secular'; }
  state.countries.germany!.religion = 'secular';
  owned[0]!.population = 100; owned[1]!.population = 300; owned[1]!.religion = 'buddhism';
  recalcReligiousUnity(state); assert.equal(state.countries.germany!.religiousUnity, 25);
  owned[1]!.ownerId = 'france'; recalcReligiousUnity(state);
  assert.equal(state.countries.germany!.religiousUnity, 100);
  assert.equal(owned[1]!.religion, 'buddhism');
});

test('low unity raises unrest with bounds and every faith uses the same monthly mechanics', () => {
  const results: number[] = [];
  for (const religion of RELIGION_IDS) {
    const state = world(); state.countries.germany!.religion = religion;
    for (const p of state.provinces.filter(p => p.ownerId === 'germany')) { p.religion = RELIGION_IDS.find(id => id !== religion)!; p.unrest = 99.99; }
    state.countries.germany!.unrest = 40;
    monthlyReligionEffects(state);
    results.push(state.countries.germany!.unrest!);
    assert.equal(state.countries.germany!.religiousUnity, 0);
    assert.ok(state.provinces.every(p => p.unrest! >= 0 && p.unrest! <= 100));
    state.countries.germany!.unrest = 99.99; monthlyReligionEffects(state); assert.equal(state.countries.germany!.unrest, 100);
  }
  assert.ok(results.every(value => value === 40.15));
});

test('old world religion fields migrate once, malformed persisted identities fail, legacy stays isolated', () => {
  const state = world();
  for (const c of Object.values(state.countries)) { delete c.religion; delete c.religiousUnity; delete c.religionCooldownUntilTick; }
  for (const p of state.provinces) { delete p.religion; delete p.unrest; }
  const old = structuredClone(state); initializeReligions(state);
  const migrated = structuredClone(state); initializeReligions(state); assert.deepEqual(state, migrated);
  assert.equal(old.provinces[0]!.religion, undefined);
  const corrupted = world(); corrupted.provinces[0]!.religion = ''; assert.throws(() => initializeReligions(corrupted));
  const invalid = world(); invalid.provinces[0]!.unrest = NaN; assert.throws(() => initializeReligions(invalid));
  const overflow = world(); for (const p of overflow.provinces.filter(p => p.ownerId === 'germany')) p.population = 1e308; assert.throws(() => recalcReligiousUnity(overflow), /overflow/);
  const legacy = campaign(createInitialState('legacy', 'LEGACY', 'host', 'Test'));
  assert.equal(legacy.countries.germany!.religion, undefined);
  assert.throws(() => applyServerCommand(legacy, { type: 'CHANGE_RELIGION', playerId: 'host', religionId: 'secular' }, 'host'));
});

test('religion map uses province identity independently of state policy and graphics', () => {
  const before = campaign(); before.countries.germany!.politicalPower = 150;
  const colors = buildProvinceColors(before, 'Religion', new Map()), original = structuredClone(before);
  const next = applyServerCommand(before, { type: 'CHANGE_RELIGION', playerId: 'host', religionId: choice(before) }, 'host');
  assert.deepEqual(buildProvinceColors(next, 'Religion', new Map()), colors);
  assert.equal(new Set(colors.values()).size, 13);
  assert.deepEqual(before, original);
});
