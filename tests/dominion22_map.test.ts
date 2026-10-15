import {CURRENT_STATE_VERSION} from '../supabase/functions/_shared/stateMigrations';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {mapSceneFor} from '../src/map/worldScene';
import {contains,project} from '../src/map/geometry';
import {atlasLevel,smoothDetail} from '../src/map/atlas22';
import {provinceInstallations,mapOrders,tradeLinks,localInfrastructure} from '../src/map/strategic22';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
const s=createWorldState('map22','MAP22','host','Test',101),scene=mapSceneFor(s);
test('world atlas LOD remains bounded and projection aligns with unchanged world geometry',()=>{
  assert.deepEqual(project(0,0),{x:720,y:360});
  assert.equal(atlasLevel(16,'Performance'),'world');assert.equal(atlasLevel(3,'Balanced'),'region');assert.equal(atlasLevel(9,'Balanced'),'province');
  assert.equal(smoothDetail(1,2,6),0);assert.equal(smoothDetail(8,2,6),1);assert.ok(smoothDetail(4,2,6)>.4);
  assert.equal(scene.provinceGeometry.size,s.provinces.length);
});
test('province symbols contain only actual deposits/buildings and stay on their province',()=>{
  const p=s.provinces.find(p=>p.ownerId==='germany')!;
  const copy={...s,provinces:[{...p,buildings:{Farm:2,Factory:1,OilWell:1,RailHub:1}}]};
  const visible=new Set([p.id]),before=JSON.stringify(copy);
  for(const filter of ['Resources','Industry','Infrastructure','Province'] as const){
    const symbols=provinceInstallations(copy,scene,visible,10,'Balanced',filter,p.id);
    assert.ok(symbols.length);for(const row of symbols){assert.equal(row.provinceId,p.id);assert.ok(contains(scene.provinceGeometry.get(p.id)!,row.point));if(!row.resource)assert.ok((copy.provinces[0]!.buildings as Record<string,number>)[row.id.slice(p.id.length+1)]!>0);}
  }
  const medieval=provinceInstallations({...copy,year:1500},scene,visible,10,'Ultra','Province');
  assert.ok(medieval.every(r=>r.kind!=='rig'&&r.kind!=='rail'));
  assert.equal(JSON.stringify(copy),before,'Rendering must not mutate GameState');
});
test('army routes are confirmed orders, ETA is nonnegative, and selection changes no orders',()=>{
  const army=s.armies.find(a=>a.ownerId==='germany')!,from=s.provinces.find(p=>p.id===army.provinceId)!,to=s.provinces.find(p=>from.neighbors.includes(p.id)&&p.ownerId==='germany')!;
  const a={...army,order:{type:'MOVE' as const,targetProvinceId:to.id,route:[to.id],issuedTick:s.tick,travelProgress:0}};
  const copy={...s,armies:[a]},before=JSON.stringify(a),orders=mapOrders(copy,scene,new Set([from.id,to.id]),a.id,'germany');
  assert.equal(orders.length,1);assert.deepEqual(orders[0]!.target,scene.provinceGeometry.get(to.id)!.anchor);assert.ok(orders[0]!.eta>=0);assert.equal(JSON.stringify(a),before);
  assert.equal(mapOrders({...copy,armies:[{...army,order:undefined}]},scene,new Set([from.id])).length,0);
});
test('trade links include only accepted active contracts and existing capitals; roads require real infrastructure',()=>{
  const contract={id:'confirmed',exporterId:'germany',importerId:'france',offeredBy:'germany',resource:'iron' as const,quantity:10,price:1,months:2,accepted:true,lastTick:s.tick,fulfilled:8,efficiency:.8};
  const copy={...s,tradeContracts:[contract,{...contract,id:'offered',accepted:false},{...contract,id:'expired',months:0}]};
  const links=tradeLinks(copy,scene,{left:0,right:1440,top:0,bottom:720});assert.deepEqual(links.map(l=>l.id),['confirmed']);
  assert.deepEqual(links[0]!.from,scene.cities.find(c=>c.id===s.countries.germany!.capitalCityId)!.point);
  const noRoads={...s,provinces:s.provinces.map(p=>({...p,buildings:{}}))};assert.equal(localInfrastructure(noRoads,scene,new Set(s.provinces.map(p=>p.id)),12).length,0);
});
test('2.1.2 schema and IDs round-trip through 2.2 without simulation changes',()=>{
  const loaded=decodeCampaign(encodeCampaign(s,1)).state;
  assert.equal(loaded.stateVersion,CURRENT_STATE_VERSION);assert.deepEqual(loaded.provinces.map(p=>p.id),s.provinces.map(p=>p.id));assert.deepEqual(loaded.armies,s.armies);
});
