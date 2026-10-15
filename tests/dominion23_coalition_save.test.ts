import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {monthlyGeopolitics} from '../supabase/functions/_shared/geopoliticsSystem';
import {recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
test('a full eight-country defensive coalition produces a valid persistent diplomatic event',()=>{
 const s=createWorldState('coalition-save','COAL81','host','QA',91);s.phase='running';s.players[0]!.countryId='germany';s.countries.germany!.internationalThreat=90;
 for(const id of ['france','poland','aut','cze','nld','bel','che','dnk']){
  const c=s.countries[id]!;assert.ok(c);c.regionalInterests={neighbours:['germany'],partners:[],rivals:[],claimedProvinceIds:[],reviewTick:6,reason:'Border threat'};
 }
 monthlyGeopolitics(s);assert.equal(s.coalitions![0]!.members.length,8);
 assert.equal(s.diplomaticHistory!.find(e=>e.kind==='Coalition')!.countries.length,8);
 recalcEconomy(s);assert.deepEqual(decodeCampaign(encodeCampaign(s,1)).state,s);
});
