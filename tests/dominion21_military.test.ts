import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyCommand} from '../supabase/functions/_shared/gameEngine';
import {retreatArmy} from '../supabase/functions/_shared/militaryLogistics';
import {beginBattle,dailyMilitary,mergeArmies,splitArmy} from '../supabase/functions/_shared/military3System';
import {scenarioStrength} from './helpers/militaryFixture';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
test('split and merge conserve every regiment, templates and manpower',()=>{
 const s=createWorldState('regiments','REG001','host','QA',21),a=s.armies.find(a=>a.ownerId==='germany')!;const totals=a.troops,manpower=s.countries.germany!.manpower;splitArmy(s,a.ownerId,a.id,50);const armies=s.armies.filter(b=>b.ownerId===a.ownerId);assert.equal(armies.reduce((n,b)=>n+b.troops,0),totals);mergeArmies(s,a.ownerId,armies.map(b=>b.id));assert.equal(a.troops,totals);assert.equal(s.countries.germany!.manpower,manpower);decodeCampaign(encodeCampaign(s,1));
});
test('movement waits for calendar travel and does not cancel on selection; forged split rejected',()=>{
 let s=createWorldState('route','RTE001','host','QA',21);s.players[0]!.countryId='germany';s.phase='running';const a=s.armies.find(a=>a.ownerId==='germany')!,p=s.provinces.find(p=>p.id===a.provinceId)!,target=p.neighbors.find(id=>s.provinces.find(p=>p.id===id)?.ownerId===a.ownerId)!;assert.ok(target);
 s=applyCommand(s,{type:'ORDER_ARMY',playerId:'host',armyId:a.id,provinceId:target},true);assert.equal(s.armies.find(b=>b.id===a.id)!.provinceId,p.id);
 for(let i=0;i<6;i++)s=applyCommand(s,{type:'ADVANCE_DAY'},true);assert.equal(s.armies.find(b=>b.id===a.id)!.provinceId,target);assert.throws(()=>applyCommand(s,{type:'SPLIT_ARMY',playerId:'host',armyId:a.id,percent:99}));
});
test('battle lasts days then fort siege progresses; occupation never transfers legal ownership',()=>{
 const s=createWorldState('battle','BTL001','host','QA',21);s.phase='running';const origin=s.provinces.find(p=>p.ownerId==='germany'&&p.neighbors.some(id=>s.provinces.find(q=>q.id===id)?.ownerId==='poland'))!,p=s.provinces.find(p=>origin.neighbors.includes(p.id)&&p.ownerId==='poland')!;assert.ok(p);
 const a=s.armies.find(a=>a.ownerId==='germany')!,d=s.armies.find(a=>a.ownerId==='poland')!;a.provinceId=origin.id;d.provinceId=p.id;scenarioStrength(a,100000);scenarioStrength(d,4000);p.buildings={...p.buildings,Fort:2};s.wars=[{id:'test-war',attackers:['germany'],defenders:['poland'],startedTick:s.tick,warScore:0,casualties:{},occupiedProvinceIds:[]}];beginBattle(s,a,p);assert.equal(s.activeBattles!.length,1);dailyMilitary(s);assert.equal(s.activeBattles!.length,1);
 for(let i=0;i<25&&s.activeBattles!.length;i++){s.simulationDay!++;dailyMilitary(s);}assert.equal(s.activeBattles!.length,0);assert.ok(s.battleLog[0]!.durationDays!>1);assert.equal(s.sieges!.length,1);const before=s.sieges![0]!.progress;s.simulationDay!++;dailyMilitary(s);assert.ok(s.sieges![0]!.progress>before);assert.equal(p.ownerId,'poland');assert.equal(p.controllerId,'poland');decodeCampaign(encodeCampaign(s,1));
});

test('active battle orders cannot corrupt the saved route; explicit retreat removes fighting participation',()=>{
 const s=createWorldState('combat-orders','ORD021','host','QA',21);s.phase='running';s.players[0]!.countryId='germany';const origin=s.provinces.find(p=>p.ownerId==='germany'&&p.neighbors.some(id=>s.provinces.find(q=>q.id===id)?.ownerId==='poland')&&p.neighbors.some(id=>s.provinces.find(q=>q.id===id)?.ownerId==='germany'))!,target=s.provinces.find(p=>origin.neighbors.includes(p.id)&&p.ownerId==='poland')!,friend=s.provinces.find(p=>origin.neighbors.includes(p.id)&&p.ownerId==='germany')!,a=s.armies.find(a=>a.ownerId==='germany')!,d=s.armies.find(a=>a.ownerId==='poland')!;a.provinceId=origin.id;d.provinceId=target.id;s.wars=[{id:'test-war',attackers:['germany'],defenders:['poland'],startedTick:0,warScore:0,casualties:{},occupiedProvinceIds:[]}];beginBattle(s,a,target);
 assert.throws(()=>applyCommand(s,{type:'ORDER_ARMY',playerId:'host',armyId:a.id,provinceId:friend.id},true),/отступления/);retreatArmy(s,a.ownerId,a.id,friend.id);assert.ok(!s.activeBattles![0]!.attackerArmyIds.includes(a.id));dailyMilitary(s);assert.equal(s.battleLog[0]!.attackerLosses,0);decodeCampaign(encodeCampaign(s,1));
});
