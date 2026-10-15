import {money} from '../supabase/functions/_shared/economySystem';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { applyServerCommand, createInitialState } from '../supabase/functions/_shared/game';
import { applyCommand } from '../src/engine/gameEngine';
import { annualPopulationGrowth, initializePopulation, monthlyPopulationGrowth, recalcPopulationTotals,populationCapacity } from '../supabase/functions/_shared/populationSystem';
import { governmentIncome, governmentModifiers } from '../supabase/functions/_shared/governmentSystem';
import type { GameState } from '../src/types/game';

function world(): GameState { return createWorldState('population-qa', 'POPQA', 'host', 'Test', 101); }
function campaign(): GameState {
  let state = world();
  for (const command of [{ type: 'SELECT_COUNTRY', playerId: 'host', countryId: 'germany' }, { type: 'SET_READY', playerId: 'host', ready: true }, { type: 'START_GAME', playerId: 'host' }]) state = applyServerCommand(state, command as never, 'host');
  return state;
}

test('real-world monthly growth updates province/city/country counts, taxes and manpower with immutable reducer parity', () => {
  const before = campaign(), original = structuredClone(before);
  const next = applyServerCommand(before, { type: 'ADVANCE_TICK' }, 'host');
  assert.deepEqual(next, applyCommand(before, { type: 'ADVANCE_TICK' })); assert.deepEqual(before, original);
  for (let i = 0; i < next.provinces.length; i++) {
    const p = next.provinces[i]!; assert.ok(Number.isSafeInteger(p.population) && p.population >= before.provinces[i]!.population);
    assert.equal(p.monthlyPopulationGrowth, p.population - before.provinces[i]!.population);
    assert.ok(p.populationGrowthCarry! >= 0 && p.populationGrowthCarry! < 1);
  }
  for (const c of Object.values(next.countries)) {
    const owned = next.provinces.filter(p => p.ownerId === c.id);
    assert.equal(c.population, owned.reduce((n,p) => n+p.population,0));
    assert.equal(c.monthlyPopulationGrowth, owned.reduce((n,p) => n+p.monthlyPopulationGrowth!,0));
  }
  const nation = next.countries.germany!, old = before.countries.germany!;
  assert.ok(nation.population > old.population);
  assert.equal(nation.income, money(governmentIncome(next.provinces.filter(p=>p.ownerId==='germany').reduce((n,p)=>n+p.income,0),nation.governmentType)*(1+(nation.technologies?.Economy??0)*.04)));
  const natural=Math.max(500,Math.round(nation.population*.00004*(1+governmentModifiers(nation.governmentType).manpowerPercent/100))),available=Math.max(0,Math.floor(nation.population*.06)-old.army-old.manpower-old.reserveManpower!-(old.militaryLosses??0));
  assert.equal(nation.manpower,old.manpower+Math.min(natural,available));assert.equal(nation.reserveManpower,old.reserveManpower);
  for (let i = 0; i < next.cities!.length; i++) assert.ok(next.cities![i]!.population >= before.cities![i]!.population);
});

test('paused commands cannot advance population, carries, city counts or date', () => {
  const before = applyServerCommand(campaign(), { type: 'SET_SPEED', playerId: 'host', speed: 0 }, 'host');
  const next = applyServerCommand(before, { type: 'ADVANCE_TICK' }, 'host');
  assert.deepEqual(next, before);
});

test('demographic capacity retains the first-month rate and slows births continuously as a province fills',()=>{
  const initial=world(),p=initial.provinces.find(p=>p.ownerId==='germany')!,old=p.population,capacity=populationCapacity(p)!;
  const expected=Math.floor(old*annualPopulationGrowth(p.development??40,initial.countries.germany!.stability)/12+p.populationGrowthCarry!);
  monthlyPopulationGrowth(initial);assert.equal(p.monthlyPopulationGrowth,expected);assert.ok(capacity>old);
  const half=world(),h=half.provinces.find(q=>q.id===p.id)!;h.population=Math.floor((old+capacity)/2);monthlyPopulationGrowth(half);
  assert.ok(h.monthlyPopulationGrowth!/h.population<p.monthlyPopulationGrowth!/p.population);
  const near=world(),n=near.provinces.find(q=>q.id===p.id)!;n.population=capacity-1;monthlyPopulationGrowth(near);assert.ok(n.monthlyPopulationGrowth!<=1);assert.ok(n.population<=capacity);
});

test('10000 demographic months preserve urban conservation and approach a bounded capacity without deleting people',()=>{
  let s=world();const p=s.provinces.find(p=>p.ownerId==='germany')!,id=p.id,initial=p.population,capacity=populationCapacity(p)!;
  s.provinces=[p];s.countries={germany:s.countries.germany!};s.cities=s.cities!.filter(c=>c.provinceId===id);initializePopulation(s);
  for(let month=1;month<=10000;month++){monthlyPopulationGrowth(s);if(month%1000===0){initializePopulation(s);const stable=structuredClone(s);initializePopulation(s);assert.deepEqual(s,stable);assert.ok(s.cities!.reduce((n,c)=>n+c.population,0)<=p.population);}}
  assert.ok(p.population>initial&&p.population<=capacity);assert.equal(s.countries.germany!.population,p.population);assert.ok(p.monthlyPopulationGrowth!<initial*.001);
  const larger=world(),q=larger.provinces.find(q=>q.id===id)!;q.population=capacity*2;q.populationGrowthCarry=.75;const old=q.population;monthlyPopulationGrowth(larger);assert.equal(q.population,old);assert.equal(q.populationGrowthCarry,.75);assert.equal(q.monthlyPopulationGrowth,0);
});

