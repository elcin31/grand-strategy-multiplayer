import { test } from 'node:test';
import { money } from '../supabase/functions/_shared/economySystem';
import assert from 'node:assert/strict';
import { applyServerCommand, createInitialState } from '../supabase/functions/_shared/game';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { applyCommand } from '../src/engine/gameEngine';
import { GOVERNMENTS, GOVERNMENT_TYPES, governmentIncome, governmentModifiers } from '../supabase/functions/_shared/governmentSystem';
import { buildProvinceColors } from '../src/map/scene';
import type { GameState, GovernmentType } from '../src/types/game';

const world = () => createWorldState('government-qa', 'GOVQA', 'host', 'Test', 101);
function campaign(state = world(), countryId = 'nru'): GameState {
  for (const command of [
    { type: 'SELECT_COUNTRY', playerId: 'host', countryId },
    { type: 'SET_READY', playerId: 'host', ready: true },
    { type: 'START_GAME', playerId: 'host' },
    { type: 'SET_SPEED', playerId: 'host', speed: 0 },
  ]) state = applyServerCommand(state, command as never, 'host');
  return state;
}
const different = (type: GovernmentType) => GOVERNMENT_TYPES.find(t => t !== type)!;

test('all ten governments have restrained tradeoffs; none dominates every modifier', () => {
  assert.equal(GOVERNMENT_TYPES.length, 10);
  const scores = Object.values(GOVERNMENTS).map(m => [m.taxationPercent, m.manpowerPercent, m.researchPercent, m.diplomacy, m.stabilityPerYear, -m.unrestPerYear]);
  for (const a of scores) for (const b of scores) {
    if (a === b) continue;
    assert.ok(!a.every((value, i) => value >= b[i]!), 'A government dominates another');
  }
  for (const m of Object.values(GOVERNMENTS)) {
    assert.ok(Math.abs(m.taxationPercent) <= 3 && Math.abs(m.manpowerPercent) <= 3 && Math.abs(m.researchPercent) <= 3);
    assert.ok(Math.abs(m.diplomacy) <= 2 && Math.abs(m.stabilityPerYear) <= .5 && Math.abs(m.unrestPerYear) <= .3);
  }
  const state = world();
  assert.deepEqual(state, world());
  assert.equal(new Set(Object.values(state.countries).map(c => c.governmentType)).size, 10);
});

test('government switch has authoritative costs, diplomatic effects and immutable local/server parity', () => {
  const before = campaign(), old = before.countries.nru!;
  const governmentType = different(old.governmentType!);
  const command = { type: 'CHANGE_GOVERNMENT', playerId: 'host', governmentType } as const;
  const next = applyServerCommand(before, command, 'host'), nation = next.countries.nru!;
  assert.deepEqual(next, applyCommand(before, command));
  assert.equal(nation.governmentType, governmentType);
  assert.equal(nation.politicalPower, old.politicalPower! - 80);
  assert.equal(nation.stability, old.stability - 8);
  assert.equal(nation.governmentCooldownUntilTick, before.tick + 24);
  assert.equal(nation.diplomaticReputation, old.diplomaticReputation! + governmentModifiers(governmentType).diplomacy - governmentModifiers(old.governmentType).diplomacy);
  assert.equal(before.countries.nru!.politicalPower, 100);
  assert.throws(() => applyServerCommand(before, { ...command, playerId: 'other' }, 'host'), /Подмена/);
  assert.throws(() => applyServerCommand(before, command, 'intruder'), /Игрок/);
});

