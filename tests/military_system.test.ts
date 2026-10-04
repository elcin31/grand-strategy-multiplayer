import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {combatMultiplier,initializeMilitary,recoverMilitary,UNITS,UNIT_TYPES} from '../supabase/functions/_shared/militarySystem';
function campaign(){const s=createWorldState('military','MIL001','host','QA',37);s.phase='paused';s.players[0]!.countryId='germany';return s;}
test('all six units recruit at server prices, require research, and do not merge different types',()=>{
  const s=campaign(),c=s.countries.germany!,p=s.provinces.find(p=>p.ownerId===c.id)!;c.treasury=100000;c.manpower=1000000;
  assert.throws(()=>applyServerCommand(s,{type:'RECRUIT_UNIT',playerId:'host',provinceId:p.id,troops:1000,unitType:'Armor'},'host'));
  c.technologies!.Military=5;let n=s;
  for(const unitType of UNIT_TYPES){const before=n.countries.germany!.treasury;n=applyServerCommand(n,{type:'RECRUIT_UNIT',playerId:'host',provinceId:p.id,troops:1000,unitType},'host');assert.equal(n.countries.germany!.treasury,before-UNITS[unitType].cost);}
  assert.equal(new Set(n.armies.filter(a=>a.provinceId===p.id).map(a=>a.unitType)).size,6);
  assert.throws(()=>applyServerCommand(s,{type:'RECRUIT_UNIT',playerId:'host',provinceId:p.id,troops:1000,unitType:'Armor',morale:100} as never,'host'));
});
test('commanders are seeded, country bound, unique per army and affect readiness/terrain combat',()=>{
  const s=campaign(),a=s.armies.find(a=>a.ownerId==='germany')!,p=s.provinces.find(p=>p.id===a.provinceId)!;
  assert.deepEqual(s.commanders,campaign().commanders);
  const cmd={type:'ASSIGN_COMMANDER',playerId:'host',armyId:a.id,commanderId:'general-germany-0'} as const;
  const n=applyServerCommand(s,cmd,'host');assert.equal(s.armies.find(q=>q.id===a.id)!.commanderId,undefined);
  assert.ok(combatMultiplier(n,n.armies.find(q=>q.id===a.id)!,p,false)>combatMultiplier(s,a,p,false));
  assert.throws(()=>applyServerCommand(s,{...cmd,commanderId:'general-france-0'},'host'));
  a.unitType='Armor';p.terrain='plains';const plains=combatMultiplier(s,a,p,false);p.terrain='mountain';assert.ok(combatMultiplier(s,a,p,false)<plains);
  a.morale=1;a.organization=1;const exhausted=combatMultiplier(s,a,p,false);recoverMilitary(s);assert.ok(combatMultiplier(s,a,p,false)>exhausted);
  a.morale=NaN;assert.throws(()=>initializeMilitary(s));
});
test('migration preserves troops and old campaigns while adding bounded readiness',()=>{
  const s=campaign();const sum=s.armies.reduce((n,a)=>n+a.troops,0);delete s.commanders;for(const a of s.armies){delete a.morale;delete a.organization;delete a.unitType;}
  initializeMilitary(s);assert.equal(s.armies.reduce((n,a)=>n+a.troops,0),sum);assert.ok(s.armies.every(a=>a.morale===80));
});
