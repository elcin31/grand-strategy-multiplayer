import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MapWorkQueue} from '../src/performance/mapWorkQueue';
import {stableAtlasLevel} from '../src/map/atlas22';
import {stableRasterLevel,budgetRasterLevel,cameraCoverage,RASTER_LEVELS} from '../src/map/cameraCoverage';
import {selectGeometryLod} from '../src/map/geometryLod';
import {RasterCache,rasterCoverageForBudget} from '../src/map/rasterTiles';
import type {MapFeature} from '../src/map/geometry';
import {mapBudget} from '../src/map/mobileBudgets';

test('touch input defers all tile jobs; cancelled coverage never builds; visible work goes first',async()=>{
  let timer:(()=>void)|undefined,active=true;
  const queue=new MapWorkQueue({set:run=>{timer=run;return run;},clear:()=>{timer=undefined;}}),built:string[]=[];
  const cancel=queue.schedule(()=>{built.push('obsolete');},()=>!active,0);
  queue.schedule(()=>{built.push('neighbor');},()=>!active,10);
  queue.schedule(()=>{built.push('visible');},()=>!active,-1);
  const step=async()=>{const run=timer;timer=undefined;run?.();await Promise.resolve();await Promise.resolve();};
  await step();assert.deepEqual(built,[]);cancel();assert.equal(queue.size,2);
  active=false;await step();assert.deepEqual(built,['visible']);await step();assert.deepEqual(built,['visible','neighbor']);assert.equal(queue.size,0);
});
test('native file reads stay serial and a new gesture can postpone decode',async()=>{
  let timer:(()=>void)|undefined,release!:()=>void,active=false;
  const queue=new MapWorkQueue({set:run=>{timer=run;return run;},clear:()=>{timer=undefined;}}),events:string[]=[];
  queue.schedule(async()=>{events.push('read');await new Promise<void>(r=>{release=r;});queue.schedule(()=>{events.push('decode');},()=>!active,-1);},()=>!active);
  queue.schedule(()=>{events.push('next');},()=>!active,1);
  const fire=()=>{const run=timer;timer=undefined;run?.();};
  fire();assert.deepEqual(events,['read']);active=true;release();
  await Promise.resolve();await Promise.resolve();fire();assert.deepEqual(events,['read']);active=false;fire();await Promise.resolve();await Promise.resolve();assert.deepEqual(events,['read','decode']);
});
test('zoom jitter preserves atlas, raster and geometry bands while large zoom changes refine',()=>{
  assert.equal(stableAtlasLevel(1.7,'Balanced','world'),'world');assert.equal(stableAtlasLevel(1.6,'Balanced','region'),'region');
  assert.equal(stableAtlasLevel(8.1,'Balanced','region'),'region');assert.equal(stableAtlasLevel(7.9,'Balanced','province'),'province');assert.equal(stableAtlasLevel(10,'Balanced','region'),'province');
  assert.equal(stableRasterLevel(6.1,RASTER_LEVELS[1]),RASTER_LEVELS[1]);assert.equal(stableRasterLevel(5.9,RASTER_LEVELS[2]),RASTER_LEVELS[2]);assert.equal(stableRasterLevel(10,RASTER_LEVELS[1]),RASTER_LEVELS[2]);
  assert.equal(selectGeometryLod(7.1,'Balanced','low'),'low');assert.equal(selectGeometryLod(6.9,'Balanced','high'),'high');assert.equal(selectGeometryLod(9,'Balanced','low'),'high');
});
test('lower quality trims both retained caches without disposing objects still on screen',()=>{
  const high=mapBudget('High'),balanced=mapBudget('Balanced');assert.ok(balanced.atlasBytes+balanced.politicalBytes<high.atlasBytes+high.politicalBytes);
  assert.equal(balanced.atlasBytes+balanced.politicalBytes,40*1024*1024);
  const cache=new RasterCache<{dispose:()=>never}>(100,5),live={dispose:():never=>{throw new Error('live image disposed');}};
  cache.set('old',live,60);cache.set('visible',live,30);cache.get('visible');cache.resize(40,2);
  assert.equal(cache.peek('visible'),live);assert.equal(cache.peek('old'),undefined);assert.equal(cache.bytes,30);
});
test('wide-screen LOD transitions fit their cache even at the lower hysteresis boundary',()=>{
  const coverage:MapFeature={id:'footprint',name:'',countryId:null,provinceId:null,bounds:{left:0,right:1440,top:0,bottom:720},anchor:{x:720,y:360},polygons:[]};
  for(const preset of ['Performance','Balanced','High','Ultra'] as const)for(const [i,zoom]of [.5,1.76,5.28,10.56].entries()){
    const levels=RASTER_LEVELS.map(l=>budgetRasterLevel(l,preset)),budget=mapBudget(preset).politicalBytes;
    const {level,tiles}=rasterCoverageForBudget([coverage],cameraCoverage({x:720,y:360,zoom},{width:1280,height:720}),levels,RASTER_LEVELS[i]!,budget);
    const bytes=tiles.reduce((n,t)=>n+(Math.ceil((t.bounds.right-t.bounds.left)*level.scale)+4)*(Math.ceil((t.bounds.bottom-t.bounds.top)*level.scale)+4)*4,0);
    assert.ok(bytes<=budget,preset+' '+level.key);assert.ok(tiles.length<=96);
  }
});
