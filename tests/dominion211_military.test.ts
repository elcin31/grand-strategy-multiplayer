import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {armyTravelDays,armyETA,beginSiege} from '../supabase/functions/_shared/military3System';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {armyDisplayPoint} from '../src/map/armyInterpolation';
import type {MapFeature} from '../src/map/geometry';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
import {scenarioStrength} from './helpers/militaryFixture';
test('march cost keeps distance, terrain, roads and supply; display does not mutate orders',()=>{
 const s=createWorldState('march211','MR211A','host','QA'),a=s.armies.find(a=>a.ownerId==='germany')!,origin=s.provinces.find(p=>p.id===a.provinceId)!,p=s.provinces.find(p=>origin.neighbors.includes(p.id))!;
 const close={...p,x:origin.x+1,y:origin.y,width:origin.width,height:origin.height,terrain:'plains' as const,buildings:{Infrastructure:0}};
 const short=armyTravelDays(s,a,close),far={...close,x:origin.x+100};assert.ok(short>=1&&short<=2);assert.ok(armyTravelDays(s,a,far)>short);
 const mountain={...far,terrain:'mountain' as const};assert.ok(armyTravelDays(s,a,mountain)>=armyTravelDays(s,a,far));assert.ok(armyTravelDays(s,a,{...mountain,buildings:{Infrastructure:5}})<=armyTravelDays(s,a,mountain));assert.ok(armyTravelDays(s,{...a,supply:0},mountain)>=armyTravelDays(s,a,mountain));
 a.order={type:'MOVE',targetProvinceId:p.id,route:[p.id],issuedTick:s.tick,travelProgress:1};const before=JSON.stringify(a),days=armyTravelDays(s,a,p);
 const geometry=new Map([[origin.id,{id:origin.id,anchor:{x:0,y:0}} as MapFeature],[p.id,{id:p.id,anchor:{x:20,y:10}} as MapFeature]]);
 const point=armyDisplayPoint(s,{key:'one',provinceId:origin.id,ownerId:a.ownerId,ids:[a.id],troops:a.troops,x:0,y:0,ownerIds:[a.ownerId],stack:false},geometry);
 assert.equal(point.x,20*Math.min(1,1/days));assert.equal(JSON.stringify(a),before);assert.equal(armyETA(s,a),Math.max(0,days-1));
});
test('siege assault costs real troops, checks ownership, and cannot repeat in one day',()=>{
 let s=createWorldState('siege211','SG211A','host','QA');s.phase='paused';s.speed=0;s.players[0]!.countryId='germany';s.players.push({id:'guest',countryId:'poland',displayName:'B',ready:true,isHost:false});
 const origin=s.provinces.find(p=>p.ownerId==='germany'&&p.neighbors.some(id=>s.provinces.find(q=>q.id===id)?.ownerId==='poland'))!,p=s.provinces.find(p=>origin.neighbors.includes(p.id)&&p.ownerId==='poland')!,a=s.armies.find(a=>a.ownerId==='germany')!;
 a.provinceId=origin.id;scenarioStrength(a,100000);p.buildings={...p.buildings,Fort:2};s.wars=[{id:'assault-war',attackers:['germany'],defenders:['poland'],startedTick:0}];beginSiege(s,a,p);const siegeId=s.sieges![0]!.id;
 assert.throws(()=>applyServerCommand(s,{type:'ASSAULT_SIEGE',playerId:'guest',siegeId},'guest'));
 s=applyServerCommand(s,{type:'ASSAULT_SIEGE',playerId:'host',siegeId},'host');assert.ok(s.armies.find(x=>x.id===a.id)!.troops<100000);assert.ok(s.sieges![0]!.progress>0);assert.equal(s.provinces.find(x=>x.id===p.id)!.ownerId,'poland');
 assert.throws(()=>applyServerCommand(s,{type:'ASSAULT_SIEGE',playerId:'host',siegeId},'host'),/следующий игровой день/);decodeCampaign(encodeCampaign(s,1));
});
