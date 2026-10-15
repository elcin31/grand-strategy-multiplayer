import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {monthlyGameEvents,eventCondition,eventOptionReason} from '../supabase/functions/_shared/eventSystem';
import {recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {encodeCampaign,decodeCampaign,validateCampaign} from '../src/persistence/campaignCodec';
import {focusAvailability} from '../supabase/functions/_shared/focusSystem';
import {projectFogOfWar} from '../supabase/functions/_shared/strategy3System';

function debtCrisis(){
 const s=createWorldState('event-world','EVENT1','host','QA',91);s.phase='paused';s.players[0]!.countryId='germany';
 s.players.push({id:'guest',displayName:'France',countryId:'france',isHost:false,ready:true});
 s.countries.germany!.debt=2000;s.countries.germany!.taxRate=10;recalcEconomy(s);
 assert.ok(s.countries.germany!.economy!.monthlyBalance<0);s.tick=1;monthlyGameEvents(s);
 return s;
}
test('a real debt crisis charges once, unlocks an existing-tree course, chains by date and survives exact restore',()=>{
 let s=debtCrisis(),x=s.events!.pending.find(e=>e.countryId==='germany')!;
 assert.equal(x.eventId,'debt-pressure');const cash=s.countries.germany!.treasury,pp=s.countries.germany!.politicalPower!;
 assert.match(focusAvailability(s,'germany','event-fiscal-recovery')!,/события/);
 const command={type:'RESOLVE_GAME_EVENT',playerId:'host',eventId:x.id,choiceId:'audit'} as const;
 const before=structuredClone(s);s=applyServerCommand(s,command,'host');assert.deepEqual(before.events!.pending.find(e=>e.id===x.id),x);
 assert.equal(s.countries.germany!.treasury,cash-60);assert.equal(s.countries.germany!.politicalPower,pp-10);
 assert.ok(s.countries.germany!.eventUnlockedFocuses!.includes('event-fiscal-recovery'));
 assert.ok(s.chronicle!.some(e=>e.kind==='Economy'&&e.countries.includes('germany')));
 assert.throws(()=>applyServerCommand(s,command,'host'),/завершено/);
 assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
 s.tick=6;monthlyGameEvents(s);assert.ok(!s.events!.pending.some(e=>e.eventId==='debt-review'&&e.countryId==='germany'));
 s.tick=7;monthlyGameEvents(s);x=s.events!.pending.find(e=>e.countryId==='germany')!;assert.equal(x.eventId,'debt-review');
 assert.match(eventOptionReason(s,x,'recovered')!,/условия/);
 const once=structuredClone(s);monthlyGameEvents(s);assert.deepEqual(s,once);
});
test('event authority rejects a second country, forged prices, invalid choices and double application',()=>{
 const s=debtCrisis(),x=s.events!.pending.find(e=>e.countryId==='germany')!,before=structuredClone(s);
 assert.throws(()=>applyServerCommand(s,{type:'RESOLVE_GAME_EVENT',playerId:'guest',eventId:x.id,choiceId:'audit'},'guest'));
 assert.throws(()=>applyServerCommand(s,{type:'RESOLVE_GAME_EVENT',playerId:'host',eventId:x.id,choiceId:'audit',cost:0} as never,'host'));
 assert.throws(()=>applyServerCommand(s,{type:'RESOLVE_GAME_EVENT',playerId:'host',eventId:x.id,choiceId:'__proto__'},'host'));
 assert.deepEqual(s,before);
 const view=projectFogOfWar(s,'france');assert.ok(!view.events!.pending.some(e=>e.countryId==='germany'));assert.equal(view.countries.germany!.eventReceipts,undefined);
});
test('unanswered human events expire through their free fallback and never reappear after reconnect',()=>{
 const s=debtCrisis(),x=s.events!.pending.find(e=>e.countryId==='germany')!;s.countries.germany!.treasury=0;s.countries.germany!.politicalPower=0;
 s.tick=x.deadlineTick;monthlyGameEvents(s);
 assert.equal(s.countries.germany!.eventReceipts!['debt-pressure']!.choiceId,'delay');
 assert.equal(s.events!.history.find(e=>e.id===x.id)!.automatic,true);
 const count=s.events!.history.length;s.tick++;monthlyGameEvents(s);assert.equal(s.events!.history.filter(e=>e.id===x.id).length,1);assert.ok(s.events!.history.length>=count);
});
test('typed conditions use actual calendar, resource, government, province and technology state',()=>{
 const s=debtCrisis(),c=s.countries.germany!,context={countryId:c.id};
 assert.ok(eventCondition(s,context,{kind:'all',conditions:[{kind:'date',fromYear:2000,toYear:2100},{kind:'government',value:c.governmentType!},{kind:'province',provinceId:c.provinceIds![0]!,owner:'self'},{kind:'technology',id:'science-method'},{kind:'resource',resource:'food',amount:0}]}));
 assert.ok(!eventCondition(s,context,{kind:'result',eventId:'debt-pressure',choiceId:'audit'}));
 const malformed=structuredClone(s);malformed.events!.pending.push({...malformed.events!.pending[0]!});assert.throws(()=>validateCampaign(malformed));
 const future=structuredClone(s);future.events!.pending[0]!.deadlineTick++;assert.throws(()=>validateCampaign(future));
});
