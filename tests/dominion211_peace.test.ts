import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {makePeaceTerms,assertPeaceTerms,refreshWars,warMetrics,monthlyWar} from '../supabase/functions/_shared/warSystem';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
function scenario(){const s=createWorldState('peace211','PC211A','host','A');s.phase='paused';s.speed=0;s.players[0]!.countryId='germany';s.players.push({id:'guest',displayName:'B',countryId:'france',ready:true,isHost:false});s.wars=[{id:'compound-war',attackers:['germany'],defenders:['france'],startedTick:0,warScore:0,casualties:{},occupiedProvinceIds:[]}];for(const p of s.provinces)if(p.ownerId==='france')p.controllerId='germany';refreshWars(s);return s;}
test('compound human treaty is atomic, authorized, migrates, and pays once',()=>{
 let s=scenario();const war=s.wars![0]!,province=s.provinces.find(p=>p.ownerId==='france')!,before=s.countries.germany!.treasury;
 const terms=makePeaceTerms([{kind:'Territory',provinceIds:[province.id],amount:0},{kind:'Money',provinceIds:[],amount:10},{kind:'Reparations',provinceIds:[],amount:1},{kind:'Guarantee',provinceIds:[],amount:0}]);
 s=applyServerCommand(s,{type:'PROPOSE_PEACE',playerId:'host',warId:war.id,terms},'host');assert.equal(s.provinces.find(p=>p.id===province.id)!.ownerId,'france');assert.equal(s.countries.germany!.treasury,before);
 s.stateVersion=23;const restored=decodeCampaign(encodeCampaign(s,1)).state;assert.equal(restored.stateVersion,24);assert.deepEqual(restored.wars![0]!.peaceOffer!.terms,terms);
 assert.throws(()=>applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'guest',warId:war.id,accept:true},'host'),/Подмена/);
 const declined=applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'guest',warId:war.id,accept:false},'guest');assert.equal(declined.provinces.find(p=>p.id===province.id)!.ownerId,'france');assert.equal(declined.wars![0]!.peaceOffer,undefined);
 s=applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'guest',warId:war.id,accept:true},'guest');assert.equal(s.provinces.find(p=>p.id===province.id)!.ownerId,'germany');assert.equal(s.countries.germany!.treasury,before+10);assert.equal(s.wars!.length,0);assert.equal(s.warHistory![0]!.clauses!.length,4);
 assert.throws(()=>applyServerCommand(s,{type:'RESPOND_PEACE',playerId:'guest',warId:war.id,accept:true},'guest'));
 s.tick++;const money=s.countries.germany!.treasury;monthlyWar(s);monthlyWar(s);assert.equal(s.countries.germany!.treasury,money+1);decodeCampaign(encodeCampaign(s,2));
});
test('budget, duplicate provinces, incompatible clauses and legacy offers are validated',()=>{
 const s=scenario(),w=s.wars![0]!,p=s.provinces.find(p=>p.ownerId==='france')!;
 assert.equal(warMetrics(s,w,'germany').occupationPercent,100);assert.equal(warMetrics(s,w,'germany').enemyProvinces,s.provinces.filter(p=>p.ownerId==='france').length);
 assert.throws(()=>assertPeaceTerms(makePeaceTerms([{kind:'WhitePeace',provinceIds:[],amount:0},{kind:'Money',provinceIds:[],amount:1}])));
 assert.throws(()=>assertPeaceTerms(makePeaceTerms([{kind:'Territory',provinceIds:[p.id],amount:0},{kind:'ReturnTerritory',provinceIds:[p.id],amount:0}])));
 assert.throws(()=>assertPeaceTerms(makePeaceTerms([{kind:'Vassalization',provinceIds:[],amount:0},{kind:'Guarantee',provinceIds:[],amount:0}])));
 const poor=structuredClone(s);poor.countries.france!.treasury=1;assert.throws(()=>applyServerCommand(poor,{type:'PROPOSE_PEACE',playerId:'host',warId:w.id,terms:makePeaceTerms([{kind:'Money',provinceIds:[],amount:10}])},'host'));
 const zero=structuredClone(s);for(const p of zero.provinces)p.controllerId=p.ownerId;refreshWars(zero);assert.throws(()=>applyServerCommand(zero,{type:'PROPOSE_PEACE',playerId:'host',warId:w.id,terms:makePeaceTerms([{kind:'Guarantee',provinceIds:[],amount:0}])},'host'),/военный счёт/);
 s.wars![0]!.peaceOffer={from:'germany',terms:{kind:'WhitePeace',provinceIds:[],amount:0},expiresTick:6};s.stateVersion=23;const old=decodeCampaign(encodeCampaign(s,1)).state;assert.equal(old.wars![0]!.peaceOffer!.terms.kind,'WhitePeace');
});
