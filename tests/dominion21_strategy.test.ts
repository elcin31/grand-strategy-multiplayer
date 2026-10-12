import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {projectFogOfWar,declareGoalWar} from '../supabase/functions/_shared/strategy3System';
import {peaceCost} from '../supabase/functions/_shared/warSystem';
import {focusBonuses} from '../supabase/functions/_shared/focusCatalogue';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
test('server view hides distant armies and foreign reserves, allied/intel visibility preserves own authority',()=>{
 const s=createWorldState('fog','FOG001','host','QA',21);s.phase='running';s.players[0]!.countryId='germany';const original=JSON.stringify(s),view=projectFogOfWar(s,'germany');assert.ok(!view.armies.some(a=>a.ownerId==='usa'));assert.equal(view.countries.usa!.stockpile,undefined);assert.equal(view.countries.usa!.treasury,0);assert.equal(view.countries.germany!.stockpile,s.countries.germany!.stockpile);assert.equal(JSON.stringify(s),original);assert.throws(()=>applyServerCommand(s,{type:'APPOINT_ADVISER',playerId:'intruder',role:'Economy'},'host'));
});
test('limited goals constrain peace, advisers have costs/effects and chronicle records real war',()=>{
 let s=createWorldState('goals','GOL001','host','QA',21);s.phase='running';s.players[0]!.countryId='germany';const before=s.countries.germany!.treasury,bonus=focusBonuses(s.countries.germany!).tax;s=applyServerCommand(s,{type:'APPOINT_ADVISER',playerId:'host',role:'Economy'},'host');assert.equal(s.countries.germany!.treasury,before-50);assert.ok(focusBonuses(s.countries.germany!).tax>bonus);
 s=applyServerCommand(s,{type:'DECLARE_WAR_GOAL',playerId:'host',targetId:'poland',goal:'LimitedWar',provinceIds:[]},'host');assert.equal(s.wars![0]!.goals!.germany!.type,'LimitedWar');assert.ok(s.chronicle!.some(e=>e.kind==='War'));assert.throws(()=>peaceCost(s,s.wars![0]!,'germany',{kind:'Territory',provinceIds:s.provinces.filter(p=>p.ownerId==='poland').slice(0,4).map(p=>p.id),amount:0}));decodeCampaign(encodeCampaign(s,1));
 assert.throws(()=>declareGoalWar(s,'usa','poland','Liberation',[s.provinces.find(p=>p.ownerId==='poland')!.id]));
});
