import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {declareWar,diplomaticLink,initializeDiplomacy,pairKey,warBetween} from '../supabase/functions/_shared/diplomacySystem';
function campaign(){const s=createWorldState('diplomacy','DIP001','host','QA',37);s.phase='paused';s.players[0]!.countryId='germany';s.players.push({id:'guest',countryId:'france',displayName:'QA2',ready:true,isHost:false});return s;}
test('human treaties require counterparty consent and preserve immutable state',()=>{
  const s=campaign(),original=structuredClone(s);let n=applyServerCommand(s,{type:'OFFER_TREATY',playerId:'host',targetId:'france',treaty:'NonAggression'},'host');assert.deepEqual(s,original);
  assert.deepEqual(n.diplomacy![pairKey('germany','france')]!.treaties,[]);
  assert.throws(()=>applyServerCommand(n,{type:'RESPOND_TREATY',playerId:'host',targetId:'france',accept:true},'host'));
  n=applyServerCommand(n,{type:'RESPOND_TREATY',playerId:'guest',targetId:'germany',accept:true},'guest');
  assert.throws(()=>applyServerCommand(n,{type:'DECLARE_WAR',playerId:'host',targetId:'france'},'host'));
  n=applyServerCommand(n,{type:'DIPLOMATIC_ACTION',playerId:'host',targetId:'france',action:'Cancel'},'host');
  assert.throws(()=>applyServerCommand(n,{type:'DECLARE_WAR',playerId:'host',targetId:'france'},'host'));
  n.tick+=6;n=applyServerCommand(n,{type:'DECLARE_WAR',playerId:'host',targetId:'france'},'host');assert.ok(warBetween(n,'germany','france'));
});
test('peace-time invasion is rejected and defensive guarantees create real participants',()=>{
  const s=campaign();const p=s.provinces.find(p=>p.ownerId==='germany'&&p.neighbors.some(id=>s.provinces.find(q=>q.id===id)?.ownerId==='france'))!;
  const target=p.neighbors.map(id=>s.provinces.find(q=>q.id===id)!).find(q=>q.ownerId==='france')!,a=s.armies.find(a=>a.ownerId==='germany')!;a.provinceId=p.id;
  assert.throws(()=>applyServerCommand(s,{type:'MOVE_ARMY',playerId:'host',armyId:a.id,provinceId:target.id},'host'));
  diplomaticLink(s,'france','poland').guarantors=['poland'];const war=declareWar(s,'germany','france');assert.ok(war.defenders.includes('poland'));
  assert.throws(()=>declareWar(s,'france','spain'));assert.throws(()=>declareWar(s,'germany','germany'));
});
test('paid relations have cooldowns, NPC consent is deterministic, and spoofed fields fail',()=>{
  const s=campaign();const cmd={type:'DIPLOMATIC_ACTION',playerId:'host',targetId:'poland',action:'Improve'} as const;
  const n=applyServerCommand(s,cmd,'host');assert.equal(n.countries.germany!.politicalPower,s.countries.germany!.politicalPower!-10);
  assert.throws(()=>applyServerCommand(n,cmd,'host'));
  const accepted=applyServerCommand(n,{type:'OFFER_TREATY',playerId:'host',targetId:'poland',treaty:'Alliance'},'host');assert.ok(accepted.diplomacy![pairKey('germany','poland')]!.treaties.includes('Alliance'));
  assert.throws(()=>applyServerCommand(s,{...cmd,relation:100} as never,'host'));
  n.diplomacy![pairKey('germany','poland')]!.relation=Infinity;assert.throws(()=>initializeDiplomacy(n));
});
