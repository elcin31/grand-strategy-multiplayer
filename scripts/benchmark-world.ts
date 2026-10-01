import { performance } from 'node:perf_hooks';
import { createWorldState } from '../supabase/functions/_shared/worldState';
import { applyServerCommand } from '../supabase/functions/_shared/game';
import { mapSceneFor } from '../src/map/worldScene';
import { countryLabels } from '../src/map/scene';
const start=performance.now();let state=createWorldState('benchmark','WORLD1','host','Benchmark');const createMs=performance.now()-start;
const beforeScene=performance.now();const scene=mapSceneFor(state);const sceneMs=performance.now()-beforeScene;
const labelStart=performance.now();const labels=countryLabels(scene.features,new Map(state.provinces.map(p=>[p.id,p.ownerId])),[],{height:4},new Set(['germany','france','poland','italy','uk','esp','nld','bel','che','aut','cze']));const labelMs=performance.now()-labelStart;
const snapshotBytes=Buffer.byteLength(JSON.stringify(state));
state.players[0]!.countryId='usa';state.players[0]!.ready=true;state.phase='running';
const ticks=Number(process.argv[2]??100);if(!Number.isSafeInteger(ticks)||ticks<1||ticks>10000)throw Error('Invalid tick count');
const durations:number[]=[];
for(let i=0;i<ticks;i++){
 const before=performance.now();state=applyServerCommand(state,{type:'ADVANCE_TICK'},'host');durations.push(performance.now()-before);
 if(state.tick!==i+1)throw Error('Clock stopped');
 for(const c of Object.values(state.countries))for(const n of [c.treasury,c.income,c.population,c.manpower,c.army])if(!Number.isFinite(n)||n<0)throw Error('Invalid country value');
 if(new Set(state.armies.map(a=>a.id)).size!==state.armies.length||state.armies.some(a=>!Number.isSafeInteger(a.troops)||a.troops<=0))throw Error('Invalid armies');
 if(state.battleLog.length>20)throw Error('Unbounded battle history');
}
durations.sort((a,b)=>a-b);
console.log(JSON.stringify({countries:Object.keys(state.countries).length,provinces:state.provinces.length,cities:state.cities!.length,armies:state.armies.length,ticks:state.tick,createMs:+createMs.toFixed(2),sceneMs:+sceneMs.toFixed(2),visibleCountryLabels:labels.length,labelMs:+labelMs.toFixed(2),tickP95Ms:+durations[Math.min(ticks-1,Math.floor(ticks*.95))]!.toFixed(2),snapshotBytes,finalSnapshotBytes:Buffer.byteLength(JSON.stringify(state)),note:'CPU/data simulation only; no native FPS, networking chaos, or completed AI 2.0 claim'},null,2));
