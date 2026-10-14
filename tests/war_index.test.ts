import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {refreshWars,warMetrics} from '../supabase/functions/_shared/warSystem';
import {periodicMilitaryAI} from '../supabase/functions/_shared/ai3System';

test('war indices isolate simultaneous wars and rebuild after ownership, control and restore changes',()=>{
  let s=createWorldState('war-indices','WARIDX','host','QA',91);
  const first=declareWar(s,'germany','france'),second=declareWar(s,'usa','can');
  const french=s.provinces.filter(p=>p.ownerId==='france');
  for(const p of french)p.controllerId='germany';
  refreshWars(s);
  assert.equal(first.warScore,100);assert.equal(second.warScore,0);
  assert.deepEqual(first.occupiedProvinceIds,french.map(p=>p.id));
  assert.equal(warMetrics(s,first,'france').score,-100);
  s=JSON.parse(JSON.stringify(s));
  for(const p of s.provinces)if(p.ownerId==='france'){p.ownerId='germany';p.controllerId='germany';}
  const canadian=s.provinces.find(p=>p.ownerId==='can')!;canadian.controllerId='usa';
  refreshWars(s);
  assert.deepEqual(s.wars![0]!.occupiedProvinceIds,[]);
  assert.deepEqual(s.wars![1]!.occupiedProvinceIds,[canadian.id]);
  assert.ok(s.wars![1]!.warScore!>0);
});

test('peaceful military scheduling preserves armies and still releases AI control after a human takeover',()=>{
  const s=createWorldState('peace-schedule','PEACE1','host','QA',91);
  s.players[0]!.countryId='germany';
  const before=structuredClone(s);
  periodicMilitaryAI(s);assert.deepEqual(s,before);
  const a=s.armies.find(a=>a.ownerId==='germany')!;
  a.militaryPlan={objective:'Reserve',targetProvinceId:a.provinceId,autoCommand:true,source:'AI',priority:1,status:'Holding',startedDay:0,reviewDay:0,reason:'QA'};
  periodicMilitaryAI(s);assert.equal(a.militaryPlan,undefined);
  assert.equal(a.troops,before.armies.find(q=>q.id===a.id)!.troops);
});
