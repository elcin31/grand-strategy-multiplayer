import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { createInitialState, applyServerCommand } from '../supabase/functions/_shared/game';
import { applyCommand } from '../src/engine/gameEngine';
import { initialDeposit, initializeResources, RESOURCES, RESOURCE_TYPES, provinceProduction, resourceReport } from '../supabase/functions/_shared/resourceSystem';
import { recalcEconomy, monthlyEconomy, money } from '../supabase/functions/_shared/economySystem';
import { buildProvinceColors } from '../src/map/scene';
const world = () => createWorldState('resource-qa','RESQAA','host','Test',123);

test('all world deposits are seeded, bounded, complete and stable across ordering and conquest',()=>{
 const state=world(), repeated=world();
 assert.deepEqual(state.provinces.map(p=>p.resourceDeposit),repeated.provinces.map(p=>p.resourceDeposit));
 assert.equal(new Set(state.provinces.map(p=>p.resourceDeposit!.type)).size,10);
 for(const p of state.provinces){assert.ok(RESOURCE_TYPES.includes(p.resourceDeposit!.type));assert.ok(p.resourceDeposit!.richness>=1&&p.resourceDeposit!.richness<=100);}
 assert.notDeepEqual(state.provinces.map(p=>p.resourceDeposit),state.provinces.map(p=>initialDeposit(p.id,456)));
 const p=state.provinces[0]!, deposit=structuredClone(p.resourceDeposit);p.ownerId='germany';state.provinces.reverse();initializeResources(state);assert.deepEqual(p.resourceDeposit,deposit);
});
test('monthly sales are real owned income, conserve country ledgers and move with conquered provinces',()=>{
 const state=world(), c=state.countries.germany!;
 const rows=resourceReport(state,c.id);assert.ok(c.economy!.resourceIncome>0);
 assert.equal(money(rows.reduce((sum,r)=>sum+r.revenue,0)),c.economy!.resourceIncome);
 const cash=c.treasury,balance=c.economy!.monthlyBalance;monthlyEconomy(state);assert.equal(c.treasury,money(cash+balance));
 const p=state.provinces.find(p=>p.ownerId==='france')!, old=c.economy!.resourceIncome, original=structuredClone(p.resourceDeposit);
 p.ownerId='germany';p.controllerId='germany';recalcEconomy(state);
 assert.equal(c.economy!.resourceIncome,money(old+provinceProduction(p,c).revenue));assert.deepEqual(p.resourceDeposit,original);
});
test('production reacts to unrest, technology and development without negative or invalid output',()=>{
 const state=world(),p=state.provinces.find(p=>p.ownerId==='germany')!,c=state.countries.germany!;
 const base=provinceProduction(p,c);p.unrest=100;assert.ok(provinceProduction(p,c).units<=base.units);
 p.unrest=0;p.development=100;c.technology=100;assert.ok(provinceProduction(p,c).units>=base.units);
 for(const bad of [NaN,Infinity,-1,101]){p.development=bad;assert.throws(()=>provinceProduction(p,c));}
});
test('old snapshots migrate once on authoritative clone, legacy remains unchanged, malformed deposits rejected',()=>{
 const state=world();for(const p of state.provinces)delete p.resourceDeposit;
 const original=structuredClone(state);const cmd={type:'SELECT_COUNTRY',playerId:'host',countryId:'germany'} as const;
 const next=applyServerCommand(state,cmd,'host');assert.deepEqual(next,applyCommand(state,cmd));assert.deepEqual(state,original);
 assert.ok(next.provinces.every(p=>p.resourceDeposit));const before=structuredClone(next);initializeResources(next);assert.deepEqual(next,before);
 for(const bad of [null,{}, {type:'gold',richness:NaN},{type:'__proto__',richness:50},{type:'oil',richness:101},{type:'food',richness:1.5},{type:'gas',richness:50,revenue:9999}]){
  const broken=world();broken.provinces[0]!.resourceDeposit=bad as never;const old=structuredClone(broken);assert.throws(()=>applyServerCommand(broken,cmd,'host'));assert.deepEqual(broken,old);
 }
 const legacy=createInitialState('old','OLDQAA','host','Test'),old=structuredClone(legacy);initializeResources(legacy);assert.deepEqual(legacy,old);
});
test('resource map colors identify actual deposits and reject client-injected output',()=>{
 const state=world(), colors=buildProvinceColors(state,'Resources',new Map());
 for(const p of state.provinces)assert.equal(colors.get(p.id),RESOURCES[p.resourceDeposit!.type].color);
 assert.throws(()=>applyServerCommand(state,{type:'SET_TAX_RATE',playerId:'host',taxRate:30,resourceIncome:1e9} as never,'host'));
 assert.throws(()=>applyServerCommand(state,{type:'SET_RESOURCE',playerId:'host',provinceId:state.provinces[0]!.id,resource:'gold'} as never,'host'));
});
