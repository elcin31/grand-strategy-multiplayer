import assert from 'node:assert/strict';
import {writeFileSync,renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {applyCommand} from '../supabase/functions/_shared/gameEngine';
import {performance} from 'node:perf_hooks';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
import {assertInvariants} from '../tests/helpers/invariants';
import {populationCapacity} from '../supabase/functions/_shared/populationSystem';
const sourceRoot=dirname(dirname(fileURLToPath(import.meta.url))),sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),sourceClean=execFileSync('git',['status','--porcelain'],{cwd:sourceRoot,encoding:'utf8'}).trim()==='';
const mode=process.argv.includes('--daily')?'daily':'monthly',steps=10000;
writeFileSync('SOURCE.json',JSON.stringify({sourceSha,sourceClean,mode,steps,node:process.version},null,2));
let state=createWorldState('final-long-simulation','LONG01','host','Simulation',91);state.phase='running';state.players[0]!.countryId='usa';state.speed=1;
// Start one legal conflict so the full-world run exercises peace even if diplomacy deters new wars.
declareWar(state,'germany','france');
const initialPopulation=state.provinces.reduce((n,p)=>n+p.population,0);
const started=performance.now(),durations:number[]=[],samples:unknown[]=[],wars=new Set<string>(),ended=new Set<string>(),battles=new Set<string>();let maxArmies=state.armies.length,maxBytes=0,maxWarAge=0,restores=0,movementTicks=0;
for(let tick=1;tick<=steps;tick++){
 try{const start=performance.now();state=mode==='daily'?applyCommand(state,{type:'ADVANCE_DAY'}):applyServerCommand(state,{type:'ADVANCE_TICK'},'host');durations.push(performance.now()-start);assert.equal(mode==='daily'?state.simulationDay:state.tick,tick);
 for(const w of state.wars??[]){wars.add(w.id);maxWarAge=Math.max(maxWarAge,state.tick-w.startedTick);}for(const w of state.warHistory??[])ended.add(w.id);for(const b of state.battleLog)battles.add(b.id);if(state.movements?.some(m=>m.tick===state.tick))movementTicks++;
 maxArmies=Math.max(maxArmies,state.armies.length);
 if(tick%50===0)assertInvariants(state);
 if(tick%1000===0){const text=encodeCampaign(state,tick);writeFileSync('long-simulation-checkpoint.json.pending',text);renameSync('long-simulation-checkpoint.json.pending','long-simulation-checkpoint.json');const restored=decodeCampaign(text).state;assert.deepEqual(restored,state);state=restored;restores++;global.gc?.();const countries=Object.values(state.countries),bytes=Buffer.byteLength(JSON.stringify(state));maxBytes=Math.max(maxBytes,bytes);assert.ok(bytes<32*1024*1024,'Runaway snapshot');assert.ok(state.armies.length<100000,'Runaway armies');const population=state.provinces.reduce((n,p)=>n+p.population,0);assert.ok(population<=initialPopulation*6,'Runaway fresh-campaign demographic growth');const sample={step:tick,monthlyTick:state.tick,simulationDay:state.simulationDay,bytes,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss,armies:state.armies.length,wars:state.wars!.length,peaceCount:ended.size,bankruptCountries:countries.filter(c=>c.bankruptcyCount!>0).length,treasuryMax:Math.max(...countries.map(c=>c.treasury)),population,populationRatio:population/initialPopulation,settlementCapacity:state.provinces.reduce((n,p)=>n+(populationCapacity(p)??p.population),0),completedFocuses:countries.reduce((n,c)=>n+c.completedFocuses!.length,0),scientificDiscoveries:countries.reduce((n,c)=>n+c.scientificDiscoveries!.length,0),elapsedSeconds:Math.round((performance.now()-started)/1000)};samples.push(sample);console.log(JSON.stringify(sample));}
 }catch(error){writeFileSync('long-simulation-failure.json',JSON.stringify({step:tick,monthlyTick:state.tick,simulationDay:state.simulationDay,sourceSha,mode,error:String(error),stack:error instanceof Error?error.stack:undefined}));writeFileSync('long-simulation-failed-state.json',JSON.stringify(state));throw error;}
}
assertInvariants(state);assert.ok(ended.size>0,'AI never made peace');assert.ok(Object.values(state.countries).some(c=>Object.values(c.technologies!).some(n=>n>0)),'No research');assert.ok(Object.values(state.countries).some(c=>c.scientificDiscoveries!.length>0),'AI never completed a scientific discovery');assert.ok(Object.values(state.countries).some(c=>c.completedFocuses!.length>0),'AI never completed a national course');assert.ok(state.provinces.some(p=>Object.values(p.buildings??{}).some(n=>n>0)),'No construction');durations.sort((a,b)=>a-b);
const report={sourceSha,sourceClean,mode,steps,days:state.simulationDay,ticks:state.tick,countries:Object.keys(state.countries).length,provinces:state.provinces.length,cities:state.cities!.length,restores,warsObserved:wars.size,peaceCount:ended.size,battles:battles.size,movementTicks,maxWarAge,maxArmies,maxSnapshotBytes:maxBytes,tickP95Ms:durations[9499],samples,note:'Full-world deterministic AI simulation; seeded initial legal war, no physical device or network claim'};writeFileSync('LONG_SIMULATION_RESULTS.json',JSON.stringify(report,null,2));console.log('PASS: 10000 '+mode+' steps, invariants, ten atomic save/restore cycles');
