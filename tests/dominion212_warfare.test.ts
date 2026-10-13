import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyCommand} from '../supabase/functions/_shared/gameEngine';
import {periodicMilitaryAI} from '../supabase/functions/_shared/ai3System';
import {beginBattle} from '../supabase/functions/_shared/military3System';
import {scenarioArmy} from './helpers/militaryFixture';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
function fixture(){
 const s=createWorldState('livingwar','LW212A','host','QA',12);s.phase='running';s.speed=3;
 s.players=Object.keys(s.countries).filter(id=>id!=='poland').map((countryId,n)=>({id:n?'p'+n:'host',countryId,displayName:'QA',ready:true,isHost:n===0}));
 const home=s.provinces.filter(p=>p.ownerId==='poland').slice(0,3),enemy=s.provinces.filter(p=>p.ownerId==='germany').slice(0,2),line=[...home,...enemy];
 line.forEach((p,n)=>{p.neighbors=[line[n-1]?.id,line[n+1]?.id].filter((id):id is string=>!!id);p.terrain='plains';p.buildings={Infrastructure:2};p.buildingDamage=0;});
 s.cities!.find(c=>c.id===s.countries.poland!.capitalCityId)!.provinceId=home[0]!.id;
 s.cities!.find(c=>c.id===s.countries.germany!.capitalCityId)!.provinceId=enemy[1]!.id;
 s.wars=[{id:'living-war',attackers:['germany'],defenders:['poland'],startedTick:0}];
 const army=scenarioArmy({id:'polish-field',ownerId:'poland',provinceId:home[0]!.id,troops:20000,morale:100,organization:100,supply:100});s.armies=[army];
 return {s,home,enemy,army};
}
test('a sole distant capital army marches to the front, attacks and continues after occupation',()=>{
 let {s,home,enemy,army}=fixture();periodicMilitaryAI(s);
 assert.ok(army.order);assert.equal(army.order!.route[0],home[1]!.id);assert.equal(army.militaryPlan!.objective,'Capture');
 const target=army.militaryPlan!.targetProvinceId;
 for(let n=0;n<28;n++){s=applyCommand(s,{type:'ADVANCE_DAY'},true);if(s.provinces.find(p=>p.id===enemy[1]!.id)!.controllerId==='poland')break;}
 assert.equal(s.provinces.find(p=>p.id===enemy[0]!.id)!.controllerId,'poland');assert.equal(s.provinces.find(p=>p.id===enemy[1]!.id)!.controllerId,'poland');
 assert.ok(s.armies[0]!.militaryPlan!.targetProvinceId!==target);assert.equal(s.players.some(p=>p.countryId==='poland'),false);
 s.players=[{id:'host',countryId:'germany',displayName:'QA',ready:true,isHost:true}];decodeCampaign(encodeCampaign(s,1));
});
test('AI initiates a real defended battle and continues the same campaign after victory',()=>{
 let {s,home,enemy,army}=fixture();army.provinceId=home[2]!.id;s.armies.push(scenarioArmy({id:'defender',ownerId:'germany',provinceId:enemy[0]!.id,troops:2500,morale:100,organization:100}));periodicMilitaryAI(s);assert.equal(army.order?.type,'ATTACK');let battled=false;
 for(let n=0;n<24;n++){s=applyCommand(s,{type:'ADVANCE_DAY'},true);battled||=(s.activeBattles?.length??0)>0;if(s.provinces.find(p=>p.id===enemy[1]!.id)!.controllerId==='poland')break;}
 assert.ok(battled);assert.ok(s.battleLog.some(b=>b.attackerId==='poland'&&b.winnerId==='poland'));assert.equal(s.provinces.find(p=>p.id===enemy[1]!.id)!.controllerId,'poland');
});
test('reserves receive a route to an attacked province and human takeover ends national auto command',()=>{
 const {s,home,enemy,army}=fixture();const guard=scenarioArmy({id:'guard',ownerId:'poland',provinceId:home[2]!.id,troops:1000,morale:80,organization:80});
 const invader=scenarioArmy({id:'invader',ownerId:'germany',provinceId:enemy[0]!.id,troops:10000,morale:80,organization:80});s.armies.push(guard,invader);beginBattle(s,invader,home[2]!);periodicMilitaryAI(s);
 assert.equal(army.order?.targetProvinceId,home[2]!.id);assert.equal(army.militaryPlan?.objective,'Defend');
 s.players.push({id:'takeover',countryId:'poland',ready:true,isHost:false,displayName:'Human',aiControlled:false});const route=JSON.stringify(army.order);periodicMilitaryAI(s);assert.equal(army.militaryPlan,undefined);assert.equal(JSON.stringify(army.order),route);
});
test('a weak army does not cross a defended front without committed support',()=>{
 const {s,home,enemy,army}=fixture();army.provinceId=home[2]!.id;s.armies.push(scenarioArmy({id:'strong',ownerId:'germany',provinceId:enemy[0]!.id,troops:200000,morale:100,organization:100}));periodicMilitaryAI(s);assert.notEqual(army.order?.type,'ATTACK');
});
