import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {data} from '../supabase/functions/_shared/scenarioContent';
import {validateScenarioPack} from '../supabase/functions/_shared/contentValidation';
import {decodeCampaign,encodeCampaign,validateCampaign} from '../src/persistence/campaignCodec';
import {monthlyGameEvents} from '../supabase/functions/_shared/eventSystem';
import {focusAvailability} from '../supabase/functions/_shared/focusSystem';

test('registered alternate scenario preserves geography and players, applies real definitions and roundtrips',()=>{
 const s=createWorldState('scenario-test','SCENE1','host','QA',91);s.players[0]!.countryId='germany';s.players[0]!.ready=true;
 s.players.push({id:'guest',displayName:'France',countryId:'france',isHost:false,ready:true});
 const before=structuredClone(s);let selected=applyServerCommand(s,{type:'SELECT_SCENARIO',playerId:'host',scenarioId:data.id},'host');
 assert.deepEqual(s,before);assert.equal(selected.scenario!.id,data.id);assert.equal(selected.players[1]!.id,'guest');assert.equal(selected.players[0]!.countryId,'germany');assert.ok(selected.players.every(p=>!p.ready));
 assert.equal(selected.countries.germany!.treasury,2400);assert.equal(selected.countries.germany!.stockpile!.amounts.steel,120);
 assert.equal(selected.diplomacy!['france|germany']!.trust,65);assert.equal(selected.provinces.find(p=>p.id==='deu-1572')!.buildingDamage,.35);
 assert.deepEqual(selected.provinces.map(p=>[p.id,p.neighbors,p.x,p.y]),s.provinces.map(p=>[p.id,p.neighbors,p.x,p.y]));
 selected.phase='running';selected.tick=1;monthlyGameEvents(selected);assert.ok(selected.events!.pending.some(e=>e.countryId==='germany'&&e.eventId==='alt-rhine-workshops'));
 const event=selected.events!.pending.find(e=>e.countryId==='germany')!;selected=applyServerCommand(selected,{type:'RESOLVE_GAME_EVENT',playerId:'host',eventId:event.id,choiceId:'joint'},'host');
 assert.ok(selected.countries.germany!.eventUnlockedFocuses!.includes('alt-shared-workshops'));assert.equal(selected.countries.germany!.treasury,2320);
 assert.deepEqual(decodeCampaign(encodeCampaign(selected,1)).state,selected);
 assert.throws(()=>applyServerCommand(selected,{type:'SELECT_SCENARIO',playerId:'host',scenarioId:'modern-world'},'host'),/до начала/);
 assert.match(focusAvailability(s,'germany','alt-shared-workshops')!,/сценарии/);
});
test('scenario choice is host-only, registered-only and rejects mutations after campaign launch',()=>{
 const s=createWorldState('scenario-authority','SCENE2','host','QA',91);s.players.push({id:'guest',displayName:'Guest',countryId:'france',isHost:false,ready:true});const original=structuredClone(s);
 assert.throws(()=>applyServerCommand(s,{type:'SELECT_SCENARIO',playerId:'guest',scenarioId:data.id},'guest'));
 assert.throws(()=>applyServerCommand(s,{type:'SELECT_SCENARIO',playerId:'host',scenarioId:'client-script'},'host'));
 assert.throws(()=>applyServerCommand(s,{type:'SELECT_SCENARIO',playerId:'host',scenarioId:data.id,content:data} as never,'host'));
 assert.deepEqual(s,original);const future=structuredClone(s);future.scenario!.version++;assert.throws(()=>validateCampaign(future),/совместимая/);
});
test('JSON content rejects missing references, duplicate IDs, cycles, invalid dates, negative units and arbitrary operations',()=>{
 validateScenarioPack(data);
 const cases=[
  (p:any)=>{p.countries.push({...p.countries[0]});},
  (p:any)=>{p.provinceOwners[0].provinceId='missing';},
  (p:any)=>{p.countries[0].resources.steel=-1;},
  (p:any)=>{p.startDate={year:2026,month:2,day:29};},
  (p:any)=>{p.armies=[{id:'bad-army',ownerId:'germany',provinceId:'deu-1572',composition:{Infantry:-1}}];},
  (p:any)=>{p.focuses[0].prerequisites=[p.focuses[0].id];},
  (p:any)=>{p.events[0].options[0].effects=[{kind:'execute',script:'process.exit()'}];},
  (p:any)=>{p.events[0].options[0].effects=[{kind:'schedule',eventId:p.events[0].id,months:1}];},
  (p:any)=>{p.events[0].options[1].cost={treasury:1};},
  (p:any)=>{p.schemaVersion=999;}
 ];
 for(const mutate of cases){const pack=structuredClone(data) as unknown;mutate(pack);assert.throws(()=>validateScenarioPack(pack));}
});
