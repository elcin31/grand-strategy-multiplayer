import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { applyServerCommand, createInitialState } from '../supabase/functions/_shared/game';
import { applyCommand } from '../src/engine/gameEngine';
import { initializeEconomy, monthlyEconomy, recalcEconomy, money, borrow, repay, BANKRUPTCY_MONTHS } from '../supabase/functions/_shared/economySystem';
import type { GameState } from '../src/types/game';

function world(): GameState { return createWorldState('economic-qa','ECONQA','host','Test',101); }
function campaign(): GameState {
  let state=world();
  for(const command of [{type:'SELECT_COUNTRY',playerId:'host',countryId:'germany'},{type:'SET_READY',playerId:'host',ready:true},{type:'START_GAME',playerId:'host'},{type:'SET_SPEED',playerId:'host',speed:0}]) state=applyServerCommand(state,command as never,'host');
  return state;
}
test('monthly income pays substantial actual army upkeep and commerce is derived from owned development',()=>{
  const state=world(), c=state.countries.germany!, budget=structuredClone(c.economy!), cash=c.treasury;
  assert.equal(budget.armyMaintenance,c.army/1000*1.25);
  assert.ok(budget.armyMaintenance>0 && budget.tradeIncome>0);
  assert.equal(budget.monthlyBalance,money(budget.taxIncome+budget.tradeIncome-budget.armyMaintenance));
  monthlyEconomy(state); assert.equal(c.treasury,money(cash+budget.monthlyBalance)); assert.equal(c.debt,0);
  const province=state.provinces.find(p=>p.ownerId==='germany')!, old=c.economy!.tradeIncome;
  province.development=100; recalcEconomy(state); assert.ok(c.economy!.tradeIncome>=old);
});
test('authenticated loans and repayment preserve net assets with immutable shared reducer parity',()=>{
  const before=campaign(), original=structuredClone(before), old=before.countries.germany!;
  const command={type:'BORROW',playerId:'host',amount:100} as const;
  const next=applyServerCommand(before,command,'host'); assert.deepEqual(next,applyCommand(before,command)); assert.deepEqual(before,original);
  const c=next.countries.germany!; assert.equal(c.debt,100); assert.equal(c.treasury,old.treasury+100); assert.equal(c.economy!.interest,.5);
  const paid=applyServerCommand(next,{type:'REPAY_DEBT',playerId:'host',amount:100},'host');
  assert.equal(paid.countries.germany!.debt,0); assert.equal(paid.countries.germany!.treasury,old.treasury);
  assert.throws(()=>applyServerCommand(before,command,'guest'));
});
test('tax change is a real bounded action, raises revenue, and charges monthly stability/unrest tradeoffs',()=>{
  const before=campaign(), old=before.countries.germany!;
  const next=applyServerCommand(before,{type:'SET_TAX_RATE',playerId:'host',taxRate:60},'host'), c=next.countries.germany!;
  assert.equal(c.income,old.income*2); assert.equal(c.treasury,old.treasury); assert.equal(c.stability,old.stability);
  const province=next.provinces.find(p=>p.ownerId==='germany')!, unrest=province.unrest!, stability=c.stability;
  monthlyEconomy(next); assert.ok(c.stability<stability); assert.ok(province.unrest!>unrest);
});
test('loan/tax payload, lobby, overspend, credit, precision and bankruptcy guards reject immutably',()=>{
  const state=campaign();
  const invalid=[
    {type:'BORROW',playerId:'host',amount:NaN},{type:'BORROW',playerId:'host',amount:Infinity},
    {type:'BORROW',playerId:'host',amount:-1},{type:'BORROW',playerId:'host',amount:.0001},
    {type:'BORROW',playerId:'host',amount:100,treasury:99999},{type:'BORROW',playerId:'host',amount:100,countryId:'usa'},
    {type:'BORROW',playerId:'host',amount:1_000_000},{type:'REPAY_DEBT',playerId:'host',amount:1},
    {type:'SET_TAX_RATE',playerId:'host',taxRate:61},{type:'SET_TAX_RATE',playerId:'host',taxRate:10.5},
  ];
  for(const cmd of invalid){const before=structuredClone(state);assert.throws(()=>applyServerCommand(state,cmd as never,'host'));assert.deepEqual(state,before);}
  assert.throws(()=>applyServerCommand(world(),{type:'BORROW',playerId:'host',amount:1},'host'));
  state.countries.germany!.bankruptcyUntilTick=state.tick+24;
  assert.throws(()=>applyServerCommand(state,{type:'BORROW',playerId:'host',amount:1},'host'));
  const capital=state.cities!.find(c=>c.id===state.countries.germany!.capitalCityId)!;
  assert.throws(()=>applyServerCommand(state,{type:'RECRUIT',playerId:'host',provinceId:capital.provinceId,troops:1000},'host'));
});
test('deficit uses bounded debt; default cannot maintain an unpaid army or spam penalties every month',()=>{
  const state=world(), c=state.countries.germany!;
  c.treasury=0; c.taxRate=10;
  const army=state.armies.find(a=>a.ownerId==='germany')!; army.troops=1_000_000;
  recalcEconomy(state); const shortfall=-c.economy!.monthlyBalance;
  assert.ok(shortfall>0 && shortfall<c.economy!.creditLimit);
  monthlyEconomy(state); assert.equal(c.treasury,0); assert.equal(c.debt,shortfall);
  c.debt=c.economy!.creditLimit; recalcEconomy(state);
  const stability=c.stability, unrest=c.unrest!, troops=c.army;
  monthlyEconomy(state);
  assert.equal(c.debt,0); assert.equal(c.treasury,0); assert.equal(c.bankruptcyCount,1); assert.equal(c.bankruptcyUntilTick,state.tick+BANKRUPTCY_MONTHS);
  assert.equal(c.stability,stability-20); assert.ok(c.unrest!>=unrest+20); assert.ok(c.army<troops/2); assert.ok(c.economy!.monthlyBalance>=0);
  for(let i=0;i<10;i++){state.tick++;monthlyEconomy(state);}
  assert.equal(c.bankruptcyCount,1); assert.ok(c.treasury>=0 && Number.isFinite(c.treasury));
});
test('migration validates money, ignores forged derived budgets, and isolates legacy saves',()=>{
  const state=world();
  for(const c of Object.values(state.countries)){delete c.taxRate;delete c.debt;delete c.bankruptcyUntilTick;delete c.bankruptcyCount;c.economy={monthlyIncome:1e10} as never;}
  initializeEconomy(state); const before=structuredClone(state); initializeEconomy(state);assert.deepEqual(state,before);
  for(const bad of [-1,NaN,Infinity,.0001,Number.MAX_SAFE_INTEGER]){const broken=world();broken.countries.germany!.treasury=bad;assert.throws(()=>initializeEconomy(broken));}
  const invalid=world();invalid.countries.germany!.bankruptcyCount=-1;assert.throws(()=>initializeEconomy(invalid));
  const legacy=createInitialState('legacy','LEGACY','host','Test'), original=structuredClone(legacy);initializeEconomy(legacy);monthlyEconomy(legacy);assert.deepEqual(legacy,original);
});
test('1000 fractional borrow/repay cycles cannot create money or accumulate residual debt',()=>{
  const state=world(), c=state.countries.germany!, initial=c.treasury;
  for(let i=0;i<1000;i++){const amount=(i%100+1)/1000;borrow(state,c,amount);repay(state,c,amount);assert.equal(c.debt,0);assert.equal(c.treasury,initial);}
  assert.equal(c.economy!.interest,0);
});

test('paid recruitment after fractional income preserves precision and immediately updates upkeep',()=>{
  const state=campaign(), c=state.countries.germany!; c.treasury=1234.001;
  const city=state.cities!.find(city=>city.id===c.capitalCityId)!;
  const next=applyServerCommand(state,{type:'RECRUIT',playerId:'host',provinceId:city.provinceId,troops:10_000},'host');
  const country=next.countries.germany!;
  assert.equal(country.treasury,1034.001); assert.equal(country.economy!.armyMaintenance,c.economy!.armyMaintenance+12.5);
  assert.doesNotThrow(()=>applyServerCommand(next,{type:'BORROW',playerId:'host',amount:.001},'host'));
});
