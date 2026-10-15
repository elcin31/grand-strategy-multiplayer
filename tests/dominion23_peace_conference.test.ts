import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {makePeaceTerms,peaceConference,peaceCost,refreshWars} from '../supabase/functions/_shared/warSystem';
import {decodeCampaign,encodeCampaign} from '../src/persistence/campaignCodec';

function conference(){const s=createWorldState('multilateral','PEACE3','host','QA',91);s.phase='paused';s.speed=0;
 s.players[0]!.countryId='germany';s.players.push({id:'ally',displayName:'Poland',countryId:'poland',isHost:false,ready:true},{id:'enemy',displayName:'France',countryId:'france',isHost:false,ready:true});
 s.wars=[{id:'coalition-war',attackers:['germany','poland'],defenders:['france'],startedTick:0,casualties:{germany:10000,poland:30000},warScore:0,battleScore:0,occupiedProvinceIds:[]}];
 const french=s.provinces.filter(p=>p.ownerId==='france');for(let i=0;i<french.length;i++)french[i]!.controllerId=i%2?'poland':'germany';refreshWars(s);
 return {s,german:french[0]!.id,polish:french[1]!.id,warId:s.wars[0]!.id};
}
test('three real player identities negotiate separate allocations and apply the entire peace once',()=>{
 let {s,german,polish,warId}=conference();const before=structuredClone(s),g=s.countries.germany!.treasury,p=s.countries.poland!.treasury,f=s.countries.france!.treasury;
 const terms=makePeaceTerms([{kind:'Territory',provinceIds:[german],amount:0,recipientId:'germany'},{kind:'Territory',provinceIds:[polish],amount:0,recipientId:'poland'},{kind:'Money',provinceIds:[],amount:20,recipientId:'germany'},{kind:'Money',provinceIds:[],amount:15,recipientId:'poland'}]);
 const shares=peaceConference(s,s.wars![0]!,'germany');assert.ok(shares.every(row=>row.budget>0));assert.ok(Math.abs(shares.reduce((n,row)=>n+row.budget,0)-100)<1e-9);
 s=applyServerCommand(s,{type:'PROPOSE_PEACE',playerId:'host',warId,terms},'host');assert.equal(s.provinces.find(q=>q.id===polish)!.ownerId,'france');
 assert.throws(()=>applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'enemy',warId,accept:true},'enemy'),/согласие союзников/);
 assert.throws(()=>applyServerCommand(s,{type:'APPROVE_PEACE_PLAN',playerId:'ally',warId,accept:true},'host'),/Подмена/);
 s=applyServerCommand(s,{type:'APPROVE_PEACE_PLAN',playerId:'ally',warId,accept:true},'ally');
 assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
 s=applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'enemy',warId,accept:true},'enemy');
 assert.equal(s.provinces.find(q=>q.id===german)!.ownerId,'germany');assert.equal(s.provinces.find(q=>q.id===polish)!.ownerId,'poland');
 assert.equal(s.countries.germany!.treasury,g+20);assert.equal(s.countries.poland!.treasury,p+15);assert.equal(s.countries.france!.treasury,f-35);assert.equal(s.wars!.length,0);
 assert.ok(s.cities!.filter(c=>c.provinceId===polish).every(c=>c.countryId==='poland'));assert.equal(before.provinces.find(q=>q.id===polish)!.ownerId,'france');
 assert.throws(()=>applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'enemy',warId,accept:true},'enemy'));
});
test('conference budgets, foreign recipients, overlapping demands and aggregate payouts are server checked',()=>{
 const {s,german}=conference(),w=s.wars![0]!;
 assert.throws(()=>peaceCost(s,w,'germany',makePeaceTerms([{kind:'Territory',provinceIds:[german],amount:0,recipientId:'uk'}])),/коалиции/);
 assert.throws(()=>peaceCost(s,w,'germany',makePeaceTerms([{kind:'Territory',provinceIds:[german],amount:0,recipientId:'germany'},{kind:'Territory',provinceIds:[german],amount:0,recipientId:'poland'}])));
 assert.throws(()=>peaceCost(s,w,'germany',makePeaceTerms([{kind:'Vassalization',provinceIds:[],amount:0}])),/бюджет/);
 s.countries.france!.treasury=20;assert.throws(()=>peaceCost(s,w,'germany',makePeaceTerms([{kind:'Money',provinceIds:[],amount:15,recipientId:'germany'},{kind:'Money',provinceIds:[],amount:15,recipientId:'poland'}])),/Общие выплаты/);
});
test('a leader cannot silently take an NPC ally occupation or bypass a human ally refusal',()=>{
 let {s,polish,warId}=conference();s.players=s.players.filter(p=>p.id!=='ally');
 assert.throws(()=>applyServerCommand(s,{type:'PROPOSE_PEACE',playerId:'host',warId,terms:makePeaceTerms([{kind:'Territory',provinceIds:[polish],amount:0}])},'host'),/союзник/);
 ({s,polish,warId}=conference());s=applyServerCommand(s,{type:'PROPOSE_PEACE',playerId:'host',warId,terms:makePeaceTerms([{kind:'Territory',provinceIds:[polish],amount:0,recipientId:'poland'}])},'host');
 s=applyServerCommand(s,{type:'APPROVE_PEACE_PLAN',playerId:'ally',warId,accept:false},'ally');assert.equal(s.wars![0]!.peaceOffer,undefined);assert.equal(s.provinces.find(p=>p.id===polish)!.ownerId,'france');
});
