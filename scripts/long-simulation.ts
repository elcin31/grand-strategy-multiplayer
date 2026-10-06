import assert from 'node:assert/strict';
import {writeFileSync,renameSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
import {assertInvariants} from '../tests/helpers/invariants';
let state=createWorldState('final-long-simulation','LONG01','host','Simulation',91);state.phase='running';state.players[0]!.countryId='usa';
// Start one legal conflict so the full-world run exercises peace even if diplomacy deters new wars.
declareWar(state,'germany','france');
const started=performance.now(),durations:number[]=[],samples:unknown[]=[],wars=new Set<string>(),ended=new Set<string>(),battles=new Set<string>();let maxArmies=state.armies.length,maxBytes=0,maxWarAge=0,restores=0,movementTicks=0;
for(let tick=1;tick<=10000;tick++){
 try{const start=performance.now();state=applyServerCommand(state,{type:'ADVANCE_TICK'},'host');durations.push(performance.now()-start);assert.equal(state.tick,tick);
 for(const w of state.wars??[]){wars.add(w.id);maxWarAge=Math.max(maxWarAge,tick-w.startedTick);}for(const w of state.warHistory??[])ended.add(w.id);for(const b of state.battleLog)battles.add(b.id);if(state.movements?.some(m=>m.tick===tick))movementTicks++;
 maxArmies=Math.max(maxArmies,state.armies.length);
 if(tick%50===0)assertInvariants(state);
 if(tick%1000===0){const text=encodeCampaign(state,tick);writeFileSync('long-simulation-checkpoint.json.pending',text);renameSync('long-simulation-checkpoint.json.pending','long-simulation-checkpoint.json');const restored=decodeCampaign(text).state;assert.deepEqual(restored,state);state=restored;restores++;global.gc?.();const countries=Object.values(state.countries),bytes=Buffer.byteLength(JSON.stringify(state));maxBytes=Math.max(maxBytes,bytes);assert.ok(bytes<32*1024*1024,'Runaway snapshot');assert.ok(state.armies.length<100000,'Runaway armies');const sample={tick,bytes,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss,armies:state.armies.length,wars:state.wars!.length,peaceCount:ended.size,bankruptCountries:countries.filter(c=>c.bankruptcyCount!>0).length,treasuryMax:Math.max(...countries.map(c=>c.treasury)),elapsedSeconds:Math.round((performance.now()-started)/1000)};samples.push(sample);console.log(JSON.stringify(sample));}
 }catch(error){writeFileSync('long-simulation-failure.json',JSON.stringify({tick,error:String(error)}));throw error;}
}
assertInvariants(state);assert.ok(ended.size>0,'AI never made peace');assert.ok(Object.values(state.countries).some(c=>Object.values(c.technologies!).some(n=>n>0)),'No research');assert.ok(state.provinces.some(p=>Object.values(p.buildings??{}).some(n=>n>0)),'No construction');durations.sort((a,b)=>a-b);
const report={ticks:state.tick,countries:Object.keys(state.countries).length,provinces:state.provinces.length,cities:state.cities!.length,restores,warsObserved:wars.size,peaceCount:ended.size,battles:battles.size,movementTicks,maxWarAge,maxArmies,maxSnapshotBytes:maxBytes,tickP95Ms:durations[9499],samples,note:'Full-world deterministic AI simulation; seeded initial legal war, no physical device or network claim'};writeFileSync('LONG_SIMULATION_RESULTS.json',JSON.stringify(report,null,2));console.log('PASS: 10000 ticks, invariants, ten atomic save/restore cycles');
