import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {normalizeGameState} from '../supabase/functions/_shared/stateMigrations';
import {pumpClock} from '../supabase/functions/_shared/sessionState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
function world(){const s=createWorldState('trusted-clock','CLK230','host','QA',91);s.phase='running';s.speed=5;s.day=28;s.players[0]!.countryId='usa';s.players[0]!.connected=true;declareWar(s,'germany','france');normalizeGameState(s);return s;}
test('validated server catchup equals the defensive reducer across month boundaries and leaves its input intact',()=>{
 let safe=world(),fast=structuredClone(safe);const original=structuredClone(safe);
 for(let i=0;i<8;i++){
  const slowResult=pumpClock(safe,i*1440,(i+1)*1440),fastResult=pumpClock(fast,i*1440,(i+1)*1440,true);
  assert.deepEqual(fastResult,slowResult);safe=slowResult.state;fast=fastResult.state;
 }
 assert.ok(fast.tick>=2);assert.deepEqual(decodeCampaign(encodeCampaign(fast,1)).state,fast);assert.deepEqual(world(),original);
});
test('normalized server commands keep costs, ownership, strict payload checks and immutable results',()=>{
 const s=world(),province=s.provinces.find(p=>p.ownerId==='usa')!.id;
 const command={type:'RECRUIT',playerId:'host',provinceId:province,troops:1000} as const;
 const copy=structuredClone(s),slow=applyServerCommand(s,command,'host'),fast=applyServerCommand(s,command,'host',true);assert.deepEqual(s,copy);assert.deepEqual(slow,fast);
 for(const payload of [{...command,playerId:'other'},{...command,treasury:999999},{...command,troops:-1000},{...command,provinceId:s.provinces.find(p=>p.ownerId==='france')!.id}])assert.throws(()=>applyServerCommand(s,payload as never,'host',true));
});
