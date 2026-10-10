import {scenarioStrength} from './helpers/militaryFixture';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {findArmyRoute,advanceArmyOrders,setArmyOrder,validateArmyOrders} from '../supabase/functions/_shared/armyOrders';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
function campaign(){const s=createWorldState('orders','ORDER1','host','Test',101);s.players[0]!.countryId='germany';s.phase='running';s.speed=0;return s;}
test('multi-province order is authoritative, immutable, cancellable and saved',()=>{
 const s=campaign(),a=s.armies.find(a=>a.ownerId==='germany')!;
 const target=s.provinces.filter(p=>p.ownerId==='germany').find(p=>{try{return findArmyRoute(s,a,p.id).length>=3;}catch{return false;}})!;
 const n=applyServerCommand(s,{type:'ORDER_ARMY',playerId:'host',armyId:a.id,provinceId:target.id},'host');
 assert.equal(a.order,undefined);const ordered=n.armies.find(v=>v.id===a.id)!;assert.ok(ordered.order!.route.length>=3);assert.equal(ordered.order!.targetProvinceId,target.id);validateArmyOrders(n);
 const steps=ordered.order!.route.length;for(let i=0;i<steps;i++)advanceArmyOrders(n,(_s,_o,_a,p)=>{ordered.provinceId=p;});
 assert.equal(ordered.provinceId,target.id);assert.equal(ordered.order,undefined);
 const cancelled=applyServerCommand(applyServerCommand(s,{type:'ORDER_ARMY',playerId:'host',armyId:a.id,provinceId:target.id},'host'),{type:'CANCEL_ARMY_ORDER',playerId:'host',armyId:a.id},'host');assert.equal(cancelled.armies.find(v=>v.id===a.id)!.order,undefined);
 assert.throws(()=>applyServerCommand(s,{type:'ORDER_ARMY',playerId:'other',armyId:a.id,provinceId:target.id},'host'));
 assert.throws(()=>applyServerCommand(s,{type:'ORDER_ARMY',playerId:'host',armyId:s.armies.find(v=>v.ownerId==='france')!.id,provinceId:target.id},'host'));
});
test('attack reaches exact requested target; neutral and stale routes cannot bypass diplomacy',()=>{
 const s=campaign(),a=s.armies.find(a=>a.ownerId==='germany')!;scenarioStrength(a,10000000);
 const border=s.provinces.find(p=>p.ownerId==='germany'&&p.neighbors.some(id=>s.provinces.find(q=>q.id===id)?.ownerId==='france'))!;
 const target=s.provinces.find(p=>p.ownerId==='france'&&border.neighbors.includes(p.id))!;
 assert.throws(()=>findArmyRoute(s,a,target.id),/войну/);declareWar(s,'germany','france');
 let n=applyServerCommand(s,{type:'ORDER_ARMY',playerId:'host',armyId:a.id,provinceId:target.id},'host');const route=[...n.armies.find(v=>v.id===a.id)!.order!.route];
 assert.ok(route.length>1); // capital to foreign border is genuinely multi-step
 // Exercise real monthly reducer and combat with AI paused through human ownership of every country.
 n.players=Object.keys(n.countries).map((id,i)=>({id:i?'npc-'+i:'host',displayName:id,countryId:id,isHost:!i,ready:true}));n.speed=1;
 for(let i=0;i<route.length+1;i++)n=applyServerCommand(n,{type:'ADVANCE_TICK'},'host');
 assert.equal(n.armies.find(v=>v.id===a.id)?.provinceId,target.id);assert.ok(n.battleLog.some(b=>b.provinceId===target.id&&b.attackerId==='germany'));
 const stale=campaign(),own=stale.armies.find(v=>v.ownerId==='germany')!;const ownTarget=stale.provinces.find(p=>p.ownerId==='germany'&&p.id!==own.provinceId)!;setArmyOrder(stale,'germany',own.id,ownTarget.id);
 stale.provinces.find(p=>p.id===own.order!.route[0])!.controllerId='france';let moved=false;advanceArmyOrders(stale,()=>{moved=true;});assert.equal(moved,false);assert.equal(own.order,undefined);
 assert.throws(()=>findArmyRoute(stale,own,'missing'));assert.throws(()=>findArmyRoute(stale,own,stale.provinces.find(p=>p.ownerId==='usa')!.id));
});
