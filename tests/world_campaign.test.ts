import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { applyCommand } from '../src/engine/gameEngine';
import { applyServerCommand } from '../supabase/functions/_shared/game';
import { worldCountries } from '../src/world/catalog';
import { mapSceneFor } from '../src/map/worldScene';
import { contains } from '../src/map/geometry';
import { countryLabels, visibleCities } from '../src/map/scene';
import { LocalTransport } from '../src/multiplayer/localTransport';

const world = () => createWorldState('world-qa', 'WORLD1', 'host', 'Test', 987654);
test('new campaigns contain every country, real provinces/cities and exact population totals', () => {
  const state = world(), provinces = new Map(state.provinces.map(p => [p.id, p])), cities = new Map(state.cities!.map(c => [c.id, c]));
  assert.equal(Object.keys(state.countries).length, worldCountries.length);
  assert.equal(state.provinces.length, 4386); assert.equal(state.cities!.length, 7214);
  assert.equal(provinces.size,state.provinces.length); assert.equal(cities.size,state.cities!.length);
  for (const country of Object.values(state.countries)) {
    const owned = state.provinces.filter(p => p.ownerId === country.id);
    assert.ok(owned.length > 0); assert.equal(country.population, owned.reduce((n,p) => n+p.population,0));
    assert.equal(country.income, owned.reduce((n,p) => n+p.income,0));
    assert.equal(country.army,state.armies.filter(a => a.ownerId===country.id).reduce((n,a) => n+a.troops,0));
    assert.ok(owned.some(p => p.id === cities.get(country.capitalCityId!)!.provinceId));
    assert.ok(country.adjective && country.flag);
  }
  for (const province of state.provinces) {
    assert.equal(province.ownerId,province.controllerId); assert.equal(province.countryId,province.ownerId);
    assert.ok(Number.isSafeInteger(province.population) && province.population >= 0);
    assert.ok(province.cityIds!.every(id => cities.get(id)?.provinceId===province.id));
    assert.ok(province.cityIds!.reduce((n,id) => n+cities.get(id)!.population,0)<=province.population);
    for (const id of province.neighbors) assert.ok(id!==province.id && provinces.get(id)!.neighbors.includes(province.id));
  }
  for (const army of state.armies) assert.equal(provinces.get(army.provinceId)?.ownerId,army.ownerId);
  assert.doesNotMatch(JSON.stringify(state), /"polygons"|"point"|<svg/);
  assert.deepEqual(world(),state);
});
test('campaign mutation cannot modify any future campaign or shared definitions', () => {
  const before=world(), changed=world();
  changed.provinces[0]!.neighbors.length=0;changed.cities![0]!.population=1;changed.countries.usa!.treasury=1;
  assert.deepEqual(world(),before);
});
test('every new country is selectable by local and authenticated reducers; legacy ids are not a limit', () => {
  const state=world();
  for (const country of worldCountries) {
    const command={type:'SELECT_COUNTRY',playerId:'host',countryId:country.id} as const;
    assert.equal(applyCommand(state,command).players[0]!.countryId,country.id);
    assert.deepEqual(applyServerCommand(state,command,'host'),applyCommand(state,command));
  }
  assert.throws(()=>applyServerCommand(state,{type:'SELECT_COUNTRY',playerId:'host',countryId:'__proto__'},'host'));
  assert.deepEqual(state,world());
});
test('world gameplay pays for recruitment, respects land adjacency, and keeps a paused calendar', () => {
  let state=world();
  for (const command of [{type:'SELECT_COUNTRY',playerId:'host',countryId:'usa'}, {type:'SET_READY',playerId:'host',ready:true}, {type:'START_GAME',playerId:'host'}, {type:'SET_SPEED',playerId:'host',speed:0}]) state=applyServerCommand(state,command as never,'host');
  const army=state.armies.find(a=>a.ownerId==='usa')!, origin=state.provinces.find(p=>p.id===army.provinceId)!;
  const target=origin.neighbors.find(id=>state.provinces.find(p=>p.id===id)?.ownerId==='usa')!;
  assert.ok(target);
  const before=structuredClone(state);
  state=applyServerCommand(state,{type:'RECRUIT',playerId:'host',provinceId:origin.id,troops:25000},'host');
  assert.equal(state.countries.usa!.treasury,before.countries.usa!.treasury-500);
  assert.equal(state.countries.usa!.manpower,before.countries.usa!.manpower-25000);
  state=applyServerCommand(state,{type:'MOVE_ARMY',playerId:'host',armyId:army.id,provinceId:target},'host');
  assert.equal(state.armies.find(a=>a.id===army.id)!.provinceId,target);
  const paused=structuredClone(state);state=applyServerCommand(state,{type:'ADVANCE_TICK'},'host');assert.deepEqual(state,paused);
  assert.throws(()=>applyServerCommand(state,{type:'MOVE_ARMY',playerId:'host',armyId:army.id,provinceId:before.armies.find(a=>a.ownerId==='nzl')!.provinceId},'host'));
});
test('GPU world scene has valid anchors, capital markers, cached geometry and viewport LOD', () => {
  const scene=mapSceneFor(world()); assert.equal(scene.provinceGeometry.size,4386);
  assert.equal(scene,mapSceneFor(world())); assert.equal(scene.cities.length,7214);
  for (const feature of scene.provinceGeometry.values()) assert.ok(contains(feature,feature.anchor),feature.id);
  assert.equal(scene.cities.filter(c=>c.capital).length,195);
  const visible=visibleCities(scene.cities,{left:700,right:850,top:100,bottom:230},2,'Low');
  assert.ok(visible.length<=8 && visible.every(c=>c.capital));
  const labels=countryLabels(scene.features,new Map(world().provinces.map(p=>[p.id,p.ownerId])),[],{height:4},new Set(['germany']));
  assert.equal(labels.length,1);assert.equal(labels[0]!.countryId,'germany');
});
test('offline transport actually creates the modern world campaign', async()=> {
  const transport=new LocalTransport();const session=await transport.createRoom('Test');
  assert.equal(session.state.dataset,'modern-world-v1');assert.equal(Object.keys(session.state.countries).length,195);
  await transport.sendCommand(session.state.id,{type:'SELECT_COUNTRY',playerId:session.playerId,countryId:'nru'});
  await transport.leave(session.state.id);
});

