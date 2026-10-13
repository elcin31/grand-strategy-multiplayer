import {test} from 'node:test';
import assert from 'node:assert/strict';
import {borderRasterPlan,borderPriority} from '../src/map/borderRaster';
import {borderRasterBudget} from '../src/map/mobileBudgets';
import {RasterCache} from '../src/map/rasterTiles';

test('border snapshots preserve physical stroke resolution and reject allocation pressure',()=>{
  const bounds={left:64,right:128,top:64,bottom:128};
  for(const density of [1,2.75,3])for(const zoom of [.8,3.5,8,18]){
    const p=borderRasterPlan(bounds,zoom,density,borderRasterBudget('Balanced'));
    if(p){assert.ok(p.scale>=zoom*density);assert.ok(p.width<=1024&&p.height<=1024);assert.ok(p.bytes<=borderRasterBudget('Balanced'));}
  }
  assert.equal(borderRasterPlan(bounds,18,3,borderRasterBudget('Balanced')),null,'Oversized tiles keep vector fidelity');
  assert.equal(borderRasterPlan(bounds,3.5,1,1),null);
  assert.equal(borderRasterPlan(bounds,3.5,1,borderRasterBudget('High')),null);
  assert.equal(borderRasterPlan(bounds,3.5,1,borderRasterBudget('Ultra')),null);
});
test('visible snapshot admission cannot evict an active image or exceed its byte budget',()=>{
  const cache=new RasterCache<object>(100,3),live={};cache.set('live',live,80);
  assert.equal(cache.canFit(30),false);assert.equal(cache.peek('live'),live);
  cache.delete('live');assert.equal(cache.canFit(30),true);cache.set('new',{},30);assert.equal(cache.bytes,30);
  const screen={left:0,right:500,top:0,bottom:300},center={left:240,right:260,top:140,bottom:160},neighbor={left:0,right:20,top:0,bottom:20};
  assert.ok(borderPriority(center,screen)<borderPriority(neighbor,screen));
});
