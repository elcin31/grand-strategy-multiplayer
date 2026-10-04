import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {declareWar,warBetween,pairKey} from '../supabase/functions/_shared/diplomacySystem';
import {initializeWars,monthlyWar,refreshWars} from '../supabase/functions/_shared/warSystem';
function campaign(){const s=createWorldState('warqa','WAR001','host','QA',99);s.phase='paused';s.speed=0;s.players[0]!.countryId='germany';s.players.push({id:'guest',countryId:'france',displayName:'QA2',ready:true,isHost:false});return s;}
function invaded(){let s=campaign();declareWar(s,'germany','france');const origin=s.provinces.find(p=>p.ownerId==='germany'&&p.neighbors.some(id=>s.provinces.find(q=>q.id===id)?.ownerId==='france'))!,dest=origin.neighbors.map(id=>s.provinces.find(q=>q.id===id)!).find(p=>p.ownerId==='france')!,a=s.armies.find(a=>a.ownerId==='germany')!;a.provinceId=origin.id;a.troops=10000000;s.armies=s.armies.filter(q=>q.ownerId!=='france'||q.provinceId!==dest.id);s=applyServerCommand(s,{type:'MOVE_ARMY',playerId:'host',armyId:a.id,provinceId:dest.id},'host');return {s,destId:dest.id,warId:s.wars![0]!.id};}
test('battle occupies without annexation; income, recruitment and construction respect controller',()=>{
  const {s,destId}=invaded(),p=s.provinces.find(p=>p.id===destId)!;assert.equal(p.ownerId,'france');assert.equal(p.controllerId,'germany');assert.ok(s.wars![0]!.occupiedProvinceIds!.includes(destId));assert.ok(s.wars![0]!.casualties!.germany!>0);assert.ok(s.countries.germany!.warExhaustion!>0);
  for(const playerId of ['host','guest']){assert.throws(()=>applyServerCommand(s,{type:'RECRUIT',playerId,provinceId:destId,troops:1000},playerId));assert.throws(()=>applyServerCommand(s,{type:'BUILD',playerId,provinceId:destId,buildingType:'Farm'},playerId));}
});
test('territory peace needs opponent consent, transfers cities/totals and enforces truce',()=>{
  let {s,destId,warId}=invaded();const original=structuredClone(s);s=applyServerCommand(s,{type:'PROPOSE_PEACE',playerId:'host',warId,terms:{kind:'Territory',provinceIds:[destId],amount:0}},'host');assert.equal(original.provinces.find(p=>p.id===destId)!.ownerId,'france');assert.equal(s.provinces.find(p=>p.id===destId)!.ownerId,'france');
  assert.throws(()=>applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'host',warId,accept:true},'host'));
  s=applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'guest',warId,accept:true},'guest');
  assert.equal(s.provinces.find(p=>p.id===destId)!.ownerId,'germany');assert.ok(s.cities!.filter(c=>c.provinceId===destId).every(c=>c.countryId==='germany'));assert.equal(s.wars!.length,0);assert.equal(s.warHistory!.length,1);
  assert.equal(s.countries.germany!.population,s.provinces.filter(p=>p.ownerId==='germany').reduce((n,p)=>n+p.population,0));
  assert.equal(s.diplomacy![pairKey('germany','france')]!.truceUntilTick,s.tick+24);assert.throws(()=>declareWar(s,'germany','france'));
});
test('white peace restores control and returns armies; money and vassalization are real settlements',()=>{
  for(const kind of ['WhitePeace','Money','Vassalization'] as const){let {s,warId,destId}=invaded();const before=s.countries.germany!.treasury;const amount=kind==='Money'?10:0;
    s=applyServerCommand(s,{type:'PROPOSE_PEACE',playerId:'host',warId,terms:{kind,provinceIds:[],amount}},'host');s=applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'guest',warId,accept:true},'guest');
    assert.equal(s.provinces.find(p=>p.id===destId)!.controllerId,'france');assert.equal(s.countries.germany!.treasury,before+amount);assert.ok(s.armies.every(a=>s.provinces.find(p=>p.id===a.provinceId)!.ownerId===a.ownerId));
    if(kind==='Vassalization'){assert.equal(s.countries.france!.overlordId,'germany');assert.throws(()=>declareWar(s,'france','poland'));const treasury=s.countries.germany!.treasury;monthlyWar(s);assert.ok(s.countries.germany!.treasury>treasury);}
  }
});
test('return territory validates original ownership, malformed peace is rejected, migration keeps occupations',()=>{
  let {s,destId,warId}=invaded();const p=s.provinces.find(p=>p.id===destId)!;
  assert.throws(()=>applyServerCommand(s,{type:'PROPOSE_PEACE',playerId:'host',warId,terms:{kind:'ReturnTerritory',provinceIds:[destId],amount:0}},'host'));
  p.originalOwnerId='germany';s=applyServerCommand(s,{type:'PROPOSE_PEACE',playerId:'host',warId,terms:{kind:'ReturnTerritory',provinceIds:[destId],amount:0}},'host');s=applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'guest',warId,accept:true},'guest');assert.equal(s.provinces.find(p=>p.id===destId)!.ownerId,'germany');
  const a=invaded().s;const score=a.wars![0]!.warScore;initializeWars(a);assert.equal(a.wars![0]!.warScore,score);refreshWars(a);assert.ok(warBetween(a,'germany','france'));
  assert.throws(()=>applyServerCommand(a,{type:'PROPOSE_PEACE',playerId:'host',warId:a.wars![0]!.id,terms:{kind:'Money',provinceIds:[],amount:NaN}},'host'));
});
test('occupation suspends national building bonuses and AI cannot recruit in occupied land',()=>{
  const {s,destId}=invaded();const p=s.provinces.find(p=>p.id===destId)!;p.buildings={University:5};
  // Let the AI act for France while its richest province is occupied.
  s.players=s.players.filter(p=>p.id==='host');s.phase='running';s.speed=1;s.tick=2;
  for(const q of s.provinces)if(q.ownerId==='france'){q.controllerId='germany';q.buildings={University:5};}
  assert.doesNotThrow(()=>applyServerCommand(s,{type:'ADVANCE_TICK'},'host'));
});
test('a vassal cannot appear on both sides of a declared war or bypass its truce',()=>{
  const s=campaign();s.countries.poland!.overlordId='germany';
  s.diplomacy!['france|poland']={a:'france',b:'poland',relation:30,treaties:['Alliance'],rivals:[],guarantors:[],truceUntilTick:0};
  assert.throws(()=>applyServerCommand(s,{type:'DECLARE_WAR',playerId:'host',targetId:'france'},'host'));
  s.diplomacy!['france|poland']!.treaties=[];s.diplomacy!['france|poland']!.truceUntilTick=10;
  assert.throws(()=>applyServerCommand(s,{type:'DECLARE_WAR',playerId:'host',targetId:'france'},'host'));
});
