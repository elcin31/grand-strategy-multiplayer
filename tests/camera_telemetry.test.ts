import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraMetrics,getMetrics} from '../src/performance/telemetry';

test('dense HUD touch coordinates cannot truncate Android camera timing logs',()=>{
  const hud={...getMetrics(),countryTargets:'coordinates'.repeat(10000),armyTargets:'troop-identities'.repeat(10000),benchmarkError:'ошибка'.repeat(10000),uiFps:45.123456789,frameP95Ms:100,rasterPrewarmBuilds:42,rasterPrewarmMs:123.456};
  const compact=cameraMetrics(hud);
  assert.ok(Buffer.byteLength('DOMINION_CAMERA '+JSON.stringify(compact),'utf8')<3800);
  assert.equal(compact.uiFps,hud.uiFps);assert.equal(compact.frameP95Ms,100);
  assert.equal(compact.rasterPrewarmBuilds,42);assert.equal(compact.rasterPrewarmMs,123.456);
  assert.equal(compact.benchmarkError.length,160);
  assert.equal('countryTargets' in compact,false);assert.equal('armyTargets' in compact,false);
  assert.equal(hud.countryTargets.length,110000);assert.equal(hud.armyTargets.length,160000);
  assert.equal(hud.benchmarkError.length,60000);
});

test('compact camera logs preserve all scalar timing fields without changing the HUD',()=>{
  const hud=getMetrics(),before=JSON.stringify(hud),compact=cameraMetrics(hud);
  for(const key of Object.keys(hud) as (keyof typeof hud)[]){
    if(key==='countryTargets'||key==='armyTargets')continue;
    assert.equal(compact[key],hud[key]);
  }
  assert.equal(JSON.stringify(getMetrics()),before);
});
