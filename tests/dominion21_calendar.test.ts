import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyCommand} from '../supabase/functions/_shared/gameEngine';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {pumpClock} from '../supabase/functions/_shared/sessionState';
import {monthDays,dayDelay} from '../supabase/functions/_shared/calendarSystem';
import {validateCampaign,encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
test('daily calendar keeps monthly payments and projects on month boundaries; save restores exact day',()=>{
 let s=createWorldState('daily','DAY001','host','QA',21);s.phase='running';s.speed=5;s.month=1;s.day=1;s.players[0]!.countryId='germany';const treasury=s.countries.germany!.treasury,tick=s.tick;
 for(let i=0;i<30;i++)s=applyCommand(s,{type:'ADVANCE_DAY'},true);
 assert.equal(s.tick,tick);assert.equal(s.day,31);assert.equal(s.countries.germany!.treasury,treasury);
 s=applyCommand(s,{type:'ADVANCE_DAY'},true);assert.equal(s.tick,tick+1);assert.equal(s.day,1);assert.equal(s.month,2);
 const restored=decodeCampaign(encodeCampaign(s,1)).state;assert.equal(restored.simulationDay,s.simulationDay);assert.equal(restored.tick,s.tick);assert.equal(restored.day,1);
 assert.equal(monthDays(2000,2),29);assert.equal(monthDays(1900,2),28);
});
test('2.0 saves acquire deterministic day layer without changing month or existing deposits',()=>{
 const s=createWorldState('old','OLD001','host','QA',21);s.stateVersion=18;delete s.day;delete s.simulationDay;delete s.pauseRequests;delete s.notifications;delete s.notificationSequence;const deposits=s.provinces.map(p=>p.resourceDeposit);
 const r=validateCampaign(s);assert.equal(r.day,1);assert.equal(r.tick,s.tick);assert.equal(r.month,s.month);assert.deepEqual(r.provinces.map(p=>p.resourceDeposit),deposits);
});
test('server authority, bounded catchup, shared pause vote and five distinct speeds',()=>{
 const s=createWorldState('clock','CLK001','host','QA',21);s.phase='running';s.players[0]!.countryId='germany';s.players[0]!.connected=true;s.players.push({id:'guest',displayName:'Guest',countryId:'usa',isHost:false,ready:true,connected:true});
 assert.throws(()=>applyServerCommand(s,{type:'SET_SPEED',playerId:'guest',speed:5},'guest'));
 assert.throws(()=>applyServerCommand(s,{type:'ADVANCE_DAY'},'guest'));
 assert.equal(new Set(([1,2,3,4,5] as const).map(dayDelay)).size,5);
 const fast=applyServerCommand(s,{type:'SET_SPEED',playerId:'host',speed:5},'host');const pumped=pumpClock(fast,0,10000);assert.equal(pumped.ticks,3);assert.equal(pumped.state.simulationDay,(fast.simulationDay??0)+3);
 const requested=applyServerCommand(fast,{type:'REQUEST_PAUSE',playerId:'guest'},'guest');assert.equal(requested.phase,'running');const paused=applyServerCommand(requested,{type:'VOTE_PAUSE',playerId:'host',accept:true},'host');assert.equal(paused.phase,'paused');assert.equal(pumpClock(paused,0,10000).ticks,0);
});
