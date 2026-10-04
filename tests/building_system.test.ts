import { declareWar } from '../supabase/functions/_shared/diplomacySystem';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, BUILDING_TYPES, buildingQuote, initializeBuildings, provinceBuildingModifiers, startConstruction } from '../supabase/functions/_shared/buildingSystem';
import { normalizeGameState, CURRENT_STATE_VERSION } from '../supabase/functions/_shared/stateMigrations';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { applyServerCommand, createInitialState } from '../supabase/functions/_shared/game';
import { applyCommand } from '../src/engine/gameEngine';
import type { BuildingType, GameState } from '../src/types/game';

function world(): GameState { return createWorldState('building-qa','BUILD1','host','Test',303); }
function campaign(): GameState {
  let state = world();
  for (const command of [{type:'SELECT_COUNTRY',playerId:'host',countryId:'germany'},{type:'SET_READY',playerId:'host',ready:true},{type:'START_GAME',playerId:'host'},{type:'SET_SPEED',playerId:'host',speed:0}]) state=applyServerCommand(state,command as never,'host');
  return state;
}
function capitalProvince(state: GameState, countryId='germany') {
  const city=state.cities!.find(c=>c.id===state.countries[countryId]!.capitalCityId)!;
  return state.provinces.find(p=>p.id===city.provinceId)!;
}

test('building catalogue contains all ten required types with real costs, time, maintenance, levels and modifiers',()=>{
  assert.deepEqual(new Set(BUILDING_TYPES),new Set<BuildingType>(['Farm','Mine','Factory','Barracks','Fort','University','Port','Infrastructure','Administration','Hospital']));
  for(const type of BUILDING_TYPES){const d=BUILDINGS[type];assert.ok(d.baseCost>0&&Number.isInteger(d.baseBuildTime)&&d.baseBuildTime>0&&d.maintenance>=0&&d.maxLevel>=1);assert.ok(Object.keys(d.modifiers).length>0);}
});

test('authenticated BUILD is server-priced, immutable, owner-bound and queues only one construction per province',()=>{
  const state=campaign(), original=structuredClone(state), province=capitalProvince(state), quote=buildingQuote(province,'Factory'), cash=state.countries.germany!.treasury;
  const command={type:'BUILD',playerId:'host',provinceId:province.id,buildingType:'Factory'} as const;
  const next=applyServerCommand(state,command,'host');
  assert.deepEqual(state,original); assert.deepEqual(next,applyCommand(state,command));
  assert.equal(next.countries.germany!.treasury,cash-quote.cost); assert.equal(next.constructions!.length,1);
  assert.deepEqual(next.constructions![0],{id:next.constructions![0]!.id,provinceId:province.id,ownerId:'germany',buildingType:'Factory',targetLevel:1,startedTick:state.tick,completeTick:state.tick+quote.buildTime,cost:quote.cost});
  assert.throws(()=>applyServerCommand(next,command,'host'));
  const foreign=next.provinces.find(p=>p.ownerId==='france')!;
  assert.throws(()=>applyServerCommand(next,{type:'BUILD',playerId:'host',provinceId:foreign.id,buildingType:'Farm'},'host'));
  assert.throws(()=>applyServerCommand(state,{...command,cost:1} as never,'host'));
  assert.throws(()=>applyServerCommand(state,{...command,buildingType:'Palace'} as never,'host'));
});

test('construction completes only after game time, then affects maintenance and province economy',()=>{
  let state=campaign(); const province=capitalProvince(state), beforeResource=state.countries.germany!.economy!.resourceIncome;
  const quote=buildingQuote(province,'Mine'); state=applyServerCommand(state,{type:'BUILD',playerId:'host',provinceId:province.id,buildingType:'Mine'},'host');
  state=applyServerCommand(state,{type:'SET_SPEED',playerId:'host',speed:1},'host');
  for(let i=0;i<quote.buildTime-1;i++) state=applyServerCommand(state,{type:'ADVANCE_TICK'},'host');
  assert.equal(capitalProvince(state).buildings?.Mine,undefined); assert.equal(state.constructions!.length,1);
  state=applyServerCommand(state,{type:'ADVANCE_TICK'},'host');
  assert.equal(capitalProvince(state).buildings?.Mine,1); assert.equal(state.constructions!.length,0);
  assert.equal(state.countries.germany!.economy!.buildingMaintenance,BUILDINGS.Mine.maintenance);
  assert.ok(state.countries.germany!.economy!.resourceIncome>beforeResource);
});

