import {test} from 'node:test';import assert from 'node:assert/strict';
import {cameraCoverage,cameraNeedsCoverage,rasterLevel} from '../src/map/cameraCoverage';
import {visibleBounds} from '../src/map/camera';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {mapSceneFor} from '../src/map/worldScene';
import {borderChunks,bordersInBounds} from '../src/map/borderChunks';
import {rasterTiles,visibleRasterTiles,RasterCache} from '../src/map/rasterTiles';
import {budgetArmyMarkers,markerBudgets} from '../src/map/markerBudget';
test('camera moves inside coverage without JS snapshots, escape/zoom reculls and whole world does not churn',()=>{
  const v={width:1280,height:720},c={x:800,y:160,zoom:7};
  assert.equal(cameraNeedsCoverage({...c,x:c.x+20},c,v),false);
  assert.equal(cameraNeedsCoverage({...c,x:c.x+150},c,v),true);
  assert.equal(cameraNeedsCoverage({...c,zoom:3},c,v),true);
  const coverage=cameraCoverage(c,v),screen=visibleBounds(c,v,0);assert.ok(coverage.left<screen.left&&coverage.right>screen.right);
  const world={x:720,y:360,zoom:.5};for(const x of [500,720,850])assert.equal(cameraNeedsCoverage({...world,x},world,v),false);
});
test('fixed border chunks reuse ownership generation and exactly classify annexation, without camera strings',()=>{
  const s=createWorldState('borders','BORDER','host','QA'),scene=mapSceneFor(s),owners=new Map(s.provinces.map(p=>[p.id,p.ownerId]));
  const chunks=borderChunks(scene.edges,owners);assert.equal(borderChunks(scene.edges,owners),chunks);
  assert.equal(chunks.reduce((n,c)=>n+c.outer.length+c.inner.length,0),scene.edges.length);
  const bounds={left:790,right:810,top:150,bottom:170};assert.ok(bordersInBounds(chunks,bounds).length<chunks.length);
  const changed=new Map(owners),id=s.provinces.find(p=>p.ownerId==='germany')!.id;changed.set(id,'france');const after=borderChunks(scene.edges,changed);assert.notEqual(after,chunks);
  for(const c of after)for(const e of c.outer)assert.ok(e.provinces.length===1||e.provinces.some(p=>changed.get(p)!==changed.get(e.provinces[0]!)));
});
test('tile culling covers every visible province, stays reference stable and bounds decoded texture resolution',()=>{
  const s=createWorldState('tiles','TILES1','host','QA'),scene=mapSceneFor(s),bounds={left:790,right:810,top:150,bottom:170};
  for(const zoom of [.5,3.5,9,18]){const level=rasterLevel(zoom),tiles=rasterTiles(scene.features,level);assert.equal(rasterTiles(scene.features,level),tiles);assert.ok(level.cell*level.scale<=576);const visible=visibleRasterTiles(scene.features,bounds,level);assert.ok(visible.length<tiles.length);for(const f of scene.spatialIndex.query(bounds))assert.ok(visible.some(t=>t.features.includes(f)));}
});
test('texture LRU bounds bytes, respects recent usage and cleans up on campaign exit',()=>{
  const cache=new RasterCache<string>(30,3);cache.set('a','A',10);cache.set('b','B',10);cache.set('c','C',10);assert.equal(cache.get('a'),'A');cache.set('d','D',10);assert.equal(cache.get('b'),undefined);assert.equal(cache.bytes,30);cache.set('e','E',50);assert.equal(cache.get('e'),undefined);cache.clear();assert.equal(cache.bytes,0);assert.equal(cache.size,0);
});
test('dense army budget conserves all troops/identities/owners and pins selected army independently',()=>{
  const counters=Array.from({length:1500},(_,i)=>({key:String(i),provinceId:String(i),ownerId:'owner'+i%100,ids:['army'+i],troops:100+i,x:i%100*14,y:Math.floor(i/100)*35}));
  for(const zoom of [.8,3.5,9]){const budget=markerBudgets(zoom,'Balanced').armies,groups=budgetArmyMarkers(counters,zoom,budget,'army20','owner0');assert.ok(groups.length<=budget);assert.equal(groups.reduce((n,c)=>n+c.troops,0),counters.reduce((n,c)=>n+c.troops,0));assert.deepEqual(groups.flatMap(c=>c.ids).sort(),counters.flatMap(c=>c.ids).sort());const selected=groups.find(c=>c.ids.includes('army20'))!;assert.deepEqual(selected.ids,['army20']);assert.ok(groups.some(c=>c.ownerIds.length>1&&c.stack));}
});