test('battle IDs stay unique after the bounded log fills in a single paused tick', () => {
  let state=createWorldState('entity-qa','ENTITY','host','Test');
  state.phase='paused';state.speed=0;state.players[0]!.countryId='germany';
  const germany=state.provinces.filter(p=>p.ownerId==='germany');
  const origin=germany.find(p=>p.neighbors.some(id=>state.provinces.find(n=>n.id===id)?.ownerId!=='germany'))!;
  const destination=origin.neighbors.find(id=>state.provinces.find(n=>n.id===id)?.ownerId!=='germany')!;
  const enemy=state.provinces.find(p=>p.id===destination)!.ownerId;
  state.armies.push({id:'army-boundary-test',ownerId:'germany',provinceId:origin.id,troops:1000});
  state.armies.push({id:'army-defender-test',ownerId:enemy,provinceId:destination,troops:1000000});
  const ids=new Set<string>();
  for(let i=0;i<60;i++) {
    const existing=state.armies.find(a=>a.id==='army-boundary-test');
    if(existing)existing.troops=1000;else state.armies.push({id:'army-boundary-test',ownerId:'germany',provinceId:origin.id,troops:1000});
    state=applyServerCommand(state,{type:'MOVE_ARMY',playerId:'host',armyId:'army-boundary-test',provinceId:destination},'host');
    const id=state.battleLog[0]!.id;assert.ok(!ids.has(id));ids.add(id);
    assert.equal(new Set(state.battleLog.map(b=>b.id)).size,state.battleLog.length);
    assert.ok(state.battleLog.length<=20);assert.equal(state.tick,0);
  }
});
