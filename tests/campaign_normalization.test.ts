import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {normalizeGameState} from '../supabase/functions/_shared/stateMigrations';
import {refreshWars} from '../supabase/functions/_shared/warSystem';
import {recalcEconomy} from '../supabase/functions/_shared/economySystem';
import {decodeCampaign,encodeCampaign} from '../src/persistence/campaignCodec';

test('normalizing and saving an active war preserve the last committed simulation state exactly',()=>{
  const state=createWorldState('war-save-roundtrip','SAVE01','host','QA',91);
  state.phase='running';state.players[0]!.countryId='usa';
  declareWar(state,'germany','france');
  state.countries.germany!.warExhaustion=2.7;
  recalcEconomy(state);
  // A new war or a monthly exhaustion change may precede the next score refresh.
  // Validation must not perform that simulation work or advance its cached result.
  const committed=structuredClone(state);
  normalizeGameState(state);
  assert.deepEqual(state,committed);
  assert.deepEqual(decodeCampaign(encodeCampaign(state,1)).state,committed);
  refreshWars(state);
  assert.notEqual(state.wars![0]!.warScore,committed.wars![0]!.warScore);
  const refreshed=structuredClone(state);
  normalizeGameState(state);normalizeGameState(state);
  assert.deepEqual(state,refreshed);
});

test('yearly successor generation is complete before an exact save, without normalization changing any leader',async()=>{
 const {applyServerCommand}=await import('../supabase/functions/_shared/serverCommand');
 const {AI_PERSONALITIES}=await import('../supabase/functions/_shared/aiSystem');
 let state=createWorldState('successor-save','SAVE02','host','QA',91);const before=structuredClone(state);state.phase='running';state.speed=1;state.month=12;state.players[0]!.countryId='usa';
 for(const leader of Object.values(state.leaders!))leader.age=85;
 state=applyServerCommand(state,{type:'ADVANCE_TICK'},'host');
 assert.ok(Object.values(state.countries).every(c=>c.rulerId!==before.countries[c.id]!.rulerId));
 for(const leader of Object.values(state.leaders!))assert.equal(leader.aiPersonality,AI_PERSONALITIES[leader.portraitSeed%AI_PERSONALITIES.length]);
 const expected=structuredClone(state);normalizeGameState(state);assert.deepEqual(state,expected);
 assert.deepEqual(decodeCampaign(encodeCampaign(state,1)).state,expected);
});
