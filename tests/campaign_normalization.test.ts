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
