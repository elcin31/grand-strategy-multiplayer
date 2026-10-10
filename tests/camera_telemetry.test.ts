import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraMetrics,getMapTargets,getMetrics,recordMetrics} from '../src/performance/telemetry';

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

test('timing refreshes keep the target snapshot stable; changed selection and geometry publish every real identity',()=>{
  const original={countryTargets:getMetrics().countryTargets,armyTargets:getMetrics().armyTargets};
  try{
    const countryTargets=JSON.stringify(Array.from({length:195},(_,i)=>({countryId:'country-'+i,x:i*3.1,y:i*2.3}))),
      armyTargets=JSON.stringify([{ids:['army-a','army-b'],ownerIds:['germany','france'],selected:false,x:340,y:190}]);
    recordMetrics({countryTargets,armyTargets});const first=getMapTargets();
    const unchanged=JSON.stringify(first);
    for(let i=0;i<120;i++){recordMetrics({uiFps:30+i/100,frameMs:20+i/100});assert.equal(getMapTargets(),first);}
    assert.equal(JSON.stringify(getMapTargets()),unchanged);assert.equal(first.countryTargets,countryTargets);assert.equal(first.armyTargets,armyTargets);
    const selected=armyTargets.replace('"selected":false','"selected":true');recordMetrics({armyTargets:selected});
    const selection=getMapTargets();assert.notEqual(selection,first);assert.equal(selection.countryTargets,countryTargets);assert.equal(selection.armyTargets,selected);
    recordMetrics({countryTargets:countryTargets.replace('"x":0','"x":100')});assert.notEqual(getMapTargets(),selection);
    assert.deepEqual(JSON.parse(getMapTargets().armyTargets)[0].ids,['army-a','army-b']);
    recordMetrics(original);assert.deepEqual(getMapTargets(),original);
  }finally{recordMetrics(original);}
});
