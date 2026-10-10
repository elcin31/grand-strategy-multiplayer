import {scenarioArmy} from './helpers/militaryFixture';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {initializeStability,monthlyStability,unrestPressure} from '../supabase/functions/_shared/stabilitySystem';
import {recalcEconomy} from '../supabase/functions/_shared/economySystem';
function campaign(){const s=createWorldState('rebelqa','REB001','host','QA',22);s.phase='running';s.players[0]!.countryId='germany';return s;}
test('high unrest creates persistent rebels, suspends income/build/recruitment and respects pause',()=>{
  const s=campaign(),p=s.provinces.find(p=>p.ownerId==='germany'&&p.population>2000)!;p.unrest=99;s.armies=s.armies.filter(a=>a.provinceId!==p.id);const copy=structuredClone(s);
  const n=applyServerCommand(s,{type:'ADVANCE_TICK'},'host'),r=n.provinces.find(q=>q.id===p.id)!;assert.deepEqual(s,copy);assert.ok(r.rebellion);assert.equal(n.rebellionLog![0]!.provinceId,p.id);
  assert.throws(()=>applyServerCommand(n,{type:'RECRUIT',playerId:'host',provinceId:p.id,troops:1000},'host'));assert.throws(()=>applyServerCommand(n,{type:'BUILD',playerId:'host',provinceId:p.id,buildingType:'Farm'},'host'));
  const tax=n.countries.germany!.economy!.taxIncome;const restored=structuredClone(n);delete restored.provinces.find(q=>q.id===p.id)!.rebellion;recalcEconomy(restored);assert.ok(restored.countries.germany!.economy!.taxIncome>tax);
  const paused=applyServerCommand(n,{type:'SET_SPEED',playerId:'host',speed:0},'host');assert.deepEqual(applyServerCommand(paused,{type:'ADVANCE_TICK'},'host'),paused);
  const loaded=JSON.parse(JSON.stringify(n));initializeStability(loaded);assert.deepEqual(loaded.provinces.find((q:{id:string})=>q.id===p.id)!.rebellion,r.rebellion);
});
test('garrison suppression consumes actual troops, restores income and prevents immediate respawn',()=>{
  let s=campaign();const a=s.armies.find(a=>a.ownerId==='germany')!,p=s.provinces.find(p=>p.id===a.provinceId)!;p.rebellion={strength:1000,startedTick:0,lastBattleTick:-1};p.unrest=99;const troops=s.armies.reduce((n,a)=>n+a.troops,0);s.phase='paused';
  s=applyServerCommand(s,{type:'SUPPRESS_REBELLION',playerId:'host',provinceId:p.id},'host');const after=s.provinces.find(q=>q.id===p.id)!;assert.equal(after.rebellion,undefined);assert.equal(after.unrest,40);assert.equal(after.rebellionCooldownUntilTick,24);assert.equal(troops-s.armies.reduce((n,a)=>n+a.troops,0),300);assert.equal(s.countries.germany!.army,s.armies.filter(a=>a.ownerId==='germany').reduce((n,a)=>n+a.troops,0));
  after.unrest=99;monthlyStability(s);assert.equal(after.rebellion,undefined);
});
test('pacification is priced by server and ownership-bound, unrest responds to war/occupation/bankruptcy',()=>{
  const s=campaign(),p=s.provinces.find(p=>p.ownerId==='germany')!,before=structuredClone(s),cmd={type:'PACIFY_PROVINCE',playerId:'host',provinceId:p.id} as const;
  const n=applyServerCommand(s,cmd,'host');assert.deepEqual(s,before);assert.equal(n.countries.germany!.treasury,s.countries.germany!.treasury-50);assert.equal(n.countries.germany!.politicalPower,s.countries.germany!.politicalPower!-10);
  assert.throws(()=>applyServerCommand(s,{...cmd,provinceId:s.provinces.find(q=>q.ownerId==='france')!.id},'host'));
  assert.throws(()=>applyServerCommand(s,{...cmd,cost:0} as never,'host'));
  const calm=unrestPressure(s,p);p.controllerId='france';s.countries.germany!.warExhaustion=80;s.countries.germany!.bankruptcyUntilTick=20;assert.ok(unrestPressure(s,p)>calm);
  p.rebellion={strength:NaN,startedTick:0,lastBattleTick:-1};assert.throws(()=>initializeStability(s));
});
test('a losing suppression cannot be repeated in the same paused tick',()=>{
  const s=campaign(),p=s.provinces.find(p=>p.ownerId==='germany')!;s.armies=s.armies.filter(a=>a.provinceId!==p.id);s.armies.push(scenarioArmy({id:'tiny',ownerId:'germany',provinceId:p.id,troops:1000,morale:80,organization:80,unitType:'Infantry'}));p.rebellion={strength:50000,startedTick:0,lastBattleTick:-1};
  const n=applyServerCommand(s,{type:'SUPPRESS_REBELLION',playerId:'host',provinceId:p.id},'host');assert.ok(n.provinces.find(q=>q.id===p.id)!.rebellion);assert.throws(()=>applyServerCommand(n,{type:'SUPPRESS_REBELLION',playerId:'host',provinceId:p.id},'host'));
});
