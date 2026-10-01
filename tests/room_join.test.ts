import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinCampaign } from '../supabase/functions/_shared/roomJoin';
import { createWorldState } from '../supabase/functions/_shared/worldState';
test('fresh room admission rejects a ninth player, a started room and duplicate ids without mutation',()=> {
  let state=createWorldState('qa','JOINQA','host','Host');
  for(let i=1;i<8;i++)state=joinCampaign(state,'guest-'+i,'Guest '+i);
  const before=structuredClone(state);
  assert.throws(()=>joinCampaign(state,'guest-8','Ninth'));assert.deepEqual(state,before);
  state.players.pop();assert.throws(()=>joinCampaign(state,'guest-1','Duplicate'));
  state.phase='running';const running=structuredClone(state);
  assert.throws(()=>joinCampaign(state,'guest-8','Late'));assert.deepEqual(state,running);
});
