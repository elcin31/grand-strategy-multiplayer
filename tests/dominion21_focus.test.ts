import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FOCUS_IDS,focusNode} from '../supabase/functions/_shared/focusCatalogue';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {startFocus,monthlyFocus} from '../supabase/functions/_shared/focusSystem';
import {resolveFocusChoice,startDecision,monthlyDecisions} from '../supabase/functions/_shared/politicalDecisions';
import {stock} from '../supabase/functions/_shared/stockpileSystem';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
test('120 focuses; prerequisites, exclusive paths, once-only rewards and event choices survive save',()=>{
 assert.equal(FOCUS_IDS.length,120);for(const id of FOCUS_IDS)for(const p of focusNode(id)!.prerequisites)assert.ok(focusNode(p));const s=createWorldState('focus21','FCS001','host','QA',21);s.phase='running';s.players[0]!.countryId='germany';const c=s.countries.germany!;c.treasury=20000;c.politicalPower=500;
 assert.throws(()=>startFocus(s,c.id,'eco-integration'));const complete=(id:string)=>{startFocus(s,c.id,id);for(let i=0;i<focusNode(id)!.duration;i++){s.tick++;monthlyFocus(s);}};
 for(const id of ['eco-audit','eco-procurement','eco-foundries','eco-energy','eco-transport','eco-integration'])complete(id);const cash=c.treasury;monthlyFocus(s);assert.equal(c.treasury,cash);assert.throws(()=>startFocus(s,c.id,'eco-autonomy'));assert.throws(()=>startFocus(s,c.id,'eco-audit'));
 const event=s.focusChoices!.find(e=>e.countryId===c.id)!;resolveFocusChoice(s,c,event.id,'Consensus');assert.throws(()=>resolveFocusChoice(s,c,event.id,'Consensus'));assert.ok(c.nationalSpirits!.includes('SocialCompact'));const restored=decodeCampaign(encodeCampaign(s,1)).state;assert.equal(restored.focusChoices![0]!.choice,'Consensus');assert.equal(restored.countries.germany!.completedFocuses!.length,6);
});
test('political decisions charge on start, resolve once, and retain cooldown',()=>{
 const s=createWorldState('decision','DEC001','host','QA',21);s.phase='running';const c=s.countries.germany!,before=stock(c,'food');startDecision(s,c,'FoodReserve');assert.throws(()=>startDecision(s,c,'FoodReserve'));s.tick++;monthlyDecisions(s);assert.equal(stock(c,'food'),before+40);monthlyDecisions(s);assert.equal(stock(c,'food'),before+40);assert.throws(()=>startDecision(s,c,'FoodReserve'));decodeCampaign(encodeCampaign(s,1));
});
