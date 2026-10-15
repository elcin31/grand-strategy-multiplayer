import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {reviewStrategy} from '../supabase/functions/_shared/ai3System';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';

test('strategic intentions survive monthly reviews and save/restore, but bankruptcy interrupts them',()=>{
 const s=createWorldState('persistent-ai','AIMEM1','host','QA',91),c=s.countries.germany!;
 s.phase='running';s.tick=6;let p=reviewStrategy(s,c);const id=p.id,since=p.sinceTick;
 s.tick=7;c.treasury+=100;p=reviewStrategy(s,c);assert.equal(p.id,id);assert.equal(p.sinceTick,since);
 const restored=decodeCampaign(encodeCampaign(s,1)).state;
 assert.deepEqual(restored.countries.germany!.aiStrategy,p);
 s.tick=8;c.bankruptcyUntilTick=11;p=reviewStrategy(s,c);
 assert.equal(p.goal,'Recovery');assert.equal(p.priority,95);assert.notEqual(p.id,id);
 assert.equal(p.previousPlan!.id,id);assert.match(p.reason,/Банкротство/);
 const recovery=p.id;s.tick=9;p=reviewStrategy(s,c);assert.equal(p.id,recovery);assert.equal(p.reviewTick,14);
});
