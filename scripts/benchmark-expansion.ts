import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createWorldState} from '../supabase/functions/_shared/worldState';
import {applyServerCommand} from '../supabase/functions/_shared/serverCommand';
import {declareWar} from '../supabase/functions/_shared/diplomacySystem';
import {mapSceneFor} from '../src/map/worldScene';
import {encodeCampaign,decodeCampaign} from '../src/persistence/campaignCodec';
const started=performance.now();let state=createWorldState('expansion-benchmark','BEN001','host','Benchmark',101);const createMs=performance.now()-started;
const sceneStarted=performance.now();mapSceneFor(state);const sceneMs=performance.now()-sceneStarted;
state.phase='running';state.speed=1;state.players[0]!.countryId='usa';declareWar(state,'germany','france');
const samples:number[]=[],persistence:number[]=[];
for(let tick=1;tick<=240;tick++){
  const start=performance.now();state=applyServerCommand(state,{type:'ADVANCE_TICK'},'host');samples.push(performance.now()-start);assert.equal(state.tick,tick);
  if(tick%60===0){const io=performance.now();const restored=decodeCampaign(encodeCampaign(state,tick)).state;persistence.push(performance.now()-io);assert.deepEqual(restored,state);state=restored;}
}
samples.sort((a,b)=>a-b);
const q=(p:number)=>samples[Math.ceil(samples.length*p)-1];
const report={protocol:'expansion-host-seed101-240-months-v1',seed:101,ticks:240,stateVersion:state.stateVersion,countries:Object.keys(state.countries).length,provinces:state.provinces.length,cities:state.cities!.length,createMs,sceneMs,tickP50Ms:q(.5),tickP95Ms:q(.95),tickP99Ms:q(.99),tickMaxMs:samples.at(-1),saveRestoreMs:persistence,snapshotBytes:Buffer.byteLength(JSON.stringify(state)),armies:state.armies.length,activeWars:state.wars!.length,spyMissions:state.spyMissions?.length??0,spyReports:state.spyReports?.length??0,spyEffects:state.spyEffects?.length??0,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss,note:'Same Node host and seed/ticks/war/persistence scenario; CPU/data only, no handset/GPU/frame-pacing claim.'};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