test('government payload, phase, points and full cooldown are enforced without mutating input', () => {
  const state = campaign(), command = { type: 'CHANGE_GOVERNMENT', playerId: 'host', governmentType: different(state.countries.nru!.governmentType!) } as const;
  assert.throws(() => applyServerCommand(world(), command, 'host'));
  for (const invalid of [{ ...command, governmentType: '__proto__' }, { ...command, treasury: 9999 }, { ...command, countryId: 'usa' }]) assert.throws(() => applyServerCommand(state, invalid as never, 'host'));
  const poor = structuredClone(state); poor.countries.nru!.politicalPower = 79;
  assert.throws(() => applyServerCommand(poor, command, 'host'), /Недостаточно/);
  const malformed = structuredClone(state); malformed.countries.nru!.politicalPower = NaN;
  assert.throws(() => applyServerCommand(malformed, command, 'host'), /Invalid/);
  let next = applyServerCommand(state, command, 'host');
  next.countries.nru!.politicalPower = 100;
  const second = { ...command, governmentType: different(command.governmentType) };
  next.tick = 23; assert.throws(() => applyServerCommand(next, second, 'host'), /через/);
  next.tick = 24; next = applyServerCommand(next, second, 'host');
  assert.equal(next.countries.nru!.politicalPower, 20);
  assert.deepEqual(state, campaign());
});

test('modern monthly policies affect income, manpower, research, unrest and points with finite caps', () => {
  let state = campaign();
  state.countries.nru!.governmentType = 'Federation';
  state.countries.nru!.politicalPower = 499;
  state = applyServerCommand(state, { type: 'SET_SPEED', playerId: 'host', speed: 1 }, 'host');
  const before = structuredClone(state), old = before.countries.nru!;
  state = applyServerCommand(state, { type: 'ADVANCE_TICK' }, 'host');
  const nation = state.countries.nru!;
  const raw = before.provinces.filter(p => p.ownerId === 'nru').reduce((sum, p) => sum + p.income, 0);
  assert.equal(nation.treasury, money(old.treasury + old.economy!.monthlyBalance));
  assert.equal(nation.income, governmentIncome(raw, 'Federation'));
  assert.equal(nation.manpower, old.manpower + Math.max(500, Math.round(old.population * .00004 * .99)));
  assert.equal(nation.politicalPower, 500);
  assert.ok(nation.technology > old.technology && nation.technology <= 100);
  assert.ok(nation.unrest! < old.unrest! && nation.unrest! >= 0);
});

test('older modern snapshots initialize governments once; legacy snapshots preserve old rules', () => {
  const state = campaign();
  for (const c of Object.values(state.countries)) { delete c.governmentType; delete c.politicalPower; delete c.governmentCooldownUntilTick; delete c.diplomaticReputation; delete c.unrest; }
  const restored = applyServerCommand(state, { type: 'SET_SPEED', playerId: 'host', speed: 0 }, 'host');
  assert.equal(restored.countries.nru!.politicalPower, 100);
  assert.equal(state.countries.nru!.politicalPower, undefined);
  assert.deepEqual(restored, applyServerCommand(restored, { type: 'SET_SPEED', playerId: 'host', speed: 0 }, 'host'));
  let legacy = campaign(createInitialState('legacy', 'LEGACY', 'host', 'Test'), 'germany');
  const old = structuredClone(legacy.countries.germany!);
  legacy = applyServerCommand(legacy, { type: 'SET_SPEED', playerId: 'host', speed: 1 }, 'host');
  legacy = applyServerCommand(legacy, { type: 'ADVANCE_TICK' }, 'host');
  assert.equal(legacy.countries.germany!.technology, old.technology);
  assert.equal(legacy.countries.germany!.stability, old.stability);
  assert.equal(legacy.countries.germany!.politicalPower, undefined);
  assert.throws(() => applyServerCommand(legacy, { type: 'CHANGE_GOVERNMENT', playerId: 'host', governmentType: 'Federation' }, 'host'));
});

test('government map mode is categorical, updates after policy change and cannot mutate state', () => {
  const state = campaign(), original = structuredClone(state);
  const colors = buildProvinceColors(state, 'Government', new Map());
  assert.equal(colors.size, state.provinces.length);
  assert.equal(new Set(colors.values()).size, 10);
  const next = applyServerCommand(state, { type: 'CHANGE_GOVERNMENT', playerId: 'host', governmentType: different(state.countries.nru!.governmentType!) }, 'host');
  const updated = buildProvinceColors(next, 'Government', new Map());
  for (const p of state.provinces.filter(p => p.ownerId === 'nru')) assert.notEqual(colors.get(p.id), updated.get(p.id));
  assert.deepEqual(state, original);
});
