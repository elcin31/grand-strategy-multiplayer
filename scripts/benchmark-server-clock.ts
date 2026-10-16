import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {normalizeGameState} from '../supabase/functions/_shared/stateMigrations';
import {pumpClock} from '../supabase/functions/_shared/sessionState';
const input=createWorldState('clock-benchmark','BENCLK','host','QA',91);input.phase='running';input.speed=5;input.day=28;input.players[0]!.countryId='usa';input.players[0]!.connected=true;declareWar(input,'germany','france');normalizeGameState(input);
const timings={defensive:[] as number[],normalized:[] as number[]};
for(let trial=0;trial<10;trial++){
 const modes=trial%2?[true,false]:[false,true],results=[];
 for(const trusted of modes){const start=performance.now(),result=pumpClock(input,0,1440,trusted);const elapsed=performance.now()-start;results.push(result);if(trial>=3)timings[trusted?'normalized':'defensive'].push(elapsed);}
 assert.deepEqual(results[0],results[1]);assert.equal(results[0]!.ticks,6);assert.equal(results[0]!.state.tick,1);
}
const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]!;
const before=median(timings.defensive),after=median(timings.normalized),report={node:process.version,scene:'195 countries,2924 provinces,legal war,six-day catchup from January28 across monthly accounting',equalResults:true,defensiveMs:timings.defensive,normalizedMs:timings.normalized,medianMs:[before,after],improvement:1-after/before,note:'Local engine CPU benchmark. Persistence decoding remains mandatory once per authenticated server request; no Android FPS or deployed Edge CPU-limit claim.'};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