test('building modifiers affect demographics, research and fort defense inputs rather than decorative UI only',()=>{
  const base=campaign(), province=capitalProvince(base);
  const upgraded=structuredClone(base); provinceBuildingModifiers(province);
  const upgradedProvince=capitalProvince(upgraded); upgradedProvince.buildings={University:1,Hospital:1,Fort:1};
  initializeBuildings(upgraded);
  let a=applyServerCommand(base,{type:'SET_SPEED',playerId:'host',speed:1},'host'), b=applyServerCommand(upgraded,{type:'SET_SPEED',playerId:'host',speed:1},'host');
  a=applyServerCommand(a,{type:'ADVANCE_TICK'},'host'); b=applyServerCommand(b,{type:'ADVANCE_TICK'},'host');
  assert.ok(b.countries.germany!.technology>a.countries.germany!.technology);
  assert.ok(capitalProvince(b).monthlyPopulationGrowth!>=capitalProvince(a).monthlyPopulationGrowth!);
  assert.equal(provinceBuildingModifiers(capitalProvince(b)).defensePercent,BUILDINGS.Fort.modifiers.defensePercent);
});

test('conquest preserves completed buildings but cancels the defeated owner construction',()=>{
  let state=campaign();
  const origin=state.provinces.find(p=>p.ownerId==='germany'&&p.neighbors.some(id=>state.provinces.find(q=>q.id===id)?.ownerId!=='germany'))!;
  const target=origin.neighbors.map(id=>state.provinces.find(p=>p.id===id)!).find(p=>p.ownerId!=='germany')!;
  const defenderId=target.ownerId; target.buildings={Fort:1}; state.countries[defenderId]!.treasury=1_000_000;
  startConstruction(state,defenderId,target,'Farm');
  const army=state.armies.find(a=>a.ownerId==='germany')!; army.provinceId=origin.id; army.troops=5_000_000;
  state.armies=state.armies.filter(a=>a.ownerId!==defenderId||a.provinceId!==target.id);
  declareWar(state,'germany',defenderId);
  const next=applyServerCommand(state,{type:'MOVE_ARMY',playerId:'host',armyId:army.id,provinceId:target.id},'host');
  const captured=next.provinces.find(p=>p.id===target.id)!;
  assert.equal(captured.ownerId,defenderId); assert.equal(captured.controllerId,'germany'); assert.equal(captured.buildings?.Fort,1); assert.ok(!next.constructions!.some(c=>c.provinceId===target.id));
});

test('versioned migration upgrades old modern saves sparsely, rejects malformed buildings and leaves legacy state untouched',()=>{
  const state=world(); delete state.stateVersion; delete state.constructions; for(const p of state.provinces) delete p.buildings;
  normalizeGameState(state); assert.equal(state.stateVersion,CURRENT_STATE_VERSION); assert.deepEqual(state.constructions,[]); assert.ok(state.provinces.every(p=>p.buildings===undefined));
  const stable=structuredClone(state); normalizeGameState(state); assert.deepEqual(state,stable);
  const broken=world(); capitalProvince(broken).buildings={Farm:99}; assert.throws(()=>initializeBuildings(broken));
  const future=world(); future.stateVersion=CURRENT_STATE_VERSION+1; assert.throws(()=>normalizeGameState(future));
  const legacy=createInitialState('legacy','LEGACY','host','Test'), original=structuredClone(legacy); normalizeGameState(legacy); assert.deepEqual(legacy,original);
});