test('actual development, farms, hospitals and infrastructure expand settlement capacity and restart exhausted growth',()=>{
  const s=world(),p=s.provinces.find(p=>p.ownerId==='germany')!,capacity=populationCapacity(p)!;p.population=capacity;p.populationGrowthCarry=0;monthlyPopulationGrowth(s);assert.equal(p.monthlyPopulationGrowth,0);
  p.buildings={Infrastructure:1,Farm:1,Hospital:1};assert.ok(populationCapacity(p)!>capacity);monthlyPopulationGrowth(s);assert.ok(p.monthlyPopulationGrowth!>0);
  const low=populationCapacity(p)!;p.development=Math.min(100,(p.development??40)+1);assert.ok(populationCapacity(p)!>=low);
});

test('fractional growth makes tiny settlements grow and preserves urban/rural conservation across random small provinces', () => {
  let seed = 77;
  const random = () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed; };
  for (let sample = 0; sample < 40; sample++) {
    const state = world();
    state.countries = { germany: state.countries.germany! };
    const population = 3 + random() % 2000;
    const p = { ...state.provinces.find(p=>p.ownerId==='germany')!, population, development: random()%101, populationGrowthCarry: 0, monthlyPopulationGrowth: 0 };
    state.provinces = [p];
    const count = 1 + random()%5, each = Math.floor(population/count);
    state.cities = Array.from({length:count},(_,i)=>({id:'city-'+i,name:'Settlement',countryId:'germany',provinceId:p.id,population:each,development:40,isCapital:i===0,isRegionalCapital:false,populationGrowthCarry:0}));
    initializePopulation(state);
    for (let month = 0; month < 250; month++) {
      monthlyPopulationGrowth(state); initializePopulation(state);
      assert.ok(state.cities.reduce((n,c)=>n+c.population,0) <= p.population);
      assert.equal(state.countries.germany!.population, p.population);
      assert.ok(state.cities.every(c=>Number.isSafeInteger(c.population) && c.populationGrowthCarry! >= 0 && c.populationGrowthCarry! < 1));
    }
    assert.ok(p.population > population);
  }
});

test('old population saves initialize once, ownership recomputes totals, corruption/overflow fail and legacy remains unchanged', () => {
  const state = world();
  for (const p of state.provinces) { delete p.populationGrowthCarry; delete p.monthlyPopulationGrowth; }
  for (const c of state.cities!) delete c.populationGrowthCarry;
  initializePopulation(state); const migrated = structuredClone(state); initializePopulation(state); assert.deepEqual(state,migrated);
  const province = state.provinces.find(p=>p.ownerId==='germany')!, oldGermany = state.countries.germany!.population, oldFrance = state.countries.france!.population;
  province.ownerId = 'france'; recalcPopulationTotals(state);
  assert.equal(state.countries.germany!.population, oldGermany - province.population);
  assert.equal(state.countries.france!.population, oldFrance + province.population);
  for (const corrupt of [NaN, Infinity, -1, .5]) { const invalid=world(); invalid.provinces[0]!.population=corrupt; assert.throws(()=>initializePopulation(invalid)); }
  const carry=world(); carry.cities![0]!.populationGrowthCarry=1; assert.throws(()=>initializePopulation(carry));
  const overflow=world(); overflow.provinces.find(p=>p.ownerId==='germany')!.population=Number.MAX_SAFE_INTEGER; assert.throws(()=>initializePopulation(overflow));
  const legacy=createInitialState('legacy','LEGACY','host','Test'), original=structuredClone(legacy);
  initializePopulation(legacy); monthlyPopulationGrowth(legacy); assert.deepEqual(legacy,original);
  assert.throws(()=>annualPopulationGrowth(100,NaN)); assert.throws(()=>annualPopulationGrowth(-1,50));
});

test('authoritative save validation rejects duplicate geography, orphan cities and urban overpopulation immutably', () => {
  for (const corrupt of [
    (s: GameState) => { s.provinces.push(structuredClone(s.provinces[0]!)); },
    (s: GameState) => { s.cities!.push(structuredClone(s.cities![0]!)); },
    (s: GameState) => { s.cities![0]!.provinceId = 'missing-province'; },
    (s: GameState) => { const city = s.cities![0]!; city.population = s.provinces.find(p=>p.id===city.provinceId)!.population + 1; },
  ]) {
    const state = campaign(); corrupt(state); const before = structuredClone(state);
    assert.throws(() => applyServerCommand(state, { type: 'ADVANCE_TICK' }, 'host'));
    assert.throws(() => applyCommand(state, { type: 'ADVANCE_TICK' }));
    assert.deepEqual(state, before);
  }
});
